import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * NEXMOLD V7.14 — 20-PAGE CONTENT PROJECTION AUDIT
 *
 * READ-ONLY VERIFIER.
 * This file intentionally does not modify production source, factory output,
 * metadata, dist/, release state, or any V7.14 runtime artifact.
 *
 * Checks per article:
 *   Artifact -> HTML
 *   Metadata
 *   Publication Gate
 *   Route Hash
 *   Canonical
 *   Title / H1
 *   Engineering Content Projection
 *   FAQ
 *   JSON-LD
 *   CTA
 *   No orphan / stale projection
 *
 * Run after a successful production build:
 *   node verification/v714-content-projection-audit.mjs
 */

const root = process.cwd();
const factoryDir = path.join(root, '.nexmold', 'content-factory', 'batch-01-v3');
const distDir = path.join(root, 'dist');
const reportFile = path.join(factoryDir, 'production-report.json');

const ROUTE_PREFIX = '/industries/v714/';
const ORIGIN = 'https://www.nexmold.com';
const METADATA_SCHEMA = 'nexmold.v7.14.article-contract.v2';
const PRODUCER = 'v714-article-producer';
const LINEAGE_SCHEMA = 'nexmold.v7.14.html-lineage.v1';
const EXPECTED_ARTICLES = 20;

const ENGINEERING_HEADINGS = [
  'Engineering Fundamentals',
  'Design Criteria',
  'Recommended Specifications',
  'Engineering Decision Matrix',
  'Failure Modes and Root Causes',
  'Troubleshooting and Corrective Action',
];

function fail(message) {
  console.error(`V7.14_FINAL_CONTENT_PROJECTION=FAIL`);
  throw new Error(`[V7.14 CONTENT PROJECTION] ${message}`);
}

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch (error) {
    fail(`cannot read ${path.relative(root, file)}: ${error.message}`);
  }
}

function readJson(file) {
  try {
    return JSON.parse(readText(file));
  } catch (error) {
    fail(`invalid JSON ${path.relative(root, file)}: ${error.message}`);
  }
}

function isRecord(value) {
  return value && typeof value === 'object' && !Array.isArray(value);
}

function attr(html, name) {
  const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return html.match(new RegExp(`(?:^|\\s)${escaped}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1] ?? null;
}

function canonicalHref(html) {
  for (const link of html.match(/<link\b[^>]*>/gi) ?? []) {
    const rel = attr(link, 'rel');
    if (!rel) continue;
    if (rel.toLowerCase().split(/\s+/).includes('canonical')) return attr(link, 'href');
  }
  return null;
}

function decodeHtml(value) {
  return String(value)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function textContent(html) {
  return decodeHtml(html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim());
}

function stripMarkdown(value) {
  return value
    .replace(/^---[\s\S]*?---\s*/m, '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^]]*\]\([^)]*\)/g, ' ')
    .replace(/\[[^]]*\]\([^)]*\)/g, ' ')
    .replace(/[#>*_~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function markdownFrontmatter(markdown) {
  const match = markdown.match(/^---\s*\n([\s\S]*?)\n---\s*/);
  const out = {};
  if (!match) return out;
  for (const line of match[1].split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    out[m[1]] = value;
  }
  return out;
}

function markdownHeadings(markdown) {
  return [...markdown.matchAll(/^#{2,4}\s+(.+?)\s*$/gm)]
    .map((m) => m[1].replace(/[#*_`]/g, '').trim())
    .filter(Boolean);
}

function headingSetFromHtml(html) {
  return [...html.matchAll(/<h([1-4])[^>]*>([\s\S]*?)<\/h\1>/gi)]
    .map((m) => textContent(m[2]))
    .filter(Boolean);
}

