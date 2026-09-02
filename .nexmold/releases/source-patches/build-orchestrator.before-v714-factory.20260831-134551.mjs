#!/usr/bin/env node
/**
 * NEXMOLD V7.14 鈥?Production Build Orchestrator
 *
 * Production order:
 *   1. Global kill-switch / structural precheck
 *   2. V7.14 Core Gate
 *   3. Route Conflict Gate
 *   4. Typecheck / optional tests
 *   5. Clean production build
 *   6. Immutable artifact audit + HTML manifest
 *   7. Runtime Gate
 *   8. Sitemap Gate
 *   9. Release Preflight
 *  10. Advance Last-Known-Good only after every mandatory gate passes
 *
 * Fail-closed rule:
 *   Any mandatory gate failure aborts the release and MUST NOT advance LKG.
 */

import { createHash, randomUUID } from 'node:crypto';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import {
  basename,
  dirname,
  extname,
  join,
  normalize,
  relative,
  resolve,
  sep,
} from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(process.env.NEXMOLD_ROOT ?? SCRIPT_DIR);
const DIST = resolve(ROOT, 'dist');
const CONTROL = resolve(ROOT, '.nexmold');
const RELEASES = resolve(CONTROL, 'releases');
const STATE_FILE = resolve(CONTROL, 'release-state.json');
const LKG_FILE = resolve(CONTROL, 'last-known-good.json');

const BUILD_COMMAND = process.env.NEXMOLD_BUILD_COMMAND ?? 'npx astro build';
const TYPECHECK_COMMAND = process.env.NEXMOLD_TYPECHECK_COMMAND ?? 'npx astro check';
const TEST_COMMAND = process.env.NEXMOLD_TEST_COMMAND ?? 'node --experimental-strip-types tests/contracts/v714-contracts.mjs';
const HEALTH_URL = process.env.NEXMOLD_HEALTH_URL ?? '';
const HEALTH_TIMEOUT_MS = Number(process.env.NEXMOLD_HEALTH_TIMEOUT_MS ?? 8000);
const MAX_HTML_BYTES = Number(process.env.NEXMOLD_MAX_HTML_BYTES ?? 10 * 1024 * 1024);
const CLEAN_DIST = parseBoolean(process.env.NEXMOLD_CLEAN_DIST, true);
const KILL_SWITCH = parseBoolean(process.env.NEXMOLD_KILL_SWITCH, false);
const EXPECTED_HTML_MANIFEST = process.env.NEXMOLD_EXPECTED_HTML_MANIFEST
  ? resolve(ROOT, process.env.NEXMOLD_EXPECTED_HTML_MANIFEST)
  : '';
const SMOKE_ROUTES = (process.env.NEXMOLD_SMOKE_ROUTES ?? '/,/404.html,/sitemap.xml,/services/custom-injection-molding,/knowledge-hub/')
  .split(',')
  .map((x) => x.trim())
  .filter(Boolean);

const startedAt = new Date().toISOString();
const epoch = buildEpochId();
const RELEASE_DIR = resolve(RELEASES, epoch);
const BUILD_LOG = resolve(RELEASE_DIR, 'build.log');
const summary = [];

const GATES = Object.freeze({
  core: resolve(ROOT, 'scripts', 'v714-core-gate.mjs'),
  regional: resolve(ROOT, 'scripts', 'v714-regional-gate.mjs'),
  routeConflict: resolve(ROOT, 'scripts', 'route-conflict-check.mjs'),
  runtime: resolve(ROOT, 'scripts', 'runtime-gate.mjs'),
  sitemap: resolve(ROOT, 'scripts', 'sitemap-gate.mjs'),
  releasePreflight: resolve(ROOT, 'scripts', 'release-preflight.mjs'),
});

