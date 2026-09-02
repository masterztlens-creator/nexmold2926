#!/usr/bin/env node
/**
 * V7.14 adversarial harness.
 * It intentionally probes bypass paths without modifying the application.
 */
import fs from 'node:fs';
import path from 'node:path';
import { runRuntimeGate } from '../../scripts/runtime-gate.mjs';
import { runSitemapGate } from '../../scripts/sitemap-gate.mjs';
import { runReleasePreflight } from '../../scripts/release-preflight.mjs';
import { runRouteConflictCheck } from '../../scripts/route-conflict-check.mjs';

const root = path.resolve(process.cwd());
const results = [];
function expectBlock(name, fn) {
  try { fn(); results.push({ name, passed: false, detail: 'Expected block did not occur' }); }
  catch { results.push({ name, passed: true }); }
}
function expectPass(name, fn) {
  try { fn(); results.push({ name, passed: true }); }
  catch (e) { results.push({ name, passed: false, detail: e instanceof Error ? e.message : String(e) }); }
}

expectPass('runtime-default', () => runRuntimeGate({ NODE_ENV: 'development', NEXMOLD_OUTPUT: 'static' }));
expectBlock('production-bypass', () => runRuntimeGate({ NODE_ENV: 'production', NEXMOLD_RUNTIME_MODE: 'production', NEXMOLD_OUTPUT: 'static', NEXMOLD_BYPASS_GATES: 'true' }));
expectPass('sitemap-source', () => runSitemapGate(root));
expectPass('release-preflight', () => runReleasePreflight(root));
expectPass('route-conflict-current-tree', () => runRouteConflictCheck(root));

const sourceChecks = [
  ['artifact-factory-present', fs.existsSync(path.join(root, 'src/regional/regionalPublishArtifact.ts'))],
  ['regional-preflight-present', fs.existsSync(path.join(root, 'src/regional/releasePreflight.ts'))],
  ['core-gate-present', fs.existsSync(path.join(root, 'scripts/v714-core-gate.mjs'))],
  ['orchestrator-wires-runtime', /runtime-gate\.mjs/.test(fs.readFileSync(path.join(root, 'build-orchestrator.mjs'), 'utf8'))],
  ['orchestrator-wires-route-gate', /route-conflict-check\.mjs/.test(fs.readFileSync(path.join(root, 'build-orchestrator.mjs'), 'utf8'))],
];
for (const [name, passed] of sourceChecks) results.push({ name, passed });

const failed = results.filter((x) => !x.passed);
console.log(JSON.stringify({ schema: 'nexmold.v7.14.adversarial.v1', passed: failed.length === 0, total: results.length, failed: failed.length, results }, null, 2));
process.exitCode = failed.length ? 1 : 0;

