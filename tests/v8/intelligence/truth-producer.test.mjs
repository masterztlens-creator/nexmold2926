
import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
  createSource,
  contentFingerprint,
} from "../../../.v8-build/src/v8/index.js";

import {
  TruthProducer,
} from "../../../.v8-build/src/v8/intelligence/truth-producer/index.js";

const actor = {
  id: "truth-producer-test",
  role: "SYSTEM",
};

const auditor = {
  id: "truth-producer-auditor",
  role: "AUDITOR",
};

const statement =
  "Adequate draft angle supports reliable part ejection.";

function createVerifiedEvidenceFixture() {
  const store =
    new InMemoryFoundationStore();

  const service =
    new FoundationService(store);

  const content = statement;

  const source =
    createSource({
      kind: "PUBLIC_WEB",
      locator:
        "https://example.test/truth-producer",
      access:
        "PAYLOAD_ALLOWED",
      title:
        "Truth Producer Test Source",
      version: "1",
      publisher:
        "NEXMOLD Test Authority",
      authority:
        "ENGINEERING_REFERENCE",
      canonicalUrl:
        "https://example.test/truth-producer",
      retrievedAt:
        "2026-09-10T00:00:00.000Z",
      documentHash:
        contentFingerprint(content),
    });

  service.registerSource(
    source,
    actor,
  );

  const snapshot =
    service.captureSnapshot(
      {
        source,
        capturedAt:
          "2026-09-10T00:00:00.000Z",
        locator:
          source.locator,
        content,
        metadataOnly: false,
      },
      actor,
    );

  service.sealSnapshot(
    snapshot.aggregateId,
    actor,
  );

  const evidence =
    service.ingestEvidence(
      {
        id:
          "evidence:truth-producer:1",
        sourceId: source.id,
        locator:
          "truth-producer:p1",
        excerpt: content,
        ingestion:
          "INGESTED",
        capturedAt:
          snapshot.recordedAt,
        snapshotId:
          snapshot.aggregateId,
      },
      actor,
    );

  service.verifyEvidence(
    evidence.aggregateId,
    auditor,
  );

  const verifiedEvidence =
    store.get(
      "EVIDENCE",
      evidence.aggregateId,
    );

  assert.ok(
    verifiedEvidence,
    "Evidence must be persisted.",
  );

  assert.equal(
    verifiedEvidence.state,
    "VERIFIED",
  );

  const candidate = {
    statement,
    evidenceIds: [
      evidence.aggregateId,
    ],
    epistemicLevel:
      "ENGINEERING_INFERENCE",
    confidence:
      "HIGH",
  };

  const interpreter = {
    interpret(input) {
      assert.equal(
        input.length,
        1,
      );

      return [
        candidate,
      ];
    },
  };

  return {
    store,
    service,
    evidence,
    verifiedEvidence,
    candidate,
    interpreter,
  };
}

function createAcceptingTestVerifier() {
  return {
    verify(candidate, evidence) {
      assert.ok(
        evidence.length > 0,
        "The test verifier must receive Evidence.",
      );

      return {
        verdict: "VERIFIED",
        verifiedStatement:
          candidate.statement,
        evidenceIds: [
          ...candidate.evidenceIds,
        ],
        reasons: [
          "TEST_ONLY_SEMANTIC_VERIFIER_STUB",
        ],
      };
    },
  };
}

test(
  "Truth Producer requires explicit semantic verification before creating Claim and Knowledge",
  () => {
    const fixture =
      createVerifiedEvidenceFixture();

    const producer =
      new TruthProducer(
        fixture.service,
        fixture.interpreter,
        createAcceptingTestVerifier(),
      );

    const result =
      producer.produce({
        evidence: [
          fixture.verifiedEvidence.payload,
        ],
        actor: auditor,
      });

    assert.equal(
      result.claims.length,
      1,
    );

    assert.equal(
      result.knowledge.length,
      1,
    );

    assert.deepEqual(
      result.rejectedCandidates,
      [],
    );

    const claim =
      fixture.store.get(
        "CLAIM",
        result.claims[0],
      );

    assert.ok(
      claim,
      "The semantically accepted Claim must be persisted.",
    );

    assert.equal(
      claim.state,
      "VERIFIED",
    );

    assert.equal(
      claim.payload.statement,
      statement,
    );

    assert.deepEqual(
      claim.payload.evidenceIds,
      [fixture.evidence.aggregateId],
    );

    const knowledge =
      fixture.store.get(
        "KNOWLEDGE",
        result.knowledge[0],
      );

    assert.ok(
      knowledge,
      "Knowledge must be persisted after Claim creation.",
    );

    assert.equal(
      knowledge.state,
      "VERIFIED",
    );

    assert.deepEqual(
      knowledge.payload.claimIds,
      [claim.aggregateId],
    );

    assert.doesNotThrow(
      () => fixture.store.verifyChain(),
    );
  },
);