function parseBoolean(value, fallback) {
  if (value == null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

function buildEpochId() {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z');
  return `${stamp}-${process.pid}-${randomUUID().slice(0, 8)}`;
}

function log(message) {
  const line = `${new Date().toISOString()} ${message}`;
  console.log(line);
  if (existsSync(RELEASE_DIR)) appendFileSync(BUILD_LOG, `${line}\n`, 'utf8');
}

function section(label) {
  console.log(`\n=======================================================`);
  console.log(`[NEXMOLD][V7.14] ${label}`);
  console.log(`=======================================================`);
}

function pass(label, detail = '') {
  summary.push({ label, status: 'PASS', detail });
  console.log(`PASS  ${label}${detail ? ` 鈥?${detail}` : ''}`);
}

function warn(label, detail = '') {
  summary.push({ label, status: 'WARN', detail });
  console.warn(`WARN  ${label}${detail ? ` 鈥?${detail}` : ''}`);
}

function skip(label, detail = '') {
  summary.push({ label, status: 'SKIPPED', detail });
  console.warn(`SKIP  ${label}${detail ? ` 鈥?${detail}` : ''}`);
}

function fail(label, detail = '') {
  summary.push({ label, status: 'FAIL', detail });
  throw new Error(`[${label}] ${detail}`);
}

function atomicWrite(filePath, value) {
  mkdirSync(dirname(filePath), { recursive: true });
  const temp = `${filePath}.tmp-${process.pid}-${Date.now()}`;
  writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
  rmSync(filePath, { force: true });
  writeFileSync(filePath, readFileSync(temp));
  rmSync(temp, { force: true });
}

function sha256File(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function sha256Text(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function collectFiles(dir) {
  if (!existsSync(dir)) return [];
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full));
    else if (entry.isFile()) out.push(full);
  }
  return out.sort();
}

function ensureInsideRoot(target) {
  const root = normalize(ROOT + sep).toLowerCase();
  const candidate = normalize(resolve(target) + sep).toLowerCase();
  if (!candidate.startsWith(root)) {
    throw new Error(`Path escapes project root: ${target}`);
  }
}

function normalizeRouteFromHtml(relativeHtmlPath) {
  const normalized = relativeHtmlPath.split(sep).join('/');
  if (normalized === 'index.html') return '/';
  if (normalized.endsWith('/index.html')) {
    return `/${normalized.slice(0, -'/index.html'.length)}/`.replace(/\/+/g, '/');
  }
  return `/${normalized.slice(0, -'.html'.length)}`;
}

function filePathForRoute(route) {
  const clean = route.replace(/^\/+/, '');
  if (route === '/') return join(DIST, 'index.html');
  if (route.endsWith('/')) return join(DIST, clean, 'index.html');
  return join(DIST, clean);
}

async function runCommand(command, label) {
  log(`[${label}] $ ${command}`);
  return await new Promise((resolveResult, reject) => {
    const child = spawn(command, {
      cwd: ROOT,
      env: { ...process.env, NEXMOLD_BUILD_EPOCH: epoch },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    child.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (existsSync(RELEASE_DIR)) appendFileSync(BUILD_LOG, text, 'utf8');
    });
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      if (existsSync(RELEASE_DIR)) appendFileSync(BUILD_LOG, text, 'utf8');
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolveResult({ code: 0, signal });
      else reject(new Error(`${label} exited with code=${code} signal=${signal ?? 'none'}`));
    });
  });
}

function normalizeGateResult(result) {
  if (result == null) return { ok: true, detail: 'Gate returned no result; completion was successful.' };
  if (typeof result === 'boolean') return { ok: result, detail: result ? 'PASS' : 'FAIL' };
  if (typeof result === 'object') {
    if (result.ok === false || result.pass === false || result.passed === false || result.success === false) {
      return { ok: false, detail: result.detail ?? result.message ?? JSON.stringify(result) };
    }
    if (result.status === 'FAIL' || result.status === 'FAILED') {
      return { ok: false, detail: result.detail ?? result.message ?? JSON.stringify(result) };
    }
    return {
      ok: true,
      detail: result.detail ?? result.message ?? result.status ?? 'Gate completed successfully.',
    };
  }
  return { ok: true, detail: String(result) };
}

function gateContext() {
  return {
    root: ROOT,
    projectRoot: ROOT,
    dist: DIST,
    controlDir: CONTROL,
    releaseDir: RELEASE_DIR,
    releasesDir: RELEASES,
    epoch,
    buildEpoch: epoch,
  };
}

async function runExportedGate(modulePath, exportName, label) {
  ensureInsideRoot(modulePath);
  if (!existsSync(modulePath)) fail(label, `Required gate module missing: ${relative(ROOT, modulePath)}`);

  log(`[${label}] import ${relative(ROOT, modulePath)} :: ${exportName}`);
  const mod = await import(`${pathToFileURL(modulePath).href}?v714_epoch=${encodeURIComponent(epoch)}`);
  const gate = mod[exportName];
  if (typeof gate !== 'function') {
    fail(label, `Expected export ${exportName}() was not found.`);
  }

  let result;
  try {
    result = await gate(gateContext());
  } catch (error) {
    fail(label, error instanceof Error ? error.message : String(error));
  }

  const normalized = normalizeGateResult(result);
  if (!normalized.ok) fail(label, normalized.detail);
  pass(label, normalized.detail);
  return result;
}

