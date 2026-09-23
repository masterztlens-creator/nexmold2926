import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  createClaim,
  createKnowledge,
} from "../../../.v8-build/src/v8/domain/index.js";

const ACTOR = {
  id: "v8-24-knowledge-gate",
  role: "SYSTEM",
};

const AUDITOR = {
  id: "v8-24-knowledge-auditor",
  role: "AUDITOR",
};

function fixtureHash(content) {
  return createHash("sha256")
    .update(content, "utf8")
    .digest("hex");
}

function createVerifiedClaimFixture() {
  const store =
    new InMemoryFoundationStore();

  const service =
    new FoundationService(store);

  const sourceContent =
    "ABS material at 23 C injection molding requires 2.5 mm wall thickness.";

  const source = {
    kind: "PUBLIC_WEB",
    locator:
      "https://example.com/v8-24",
    access: "PAYLOAD_ALLOWED",
    title:
      "V8-24 Knowledge Scope Fixture",
    version: "1",
    publisher:
      "V8-24 Test Authority",
    authority:
      "ENGINEERING_REFERENCE",
    canonicalUrl:
      "https://example.com/v8-24",
    retrievedAt:
      "2026-09-23T00:00:00.000Z",
    documentHash:
      fixtureHash(sourceContent),
  };

  const registered =
    service.registerSource(
      source,
      ACTOR,
    );

  const snapshot =
    service.captureSnapshot(
      {
        source: registered.payload,
        capturedAt:
          "2026-09-23T00:00:00.000Z",
        locator:
          source.locator,
        content:
          sourceContent,
        metadataOnly: false,
      },
      ACTOR,
    );

  service.sealSnapshot(
    snapshot.aggregateId,
    ACTOR,
  );

  const evidence =
    service.ingestEvidence(
      {
        id:
          "evidence:v8-24:1",
        sourceId:
          registered.aggregateId,
        snapshotId:
          snapshot.aggregateId,
        locator:
          "v8-24:p1",
        excerpt:
          sourceContent,
        capturedAt:
          snapshot.recordedAt,
        ingestion:
          "INGESTED",
        parameter:
          "wall thickness",
        value:
          "2.5",
        unit:
          "mm",
        materialGrade:
          "ABS",
        testCondition:
          "23 C",
        section:
          "engineering recommendation",
      },
      ACTOR,
    );

  service.verifyEvidence(
    evidence.aggregateId,
    AUDITOR,
  );

  const claim =
    service.createClaim(
      createClaim({
        id:
          "claim:v8-24:conditioned",
        statement:
          "For ABS material at 23 C in injection molding, a 2.5 mm wall thickness is recommended.",
        evidenceIds: [
          evidence.aggregateId,
        ],
        status:
          "VERIFIED",
        fingerprint:
          "ignored",
        scope:
          "injection molding",
        conditions: [
          "ABS",
          "23 C",
        ],
        units: [
          "mm",
        ],
        isUniversal:
          false,
      }),
      AUDITOR,
    );

  return {
    store,
    service,
    claim,
  };
}

test(
  "V8-24: conditioned Claim can become Knowledge only when applicability constraints are preserved",
  () => {
    const {
      service,
      claim,
    } =
      createVerifiedClaimFixture();

    const knowledge =
      service.createKnowledge(
        createKnowledge({
          id:
            "knowledge:v8-24:preserved",
          proposition:
            "For ABS material at 23 C in injection molding, a 2.5 mm wall thickness is recommended.",
          claimIds: [
            claim.aggregateId,
          ],
          status:
            "APPROVED",
          fingerprint:
            "ignored",
          scope:
            "injection molding",
          conditions: [
            "ABS",
            "23 C",
          ],
          units: [
            "mm",
          ],
          isUniversal:
            false,
        }),
        AUDITOR,
      );

    assert.equal(
      knowledge.state,
      "VERIFIED",
    );

    assert.equal(
      knowledge.payload.scope,
      "injection molding",
    );

    assert.deepEqual(
      knowledge.payload.conditions,
      [
        "23 C",
        "ABS",
      ],
    );

    assert.deepEqual(
      knowledge.payload.units,
      [
        "mm",
      ],
    );

    assert.equal(
      knowledge.payload.isUniversal,
      false,
    );

    service.storeView.verifyChain();
  },
);

test(
  "V8-24: Knowledge cannot silently drop Claim conditions",
  () => {
    const {
      service,
      claim,
    } =
      createVerifiedClaimFixture();

    assert.throws(
      () =>
        service.createKnowledge(
          createKnowledge({
            id:
              "knowledge:v8-24:dropped-condition",
            proposition:
              "A 2.5 mm wall thickness is recommended.",
            claimIds: [
              claim.aggregateId,
            ],
            status:
              "APPROVED",
            fingerprint:
              "ignored",
            scope:
              "injection molding",
            units: [
              "mm",
            ],
            isUniversal:
              false,
          }),
          AUDITOR,
        ),
      /V8_KNOWLEDGE_CONDITION_DROPPED/,
    );

    assert.equal(
      service.storeView.get(
        "KNOWLEDGE",
        "knowledge:v8-24:dropped-condition",
      ),
      null,
    );

    service.storeView.verifyChain();
  },
);

test(
  "V8-24: Knowledge cannot silently drop Claim scope",
  () => {
    const {
      service,
      claim,
    } =
      createVerifiedClaimFixture();

    assert.throws(
      () =>
        service.createKnowledge(
          createKnowledge({
            id:
              "knowledge:v8-24:dropped-scope",
            proposition:
              "For ABS material at 23 C, a 2.5 mm wall thickness is recommended.",
            claimIds: [
              claim.aggregateId,
            ],
            status:
              "APPROVED",
            fingerprint:
              "ignored",
            conditions: [
              "ABS",
              "23 C",
            ],
            units: [
              "mm",
            ],
            isUniversal:
              false,
          }),
          AUDITOR,
        ),
      /V8_KNOWLEDGE_SCOPE_DROPPED/,
    );

    assert.equal(
      service.storeView.get(
        "KNOWLEDGE",
        "knowledge:v8-24:dropped-scope",
      ),
      null,
    );

    service.storeView.verifyChain();
  },
);

test(
  "V8-24: conditioned Claim cannot become universal Knowledge",
  () => {
    const {
      service,
      claim,
    } =
      createVerifiedClaimFixture();

    assert.throws(
      () =>
        service.createKnowledge(
          createKnowledge({
            id:
              "knowledge:v8-24:universal",
            proposition:
              "A 2.5 mm wall thickness is universally recommended.",
            claimIds: [
              claim.aggregateId,
            ],
            status:
              "APPROVED",
            fingerprint:
              "ignored",
            isUniversal:
              true,
          }),
          AUDITOR,
        ),
      /V8_KNOWLEDGE_SCOPE_DROPPED|V8_KNOWLEDGE_CONDITION_DROPPED|V8_KNOWLEDGE_UNSUPPORTED_UNIVERSALIZATION/,
    );

    assert.equal(
      service.storeView.get(
        "KNOWLEDGE",
        "knowledge:v8-24:universal",
      ),
      null,
    );

    service.storeView.verifyChain();
  },
);