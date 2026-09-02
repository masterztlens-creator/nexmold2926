import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

const TERMS = [
  "injection molding wall thickness",
  "wall thickness",
  "uniform wall thickness",
  "thickness transition",
  "wall thickness design",
  "sink marks",
  "warpage"
];

const SKIP = new Set([
  "node_modules",
  "dist",
  ".astro",
  ".git",
  ".nexmold"
]);

function collectFiles(dir) {
  if (!fs.existsSync(dir)) return [];

  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;

    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...collectFiles(full));
    } else if (
      /\.(astro|md|mdx|ts|tsx|js|mjs|json)$/i.test(entry.name)
    ) {
      result.push(full);
    }
  }

  return result;
}

const roots = [
  path.join(ROOT, "src"),
  path.join(ROOT, "public")
];

const files = roots.flatMap(collectFiles);

console.log("=======================================================");
console.log("[NEXMOLD][V7.14] BL01 — EVIDENCE DISCOVERY");
console.log("=======================================================");
console.log(`Files scanned: ${files.length}`);
console.log("");

let totalHits = 0;

for (const term of TERMS) {
  console.log("");
  console.log(`[TERM] ${term}`);
  console.log("-------------------------------------------------------");

  let termHits = 0;

  for (const file of files) {
    let text;

    try {
      text = fs.readFileSync(file, "utf8");
    } catch {
      continue;
    }

    const lower = text.toLowerCase();
    const index = lower.indexOf(term.toLowerCase());

    if (index === -1) continue;

    const lineNo =
      text.slice(0, index).split(/\r?\n/).length;

    const lines = text.split(/\r?\n/);

    const from = Math.max(0, lineNo - 3);
    const to = Math.min(lines.length, lineNo + 4);

    console.log("");
    console.log(
      `[HIT] ${path.relative(ROOT, file)}:${lineNo}`
    );

    for (let i = from; i < to; i++) {
      console.log(
        `${String(i + 1).padStart(5)} | ${lines[i]}`
      );
    }

    termHits++;
    totalHits++;

    if (termHits >= 12) {
      console.log("[LIMIT] Showing first 12 hits for this term.");
      break;
    }
  }

  if (termHits === 0) {
    console.log("[NO LOCAL HIT]");
  }
}

console.log("");
console.log("=======================================================");
console.log("[DISCOVERY COMPLETE]");
console.log("=======================================================");
console.log(`Total displayed hits: ${totalHits}`);
console.log("");
console.log("READ ONLY.");
console.log("NO ARTICLE GENERATED.");
console.log("NO SITE CONTENT MODIFIED.");
console.log("");
console.log("NEXT: COMPILE BL01 EVIDENCE -> CLAIM INPUT.");
