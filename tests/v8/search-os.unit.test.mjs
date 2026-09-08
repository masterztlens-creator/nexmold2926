import test from "node:test";
import assert from "node:assert/strict";
import { normalizeQuery, createQueryCandidate } from "../../.v8-build/src/v8/search-os/query.js";
import { classifyIntent } from "../../.v8-build/src/v8/search-os/intent.js";
import { evaluateApplicability } from "../../.v8-build/src/v8/search-os/applicability.js";
import { decideAsset } from "../../.v8-build/src/v8/search-os/economics.js";

test("normalizes query deterministically", () => {
  assert.equal(normalizeQuery("  PA66   GF30 Shrinkage "), "pa66 gf30 shrinkage");
});

test("classifies engineering query", () => {
  const q = createQueryCandidate({
    id: "q1", rawQuery: "PA66 GF30 shrinkage", language: "en",
    source: "DISCOVERY", observedAt: "2026-09-08T00:00:00.000Z",
  });
  assert.equal(classifyIntent(q).kind, "ENGINEERING_HOW_TO");
});

test("blocks missing evidence", () => {
  const result = evaluateApplicability([], ["e1"]);
  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
});

test("blocks low uniqueness", () => {
  const result = decideAsset({
    id: "a1", queryId: "q1", canonicalKey: "q::ENGINEERING_HOW_TO",
    title: "Test", decisionId: "d1", uniquenessScore: 0.2,
    economicScore: 0.9, duplicateRisk: 0, cannibalizationRisk: 0,
  });
  assert.equal(result.decision, "BLOCK");
});
