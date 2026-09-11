import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  FoundationService,
  InMemoryFoundationStore,
  createSource,
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

function sha256(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

test(
  "V8 Truth Producer closes VERIFIED Evidence -> Claim -> Knowledge",
  () => {
    const store =
      new InMemoryFoundationStore();

    const service =
      new FoundationService(store);

    const content =
      "Adequate draft angle supports reliable part ejection.";

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
          sha256(content),
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
    );

    assert.equal(
      verifiedEvidence.state,
      "VERIFIED",
    );

    const interpreter = {
      interpret(input) {
        assert.equal(
          input.length,
          1,
        );

        return [
          {
            statement:
              "Adequate draft angle supports reliable part ejection.",
            evidenceIds: [
              evidence.aggregateId,
            ],
            epistemicLevel:
              "ENGINEERING_INFERENCE",
            confidence:
              "HIGH",
          },
        ];
      },
    };

    const producer =
      new TruthProducer(
        service,
        interpreter,
      );

    const result =
      producer.produce({
        evidence: [
          verifiedEvidence.payload,
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
      store.get(
        "CLAIM",
        result.claims[0],
      );

    assert.ok(claim);

    assert.equal(
      claim.state,
      "VERIFIED",
    );

    assert.deepEqual(
      claim.payload.evidenceIds,
      [evidence.aggregateId],
    );

    const knowledge =
      store.get(
        "KNOWLEDGE",
        result.knowledge[0],
      );

    assert.ok(knowledge);

    assert.equal(
      knowledge.state,
      "VERIFIED",
    );

    assert.deepEqual(
      knowledge.payload.claimIds,
      [claim.aggregateId],
    );

    assert.doesNotThrow(
      () => store.verifyChain(),
    );
  },
);