function jsonLdBlocks(html) {
  return [...html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((m) => {
      try { return JSON.parse(m[1]); } catch { return null; }
    })
    .filter(Boolean);
}

function lineageObject(html) {
  const match = html.match(/<script[^>]*id=["']v714-publication-lineage["'][^>]*>([\s\S]*?)<\/script>/i);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function countRegex(html, regex) {
  return [...html.matchAll(regex)].length;
}

function routeHtmlFile(slug) {
  return path.join(distDir, ...`${ROUTE_PREFIX}${slug}/`.split('/').filter(Boolean), 'index.html');
}

function collectFiles(dir, predicate, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) collectFiles(full, predicate, out);
    else if (predicate(full, name)) out.push(full);
  }
  return out;
}

if (!fs.existsSync(factoryDir)) fail('batch-01-v3 factory directory missing');
if (!fs.existsSync(reportFile)) fail('production-report.json missing');
if (!fs.existsSync(distDir)) fail('dist/ missing — run the production build first');

const report = readJson(reportFile);
const reportResults = Array.isArray(report.results) ? report.results : [];
if (reportResults.length !== EXPECTED_ARTICLES) {
  fail(`expected ${EXPECTED_ARTICLES} production report results, got ${reportResults.length}`);
}

const reportBySlug = new Map();
for (const item of reportResults) {
  const slug = String(item?.slug ?? item?.targetSlug ?? '').trim();
  if (!slug) fail('production report contains an item without slug');
  if (reportBySlug.has(slug)) fail(`duplicate production report slug: ${slug}`);
  reportBySlug.set(slug, item);
}

const metadataFiles = fs.readdirSync(factoryDir)
  .filter((name) => name.endsWith('.json') && name !== 'production-report.json')
  .sort();
if (metadataFiles.length !== EXPECTED_ARTICLES) {
  fail(`expected ${EXPECTED_ARTICLES} metadata files, got ${metadataFiles.length}`);
}

const metadataSlugs = new Set(metadataFiles.map((name) => name.slice(0, -5)));
const reportSlugs = new Set(reportBySlug.keys());
for (const slug of metadataSlugs) if (!reportSlugs.has(slug)) fail(`metadata/report orphan: ${slug}`);
for (const slug of reportSlugs) if (!metadataSlugs.has(slug)) fail(`report/metadata orphan: ${slug}`);

const counters = {
  artifactHtml: 0,
  metadata: 0,
  publicationGate: 0,
  routeHash: 0,
  canonical: 0,
  titleH1: 0,
  engineering: 0,
  faq: 0,
  jsonLd: 0,
  cta: 0,
  noOrphanStale: 0,
};

const seenHtml = new Set();

for (const file of metadataFiles) {
  const slug = file.slice(0, -5);
  const metadata = readJson(path.join(factoryDir, file));
  const reportItem = reportBySlug.get(slug);
  const artifact = metadata?.artifact;
  if (!isRecord(artifact)) fail(`${slug}: artifact missing`);

  const route = `${ROUTE_PREFIX}${slug}/`;
  const htmlFile = routeHtmlFile(slug);
  if (!fs.existsSync(htmlFile)) fail(`${slug}: HTML missing at ${path.relative(root, htmlFile)}`);
  const html = readText(htmlFile);
  seenHtml.add(path.resolve(htmlFile));

  const sourceMarkdownFile = path.join(factoryDir, `${slug}.md`);
  if (!fs.existsSync(sourceMarkdownFile)) fail(`${slug}: source markdown missing`);
  const markdown = readText(sourceMarkdownFile);
  const fm = markdownFrontmatter(markdown);
  const bodyText = stripMarkdown(markdown);
  const htmlText = textContent(html);

  // 1. Artifact -> HTML
  if (metadata.targetSlug !== slug || metadata.route !== route) fail(`${slug}: metadata route/slug mismatch`);
  if (reportItem.route !== route) fail(`${slug}: report route mismatch`);
  if (reportItem.pageContentHash !== artifact.pageContentHash) fail(`${slug}: report/artifact hash mismatch`);
  if (!html.includes(String(artifact.pageContentHash))) fail(`${slug}: artifact hash absent from final HTML`);
  counters.artifactHtml += 1;

  // 2. Metadata
  if (metadata.schema !== METADATA_SCHEMA) fail(`${slug}: metadata schema mismatch`);
  if (metadata.producerVersion !== PRODUCER) fail(`${slug}: producer version mismatch`);
  if (metadata.articleId !== reportItem.articleId) fail(`${slug}: articleId mismatch`);
  if (metadata.canonicalUrl !== artifact.canonicalUrl) fail(`${slug}: metadata/artifact canonical mismatch`);
  counters.metadata += 1;

  // 3. Publication Gate
  if (metadata.production?.publishedArtifact !== true) fail(`${slug}: publishedArtifact !== true`);
  if (metadata.production?.automaticPublication !== false) fail(`${slug}: automaticPublication !== false`);
  if (metadata.publicationAuthorization?.eligibility?.status !== 'ELIGIBLE') fail(`${slug}: eligibility is not ELIGIBLE`);
  if (metadata.publicationAuthorization?.eligibility?.compliance !== 'VERIFIED') fail(`${slug}: eligibility compliance is not VERIFIED`);
  if (metadata.publicationAuthorization?.firewall?.ok !== true) fail(`${slug}: publication firewall not OK`);
  const lineage = lineageObject(html);
  if (!lineage || lineage.publicationStatus !== 'AUTHORIZED') fail(`${slug}: HTML publication status is not AUTHORIZED`);
  counters.publicationGate += 1;

  // 4. Route Hash
  if (lineage.routeHash !== artifact.pageContentHash) fail(`${slug}: lineage routeHash mismatch`);
  if (lineage.artifactHash !== artifact.pageContentHash) fail(`${slug}: lineage artifactHash mismatch`);
  counters.routeHash += 1;

  // 5. Canonical
  const expectedCanonical = `${ORIGIN}${route}`;
  if (artifact.canonicalUrl !== expectedCanonical) fail(`${slug}: artifact canonical mismatch`);
  if (canonicalHref(html) !== expectedCanonical) fail(`${slug}: HTML canonical mismatch`);
  if (lineage.canonicalUrl !== expectedCanonical) fail(`${slug}: lineage canonical mismatch`);
  counters.canonical += 1;

  // 6. Title / H1
  const title = decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim();
  const h1 = textContent(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? '').trim();
  const expectedTitle = String(fm.title ?? '').trim();
  if (!title) fail(`${slug}: title missing`);
  if (!h1) fail(`${slug}: H1 missing`);
  if (expectedTitle && h1 !== expectedTitle) fail(`${slug}: H1 != source title`);
  if (expectedTitle && title !== `${expectedTitle} | NEXMOLD`) fail(`${slug}: title != source title + suffix`);
  counters.titleH1 += 1;

  // 7. Engineering Content Projection
  if (bodyText.length < 1500) fail(`${slug}: source engineering body unexpectedly short`);
  if (htmlText.length < 1200) fail(`${slug}: projected HTML text unexpectedly short`);
  const htmlHeadings = headingSetFromHtml(html);
  const sourceHeadings = markdownHeadings(markdown);
  const meaningfulEngineering = sourceHeadings.filter((heading) => ENGINEERING_HEADINGS.includes(heading));
  if (meaningfulEngineering.length < 3) fail(`${slug}: source lacks minimum engineering heading set`);
  const missingHeadings = meaningfulEngineering.filter((heading) => !htmlHeadings.includes(heading));
  if (missingHeadings.length) fail(`${slug}: engineering headings not projected: ${missingHeadings.join(', ')}`);
  const projectionRatio = Math.min(1, htmlText.length / Math.max(1, bodyText.length));
  if (projectionRatio < 0.55) fail(`${slug}: projected text ratio too low (${projectionRatio.toFixed(2)})`);
  if (!html.includes('Engineering Answer')) fail(`${slug}: Engineering Answer projection missing`);
  if (!html.includes('Engineering Contents')) fail(`${slug}: Engineering Contents projection missing`);
  counters.engineering += 1;

  // 8. FAQ
  const faqSourceIndex = markdown.search(/^##\s+(?:FAQ|Frequently Asked Questions)\s*$/im);
  if (faqSourceIndex < 0) fail(`${slug}: source FAQ section missing`);
  const faqSource = markdown.slice(faqSourceIndex);
  const faqQuestions = [...faqSource.matchAll(/^###\s+(.+?)\s*$/gm)].map((m) => m[1].trim()).filter(Boolean);
  if (faqQuestions.length < 2) fail(`${slug}: source FAQ has fewer than 2 questions`);
  const detailsCount = countRegex(html, /<details\b[^>]*class=["'][^"']*wp-faq-item[^"']*["'][^>]*>/gi);
  if (detailsCount !== faqQuestions.length) fail(`${slug}: FAQ projection count ${detailsCount} != source ${faqQuestions.length}`);
  for (const question of faqQuestions) {
    if (!html.includes(question)) fail(`${slug}: FAQ question not projected: ${question}`);
  }
  counters.faq += 1;

  // 9. JSON-LD
  const ld = jsonLdBlocks(html);
  if (ld.length < 1) fail(`${slug}: JSON-LD missing`);
  const webPage = ld.find((x) => x?.['@type'] === 'WebPage');
  if (!webPage) fail(`${slug}: WebPage JSON-LD missing`);
  if (webPage.url !== expectedCanonical) fail(`${slug}: WebPage JSON-LD url mismatch`);
  if (webPage.name !== title) fail(`${slug}: WebPage JSON-LD name != title`);
  counters.jsonLd += 1;

  // 10. CTA — header/global CTA is part of every MainLayout projection.
  const cta = /Get\s+24h\s+DFM\s*&\s*Quote|Get\s+Quote|Request\s+(?:a\s+)?Quote|Contact\s+Us/i.test(html);
  const ctaHref = /href=["'][^"']*(?:#rfq|contact|quote)[^"']*["']/i.test(html);
  if (!cta && !ctaHref) fail(`${slug}: CTA projection missing`);
  counters.cta += 1;

  // 11. No orphan / stale projection
  if (lineage.schema !== LINEAGE_SCHEMA) fail(`${slug}: lineage schema mismatch`);
  if (lineage.route !== route) fail(`${slug}: lineage route mismatch`);
  if (lineage.factoryRun !== metadata.factoryRun) fail(`${slug}: stale factoryRun projection`);
  if (lineage.articleId !== metadata.articleId) fail(`${slug}: stale articleId projection`);
  if (lineage.producerVersion !== metadata.producerVersion) fail(`${slug}: stale producer projection`);
  if (lineage.metadataSchema !== metadata.schema) fail(`${slug}: stale metadata schema projection`);
  if (seenHtml.size !== counters.artifactHtml) fail(`${slug}: duplicate HTML projection detected`);
  counters.noOrphanStale += 1;

  console.log(`PASS ${String(counters.artifactHtml).padStart(2, '0')}/20 ${route}`);
}

// Exact one-to-one route closure. The V7.14 index is allowed in addition to the 20 article pages.
const v714HtmlFiles = collectFiles(
  path.join(distDir, 'industries', 'v714'),
  (_full, name) => name === 'index.html',
);
if (v714HtmlFiles.length !== EXPECTED_ARTICLES + 1) {
  fail(`expected ${EXPECTED_ARTICLES + 1} V7.14 index.html files including hub index, found ${v714HtmlFiles.length}`);
}
if (seenHtml.size !== EXPECTED_ARTICLES) fail(`expected exactly ${EXPECTED_ARTICLES} matched article HTML files, got ${seenHtml.size}`);

// Detect article HTML routes that have no metadata counterpart.
const articleHtmlFiles = v714HtmlFiles.filter((file) => !path.normalize(file).endsWith(`${path.sep}industries${path.sep}v714${path.sep}index.html`));
if (articleHtmlFiles.length !== EXPECTED_ARTICLES) fail(`article HTML closure mismatch: ${articleHtmlFiles.length}`);
for (const file of articleHtmlFiles) {
  const rel = path.relative(path.join(distDir, 'industries', 'v714'), file).replace(/\\/g, '/');
  const slug = rel.split('/')[0];
  if (!metadataSlugs.has(slug)) fail(`orphan/stale HTML projection: ${slug}`);
}

const labels = [
  ['20/20 Artifact → HTML', counters.artifactHtml],
  ['20/20 Metadata', counters.metadata],
  ['20/20 Publication Gate', counters.publicationGate],
  ['20/20 Route Hash', counters.routeHash],
  ['20/20 Canonical', counters.canonical],
  ['20/20 Title/H1', counters.titleH1],
  ['20/20 Engineering Content Projection', counters.engineering],
  ['20/20 FAQ', counters.faq],
  ['20/20 JSON-LD', counters.jsonLd],
  ['20/20 CTA', counters.cta],
  ['20/20 No orphan / stale projection', counters.noOrphanStale],
];

console.log('');
for (const [label, count] of labels) {
  if (count !== EXPECTED_ARTICLES) fail(`${label} did not reach ${EXPECTED_ARTICLES}`);
  console.log(label);
}
console.log('');
console.log('V7.14_FINAL_CONTENT_PROJECTION=PASS');
