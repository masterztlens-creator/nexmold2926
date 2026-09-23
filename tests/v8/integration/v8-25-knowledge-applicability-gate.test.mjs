import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  FoundationService,
  InMemoryFoundationStore,
  createSource,
  createClaim,
  createKnowledge,
  createScope,
  createContext,
} from "../../../.v8-build/src/v8/index.js";

import {
  ApplicabilityEngine,
} from "../../../.v8-build/src/v8/applicability/engine.js";

const actor = {
  id: "v8-25-test",
  role: "SYSTEM",
};

const auditor = {
  id: "v8-25-auditor",
  role: "AUDITOR",
};

function fixtureHash(content) {
  return createHash("sha256")
    .update(
      JSON.stringify(content),
      "utf8",
    )
    .digest("hex");
}

function createKnowledgeFixture(svc) {
  const content =
    "PA66 at 180 C requires wall thickness to be expressed in mm for this engineering condition.";

  const source = createSource({
    kind: "PUBLIC_WEB",
    locator:
      "https://example.test/v8-25-applicability",
    access: "PAYLOAD_ALLOWED",
    title:
      "V8-25 Applicability Test Reference",
    version: "1",
    publisher:
      "NEXMOLD Test Authority",
    authority:
      "ENGINEERING_REFERENCE",
    canonicalUrl:
      "https://example.test/v8-25-applicability",
    retrievedAt:
      "2026-09-23T00:00:00.000Z",
    documentHash:
      fixtureHash(content),
  });

  svc.registerSource(
    source,
    actor,
  );

  const snapshot =
    svc.captureSnapshot(
      {
        source,
        capturedAt:
          "2026-09-23T00:00:00.000Z",
        locator: source.locator,
        content,
        metadataOnly: false,
      },
      actor,
    );

  svc.sealSnapshot(
    snapshot.aggregateId,
    actor,
  );

  const evidence =
    svc.ingestEvidence(
      {
        id: "evidence:v8-25:1",
        sourceId: source.id,
        locator: "v8-25:p1",
        excerpt: content,
        ingestion: "INGESTED",
        capturedAt:
          snapshot.recordedAt,
        snapshotId:
          snapshot.aggregateId,
        materialGrade: "PA66",
        testCondition: "180 C",
        unit: "mm",
      },
      actor,
    );

  svc.verifyEvidence(
    evidence.aggregateId,
    auditor,
  );

  const claim =
    svc.createClaim(
      createClaim({
        id: "claim:v8-25:1",
        statement:
          "PA66 at 180 C requires wall thickness to be expressed in mm for this engineering condition.",
        evidenceIds: [
          evidence.aggregateId,
        ],
        status: "VERIFIED",
        fingerprint: "ignored",
        scope:
          "injection molding",
        conditions: [
          "PA66",
          "180 C",
        ],
        units: [
          "mm",
        ],
        isUniversal: false,
        epistemicLevel:
          "ENGINEERING_INFERENCE",
        confidence: "HIGH",
      }),
      auditor,
    );

  const knowledge =
    svc.createKnowledge(
      createKnowledge({
        id: "knowledge:v8-25:1",
        proposition:
          "For injection molding, this knowledge applies to PA66 at 180 C when wall thickness is expressed in mm.",
        claimIds: [
          claim.aggregateId,
        ],
        status: "APPROVED",
        fingerprint: "ignored",
        scope:
          "injection molding",
        conditions: [
          "PA66",
          "180 C",
        ],
        units: [
          "mm",
        ],
        isUniversal: false,
      }),
      actor,
    );

  return {
    source,
    snapshot,
    evidence,
    claim,
    knowledge,
  };
}

test(
  "V8-25 GREEN: ApplicabilityEngine enforces Knowledge condition constraints without treating units as applicability constraints",
  () => {
    const store =
      new InMemoryFoundationStore();

    const svc =
      new FoundationService(store);

    const {
      knowledge,
    } =
      createKnowledgeFixture(svc);

    const scope =
      svc.registerScope(
        createScope({
          id: "scope:v8-25:1",
          geography: "GLOBAL",
          industries: [
            "INJECTION_MOLDING",
          ],
          languages: [
            "en",
          ],
        }),
        actor,
      );

    const incompatibleContext =
      svc.registerContext(
        createContext({
          id:
            "context:v8-25:incompatible",
          scopeId:
            scope.aggregateId,
          purpose:
            "Evaluate Knowledge applicability against an incompatible condition.",
          variables: {
            materialGrade: "PA66",
            testCondition: "20 C",
            unit: "inch",
          },
        }),
        actor,
      );

    const incompatible =
      new ApplicabilityEngine(
        store,
      ).evaluate({
        knowledgeId:
          knowledge.aggregateId,
        scopeId:
          scope.aggregateId,
        contextId:
          incompatibleContext.aggregateId,
      });

    assert.equal(
      incompatible.applicable,
      false,
      JSON.stringify(
        incompatible,
        null,
        2,
      ),
    );

    assert.ok(
      incompatible.reasons.includes(
        "KNOWLEDGE_CONDITION_MISMATCH:180 C",
      ),
      JSON.stringify(
        incompatible,
        null,
        2,
      ),
    );

    assert.ok(
      !incompatible.reasons.some(
        (reason) =>
          reason.startsWith(
            "KNOWLEDGE_UNIT_MISMATCH:",
          ),
      ),
      JSON.stringify(
        incompatible,
        null,
        2,
      ),
    );

    const compatibleContext =
      svc.registerContext(
        createContext({
          id:
            "context:v8-25:compatible",
          scopeId:
            scope.aggregateId,
          purpose:
            "Evaluate Knowledge applicability with matching conditions and different unit metadata.",
          variables: {
            materialGrade: "PA66",
            testCondition: "180 C",
            unit: "inch",
          },
        }),
        actor,
      );

    const compatible =
      new ApplicabilityEngine(
        store,
      ).evaluate({
        knowledgeId:
          knowledge.aggregateId,
        scopeId:
          scope.aggregateId,
        contextId:
          compatibleContext.aggregateId,
      });

    assert.equal(
      compatible.applicable,
      true,
      JSON.stringify(
        compatible,
        null,
        2,
      ),
    );

    assert.deepEqual(
      compatible.reasons,
      [],
    );

    assert.deepEqual(
      knowledge.payload.units,
      ["mm"],
    );

    assert.equal(
      compatible.lineage.length,
      3,
    );

    assert.deepEqual(
      compatible.lineage.map(
        (item) => item.type,
      ),
      [
        "KNOWLEDGE",
        "SCOPE",
        "CONTEXT",
      ],
    );

    assert.doesNotThrow(() => {
      store.verifyChain();
    });
  },
);