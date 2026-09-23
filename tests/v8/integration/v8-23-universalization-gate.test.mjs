import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  HttpPageFetcher,
  ingestFetchedPage,
  evidenceAggregateId,
} from "../../../.v8-build/src/v8/acquisition/index.js";

const INGESTOR = {
  id: "v8-23-universalization-ingestor",
  role: "INGESTOR",
};

const AUDITOR = {
  id: "v8-23-universalization-auditor",
  role: "AUDITOR",
};

const FIXTURE_URL =
  "https://example.com/v8-23-universalization-fixture";

const FIXTURE_BODY =
  "V8-23 conditioned engineering evidence fixture";

async function withInternetFixture(fn) {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async (input) => {
    const requestedUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;

    assert.equal(
      requestedUrl,
      FIXTURE_URL,
      "Universalization fixture must use the eligible public HTTPS URL",
    );

    return new Response(FIXTURE_BODY, {
      status: 200,
      headers: {
        "content-type":
          "text/plain; charset=utf-8",
      },
    });
  };

  try {
    return await fn(FIXTURE_URL);
  } finally {
    globalThis.fetch = originalFetch;
  }
}

async function acquireConditionedEvidence(
  url,
  store,
) {
  const fetcher = new HttpPageFetcher();

  const page = await fetcher.fetch(url);

  const candidate = {
    locator: "body",
    excerpt: FIXTURE_BODY,
    parameter: "recommended wall thickness",
    value: "2.5",
    unit: "mm",
    section: "engineering recommendation",
    materialGrade: "ABS",
    testCondition: "23 °C",
    extractionConfidence: "HIGH",
  };

  const acquired = await ingestFetchedPage(
    store,
    page,
    [candidate],
    {
      actorId: INGESTOR.id,
    },
  );

  const evidenceId = evidenceAggregateId(
    acquired.sourceId,
    acquired.snapshotId,
    candidate,
    acquired.snapshot.contentHash,
  );

  return {
    acquired,
    candidate,
    evidenceId,
  };
}

test(
  "V8-23: conditioned verified Evidence cannot be promoted to a universal Claim",
  async () => {
    await withInternetFixture(async (url) => {
      const store =
        new InMemoryFoundationStore();

      const service =
        new FoundationService(store);

      const {
        acquired,
        candidate,
        evidenceId,
      } =
        await acquireConditionedEvidence(
          url,
          store,
        );

      const snapshotRecord =
        store.get(
          "SNAPSHOT",
          acquired.snapshotId,
        );

      assert.ok(
        snapshotRecord,
        "Acquisition must persist a Snapshot",
      );

      assert.equal(
        snapshotRecord.state,
        "SEALED",
        "Snapshot must be SEALED before Evidence verification",
      );

      const ingestedEvidence =
        store.get(
          "EVIDENCE",
          evidenceId,
        );

      assert.ok(
        ingestedEvidence,
        "Conditioned Evidence must be persisted",
      );

      assert.equal(
        ingestedEvidence.state,
        "INGESTED",
      );

      assert.equal(
        ingestedEvidence.payload.materialGrade,
        candidate.materialGrade,
      );

      assert.equal(
        ingestedEvidence.payload.testCondition,
        candidate.testCondition,
      );

      const verifiedEvidence =
        service.verifyEvidence(
          evidenceId,
          AUDITOR,
        );

      assert.equal(
        verifiedEvidence.state,
        "VERIFIED",
        "The conditioned Evidence must first become VERIFIED",
      );

      assert.equal(
        verifiedEvidence.payload
          .verificationStatus,
        "VERIFIED",
      );

      assert.throws(
        () =>
          service.createClaim(
            {
              id:
                "v8-23-universal-claim-rejected",

              statement:
                "A 2.5 mm wall thickness is universally recommended for injection molded parts.",

              evidenceIds: [
                evidenceId,
              ],

              status: "VERIFIED",

              fingerprint: "ignored",

              isUniversal: true,
            },
            AUDITOR,
          ),
        (error) => {
          assert.match(
            error.message,
            /V8_CLAIM_UNSUPPORTED_UNIVERSALIZATION/,
          );

          return true;
        },
        "Conditioned Evidence must fail the universalization gate",
      );

      assert.equal(
        store.get(
          "CLAIM",
          "v8-23-universal-claim-rejected",
        ),
        undefined,
        "Rejected universal Claim must never be persisted",
      );

      const verificationRecords =
        store
          .auditTrail()
          .filter(
            (record) =>
              record.aggregateType ===
              "VERIFICATION",
          );

      assert.equal(
        verificationRecords.length,
        1,
        "Universalization rejection must not create a false PASS verification",
      );

      assert.equal(
        verificationRecords[0].payload
          .targetType,
        "EVIDENCE",
      );

      assert.equal(
        verificationRecords[0].payload
          .targetId,
        evidenceId,
      );

      assert.equal(
        verificationRecords[0].state,
        "VERIFIED",
      );

      store.verifyChain();
    });
  },
);