async function runRouteConflictGate() {
  const modulePath = GATES.routeConflict;
  ensureInsideRoot(modulePath);
  if (!existsSync(modulePath)) fail('ROUTE_CONFLICT_GATE', `Required gate module missing: ${relative(ROOT, modulePath)}`);

  // route-conflict-check.mjs is intentionally allowed to execute its gate on import.
  // The current V7.14 implementation reports its result and exits only on failure.
  log(`[ROUTE_CONFLICT_GATE] import ${relative(ROOT, modulePath)}`);
  try {
    await import(`${pathToFileURL(modulePath).href}?v714_epoch=${encodeURIComponent(epoch)}`);
  } catch (error) {
    fail('ROUTE_CONFLICT_GATE', error instanceof Error ? error.message : String(error));
  }
  pass('ROUTE_CONFLICT_GATE', 'Route conflict gate completed successfully.');
}

function htmlManifest() {
  const files = collectFiles(DIST).filter((file) => extname(file).toLowerCase() === '.html');
  const entries = [];

  for (const file of files) {
    const size = statSync(file).size;
    if (size > MAX_HTML_BYTES) {
      throw new Error(`HTML file exceeds max size: ${relative(DIST, file)} (${size} bytes)`);
    }
    const rel = relative(DIST, file);
    entries.push({
      path: rel.split(sep).join('/'),
      route: normalizeRouteFromHtml(rel),
      bytes: size,
      sha256: sha256File(file),
    });
  }

  const routes = entries.map((x) => x.route);
  const duplicates = routes.filter((route, index) => routes.indexOf(route) !== index);
  if (duplicates.length) {
    throw new Error(`Duplicate rendered routes detected: ${[...new Set(duplicates)].join(', ')}`);
  }

  const canonicalList = entries.map((x) => `${x.route}|${x.path}|${x.sha256}`).sort();
  return {
    schema: 'nexmold.v7.14.html-manifest.v1',
    generatedAt: new Date().toISOString(),
    count: entries.length,
    setSha256: sha256Text(canonicalList.join('\n')),
    entries,
  };
}

function compareExpectedHtmlSet(manifest) {
  if (!EXPECTED_HTML_MANIFEST) {
    skip('GLOBAL_HTML_SET_EQUALITY', 'No expected HTML manifest configured. Current set is recorded but equality is not asserted.');
    return;
  }
  if (!existsSync(EXPECTED_HTML_MANIFEST)) {
    fail('GLOBAL_HTML_SET_EQUALITY', `Expected manifest not found: ${EXPECTED_HTML_MANIFEST}`);
  }

  let expected;
  try {
    expected = JSON.parse(readFileSync(EXPECTED_HTML_MANIFEST, 'utf8'));
  } catch (error) {
    fail('GLOBAL_HTML_SET_EQUALITY', `Cannot parse expected manifest: ${error instanceof Error ? error.message : String(error)}`);
  }

  const expectedRoutes = [...new Set((expected.entries ?? []).map((x) => x.route))].sort();
  const currentRoutes = [...new Set(manifest.entries.map((x) => x.route))].sort();
  if (sha256Text(expectedRoutes.join('\n')) !== sha256Text(currentRoutes.join('\n'))) {
    const missing = expectedRoutes.filter((x) => !currentRoutes.includes(x));
    const unexpected = currentRoutes.filter((x) => !expectedRoutes.includes(x));
    fail(
      'GLOBAL_HTML_SET_EQUALITY',
      `Route-set mismatch. missing=${missing.slice(0, 20).join(', ') || 'none'} unexpected=${unexpected.slice(0, 20).join(', ') || 'none'}`,
    );
  }
  pass('GLOBAL_HTML_SET_EQUALITY', `Route set matches expected manifest (${currentRoutes.length} routes).`);
}

function detectForbiddenArtifacts() {
  const forbiddenNames = new Set([
    '.env', '.env.local', '.env.production', '.env.development',
    'id_rsa', 'id_ed25519', '.npmrc',
  ]);
  const hits = collectFiles(DIST).filter((file) => forbiddenNames.has(basename(file).toLowerCase()));
  if (hits.length) {
    fail('ARTIFACT_SECRETS', `Forbidden runtime artifacts in dist: ${hits.map((x) => relative(DIST, x)).join(', ')}`);
  }
  pass('ARTIFACT_SECRETS', 'No forbidden secret/config artifacts found in dist.');
}

