#!/usr/bin/env node
/**
 * NEXMOLD V7.14 Article Factory — production batch selector.
 * IMPORTANT: historical v2/v3 output is never reused as production content.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();
const BATCH = process.env.NEXMOLD_V714_FACTORY_BATCH ?? "batch-01-v4";
const FACTORY_ROOT = path.join(ROOT, ".nexmold", "content-factory");
const OUT = path.join(FACTORY_ROOT, BATCH);

const TARGETS = [
  "injection-molding-draft-angle",
];

function sha256(value) {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
}
function stable(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${stable(value[k])}`).join(",")}}`;
}
function normalize(s) {
  return String(s ?? "").replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n");
}
function assertProductionMarkdown(markdown) {
  const text = normalize(markdown);
  let fence = false, run = 0;
  const seen = new Set();
  const lines = text.split("\n");
  for (const line of lines) {
    if (/^\s*```/.test(line)) { fence = !fence; run = 0; continue; }
    if (!fence && line.trim().length === 1 && /[A-Za-z0-9#•—–.,:;!?()/'"%+\-]/.test(line.trim())) run++;
    else run = 0;
    if (run >= 8) throw new Error("DATA-02 character-split corruption");
    if (!fence && /^\s*[-*+]\s*\[[ xX]\]\s*$/.test(line)) throw new Error("DATA-04 empty checklist item");
    const h2 = line.match(/^##\s+(.+?)\s*$/);
    if (h2) {
      const key = h2[1].trim().toLowerCase().replace(/\s+/g, " ");
      if (seen.has(key)) throw new Error(`DATA-05 duplicate H2: ${h2[1]}`);
      seen.add(key);
    }
  }
}
function sourceHash(source) {
  return sha256(stable({
    slug: source.slug, title: source.title, description: source.description,
    directAnswer: source.directAnswer, keyTakeaways: source.keyTakeaways,
    content: source.content, faq: source.faq, funnel: source.funnel,
    seoKeywords: source.seoKeywords, relatedSlugs: source.relatedSlugs,
    lastUpdated: source.lastUpdated,
  }));
}
function safeWrite(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const fd = fs.openSync(file, "wx");
  try { fs.writeFileSync(fd, content, "utf8"); } finally { fs.closeSync(fd); }
}
function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const manifest = {
    schema: "nexmold.v7.14.factory-manifest.v4",
    batch: BATCH,
    sourceOfTruth: "src/data/knowledge.ts",
    historicalBatchesReadOnly: ["batch-01-v2", "batch-01-v3"],
    targets: TARGETS,
    generatedAt: new Date().toISOString(),
  };
  safeWrite(path.join(OUT, "_factory-manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

  console.log(`[NEXMOLD][V7.14] Production batch: ${BATCH}`);
  console.log(`[NEXMOLD][V7.14] Source of truth: src/data/knowledge.ts`);
  console.log(`[NEXMOLD][V7.14] Historical v2/v3 reuse: DISABLED`);
  console.log(`[NEXMOLD][V7.14] Targets: ${TARGETS.join(", ")}`);
  console.log(`[NEXMOLD][V7.14] Run the normal factory pipeline to materialize article JSON/MD.`);
}
main();
