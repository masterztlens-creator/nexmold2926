#!/usr/bin/env node
import assert from "node:assert/strict";
import { compileRegionalPage } from "../../src/regional/regionalCompiler.ts";
import { runPublicationGate } from "../../src/regional/publication-gate.ts";

const fixture = {
  compileInput: {
    pageId: "regression-page",
    locale: "en-US",
    region: "US",
    applicability: "APPLICABLE",
    compliance: "VERIFIED",
    semantic: {
      pageId: "regression-page",
      locale: "en-US",
      region: "US",
      semanticClaimIds: ["claim:regression"],
    },
    evidence: {
      completeness: "COMPLETE",
      evidence: [{
        id: "evidence:regression",
        sourceType: "regression",
        sourceLocator: "v714://regression/evidence",
        contentHash: "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      }],
      semanticClaims: [{
        id: "claim:regression",
        claimKey: "v714.regression.claim",
      }],
    },
  },
  bindings: [{
    claim: { id: "claim:regression", claimKey: "v714.regression.claim" },
    evidenceIds: ["evidence:regression"],
  }],
  canonicalUrl: "https://example.com/regression-page",
  hreflangSet: ["en-US"],
  canonicalByLocale: new Map([
    ["en-US", "https://example.com/regression-page"],
  ]),
};

const result = compileRegionalPage(fixture);
assert.equal(result.published, true);
assert.ok(result.result.artifact);
assert.equal(result.result.artifact.bindings[0].claim.id, "claim:regression");
assert.equal(result.result.route.artifact, result.result.artifact);
assert.equal(result.result.route.contentHash, result.result.artifact.pageContentHash);

const brand = Object.getOwnPropertySymbols(result.result.artifact)[0];
const tampered = {
  ...result.result.artifact,
  [brand]: "RegionalPublishArtifact",
  bindings: [{
    ...result.result.artifact.bindings[0],
    claim: { ...result.result.artifact.bindings[0].claim, id: "claim:tampered" },
  }],
};
const gate = runPublicationGate({
  eligibility: result.result.eligibility,
  firewall: {
    ok: true,
    checkedClaims: 1,
    checkedEvidence: 1,
    reasonCodes: [],
  },
  artifact: tampered,
});
assert.equal(gate.ok, false);
assert.ok(gate.reasonCodes.includes("V714_PUBLIC_ARTIFACT_INVALID"));

console.log("[NEXMOLD][V7.14] REGRESSION PASS — object claim IDs are compared by .id, not String(object).");
console.log("[NEXMOLD][V7.14] REGRESSION PASS — tampered persisted artifact is rejected by Publication Gate.");
