#!/usr/bin/env node
/** V7.15 contract regression: tests the real Producer boundary and release preflight. */
import assert from "node:assert/strict";
import { runV714Producer } from "../../src/regional/Producer.ts";
import { evaluateRegionalEligibility } from "../../src/regional/eligibility.ts";
import { runRegionalReleasePreflight } from "../../src/regional/releasePreflight.ts";

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

const input = {
  compileInput: base,
  bindings: [{ claim: { id: "claim:v715", claimKey: "v715.contract" }, evidenceIds: ["evidence:v715"] }],
  canonicalUrl: "https://example.com/v715-contract/",
  hreflangSet: ["en-US"],
  canonicalByLocale: new Map([["en-US", "https://example.com/v715-contract/"]]),
};

const expected = evaluateRegionalEligibility(base);
assert.equal(expected.status, "ELIGIBLE");

const published = runV714Producer(input);
assert.equal(published.published, true);
assert.ok(published.result.artifact);
assert.equal(published.result.artifact.contractVersion, "V7.14-PUBLISH-ARTIFACT-3");
assert.equal(published.result.route.artifact, published.result.artifact);
assert.equal(runRegionalReleasePreflight(published.result).passed, true);

for (const mutation of [
  { applicability: "UNKNOWN" },
  { applicability: "NOT_APPLICABLE" },
  { compliance: "REQUIRES_REVIEW" },
  { compliance: "NOT_VERIFIED" },
]) {
  const result = runV714Producer({ ...input, compileInput: { ...base, ...mutation } });
  assert.equal(result.published, false);
  assert.equal(result.result, null);
}

console.log(JSON.stringify({ schema: "nexmold.v7.15.integration-tests.v2", passed: true }, null, 2));