function detectMalformedHtml(manifest) {
  for (const entry of manifest.entries) {
    const file = join(DIST, entry.path);
    const html = readFileSync(file, 'utf8');
    if (!/^\s*<!doctype html>/i.test(html)) warn('HTML_DOCTYPE', `Missing explicit <!doctype html>: ${entry.path}`);
    if (!/<html\b/i.test(html) || !/<\/html>/i.test(html)) {
      fail('HTML_INTEGRITY', `Malformed HTML shell: ${entry.path}`);
    }
  }
  pass('HTML_INTEGRITY', `Validated ${manifest.count} rendered HTML files.`);
}

function smokeRoutes() {
  for (const route of SMOKE_ROUTES) {
    const target = filePathForRoute(route);
    ensureInsideRoot(target);
    if (!existsSync(target)) {
      fail('STATIC_SMOKE', `Missing smoke route artifact: ${route} -> ${relative(ROOT, target)}`);
    }
  }
  pass('STATIC_SMOKE', `Validated ${SMOKE_ROUTES.length} local route artifacts.`);
}

async function httpHealthCheck() {
  if (!HEALTH_URL) {
    skip('CDN_HEALTH', 'NEXMOLD_HEALTH_URL not configured; no remote health claim was made.');
    return;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const response = await fetch(HEALTH_URL, {
      method: 'GET',
      redirect: 'manual',
      signal: controller.signal,
      headers: { 'user-agent': 'NEXMOLD-V7.14-Orchestrator/1.0' },
    });
    if (response.status >= 500) fail('CDN_HEALTH', `Health URL returned HTTP ${response.status}.`);
    if (response.status >= 400) {
      warn('CDN_HEALTH', `Health URL returned HTTP ${response.status}.`);
      return;
    }
    pass('CDN_HEALTH', `HTTP ${response.status} health check passed.`);
  } finally {
    clearTimeout(timeout);
  }
}

function writeReleaseState(status, extra = {}) {
  atomicWrite(STATE_FILE, {
    schema: 'nexmold.v7.14.release-state.v1',
    status,
    epoch,
    startedAt,
    finishedAt: new Date().toISOString(),
    projectRoot: ROOT,
    dist: DIST,
    summary,
    ...extra,
  });
}

