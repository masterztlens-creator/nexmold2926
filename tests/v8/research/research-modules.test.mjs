import assert from "node:assert/strict";
import test from "node:test";
import {
  canonicalizeUrl,
  mergeDiscoveryCandidates,
  evaluateFreshness,
  extractEvidenceCandidates,
  detectClaimConflict,
  detectKnowledgeGaps,
} from "../../../.v8-build/src/v8/research/index.js";
test("canonicalizeUrl removes fragments and trailing slash", () => {
  const result = canonicalizeUrl(
    "https://example.com/source/#section",
  );
  assert.equal(
    result,
    "https://example.com/source",
  );
});
test("mergeDiscoveryCandidates deduplicates canonical URLs", () => {
  const result = mergeDiscoveryCandidates([
    {
      url: "https://example.com/a#one",
      canonicalUrl: "",
      provider: "SEARCH",
      discoveredAt: "2026-01-01T00:00:00.000Z",
    },
    {
      url: "https://example.com/a#two",
      canonicalUrl: "",
      provider: "SITEMAP",
      discoveredAt: "2026-01-01T00:00:00.000Z",
    },
  ]);
  assert.equal(result.length, 1);
  assert.equal(
    result[0].canonicalUrl,
    "https://example.com/a",
  );
});
test("evaluateFreshness returns NEW without previous hash", () => {
  const document = {
    requestedUrl: "https://example.com",
    finalUrl: "https://example.com",
    canonicalUrl: "https://example.com",
    title: "Example",
    text: "Wall thickness should be 2 mm.",
    contentHash: "placeholder",
    normalizedAt: "2026-01-01T00:00:00.000Z",
  };
  const result = evaluateFreshness(document);
  assert.equal(result.status, "NEW");
  assert.ok(result.contentHash.length === 64);
});
test("extractEvidenceCandidates finds engineering evidence candidates", () => {
  const document = {
    requestedUrl: "https://example.com/dfm",
    finalUrl: "https://example.com/dfm",
    canonicalUrl: "https://example.com/dfm",
    title: "DFM",
    text:
      "Wall thickness should be 2 mm. " +
      "This is a generic sentence without engineering data.",
    contentHash: "placeholder",
    normalizedAt: "2026-01-01T00:00:00.000Z",
  };
  const result = extractEvidenceCandidates(document);
  assert.ok(result.length >= 1);
  assert.notEqual(
    result[0].evidence.extractionMethod,
    undefined,
  );
  assert.notEqual(
    result[0].evidence.extractionConfidence,
    undefined,
  );
});
test("detectClaimConflict never auto-publishes a conflict", () => {
  const result = detectClaimConflict([
    {
      value: "2 mm",
      sourceUrl: "https://source-a.example",
      authorityScore: 0.9,
    },
    {
      value: "3 mm",
      sourceUrl: "https://source-b.example",
      authorityScore: 0.8,
    },
  ]);
  assert.equal(result.status, "CONFLICT");
  assert.ok(
    result.resolution === "HIGHEST_AUTHORITY_CANDIDATE" ||
    result.resolution === "REQUIRES_REVIEW",
  );
});
test("detectKnowledgeGaps identifies missing signals", () => {
  const result = detectKnowledgeGaps(
    [
      {
        id: "wall-thickness",
        description: "Wall thickness guidance",
        requiredSignals: [
          "material",
          "wall-thickness",
          "process",
        ],
      },
    ],
    ["material", "process"],
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].status, "OPEN");
  assert.deepEqual(
    result[0].missingSignals,
    ["wall-thickness"],
  );
});