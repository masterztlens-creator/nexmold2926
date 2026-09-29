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

import {
  expandEvidenceFromInternet,
} from "../../../.v8-build/src/v8/intelligence/evidence-expansion/expansion.js";

const ingestor = {
  id: "v8-09-internet-ingestor",
  role: "INGESTOR",
};

const auditor = {
  id: "v8-09-auditor",
  role: "AUDITOR",
};

/*
 * The acquisition boundary deliberately rejects loopback/private hosts.
 *
 * These integration tests therefore use eligible public HTTPS URLs while
 * intercepting the actual network call locally through globalThis.fetch.
 *
 * This preserves:
 *
 * public-source policy evaluation
 * -> HttpPageFetcher
 * -> fetched page
 * -> Source/Snapshot
 * -> Evidence
 * -> Audit/Verification
 * -> Claim
 *
 * without weakening SSRF protection or depending on external network state.
 */
async function withInternetFixture(
  body,
  fn,
) {
  const originalFetch =
    globalThis.fetch;

  const fixtureUrl =
    "https://example.com/fixture";

  globalThis.fetch =
    async (input) => {
      const requestedUrl =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      assert.equal(
        requestedUrl,
        fixtureUrl,
        "Fixture acquisition must use the eligible public test URL",
      );

      return new Response(
        body,
        {
          status: 200,
          headers: {
            "content-type":
              "text/plain; charset=utf-8",
          },
        },
      );
    };

  try {
    return await fn(
      fixtureUrl,
    );
  } finally {
    globalThis.fetch =
      originalFetch;
  }
}

async function acquireInternetFixture(
  url,
  store,
  candidate,
  discoveryProvenance,
) {
  const fetcher =
    new HttpPageFetcher();

  const page =
    await fetcher.fetch(
      url,
    );

  return ingestFetchedPage(
    store,
    page,
    [candidate],
    {
      actorId:
        ingestor.id,

      ...(discoveryProvenance
        ? {
            discoveryProvenance,
          }
        : {}),
    },
  );
}

test(
  "V8-09: Internet → Source → sealed Snapshot → Evidence → Audit → Claim",
  async () => {
    await withInternetFixture(
      "V8-09 governed evidence fixture",
      async (url) => {
        const store =
          new InMemoryFoundationStore();

        const service =
          new FoundationService(
            store,
          );

        const candidate = {
          locator: "body",
          excerpt:
            "V8-09 governed evidence fixture",
          parameter: "fixture",
          value: "governed",
          unit: "text",
          section: "body",
          extractionConfidence:
            "HIGH",
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

        assert.ok(
          snapshotRecord,
        );

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

        assert.ok(
          ingestedEvidence,
        );

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
                status:
                  "VERIFIED",
                fingerprint:
                  "ignored",
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
            (record) =>
              record.state,
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
              id:
                "v8-09-claim",

              statement:
                "The fixture is governed evidence.",

              evidenceIds: [
                evidenceId,
              ],

              status:
                "VERIFIED",

              fingerprint:
                "ignored",
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
              item.type ===
              "EVIDENCE",
          ),
        );

        assert.ok(
          claim.lineage.some(
            (item) =>
              item.type ===
              "SNAPSHOT",
          ),
        );

        assert.ok(
          claim.lineage.some(
            (item) =>
              item.type ===
              "SOURCE",
          ),
        );

        store.verifyChain();
      },
    );
  },
);