async function main() {
  console.log('=======================================================');
  console.log('[NEXMOLD][V7.14] PRODUCTION BUILD ORCHESTRATOR');
  console.log('=======================================================');
  console.log(`Epoch: ${epoch}`);
  console.log(`Root : ${ROOT}`);
  console.log(`Dist : ${DIST}`);

  mkdirSync(RELEASE_DIR, { recursive: true });
  writeFileSync(BUILD_LOG, '', 'utf8');

  ensureInsideRoot(ROOT);
  ensureInsideRoot(DIST);
  ensureInsideRoot(CONTROL);

  if (KILL_SWITCH) {
    writeReleaseState('KILLED', { reason: 'NEXMOLD_KILL_SWITCH=true' });
    fail('GLOBAL_KILL_SWITCH', 'Release blocked by NEXMOLD_KILL_SWITCH=true.');
  }
  pass('GLOBAL_KILL_SWITCH', 'OFF');

  section('PRECHECK');
  for (const file of ['package.json', 'astro.config.mjs']) {
    if (!existsSync(resolve(ROOT, file))) fail('PRECHECK', `Required project file missing: ${file}`);
  }
  pass('PRECHECK', 'Required project structure present.');

  section('V7.14_CORE_GATE');
  await runExportedGate(GATES.core, 'runV714CoreGate', 'V714_CORE_GATE');

  section('V7.14_REGIONAL_PRODUCTION_GATE');
  await runExportedGate(GATES.regional, 'runV714RegionalGate', 'V714_REGIONAL_PRODUCTION_GATE');

  section('ROUTE_CONFLICT_GATE');
  await runRouteConflictGate();

  section('AUDIT');
  await runCommand(TYPECHECK_COMMAND, 'TYPECHECK');
  pass('TYPE_CONTRACTS', 'Type contracts verified.');

  if (TEST_COMMAND.trim()) {
    await runCommand(TEST_COMMAND, 'TEST');
    pass('CONTRACT_TESTS', 'Configured test suite passed.');
  } else {
    skip('CONTRACT_TESTS', 'NEXMOLD_TEST_COMMAND is not configured.');
  }

  section('EPOCH');
  if (CLEAN_DIST && existsSync(DIST)) {
    rmSync(DIST, { recursive: true, force: true });
    log('[EPOCH] Existing dist removed before build.');
  }
  mkdirSync(RELEASE_DIR, { recursive: true });
  pass('EPOCH', `Build epoch ${epoch} created.`);

  section('BUILD');
  await runCommand(BUILD_COMMAND, 'BUILD');
  if (!existsSync(DIST)) fail('BUILD', 'Build completed but dist directory is missing.');
  pass('BUILD', 'Production static build completed.');

  section('ARTIFACT_AUDIT');
  const manifest = htmlManifest();
  atomicWrite(resolve(RELEASE_DIR, 'html-manifest.json'), manifest);
  pass('HTML_MANIFEST', `Recorded ${manifest.count} HTML artifacts; setSha256=${manifest.setSha256}`);
  detectForbiddenArtifacts();
  detectMalformedHtml(manifest);
  compareExpectedHtmlSet(manifest);
  smokeRoutes();
  await httpHealthCheck();

  section('V7.14_POST_BUILD_GATES');
  await runExportedGate(GATES.runtime, 'runRuntimeGate', 'RUNTIME_GATE');
  await runExportedGate(GATES.sitemap, 'runSitemapGate', 'SITEMAP_GATE');

  section('RELEASE_PREFLIGHT');
  await runExportedGate(GATES.releasePreflight, 'runReleasePreflight', 'RELEASE_PREFLIGHT');

  section('RELEASE');
  const releaseManifest = {
    schema: 'nexmold.v7.14.release-manifest.v1',
    status: 'VERIFIED',
    epoch,
    startedAt,
    finishedAt: new Date().toISOString(),
    projectRoot: ROOT,
    dist: DIST,
    buildCommand: BUILD_COMMAND,
    typecheckCommand: TYPECHECK_COMMAND,
    testCommand: TEST_COMMAND || null,
    healthUrl: HEALTH_URL || null,
    htmlManifest: `releases/${epoch}/html-manifest.json`,
    htmlSetSha256: manifest.setSha256,
    htmlCount: manifest.count,
    gates: summary,
    productionWiring: {
      version: 'V7.14',
      coreGate: 'scripts/v714-core-gate.mjs#runV714CoreGate',
      regionalProductionGate: 'scripts/v714-regional-gate.mjs#runV714RegionalGate',
      canonicalChain: 'Evidence -> Claim -> Eligibility -> Firewall -> RegionalPublishArtifact -> PublicationGate -> Projection',
      routeConflictGate: 'scripts/route-conflict-check.mjs',
      runtimeGate: 'scripts/runtime-gate.mjs#runRuntimeGate',
      sitemapGate: 'scripts/sitemap-gate.mjs#runSitemapGate',
      releasePreflight: 'scripts/release-preflight.mjs#runReleasePreflight',
    },
  };

  atomicWrite(resolve(RELEASE_DIR, 'manifest.json'), releaseManifest);

  // CRITICAL: LKG advances only here, after every mandatory gate has passed.
  atomicWrite(LKG_FILE, {
    schema: 'nexmold.v7.14.last-known-good.v1',
    epoch,
    verifiedAt: new Date().toISOString(),
    releaseManifest: `releases/${epoch}/manifest.json`,
    htmlSetSha256: manifest.setSha256,
    htmlCount: manifest.count,
  });

  writeReleaseState('VERIFIED', {
    releaseManifest: `releases/${epoch}/manifest.json`,
    publicArtifactImpact: 0,
  });

  console.log('');
  console.log('=======================================================');
  console.log('[NEXMOLD][V7.14] FROZEN & VERIFIED');
  console.log('=======================================================');
  console.log(`Release epoch : ${epoch}`);
  console.log(`HTML artifacts : ${manifest.count}`);
  console.log(`HTML set hash  : ${manifest.setSha256}`);
  console.log(`LKG            : ${LKG_FILE}`);
}

export { main as runBuildOrchestrator };

main().catch((error) => {
  try {
    writeReleaseState('FAILED', {
      error: error instanceof Error ? error.message : String(error),
      lkgAdvanced: false,
    });
  } catch {
    // Preserve the original failure.
  }
  console.error(`\n[NEXMOLD][V7.14][RELEASE] FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});

