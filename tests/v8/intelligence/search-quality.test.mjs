import test from "node:test";
import assert from "node:assert/strict";

import {
  auditGeoArtifact,
  auditSeoArtifact,
} from "../../../.v8-build/src/v8/intelligence/search-quality.js";

function createSeoArtifact(overrides = {}) {
  return {
    title: "Plastic Injection Molding Wall Thickness",
    slug: "plastic-injection-molding-wall-thickness",
    description:
      "Learn how material, flow, cooling, and structural requirements affect plastic injection molding wall thickness.",
    canonicalPath:
      "/knowledge-hub/plastic-injection-molding-wall-thickness/",
    keywords: [
      "plastic injection molding wall thickness",
      "wall thickness design",
    ],
    headings: [
      "Wall thickness fundamentals",
      "Material and cooling considerations",
    ],
    ...overrides,
  };
}

function createGeoArtifact(overrides = {}) {
  return {
    directAnswer:
      "Wall thickness selection depends on material properties, flow behavior, cooling requirements, and the structural needs of the finished component.",
    facts: [
      "Wall thickness is a multi-variable engineering decision.",
    ],
    questions: [
      "How should wall thickness be selected?",
    ],
    entityTerms: [
      "wall thickness",
      "injection molding",
    ],
    citationTargets: [
      "https://example.com/engineering-guidance",
    ],
    ...overrides,
  };
}

test("SEO quality gate accepts a structurally valid artifact", () => {
  const result = auditSeoArtifact(
    createSeoArtifact(),
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.findings, []);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.findings), true);
});

test("SEO quality gate blocks an empty title", () => {
  const result = auditSeoArtifact(
    createSeoArtifact({
      title: "   ",
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) => item.code === "SEO_TITLE_EMPTY",
    ),
  );
});

test("SEO quality gate blocks an invalid canonical path", () => {
  const result = auditSeoArtifact(
    createSeoArtifact({
      canonicalPath:
        "https://example.com/page?tracking=1",
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) =>
        item.code === "SEO_CANONICAL_PATH_INVALID",
    ),
  );
});

test("SEO quality gate detects duplicate keywords", () => {
  const result = auditSeoArtifact(
    createSeoArtifact({
      keywords: [
        "Wall Thickness",
        " wall thickness ",
      ],
    }),
  );

  assert.ok(
    result.findings.some(
      (item) =>
        item.code === "SEO_KEYWORDS_DUPLICATED",
    ),
  );
});

test("SEO quality gate blocks empty keyword entries", () => {
  const result = auditSeoArtifact(
    createSeoArtifact({
      keywords: ["valid keyword", "   "],
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) => item.code === "SEO_KEYWORD_EMPTY",
    ),
  );
});

test("GEO quality gate accepts an artifact with a valid answer and citation URL", () => {
  const result = auditGeoArtifact(
    createGeoArtifact(),
  );

  assert.equal(result.passed, true);
  assert.deepEqual(result.findings, []);
});

test("GEO quality gate blocks an empty direct answer", () => {
  const result = auditGeoArtifact(
    createGeoArtifact({
      directAnswer: " ",
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) =>
        item.code === "GEO_DIRECT_ANSWER_EMPTY",
    ),
  );
});

test("GEO quality gate blocks artifacts without facts", () => {
  const result = auditGeoArtifact(
    createGeoArtifact({
      facts: [],
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) => item.code === "GEO_FACTS_EMPTY",
    ),
  );
});

test("GEO quality gate blocks artifacts without citation targets", () => {
  const result = auditGeoArtifact(
    createGeoArtifact({
      citationTargets: [],
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) => item.code === "GEO_CITATIONS_EMPTY",
    ),
  );
});

test("GEO quality gate blocks invalid citation URLs", () => {
  const result = auditGeoArtifact(
    createGeoArtifact({
      citationTargets: [
        "javascript:alert(1)",
        "not-a-url",
      ],
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) =>
        item.code === "GEO_CITATION_URL_INVALID",
    ),
  );
});

test("GEO quality gate warns about duplicate citation targets", () => {
  const result = auditGeoArtifact(
    createGeoArtifact({
      citationTargets: [
        "https://example.com/source",
        "https://example.com/source",
      ],
    }),
  );

  assert.equal(result.passed, true);
  assert.ok(
    result.findings.some(
      (item) =>
        item.code === "GEO_CITATION_DUPLICATED",
    ),
  );
});

test("GEO quality gate blocks answers over 500 characters", () => {
  const result = auditGeoArtifact(
    createGeoArtifact({
      directAnswer: "A".repeat(501),
    }),
  );

  assert.equal(result.passed, false);
  assert.ok(
    result.findings.some(
      (item) =>
        item.code === "GEO_DIRECT_ANSWER_TOO_LONG",
    ),
  );
});