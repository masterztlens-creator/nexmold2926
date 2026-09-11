import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  HttpPageFetcher,
  ingestFetchedPage,
  evidenceAggregateId,
} from "../../../.v8-build/src/v8/acquisition/index.js";

const ingestor = {
  id: "v8-09-internet-ingestor",
  role: "INGESTOR",
};

const auditor = {
  id: "v8-09-auditor",
  role: "AUDITOR",
};

async function withServer(handler, fn) {
  const server = createServer(handler);

  await new Promise((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );

  try {
    const address = server.address();

    assert.ok(
      address && typeof address === "object",
    );

    return await fn(
      `http://127.0.0.1:${address.port}/fixture`,
    );
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) =>
        error ? reject(error) : resolve(),
      );
    });
  }
}

async function acquireInternetFixture(
  url,
  store,
  candidate,
) {
  const fetcher = new HttpPageFetcher();

  const page = await fetcher.fetch(url);

  return ingestFetchedPage(
    store,
    page,
    [candidate],
    {
      actorId: ingestor.id,
    },
  );
}

test(
  "V8-09: Internet → Source → sealed Snapshot → Evidence → Audit → Claim",
  async () => {
    await withServer((_req, res) => {
      res.writeHead(200, {
        "content-type":
          "text/plain; charset=utf-8",
      });

      res.end(
        "V8-09 governed evidence fixture",
      );
    }, async (url) => {
      const store =
        new InMemoryFoundationStore();

      const service =
        new FoundationService(store);

      const candidate = {
        locator: "body",
        excerpt:
          "V8-09 governed evidence fixture",
        parameter: "fixture",
        value: "governed",
        unit: "text",
        section: "body",
        extractionConfidence: "HIGH",
      };

      const acquired =
        await acquireInternetFixture(
          url,
          store,
          candidate,
        );

      assert.equal(
        acquired.sourceId.length > 0,
        true,
      );

      assert.equal(
        acquired.snapshotId.length > 0,
        true,
      );

      assert.equal(
        acquired.snapshot.contentHash.length > 0,
        true,
      );

      const snapshotRecord =
        store.get(
          "SNAPSHOT",
          acquired.snapshotId,
        );

      assert.ok(snapshotRecord);

      assert.equal(
        snapshotRecord.state,
        "SEALED",
      );

      assert.equal(
        acquired.evidence.length,
        1,
      );

      const evidenceId =
        evidenceAggregateId(
          acquired.sourceId,
          acquired.snapshotId,
          candidate,
          acquired.snapshot.contentHash,
        );

      const ingestedEvidence =
        store.get(
          "EVIDENCE",
          evidenceId,
        );

      assert.ok(ingestedEvidence);

      assert.equal(
        ingestedEvidence.state,
        "INGESTED",
      );

      assert.equal(
        ingestedEvidence.payload
          .verificationStatus,
        "UNVERIFIED",
      );

      assert.throws(
        () =>
          service.createClaim(
            {
              id:
                "v8-09-premature-claim",
              statement:
                "The fixture is governed evidence.",
              evidenceIds: [
                evidenceId,
              ],
              status: "VERIFIED",
              fingerprint: "ignored",
            },
            auditor,
          ),
        /CLAIM_EVIDENCE_NOT_VERIFIED|EVIDENCE_NOT_VERIFIED/,
      );

      const audited =
        service.verifyEvidence(
          evidenceId,
          auditor,
        );

      assert.equal(
        audited.state,
        "VERIFIED",
      );

      assert.equal(
        audited.payload
          .verificationStatus,
        "VERIFIED",
      );

      const evidenceHistory =
        store.history(
          "EVIDENCE",
          evidenceId,
        );

      assert.deepEqual(
        evidenceHistory.map(
          (record) => record.state,
        ),
        [
          "INGESTED",
          "AUDITED",
          "VERIFIED",
        ],
      );

      const claim =
        service.createClaim(
          {
            id: "v8-09-claim",
            statement:
              "The fixture is governed evidence.",
            evidenceIds: [
              evidenceId,
            ],
            status: "VERIFIED",
            fingerprint: "ignored",
          },
          auditor,
        );

      assert.equal(
        claim.state,
        "VERIFIED",
      );

      assert.equal(
        claim.payload.statement,
        "The fixture is governed evidence.",
      );

      assert.ok(
        claim.lineage.some(
          (item) =>
            item.type === "EVIDENCE",
        ),
      );

      assert.ok(
        claim.lineage.some(
          (item) =>
            item.type === "SNAPSHOT",
        ),
      );

      assert.ok(
        claim.lineage.some(
          (item) =>
            item.type === "SOURCE",
        ),
      );

      store.verifyChain();
    });
  },
);

