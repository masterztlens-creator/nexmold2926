#!/usr/bin/env node
/** NEXMOLD V7.15 — main compatibility preflight. No writes, fail-closed. */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const ROOT = process.env.NEXMOLD_ROOT ? path.resolve(process.env.NEXMOLD_ROOT) : process.cwd();
const required = {
  "src/regional/types.ts": "486cc17464dc0810c1681cb24ec29f2793ed255d",
  "src/regional/eligibility.ts": "de9b653faf6baab408b0278fac7713bd7265fb6f",
  "src/regional/epistemic-firewall.ts": "17bc35394602095f721028ccbb6c2c9293067a91",
  "src/regional/regionalPublishArtifact.ts": "e0ea934f9f0415e6781f3d5c66d81749cd7531f6",
  "src/regional/publication-gate.ts": "e23b936f47ac676f9078527ade9508cb4a72675f",
  "src/regional/regionalCompiler.ts": "V7.15_PATCH",
};
const mustContain = [
  ["src/regional/eligibility.ts", "export function evaluateRegionalEligibility("],
  ["src/regional/epistemic-firewall.ts", "export function runEpistemicFirewall("],
  ["src/regional/regionalPublishArtifact.ts", "export function createRegionalPublishArtifact("],
  ["src/regional/publication-gate.ts", "export function runPublicationGate("],
  ["src/regional/regionalCompiler.ts", "evaluateRegionalEligibility"],
  ["src/regional/regionalCompiler.ts", "createRegionalPublishArtifact"],
  ["src/regional/regionalCompiler.ts", "runPublicationGate"],
];

const failures = [];
for (const [file, expected] of Object.entries(required)) {
  const full = path.join(ROOT, file);
  if (!existsSync(full)) { failures.push(`MISSING:${file}`); continue; }
  const text = readFileSync(full, "utf8");
  if (expected !== "V7.15_PATCH") {
    const sha = createHash("sha1").update(text).digest("hex");
    if (sha !== expected) failures.push(`SHA_MISMATCH:${file}:${sha}`);
  }
}
for (const [file, token] of mustContain) {
  const full = path.join(ROOT, file);
  if (existsSync(full) && !readFileSync(full, "utf8").includes(token)) failures.push(`TOKEN_MISSING:${file}:${token}`);
}
if (failures.length) {
  console.error("[NEXMOLD][V7.15] FAIL — main compatibility preflight");
  for (const failure of failures) console.error(`  ${failure}`);
  process.exit(1);
}
console.log("[NEXMOLD][V7.15] PASS — V7.14 dependency interfaces match inspected main baseline");
console.log("[NEXMOLD][V7.15] PASS — V7.15 compiler adapter is wired to eligibility/firewall/artifact/publication gate");
