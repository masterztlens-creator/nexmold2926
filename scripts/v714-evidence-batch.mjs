#!/usr/bin/env node
/** NEXMOLD V7.14 — Batch public-evidence acquisition for batch-01-v3. */
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

const ROOT = process.cwd();
const MANIFEST = path.join(ROOT, ".nexmold", "content-factory", "batch-01-keyword-manifest.json");
const OUT = path.join(ROOT, ".nexmold", "content-factory", "evidence");
const crawler = path.join(ROOT, "scripts", "v714-evidence-crawler.mjs");
if (!fs.existsSync(MANIFEST)) throw new Error(`MANIFEST_NOT_FOUND: ${MANIFEST}`);
const manifest = JSON.parse(fs.readFileSync(MANIFEST, "utf8"));
const entries = Array.isArray(manifest) ? manifest : (manifest.items || manifest.keywords || manifest.entries || []);
const jobs = entries.map((x) => typeof x === "string" ? { slug: x, query: x } : { slug: x.slug || x.targetSlug || x.keyword, query: x.query || x.keyword || x.title || x.slug }).filter((x) => x.slug && x.query);
if (!jobs.length) throw new Error("V714_EVIDENCE_BATCH_MANIFEST_EMPTY");
fs.mkdirSync(OUT, { recursive: true });
const limit = Math.max(1, Number(process.env.V714_EVIDENCE_BATCH_CONCURRENCY || 1));
let cursor = 0;
async function run(job) {
  const env = { ...process.env, V714_EVIDENCE_SLUG: job.slug };
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [crawler, job.query], { cwd: ROOT, env, stdio: "inherit" });
    child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(`EVIDENCE_CRAWLER_FAILED:${job.slug}:${code}`)));
    child.on("error", reject);
  });
}
async function worker() { while (cursor < jobs.length) { const job = jobs[cursor++]; try { await run(job); } catch (e) { console.error(`[BATCH][SKIP] ${job.slug}: ${e.message}`); } } }
await Promise.all(Array.from({ length: Math.min(limit, jobs.length) }, worker));
console.log(`[NEXMOLD][V7.14][EVIDENCE-BATCH] completed ${jobs.length} manifest entries; output=${path.relative(ROOT, OUT)}`);
