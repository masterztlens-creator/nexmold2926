import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const factoryDir = path.join(root, '.nexmold', 'content-factory', 'batch-01-v3');
const distDir = path.join(root, 'dist');
const reportFile = path.join(factoryDir, 'production-report.json');

const EXPECTED_PREFIX = '/industries/v714/';
const EXPECTED_ORIGIN = 'https://www.nexmold.com';
const EXPECTED_SCHEMA = 'nexmold.v7.14.html-lineage.v1';
const EXPECTED_METADATA_SCHEMA = 'nexmold.v7.14.article-contract.v2';
const EXPECTED_PRODUCER = 'v714-article-producer';

function fail(message) {
  throw new Error(`[V7.14 HTML LINEAGE] FAIL — ${message}`);
}

function sha256(value) {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (error) {
    fail(`invalid JSON: ${path.relative(root, file)}: ${error.message}`);
  }
}

function attr(html, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*["']([^"']*)["']`, 'i');
  return html.match(re)?.[1] ?? null;
}

function canonicalHref(html) {
  const links = html.match(/<link\b[^>]*>/gi) ?? [];
  for (const link of links) {
    const rel = attr(link, 'rel');
    if (!rel) continue;
    const relTokens = rel.toLowerCase().split(/\s+/).filter(Boolean);
    if (!relTokens.includes('canonical')) continue;
    return attr(link, 'href');
  }
  return null;
}
function textContent(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

if (!fs.existsSync(reportFile)) fail('production-report.json missing');
if (!fs.existsSync(distDir)) fail('dist/ missing — run npm run v714:build first');

const report = readJson(reportFile);
const results = Array.isArray(report.results) ? report.results : [];
if (results.length !== 20) fail(`expected 20 production report results, got ${results.length}`);

const resultBySlug = new Map();
for (const item of results) {
  const slug = String(item.slug ?? item.targetSlug ?? '').trim();
  if (!slug) fail('production report contains an item without slug');
  if (resultBySlug.has(slug)) fail(`duplicate report slug: ${slug}`);
  resultBySlug.set(slug, item);
}

const metadataFiles = fs.readdirSync(factoryDir)
  .filter((name) => name.endsWith('.json') && name !== 'production-report.json')
  .sort();
if (metadataFiles.length !== 20) fail(`expected 20 artifact metadata files, got ${metadataFiles.length}`);

let passed = 0;
const seenHtml = new Set();

for (const file of metadataFiles) {
  const slug = file.slice(0, -5);
  const metadata = readJson(path.join(factoryDir, file));
  const reportItem = resultBySlug.get(slug);
  if (!reportItem) fail(`${slug}: missing production report item`);

  const route = `${EXPECTED_PREFIX}${slug}/`;
  const htmlFile = path.join(distDir, ...route.split('/').filter(Boolean), 'index.html');
  if (!fs.existsSync(htmlFile)) fail(`${slug}: final HTML missing at ${path.relative(root, htmlFile)}`);
  seenHtml.add(path.resolve(htmlFile));

  const html = fs.readFileSync(htmlFile, 'utf8');
  const artifact = metadata.artifact;
  if (!artifact || typeof artifact !== 'object') fail(`${slug}: artifact missing`);

  const checks = [
    [metadata.schema === EXPECTED_METADATA_SCHEMA, 'metadata schema mismatch'],
    [metadata.producerVersion === EXPECTED_PRODUCER, 'producer version mismatch'],
    [metadata.targetSlug === slug, 'targetSlug mismatch'],
    [metadata.route === route, 'metadata route mismatch'],
    [metadata.canonicalUrl === artifact.canonicalUrl, 'metadata/artifact canonical mismatch'],
    [metadata.canonicalUrl === `${EXPECTED_ORIGIN}${route}`, 'canonical URL mismatch'],
    [reportItem.route === route, 'report route mismatch'],
    [reportItem.pageContentHash === artifact.pageContentHash, 'report/artifact hash mismatch'],
    [reportItem.articleId === metadata.articleId, 'report/articleId mismatch'],
    [reportItem.canonicalUrl === artifact.canonicalUrl, 'report/artifact canonical mismatch'],
    [metadata.production?.publishedArtifact === true, 'publishedArtifact flag is not true'],
    [metadata.production?.automaticPublication === false, 'automaticPublication flag is not false'],
  ];
  for (const [ok, reason] of checks) if (!ok) fail(`${slug}: ${reason}`);

  const lineageEl = html.match(/<script[^>]*id=["']v714-publication-lineage["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!lineageEl) fail(`${slug}: v714-publication-lineage script missing`);

  let lineage;
  try {
    lineage = JSON.parse(lineageEl[1]);
  } catch (error) {
    fail(`${slug}: lineage JSON invalid: ${error.message}`);
  }

  const lineageChecks = [
    [lineage.schema === EXPECTED_SCHEMA, 'lineage schema mismatch'],
    [lineage.route === route, 'lineage route mismatch'],
    [lineage.routeHash === artifact.pageContentHash, 'routeHash != artifact.pageContentHash'],
    [lineage.artifactHash === artifact.pageContentHash, 'artifactHash != artifact.pageContentHash'],
    [lineage.canonicalUrl === artifact.canonicalUrl, 'lineage canonical mismatch'],
    [lineage.publicationStatus === 'AUTHORIZED', 'publicationStatus is not AUTHORIZED'],
    [lineage.factoryRun === metadata.factoryRun, 'factoryRun mismatch'],
    [lineage.articleId === metadata.articleId, 'articleId mismatch'],
    [lineage.producerVersion === metadata.producerVersion, 'producerVersion mismatch'],
    [lineage.metadataSchema === metadata.schema, 'metadataSchema mismatch'],
  ];
  for (const [ok, reason] of lineageChecks) if (!ok) fail(`${slug}: ${reason}`);

  const canonical = canonicalHref(html);
  if (canonical !== artifact.canonicalUrl) fail(`${slug}: HTML canonical mismatch (${canonical})`);

  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim() ?? '';
  if (!title) fail(`${slug}: HTML title missing`);

  const hashOccurrences = (html.match(new RegExp(artifact.pageContentHash, 'g')) || []).length;
  if (hashOccurrences < 2) fail(`${slug}: artifact hash appears fewer than 2 times in final HTML (${hashOccurrences})`);

  if (!html.includes(`Article ID:`) || !html.includes(String(metadata.articleId))) {
    fail(`${slug}: Article ID provenance missing from final HTML`);
  }
  if (!html.includes('Publication Gate') || !html.includes('Evidence → Claim → Firewall')) {
    fail(`${slug}: publication provenance marker missing from final HTML`);
  }

  const bodyText = textContent(html);
  if (bodyText.length < 500) fail(`${slug}: final HTML body appears unexpectedly empty (${bodyText.length} chars)`);

  passed += 1;
  console.log(`PASS ${String(passed).padStart(2, '0')}/20 ${route} :: artifactHash=${artifact.pageContentHash}`);
}

const v714HtmlFiles = [];
function walk(dir) {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) walk(full);
    else if (name === 'index.html' && full.includes(`${path.sep}industries${path.sep}v714${path.sep}`)) v714HtmlFiles.push(path.resolve(full));
  }
}
walk(path.join(distDir, 'industries', 'v714'));
if (v714HtmlFiles.length !== 21) fail(`expected 21 V7.14 HTML files including index, found ${v714HtmlFiles.length}`);
if (seenHtml.size !== 20) fail(`expected exactly 20 article HTML files to be matched, got ${seenHtml.size}`);

console.log('------------------------------------------------------------');
console.log('V714_PUBLIC_ARTIFACTS=20');
console.log('V714_FINAL_HTML_ARTICLES=20');
console.log('V714_ARTIFACT_HTML_ONE_TO_ONE=PASS');
console.log('V714_METADATA_CANONICAL=PASS');
console.log('V714_PUBLICATION_GATE_STATE=AUTHORIZED');
console.log('V714_ROUTE_HASH_EQUALS_ARTIFACT_HASH=PASS');
console.log('V714_HTML_LINEAGE_VERIFICATION=PASS');
