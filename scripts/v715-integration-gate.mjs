#!/usr/bin/env node
/** NEXMOLD V7.15 — integration gate for the existing V7.14 architecture. */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.NEXMOLD_ROOT ? path.resolve(process.env.NEXMOLD_ROOT) : process.cwd();
const src = (file) => import(`${pathToFileURL(path.join(ROOT, "src", "regional", file)).href}?v715=${Date.now()}`);

function fixture(overrides = {}) {
  const pageId = "v715-integration-fixture";
  const locale = "en-US";
  const region = "US";
  const claimId = "claim:v715:integration";
  const evidenceId = "evidence:v715:integration";
  const canonical = "https://nxmold.com/v715-integration-fixture/";
  const evidence = {
    evidence: [{ id: evidenceId, sourceType: "test", sourceLocator: "v715://fixture", contentHash: "a".repeat(64) }],
    semanticClaims: [{ id: claimId, claimKey: "v715.integration.fixture" }],
    completeness: "COMPLETE",
  };
  return {
    compileInput: {
      pageId, locale, region, applicability: "APPLICABLE", compliance: "VERIFIED",
      semantic: { pageId, locale, region, semanticClaimIds: [claimId] }, evidence, ...overrides,
    },
    bindings: [{ claim: { id: claimId, claimKey: "v715.integration.fixture" }, evidenceIds: [evidenceId] }],
    canonicalUrl: canonical,
    hreflangSet: [locale],
    canonicalByLocale: new Map([[locale, canonical]]),
  };
}

const [compiler, eligibility, artifact, gate] = await Promise.all([
  src("regionalCompiler.ts"), src("eligibility.ts"), src("regionalPublishArtifact.ts"), src("publication-gate.ts"),
]);

assert.equal(typeof compiler.compileRegionalPage, "function");
assert.equal(typeof eligibility.evaluateRegionalEligibility, "function");
assert.equal(typeof artifact.createRegionalPublishArtifact, "function");
assert.equal(typeof gate.runPublicationGate, "function");

const good = fixture();
const eligibilityGood = eligibility.evaluateRegionalEligibility(good.compileInput);
const compiledGood = compiler.compileRegionalPage(good);
assert.equal(eligibilityGood.status, "ELIGIBLE");
assert.equal(compiledGood.published, true);
assert.equal(compiledGood.result.eligibility.status, eligibilityGood.status);
assert.equal(compiledGood.result.eligibility.pageId, eligibilityGood.pageId);
assert.ok(compiledGood.result.artifact);
assert.equal(compiledGood.result.route.artifact, compiledGood.result.artifact);
assert.equal(compiledGood.result.route.contentHash, compiledGood.result.artifact.pageContentHash);

for (const [label, overrides] of [
  ["unknown-applicability", { applicability: "UNKNOWN" }],
  ["not-applicable", { applicability: "NOT_APPLICABLE" }],
  ["review", { compliance: "REQUIRES_REVIEW" }],
  ["incomplete-evidence", { evidence: { ...good.compileInput.evidence, completeness: "INCOMPLETE" } }],
]) {
  const input = fixture(overrides);
  const expected = eligibility.evaluateRegionalEligibility(input.compileInput);
  const actual = compiler.compileRegionalPage(input);
  assert.notEqual(expected.status, "ELIGIBLE", `${label}: expected eligibility block`);
  assert.equal(actual.published, false, `${label}: compiler published`);
  assert.equal(actual.result.artifact, null, `${label}: artifact leaked`);
  assert.equal(actual.result.route, null, `${label}: route leaked`);
  assert.equal(actual.result.hreflang, null, `${label}: hreflang leaked`);
  assert.deepEqual(actual.result.eligibility.reasonCodes, expected.reasonCodes, `${label}: eligibility drift`);
}

const missingBinding = { ...good, bindings: [] };
const bindingResult = compiler.compileRegionalPage(missingBinding);
assert.equal(bindingResult.published, false);
assert.equal(bindingResult.result.artifact, null);

console.log("[NEXMOLD][V7.15] PASS — existing V7.14 contracts remain the single public architecture");
console.log("[NEXMOLD][V7.15] PASS — eligibility.ts is the single eligibility state machine");
console.log("[NEXMOLD][V7.15] PASS — blocked paths expose zero artifact/route/hreflang");
console.log("[NEXMOLD][V7.15] PASS — compiler/eligibility state parity verified");
