
import test from "node:test";
import assert from "node:assert/strict";

import {
  normalizeQuery,
  createQueryCandidate,
} from "../../.v8-build/src/v8/search-os/query.js";

import {
  classifyIntent,
} from "../../.v8-build/src/v8/search-os/intent.js";

import {
  evaluateApplicability,
} from "../../.v8-build/src/v8/search-os/applicability.js";

import {
  decideAsset,
} from "../../.v8-build/src/v8/search-os/economics.js";

function makeQuery(rawQuery) {
  return createQueryCandidate({
    id: `q:${rawQuery}`,
    rawQuery,
    language: "en",
    country: "US",
    source: "MANUAL",
    observedAt: "2026-10-16T00:00:00.000Z",
  });
}

test("normalizes query deterministically", () => {
  assert.equal(
    normalizeQuery("  PA66   GF30 Shrinkage "),
    "pa66 gf30 shrinkage",
  );
});

test("classifies an engineering topic without an explicit task", () => {
  const result = classifyIntent(
    makeQuery("PA66 GF30 shrinkage"),
  );

  assert.equal(result.kind, "ENGINEERING_HOW_TO");
  assert.equal(result.confidence, 0.55);
});

test("comparison intent takes precedence over engineering topic terms", () => {
  const result = classifyIntent(
    makeQuery("injection molding vs blow molding"),
  );

  assert.equal(result.kind, "ENGINEERING_COMPARISON");
  assert.equal(result.confidence, 0.82);
});

test("calculation intent takes precedence over generic engineering terms", () => {
  const result = classifyIntent(
    makeQuery("calculate injection molding shrinkage"),
  );

  assert.equal(result.kind, "ENGINEERING_CALCULATION");
});

test("commercial supplier intent takes precedence over generic molding terms", () => {
  const result = classifyIntent(
    makeQuery("injection molding manufacturer"),
  );

  assert.equal(result.kind, "COMMERCIAL_EVALUATION");
});

test("commercial quote intent takes precedence over generic engineering terms", () => {
  const result = classifyIntent(
    makeQuery("plastic injection molding quote"),
  );

  assert.equal(result.kind, "COMMERCIAL_EVALUATION");
});

test("troubleshooting intent takes precedence over generic warpage topic", () => {
  const result = classifyIntent(
    makeQuery("troubleshoot warpage in injection molding"),
  );

  assert.equal(result.kind, "ENGINEERING_TROUBLESHOOTING");
});

test("reference intent takes precedence over generic injection molding terms", () => {
  const result = classifyIntent(
    makeQuery("injection molding material specifications"),
  );

  assert.equal(result.kind, "ENGINEERING_REFERENCE");
});

test("explicit procedural query is classified as engineering how-to", () => {
  const result = classifyIntent(
    makeQuery("how to design injection molding wall thickness"),
  );

  assert.equal(result.kind, "ENGINEERING_HOW_TO");
  assert.equal(result.confidence, 0.82);
});

test("unknown query receives low confidence instead of a strong classification", () => {
  const result = classifyIntent(
    makeQuery("blue objects and other things"),
  );

  assert.equal(result.kind, "NON_ENGINEERING");
  assert.equal(result.confidence, 0.35);
});

test("empty normalized query fails closed", () => {
  const query = {
    id: "q:empty",
    rawQuery: "   ",
    normalizedQuery: "",
    language: "en",
    source: "MANUAL",
    observedAt: "2026-10-16T00:00:00.000Z",
  };

  assert.throws(
    () => classifyIntent(query),
    /V8_SEARCH_INTENT_QUERY_EMPTY/,
  );
});

test("classification retains query identity and immutable entity candidates", () => {
  const result = classifyIntent(
    makeQuery("custom injection molding manufacturer"),
  );

  assert.equal(
    result.queryId,
    "q:custom injection molding manufacturer",
  );

  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.requiredEntities), true);
  assert.ok(result.requiredEntities.includes("injection"));
});

test("blocks missing evidence", () => {
  const result = evaluateApplicability([], ["e1"]);

  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
});

test("blocks low uniqueness", () => {
  const result = decideAsset({
    id: "a1",
    queryId: "q1",
    canonicalKey: "q::ENGINEERING_HOW_TO",
    title: "Test",
    decisionId: "d1",
    uniquenessScore: 0.2,
    economicScore: 0.9,
    duplicateRisk: 0,
    cannibalizationRisk: 0,
  });

  assert.equal(result.decision, "BLOCK");
});
