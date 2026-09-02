#!/usr/bin/env node
/**
 * NEXMOLD V7.14 — Public Evidence Crawler
 *
 * Conservative acquisition layer. It discovers public sources, scores source
 * authority, extracts readable text, and stores immutable evidence snapshots.
 * It does NOT treat search snippets as engineering facts.
 *
 * Usage:
 *   node scripts/v714-evidence-crawler.mjs <query> [slug]
 *
 * Environment:
 *   V714_EVIDENCE_MAX_SOURCES=8
 *   V714_EVIDENCE_DELAY_MS=1200
 *   V714_EVIDENCE_OUT=.nexmold/content-factory/evidence
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const OUT = path.resolve(process.env.V714_EVIDENCE_OUT || ".nexmold/content-factory/evidence");
const MAX_SOURCES = Math.max(1, Number(process.env.V714_EVIDENCE_MAX_SOURCES || 8));
const DELAY_MS = Math.max(250, Number(process.env.V714_EVIDENCE_DELAY_MS || 1200));
const UA = "NEXMOLD-V7.14-EvidenceCrawler/1.0 (+https://www.nexmold.com/)";

const TIER1 = [/\.gov$/i, /\.edu$/i, /iso\.org$/i, /astm\.org$/i, /din\.de$/i, /vdi\.de$/i];
const TIER2 = [/basf\.com$/i, /covestro\.com$/i, /sabic\.com$/i, /dupont\.com$/i, /celanese\.com$/i, /mitsubishi-chemical\.com$/i, /engelglobal\.com$/i, /arburg\.com$/i, /husky\.co$/i, /synventive\.com$/i];
const TIER3 = [/ptonline\.com$/i, /plasticsengineering\.org$/i, /plasticstoday\.com$/i, /moldmakingtechnology\.com$/i];

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function hash(value) { return crypto.createHash("sha256").update(value, "utf8").digest("hex"); }
function domainOf(url) { return new URL(url).hostname.replace(/^www\./, ""); }
function authorityTier(domain) {
  if (TIER1.some((r) => r.test(domain))) return 1;
  if (TIER2.some((r) => r.test(domain))) return 2;
  if (TIER3.some((r) => r.test(domain))) return 3;
  return 4;
}
function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();
}
function titleOf(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? stripHtml(m[1]) : "";
}
function canonicalOf(html, fallback) {
  const m = html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)["']/i);
  return m ? new URL(m[1], fallback).href : fallback;
}
function discoverUrls(html) {
  const urls = [];
  for (const m of html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi)) {
    try {
      const u = new URL(m[1]);
      if (u.protocol === "https:" && !/[#?]/.test(u.href)) urls.push(u.href);
    } catch {}
  }
  return [...new Set(urls)];
}
async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml" }, signal: controller.signal, redirect: "follow" });
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    const type = response.headers.get("content-type") || "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) throw new Error("NON_HTML_SOURCE");
    return await response.text();
  } finally { clearTimeout(timer); }
}
async function discover(query) {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const html = await fetchText(endpoint);
  return discoverUrls(html).filter((url) => !/duckduckgo\.com$/i.test(domainOf(url)));
}

const query = process.argv.slice(2).join(" ").trim();
if (!query) {
  console.error("Usage: node scripts/v714-evidence-crawler.mjs <engineering query> [slug]");
  process.exit(2);
}
const slug = process.env.V714_EVIDENCE_SLUG || query.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

fs.mkdirSync(OUT, { recursive: true });
const urls = await discover(query);
const candidates = urls
  .map((url) => ({ url, domain: domainOf(url), tier: authorityTier(domainOf(url)) }))
  .sort((a, b) => a.tier - b.tier || a.domain.localeCompare(b.domain))
  .slice(0, MAX_SOURCES * 3);

const sources = [];
for (const candidate of candidates) {
  if (sources.length >= MAX_SOURCES) break;
  try {
    const html = await fetchText(candidate.url);
    const text = stripHtml(html);
    if (text.length < 500) continue;
    const url = canonicalOf(html, candidate.url);
    const contentHash = hash(text);
    const sourceId = `source:${hash(url).slice(0, 20)}`;
    sources.push({ id: sourceId, url, title: titleOf(html), domain: candidate.domain, tier: candidate.tier, retrievedAt: new Date().toISOString(), contentHash, text });
  } catch (error) {
    console.warn(`[SKIP] ${candidate.url}: ${error instanceof Error ? error.message : String(error)}`);
  }
  await sleep(DELAY_MS);
}

const artifact = {
  schema: "nexmold.v7.14.public-evidence-snapshot.v1",
  query,
  slug,
  generatedAt: new Date().toISOString(),
  sources,
};
const file = path.join(OUT, `${slug}.json`);
fs.writeFileSync(file, JSON.stringify(artifact, null, 2) + "\n", { encoding: "utf8", flag: "w" });
console.log(`[NEXMOLD][EVIDENCE] ${sources.length} sources -> ${path.relative(ROOT, file)}`);
console.log(`[NEXMOLD][EVIDENCE] Tier 1/2: ${sources.filter((s) => s.tier <= 2).length}; Tier 3: ${sources.filter((s) => s.tier === 3).length}; Tier 4: ${sources.filter((s) => s.tier === 4).length}`);
