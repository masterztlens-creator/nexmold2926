#!/usr/bin/env node
/** V7.15 contract regression: verifies integration with V7.14, not a replacement stack. */
import assert from "node:assert/strict";
import { evaluateRegionalEligibility } from "../../src/regional/eligibility.ts";
import { compileRegionalPage } from "../../src/regional/regionalCompiler.ts";

const base = {
  pageId: "v715-contract",
  locale: "en-US",
  region: "US",
  applicability: "APPLICABLE",
  compliance: "VERIFIED",
  semantic: { pageId: "v715-contract", locale: "en-US", region: "US", semanticClaimIds: ["claim:v715"] },
  evidence: {
    evidence: [{ id: "evidence:v715", sourceType: "test", sourceLocator: "v715://contract", contentHash: "a".repeat(64) }],
    semanticClaims: [{ id: "claim:v715", claimKey: "v715.contract" }],
    completeness: "COMPLETE",
  },
};

const compilerInput = {
  compileInput: base,
  bindings: [{ claim: { id: "claim:v715", claimKey: "v715.contract" }, evidenceIds: ["evidence:v715"] }],
  canonicalUrl: "https://example.com/v715-contract/",
  hreflangSet: ["en-US"],
  canonicalByLocale: new Map([["en-US", "https://example.com/v715-contract/"]]),
};

const expected = evaluateRegionalEligibility(base);
const actual = compileRegionalPage(compilerInput);
assert.equal(expected.status, "ELIGIBLE");
assert.equal(actual.published, true);
assert.equal(actual.result.eligibility.status, expected.status);
assert.equal(actual.result.artifact.contractVersion, "V7.14-PUBLISH-ARTIFACT-3");
assert.equal(actual.result.route.artifact, actual.result.artifact);

for (const mutation of [
  { applicability: "UNKNOWN" },
  { applicability: "NOT_APPLICABLE" },
  { compliance: "REQUIRES_REVIEW" },
  { compliance: "NOT_VERIFIED" },
]) {
  const input = { ...compilerInput, compileInput: { ...base, ...mutation } };
  const result = compileRegionalPage(input);
  assert.equal(result.published, false);
  assert.equal(result.result.artifact, null);
  assert.equal(result.result.route, null);
  assert.equal(result.result.hreflang, null);
}

console.log(JSON.stringify({ schema: "nexmold.v7.15.integration-tests.v1", passed: true }, null, 2));
