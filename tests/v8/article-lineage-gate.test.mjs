
import test from "node:test";
import assert from "node:assert/strict";

import {
  auditArticleManifest,
  ArticleLineageGateError,
} from "../../scripts/v8-article-lineage-gate.mjs";

function createValidManifest() {
  return {
    foundation: {
      verifiedEvidenceIds: ["evidence-1", "evidence-2"],
      claimIds: ["claim-1"],
      knowledgeIds: ["knowledge-1"],
    },

    acquisition: {
      sources: [
        {
          url: "https://example.com/engineering",
          evidenceIds: ["evidence-1", "evidence-2"],
        },
      ],
    },

    runtime: {
      content: {
        bodyLength: 1200,

        provenance: [
          {
            ordinal: 0,
            text: "A verified engineering proposition.",
            fingerprint: "fingerprint-0",
            kind: "KNOWLEDGE",
            knowledgeIds: ["knowledge-1"],
            claimIds: ["claim-1"],
            evidenceIds: ["evidence-1"],
          },
          {
            ordinal: 1,
            text: "A second verified engineering proposition.",
            fingerprint: "fingerprint-1",
            kind: "KNOWLEDGE",
            knowledgeIds: ["knowledge-1"],
            claimIds: ["claim-1"],
            evidenceIds: ["evidence-2"],
          },
        ],
      },
    },
  };
}

function expectGateFailure(manifest, expectedCode) {
  assert.throws(
    () => auditArticleManifest(manifest),
    (error) => {
      assert.ok(error instanceof ArticleLineageGateError);
      assert.equal(error.code, expectedCode);
      return true;
    },
  );
}

test("valid Knowledge → Claim → Evidence closure passes", () => {
  const result = auditArticleManifest(createValidManifest());

  assert.equal(result.status, "PASS");
  assert.equal(result.assertionCount, 2);
  assert.equal(result.verifiedKnowledgeCount, 1);
  assert.equal(result.verifiedClaimCount, 1);
  assert.equal(result.verifiedEvidenceCount, 2);
  assert.equal(result.mappedEvidenceCount, 2);
});

test("rejects a Claim ID outside the verified Runtime closure", () => {
  const manifest = createValidManifest();

  manifest.runtime.content.provenance[0].claimIds = [
    "claim-forged",
  ];

  expectGateFailure(
    manifest,
    "UNAUTHORIZED_LINEAGE_ID",
  );
});

test("rejects an Evidence ID outside the verified Runtime closure", () => {
  const manifest = createValidManifest();

  manifest.runtime.content.provenance[0].evidenceIds = [
    "evidence-forged",
  ];

  expectGateFailure(
    manifest,
    "UNAUTHORIZED_LINEAGE_ID",
  );
});

test("rejects duplicate IDs in an assertion lineage", () => {
  const manifest = createValidManifest();

  manifest.runtime.content.provenance[0].evidenceIds = [
    "evidence-1",
    "evidence-1",
  ];

  expectGateFailure(
    manifest,
    "DUPLICATE_ID",
  );
});

test("rejects a missing Knowledge lineage", () => {
  const manifest = createValidManifest();

  manifest.runtime.content.provenance[0].knowledgeIds = [];

  expectGateFailure(
    manifest,
    "INCOMPLETE_KNOWLEDGE_LINEAGE",
  );
});

test("rejects Evidence mapped to multiple sources", () => {
  const manifest = createValidManifest();

  manifest.acquisition.sources.push({
    url: "https://example.org/duplicate",
    evidenceIds: ["evidence-1"],
  });

  expectGateFailure(
    manifest,
    "DUPLICATE_EVIDENCE_OWNERSHIP",
  );
});

test("rejects a verified Evidence ID missing from source mapping", () => {
  const manifest = createValidManifest();

  manifest.acquisition.sources[0].evidenceIds = [
    "evidence-1",
  ];

  expectGateFailure(
    manifest,
    "SOURCE_EVIDENCE_CLOSURE_MISMATCH",
  );
});

test("rejects structural assertions contaminated by factual lineage", () => {
  const manifest = createValidManifest();

  manifest.runtime.content.provenance.push({
    ordinal: 2,
    text: "Context",
    fingerprint: "fingerprint-2",
    kind: "CONTEXT",
    knowledgeIds: ["knowledge-1"],
    claimIds: [],
    evidenceIds: [],
  });

  expectGateFailure(
    manifest,
    "STRUCTURAL_LINEAGE_CONTAMINATION",
  );
});

test("rejects an unsupported provenance kind", () => {
  const manifest = createValidManifest();

  manifest.runtime.content.provenance[0].kind = "UNRECOGNIZED";

  expectGateFailure(
    manifest,
    "UNKNOWN_PROVENANCE_KIND",
  );
});