test(
  "VERIFIED Evidence alone cannot create VERIFIED Claim or APPROVED Knowledge",
  () => {
    const fixture =
      createVerifiedEvidenceFixture();

    /*
     * Deliberately omit the semantic verifier.
     * This represents a runtime that can verify Evidence records but cannot
     * independently establish whether a candidate Claim is supported.
     */
    const producer =
      new TruthProducer(
        fixture.service,
        fixture.interpreter,
      );

    const result =
      producer.produce({
        evidence: [
          fixture.verifiedEvidence.payload,
        ],
        actor: auditor,
      });

    assert.deepEqual(
      result.claims,
      [],
    );

    assert.deepEqual(
      result.knowledge,
      [],
    );

    assert.equal(
      result.rejectedCandidates.length,
      1,
    );

    assert.equal(
      result.rejectedCandidates[0].statement,
      statement,
    );

    assert.equal(
      result.rejectedCandidates[0].reason,
      "V8_TRUTH_PRODUCER_SEMANTIC_VERIFIER_NOT_CONFIGURED",
    );

    assert.equal(
      fixture.store.list("CLAIM").length,
      0,
      "No Claim may be created without semantic verification.",
    );

    assert.equal(
      fixture.store.list("KNOWLEDGE").length,
      0,
      "No Knowledge may be created without a semantically verified Claim.",
    );

    const persistedEvidence =
      fixture.store.get(
        "EVIDENCE",
        fixture.evidence.aggregateId,
      );

    assert.ok(
      persistedEvidence,
    );

    assert.equal(
      persistedEvidence.state,
      "VERIFIED",
      "The fix must preserve valid Evidence even when Claim creation is blocked.",
    );

    assert.doesNotThrow(
      () => fixture.store.verifyChain(),
    );
  },
);

test(
  "Truth Producer rejects a semantic verifier that accepts a different statement",
  () => {
    const fixture =
      createVerifiedEvidenceFixture();

    const verifier = {
      verify(candidate) {
        return {
          verdict: "VERIFIED",
          verifiedStatement:
            `${candidate.statement} Unsupported addition.`,
          evidenceIds: [
            ...candidate.evidenceIds,
          ],
          reasons: [
            "TEST_ONLY_STATEMENT_MISMATCH",
          ],
        };
      },
    };

    const producer =
      new TruthProducer(
        fixture.service,
        fixture.interpreter,
        verifier,
      );

    const result =
      producer.produce({
        evidence: [
          fixture.verifiedEvidence.payload,
        ],
        actor: auditor,
      });

    assert.deepEqual(
      result.claims,
      [],
    );

    assert.deepEqual(
      result.knowledge,
      [],
    );

    assert.equal(
      result.rejectedCandidates.length,
      1,
    );

    assert.equal(
      result.rejectedCandidates[0].reason,
      "V8_TRUTH_PRODUCER_SEMANTIC_VERIFIED_STATEMENT_MISMATCH",
    );

    assert.equal(
      fixture.store.list("CLAIM").length,
      0,
    );

    assert.equal(
      fixture.store.list("KNOWLEDGE").length,
      0,
    );
  },
);

test(
  "Truth Producer rejects a semantic verifier with mismatched Evidence IDs",
  () => {
    const fixture =
      createVerifiedEvidenceFixture();

    const verifier = {
      verify(candidate) {
        return {
          verdict: "VERIFIED",
          verifiedStatement:
            candidate.statement,
          evidenceIds: [
            "evidence:unrelated",
          ],
          reasons: [
            "TEST_ONLY_EVIDENCE_MAPPING_MISMATCH",
          ],
        };
      },
    };

    const producer =
      new TruthProducer(
        fixture.service,
        fixture.interpreter,
        verifier,
      );

    const result =
      producer.produce({
        evidence: [
          fixture.verifiedEvidence.payload,
        ],
        actor: auditor,
      });

    assert.deepEqual(
      result.claims,
      [],
    );

    assert.deepEqual(
      result.knowledge,
      [],
    );

    assert.equal(
      result.rejectedCandidates.length,
      1,
    );

    assert.equal(
      result.rejectedCandidates[0].reason,
      "V8_TRUTH_PRODUCER_SEMANTIC_VERIFIED_EVIDENCE_MAPPING_MISMATCH",
    );

    assert.equal(
      fixture.store.list("CLAIM").length,
      0,
    );

    assert.equal(
      fixture.store.list("KNOWLEDGE").length,
      0,
    );
  },
);

test(
  "Truth Producer rejects REQUIRES_REVIEW and REJECTED verdicts",
  () => {
    for (
      const verdict of [
        "REQUIRES_REVIEW",
        "REJECTED",
      ]
    ) {
      const fixture =
        createVerifiedEvidenceFixture();

      const verifier = {
        verify(candidate) {
          return {
            verdict,
            verifiedStatement:
              candidate.statement,
            evidenceIds: [
              ...candidate.evidenceIds,
            ],
            reasons: [
              `TEST_ONLY_${verdict}`,
            ],
          };
        },
      };

      const producer =
        new TruthProducer(
          fixture.service,
          fixture.interpreter,
          verifier,
        );

      const result =
        producer.produce({
          evidence: [
            fixture.verifiedEvidence.payload,
          ],
          actor: auditor,
        });

      assert.deepEqual(
        result.claims,
        [],
        `${verdict} must not create Claims.`,
      );

      assert.deepEqual(
        result.knowledge,
        [],
        `${verdict} must not create Knowledge.`,
      );

      assert.equal(
        result.rejectedCandidates.length,
        1,
      );

      assert.match(
        result.rejectedCandidates[0].reason,
        new RegExp(
          `V8_TRUTH_PRODUCER_SEMANTIC_VERIFICATION_${verdict}`,
        ),
      );

      assert.equal(
        fixture.store.list("CLAIM").length,
        0,
      );

      assert.equal(
        fixture.store.list("KNOWLEDGE").length,
        0,
      );
    }
  },
);
