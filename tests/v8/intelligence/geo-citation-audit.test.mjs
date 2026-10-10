import test from "node:test";
import assert from "node:assert/strict";

import {
  auditClaimEvidenceAlignment,
} from "../../../.v8-build/src/v8/intelligence/geo/citation-audit.js";

function createEvidence(overrides = {}) {
  return {
    sourceUrl: "https://example.com/engineering/wall-thickness",
    title: "Engineering wall thickness guidance",
    excerpt:
      "Wall thickness should be evaluated against material properties and part requirements.",
    ...overrides,
  };
}

test(
  "claim evidence audit matches a claim to a relevant evidence excerpt",
  () => {
    const result = auditClaimEvidenceAlignment(
      [
        "Wall thickness selection depends on material properties and part requirements.",
      ],
      [createEvidence()],
    );

    assert.equal(result.passed, true);
    assert.equal(result.findings.length, 0);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].claimIndex, 0);
    assert.equal(result.matches[0].evidenceIndex, 0);
    assert.ok(result.matches[0].coverage >= 0.5);
    assert.equal(
      result.matches[0].sourceUrl,
      "https://example.com/engineering/wall-thickness",
    );
  },
);

test(
  "claim evidence audit blocks claims without matching evidence",
  () => {
    const result = auditClaimEvidenceAlignment(
      [
        "Controlled draft angles reduce mold release problems.",
      ],
      [createEvidence()],
    );

    assert.equal(result.passed, false);
    assert.ok(
      result.findings.some(
        (item) =>
          item.code === "GEO_CLAIM_EVIDENCE_UNMATCHED",
      ),
    );
  },
);

test(
  "claim evidence audit blocks evidence without an excerpt",
  () => {
    const result = auditClaimEvidenceAlignment(
      ["Wall thickness depends on material properties."],
      [
        createEvidence({
          excerpt: " ",
        }),
      ],
    );

    assert.equal(result.passed, false);
    assert.ok(
      result.findings.some(
        (item) =>
          item.code === "GEO_EVIDENCE_EXCERPT_MISSING",
      ),
    );
    assert.ok(
      result.findings.some(
        (item) =>
          item.code === "GEO_CLAIM_EVIDENCE_UNMATCHED",
      ),
    );
  },
);

test(
  "claim evidence audit blocks invalid source URLs",
  () => {
    const result = auditClaimEvidenceAlignment(
      ["Wall thickness depends on material properties."],
      [
        createEvidence({
          sourceUrl: "javascript:alert(1)",
        }),
      ],
    );

    assert.equal(result.passed, false);
    assert.ok(
      result.findings.some(
        (item) =>
          item.code === "GEO_EVIDENCE_URL_INVALID",
      ),
    );
    assert.ok(
      result.findings.some(
        (item) =>
          item.code === "GEO_CLAIM_EVIDENCE_UNMATCHED",
      ),
    );
  },
);

test(
  "claim evidence audit blocks empty claims and empty claim lists",
  () => {
    const emptyList = auditClaimEvidenceAlignment(
      [],
      [createEvidence()],
    );

    assert.equal(emptyList.passed, false);
    assert.ok(
      emptyList.findings.some(
        (item) => item.code === "GEO_CLAIMS_EMPTY",
      ),
    );

    const emptyClaim = auditClaimEvidenceAlignment(
      ["  "],
      [createEvidence()],
    );

    assert.equal(emptyClaim.passed, false);
    assert.ok(
      emptyClaim.findings.some(
        (item) => item.code === "GEO_CLAIM_EMPTY",
      ),
    );
  },
);

test(
  "claim evidence audit returns immutable reports and match records",
  () => {
    const result = auditClaimEvidenceAlignment(
      [
        "Wall thickness selection depends on material properties and part requirements.",
      ],
      [createEvidence()],
    );

    assert.equal(Object.isFrozen(result), true);
    assert.equal(Object.isFrozen(result.findings), true);
    assert.equal(Object.isFrozen(result.matches), true);
    assert.equal(Object.isFrozen(result.matches[0]), true);
    assert.equal(
      Object.isFrozen(result.matches[0].matchedTerms),
      true,
    );
  },
);

test(
  "claim evidence audit supports CJK lexical matching",
  () => {
    const result = auditClaimEvidenceAlignment(
      ["塑料注塑成型壁厚设计"],
      [
        createEvidence({
          excerpt: "塑料注塑成型壁厚设计需要考虑材料性能。",
        }),
      ],
    );

    assert.equal(result.passed, true);
    assert.equal(result.matches.length, 1);
  },
);