test(
  "V8-11: Claim lineage remains bound to the exact Evidence version and fingerprint",
  async () => {
    await withServer((_req, res) => {
      res.writeHead(200, {
        "content-type":
          "text/plain; charset=utf-8",
      });

      res.end(
        "V8-11 immutable claim fixture",
      );
    }, async (url) => {
      const store =
        new InMemoryFoundationStore();

      const service =
        new FoundationService(store);

      const candidate = {
        locator: "body",
        excerpt:
          "V8-11 immutable claim fixture",
        parameter: "fixture",
        value: "original",
        unit: "text",
        section: "body",
        extractionConfidence: "HIGH",
      };

      const acquired =
        await acquireInternetFixture(
          url,
          store,
          candidate,
        );

      const evidenceId =
        evidenceAggregateId(
          acquired.sourceId,
          acquired.snapshotId,
          candidate,
          acquired.snapshot.contentHash,
        );

      const verifiedEvidence =
        service.verifyEvidence(
          evidenceId,
          auditor,
        );

      assert.equal(
        verifiedEvidence.state,
        "VERIFIED",
      );

      const claim =
        service.createClaim(
          {
            id: "v8-11-claim",
            statement:
              "The fixture contains the original governed value.",
            evidenceIds: [
              evidenceId,
            ],
            status: "VERIFIED",
            fingerprint: "ignored",
          },
          auditor,
        );

      const claimEvidenceLineage =
        claim.lineage.find(
          (item) =>
            item.type === "EVIDENCE" &&
            item.id === evidenceId,
        );

      assert.ok(
        claimEvidenceLineage,
        "Claim must contain exact Evidence lineage",
      );

      assert.equal(
        claimEvidenceLineage.version,
        verifiedEvidence.version,
        "Claim must bind the Evidence version used at creation",
      );

      assert.equal(
        claimEvidenceLineage.fingerprint,
        verifiedEvidence.fingerprint,
        "Claim must bind the Evidence fingerprint used at creation",
      );

      const originalVersion =
        verifiedEvidence.version;

      const originalFingerprint =
        verifiedEvidence.fingerprint;

      /*
       * Create a later Evidence history version
       * through the actual Foundation state machine.
       *
       * The Foundation contract permits:
       *
       * VERIFIED -> RETIRED
       *
       * This intentionally creates a later Evidence
       * record without modifying the already-created
       * Claim lineage.
       */
      const laterEvidence =
        store.append({
          aggregateType: "EVIDENCE",
          aggregateId: evidenceId,
          version:
            verifiedEvidence.version + 1,
          state: "RETIRED",
          payload: {
            ...verifiedEvidence.payload,
            value: "replacement",
            excerpt:
              "V8-11 replacement evidence content",
            evidenceHash:
              `${verifiedEvidence.payload.evidenceHash}:replacement`,
          },
          lineage:
            verifiedEvidence.lineage,
          actor: auditor,
          reason:
            "V8-11 evidence history retirement fixture",
        });

      assert.equal(
        laterEvidence.version,
        originalVersion + 1,
      );

      assert.equal(
        laterEvidence.state,
        "RETIRED",
      );

      assert.notEqual(
        laterEvidence.fingerprint,
        originalFingerprint,
        "A changed Evidence version must have a different record fingerprint",
      );

      const persistedClaim =
        store.get(
          "CLAIM",
          claim.aggregateId,
        );

      assert.ok(
        persistedClaim,
      );

      const persistedClaimEvidenceLineage =
        persistedClaim.lineage.find(
          (item) =>
            item.type === "EVIDENCE" &&
            item.id === evidenceId,
        );

      assert.ok(
        persistedClaimEvidenceLineage,
      );

      assert.equal(
        persistedClaimEvidenceLineage.version,
        originalVersion,
        "Existing Claim must remain bound to the original Evidence version",
      );

      assert.equal(
        persistedClaimEvidenceLineage.fingerprint,
        originalFingerprint,
        "Existing Claim must remain bound to the original Evidence fingerprint",
      );

      assert.notEqual(
        persistedClaimEvidenceLineage.version,
        laterEvidence.version,
        "Claim lineage must not silently follow a later Evidence version",
      );

      assert.notEqual(
        persistedClaimEvidenceLineage.fingerprint,
        laterEvidence.fingerprint,
        "Claim lineage must not silently follow a later Evidence fingerprint",
      );

      const evidenceHistory =
        store.history(
          "EVIDENCE",
          evidenceId,
        );

      assert.equal(
        evidenceHistory.length,
        4,
        "Evidence history must preserve the original verification record and later retirement version",
      );

      assert.deepEqual(
        evidenceHistory.map(
          (record) => record.state,
        ),
        [
          "INGESTED",
          "AUDITED",
          "VERIFIED",
          "RETIRED",
        ],
      );

      assert.equal(
        evidenceHistory[
          evidenceHistory.length - 1
        ].version,
        laterEvidence.version,
      );

      store.verifyChain();
    });
  },
);