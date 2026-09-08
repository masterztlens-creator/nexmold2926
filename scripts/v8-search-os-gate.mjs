import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const required = [
  "src/v8/search-os/contracts.ts",
  "src/v8/search-os/query.ts",
  "src/v8/search-os/intent.ts",
  "src/v8/search-os/competitor.ts",
  "src/v8/search-os/ontology.ts",
  "src/v8/search-os/applicability.ts",
  "src/v8/search-os/decision.ts",
  "src/v8/search-os/freshness.ts",
  "src/v8/search-os/economics.ts",
  "src/v8/search-os/dedup.ts",
  "src/v8/search-os/cannibalization.ts",
  "src/v8/search-os/seo.ts",
  "src/v8/search-os/geo.ts",
  "src/v8/search-os/feedback.ts",
  "src/v8/search-os/pipeline.ts",
  "src/v8/search-os/index.ts",
];

for (const file of required) {
  if (!existsSync(file)) throw new Error(`V8_SEARCH_OS_MISSING:${file}`);
}
const index = readFileSync("src/v8/search-os/index.ts", "utf8");
if (!index.includes('export * from "./pipeline.js";')) throw new Error("V8_SEARCH_OS_EXPORT_MISSING");

execFileSync("npx", ["tsc", "-p", "tsconfig.v8.json"], { stdio: "inherit" });
console.log("[V8][SEARCH-OS] COMPILE PASS");
console.log("[V8][SEARCH-OS] STRUCTURE PASS");
console.log("[V8][SEARCH-OS] STATUS=VERIFIED_ONLY_BY_THIS_EXECUTION");
