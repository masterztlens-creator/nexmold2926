
import assert from "node:assert/strict";
import test from "node:test";

import {
  validateArticlePublication,
} from "../../scripts/v8-article-publication-quality-gate.mjs";

const evidenceId = "evidence:quality-gate:1";
const claimId = "claim:quality-gate:1";
const knowledgeId = "knowledge:quality-gate:1";

function makeProvenance(text, ordinal = 0) {
  return {
    ordinal,
    text,
    fingerprint: `fingerprint:${ordinal}`,
    kind: "KNOWLEDGE",
    problemIds: [],
    decisionIds: [],
    contextIds: [],
    knowledgeIds: [knowledgeId],
    claimIds: [claimId],
    evidenceIds: [evidenceId],
  };
}

function makeFixture() {
  const assertions = [
    "Uniform wall thickness can help reduce the risk of sink and warpage.",
    "Material selection affects the recommended wall thickness for a molded part.",
    "Ribs can provide stiffness without making an entire wall substantially thicker.",
    "Draft requirements depend on part geometry and mold design.",
  ];

  const description =
    "Evidence-backed engineering guidance for plastic injection molding wall thickness.";

  const article = [
    "# Plastic Injection Molding Wall Thickness",
    "",
    description,
    "",
    "## Wall Thickness and Part Quality",
    "",
    assertions[0],
    "",
    "## Material and Geometry",
    "",
    assertions[1],
    "",
    assertions[2],
    "",
    "## Draft and Mold Design",
    "",
    assertions[3],
    "",
  ].join("\n");

  const provenance = assertions.map(
    (text, ordinal) =>
      makeProvenance(text, ordinal),
  );

  const manifest = {
    schema: "nexmold.v8.first-article-manifest.v3",
    article: {
      title: "Plastic Injection Molding Wall Thickness",
      slug: "plastic-injection-molding-wall-thickness",
      description,
      artifact: "article.md",
    },
    foundation: {
      verifiedEvidenceIds: [evidenceId],
      claimIds: [claimId],
      knowledgeIds: [knowledgeId],
    },
    runtime: {
      assertionCount: provenance.length,
      content: {
        title: "Plastic Injection Molding Wall Thickness",
        bodyLength: 400,
        provenance,
      },
    },
  };

  return {
    article,
    manifest,
    assertions,
  };
}

test(
  "publication quality gate accepts structured, traced article prose",
  () => {
    const fixture = makeFixture();

    const result = validateArticlePublication({
      article: fixture.article,
      manifest: fixture.manifest,
    });

    assert.equal(result.status, "PASS");
    assert.equal(result.headingCount, 3);
    assert.equal(result.proseAssertionCount, 4);
    assert.equal(result.knowledgeAssertionCount, 4);
    assert.equal(result.verifiedEvidenceCount, 1);
  },
);

test(
  "publication quality gate rejects internal workflow labels",
  () => {
    const fixture = makeFixture();

    fixture.article = fixture.article.replace(
      "## Wall Thickness and Part Quality",
      "Problem\n\n## Wall Thickness and Part Quality",
    );

    assert.throws(
      () =>
        validateArticlePublication({
          article: fixture.article,
          manifest: fixture.manifest,
        }),
      /INTERNAL_SCAFFOLD_LEAK/,
    );
  },
);

test(
  "publication quality gate rejects unsegmented source excerpts",
  () => {
    const fixture = makeFixture();

    const longExcerpt =
      "Wall thickness guidance ".repeat(35).trim();

    fixture.manifest.runtime.content.provenance[0] =
      makeProvenance(longExcerpt, 0);

    fixture.article = fixture.article.replace(
      fixture.assertions[0],
      longExcerpt,
    );

    assert.throws(
      () =>
        validateArticlePublication({
          article: fixture.article,
          manifest: fixture.manifest,
        }),
      /ASSERTION_TOO_LONG|ASSERTION_WORD_LIMIT_EXCEEDED/,
    );
  },
);

test(
  "publication quality gate rejects evidence IDs outside the verified closure",
  () => {
    const fixture = makeFixture();

    fixture.manifest.runtime.content.provenance[0] =
      {
        ...fixture.manifest.runtime.content.provenance[0],
        evidenceIds: ["evidence:not-verified"],
      };

    assert.throws(
      () =>
        validateArticlePublication({
          article: fixture.article,
          manifest: fixture.manifest,
        }),
      /PROVENANCE_EVIDENCE_NOT_VERIFIED/,
    );
  },
);

test(
  "publication quality gate rejects non-Knowledge workflow assertions",
  () => {
    const fixture = makeFixture();

    fixture.manifest.runtime.content.provenance[0] =
      {
        ...fixture.manifest.runtime.content.provenance[0],
        kind: "DECISION",
      };

    assert.throws(
      () =>
        validateArticlePublication({
          article: fixture.article,
          manifest: fixture.manifest,
        }),
      /NON_KNOWLEDGE_ASSERTION_IN_ARTICLE/,
    );
  },
);

test(
  "publication quality gate rejects prose without exact provenance",
  () => {
    const fixture = makeFixture();

    fixture.article = fixture.article.replace(
      fixture.assertions[0],
      "This additional statement has no matching evidence record.",
    );

    assert.throws(
      () =>
        validateArticlePublication({
          article: fixture.article,
          manifest: fixture.manifest,
        }),
      /UNTRACED_ARTICLE_PROSE/,
    );
  },
);

test(
  "publication quality gate rejects articles with too few sections",
  () => {
    const fixture = makeFixture();

    fixture.article = fixture.article.replace(
      "## Material and Geometry",
      "### Material and Geometry",
    );

    assert.throws(
      () =>
        validateArticlePublication({
          article: fixture.article,
          manifest: fixture.manifest,
        }),
      /INSUFFICIENT_ARTICLE_STRUCTURE/,
    );
  },
);