test(
  "V8-09: self-owned ResearchSeed provenance reaches persisted Evidence",
  async () => {
    await withInternetFixture(
      "V8-09 self-owned discovery provenance fixture",
      async (url) => {
        const store =
          new InMemoryFoundationStore();

        const seedUrl =
          url.replace(
            "/fixture",
            "/plastic-injection-molding-wall-thickness",
          );

        const originalFetch =
          globalThis.fetch;

        globalThis.fetch =
          async (input) => {
            const requestedUrl =
              typeof input === "string"
                ? input
                : input instanceof URL
                  ? input.toString()
                  : input.url;

            assert.equal(
              requestedUrl,
              seedUrl,
              "Self-owned discovery must acquire the explicit ResearchSeed URL",
            );

            return new Response(
              "V8-09 self-owned discovery provenance fixture",
              {
                status: 200,
                headers: {
                  "content-type":
                    "text/plain; charset=utf-8",
                },
              },
            );
          };

        try {
          const result =
            await expandEvidenceFromInternet(
              [
                "plastic injection molding wall thickness",
              ],
              undefined,
              new HttpPageFetcher(),
              store,
              {
                actorId:
                  ingestor.id,

                researchSeeds: [
                  {
                    url:
                      seedUrl,

                    source:
                      "DIRECT",

                    reason:
                      "V8-09 self-owned provenance integration fixture",
                  },
                ],

                maxPages: 1,
                maxDepth: 0,
                sameHostOnly: true,
                maxCandidates: 1,
              },
            );

          assert.equal(
            result.searchErrors.length,
            0,
          );

          assert.equal(
            result.fetchErrors.length,
            0,
          );

          assert.equal(
            result.acquisitions.length,
            1,
          );

          const acquisition =
            result.acquisitions[0];

          assert.ok(
            acquisition,
          );

          assert.equal(
            acquisition.candidate
              .qualification
              ?.status,
            "QUALIFIED",
          );

          assert.ok(
            acquisition.candidate
              .discoveryProvenance,
          );

          assert.equal(
            acquisition.candidate
              .discoveryProvenance
              .status,
            "EXPLICIT_RESEARCH_SEED",
          );

          assert.equal(
            acquisition.candidate
              .discoveryProvenance
              .provider,
            "DIRECT",
          );

          assert.equal(
            acquisition.candidate
              .discoveryProvenance
              .researchSeedUrl,
            seedUrl,
          );

          assert.equal(
            acquisition.candidate
              .discoveryProvenance
              .discoveredUrl,
            seedUrl,
          );

          assert.equal(
            acquisition.candidate
              .discoveryProvenance
              .canonicalUrl,
            seedUrl,
          );

          assert.ok(
            acquisition.evidence
              .evidence.length > 0,
          );

          const evidenceId =
            acquisition.evidence
              .evidence[0]
              .sourceId;

          assert.ok(
            evidenceId,
          );

          const evidenceRecords =
            store
              .auditTrail()
              .filter(
                (record) =>
                  record.aggregateType ===
                    "EVIDENCE" &&
                  record.state ===
                    "INGESTED",
              );

          assert.equal(
            evidenceRecords.length,
            1,
          );

          const evidence =
            evidenceRecords[0];

          assert.ok(
            evidence.payload
              .discoveryProvenance,
          );

          assert.equal(
            evidence.payload
              .discoveryProvenance
              .status,
            "EXPLICIT_RESEARCH_SEED",
          );

          assert.equal(
            evidence.payload
              .discoveryProvenance
              .provider,
            "DIRECT",
          );

          assert.equal(
            evidence.payload
              .discoveryProvenance
              .researchSeedUrl,
            seedUrl,
          );

          assert.equal(
            evidence.payload
              .discoveryProvenance
              .discoveredUrl,
            seedUrl,
          );

          assert.equal(
            evidence.payload
              .discoveryProvenance
              .canonicalUrl,
            seedUrl,
          );

          assert.ok(
            evidence.payload
              .discoveryProvenance
              .discoveredAt,
          );

          /*
           * The provenance is part of the immutable Evidence payload.
           * Therefore the Foundation record fingerprint binds it to the
           * exact Evidence version.
           */
          const persistedEvidence =
            store.get(
              "EVIDENCE",
              evidence.aggregateId,
            );

          assert.ok(
            persistedEvidence,
          );

          assert.deepEqual(
            persistedEvidence
              .payload
              .discoveryProvenance,
            evidence.payload
              .discoveryProvenance,
          );

          store.verifyChain();
        } finally {
          globalThis.fetch =
            originalFetch;
        }
      },
    );
  },
);

test(
  "V8-11: Claim lineage remains bound to the exact Evidence version and fingerprint",
  async () => {
    await withInternetFixture(
      "V8-11 immutable claim fixture",
      async (url) => {
        const store =
          new InMemoryFoundationStore();

        const service =
          new FoundationService(
            store,
          );

        const candidate = {
          locator: "body",
          excerpt:
            "V8-11 immutable claim fixture",
          parameter: "fixture",
          value: "original",
          unit: "text",
          section: "body",
          extractionConfidence:
            "HIGH",
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
              id:
                "v8-11-claim",

              statement:
                "The fixture contains the original governed value.",

              evidenceIds: [
                evidenceId,
              ],

              status:
                "VERIFIED",

              fingerprint:
                "ignored",
            },
            auditor,
          );

        const claimEvidenceLineage =
          claim.lineage.find(
            (item) =>
              item.type ===
                "EVIDENCE" &&
              item.id ===
                evidenceId,
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

        const laterEvidence =
          store.append({
            aggregateType:
              "EVIDENCE",

            aggregateId:
              evidenceId,

            version:
              verifiedEvidence.version +
              1,

            state:
              "RETIRED",

            payload: {
              ...verifiedEvidence.payload,

              value:
                "replacement",

              excerpt:
                "V8-11 replacement evidence content",

              evidenceHash:
                `${verifiedEvidence.payload.evidenceHash}:replacement`,
            },

            lineage:
              verifiedEvidence.lineage,

            actor:
              auditor,

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
              item.type ===
                "EVIDENCE" &&
              item.id ===
                evidenceId,
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
            (record) =>
              record.state,
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
            evidenceHistory.length -
              1
          ].version,
          laterEvidence.version,
        );

        store.verifyChain();
      },
    );
  },
);