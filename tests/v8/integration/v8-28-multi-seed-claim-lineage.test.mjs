import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  HttpPageFetcher,
} from "../../../.v8-build/src/v8/acquisition/index.js";

import {
  expandEvidenceFromInternet,
} from "../../../.v8-build/src/v8/intelligence/evidence-expansion/expansion.js";

const ingestor = {
  id: "v8-28-integration-ingestor",
  role: "INGESTOR",
};

const auditor = {
  id: "v8-28-integration-auditor",
  role: "AUDITOR",
};

test(
  "V8-28: multiple ResearchSeeds preserve independent Evidence → Claim provenance and exact lineage",
  async () => {
    const store =
      new InMemoryFoundationStore();

    const service =
      new FoundationService(
        store,
      );

    const seedA =
      "https://example.com/research-seed-a";

    const seedB =
      "https://example.com/research-seed-b";

    const originalFetch =
      globalThis.fetch;

    const pages = {
      [seedA]: `
        <html>
          <head>
            <title>
              Injection Molding Wall Thickness A
            </title>
          </head>
          <body>
            <article>
              <h1>
                Injection Molding Wall Thickness A
              </h1>
              <p>
                Seed A engineering evidence:
                nominal wall thickness guidance
                for injection molded parts.
              </p>
            </article>
          </body>
        </html>
      `,

      [seedB]: `
        <html>
          <head>
            <title>
              Injection Molding Wall Thickness B
            </title>
          </head>
          <body>
            <article>
              <h1>
                Injection Molding Wall Thickness B
              </h1>
              <p>
                Seed B engineering evidence:
                alternative wall thickness guidance
                for injection molded parts.
              </p>
            </article>
          </body>
        </html>
      `,
    };

    globalThis.fetch =
      async (input) => {
        const requestedUrl =
          typeof input === "string"
            ? input
            : input instanceof URL
              ? input.toString()
              : input.url;

        assert.ok(
          Object.hasOwn(
            pages,
            requestedUrl,
          ),
          `Unexpected fixture URL: ${requestedUrl}`,
        );

        return new Response(
          pages[requestedUrl],
          {
            status: 200,

            headers: {
              "content-type":
                "text/html; charset=utf-8",
            },
          },
        );
      };

    try {
      const result =
        await expandEvidenceFromInternet(
          [
            "injection molding wall thickness",
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
                  seedA,

                source:
                  "DIRECT",

                reason:
                  "V8-28 Seed A independent provenance fixture",
              },

              {
                url:
                  seedB,

                source:
                  "DIRECT",

                reason:
                  "V8-28 Seed B independent provenance fixture",
              },
            ],

            maxPages:
              2,

            maxDepth:
              0,

            sameHostOnly:
              true,

            maxCandidates:
              2,
          },
        );

      /*
       * ------------------------------------------------------------
       * 1. RESEARCH DISCOVERY
       * ------------------------------------------------------------
       */

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
        2,
      );

      const acquisitions =
        result.acquisitions;

      assert.equal(
        acquisitions.length,
        2,
      );

      /*
       * Each ResearchSeed must retain its own discovery provenance.
       */

      const acquisitionA =
        acquisitions.find(
          (acquisition) =>
            acquisition.candidate
              .discoveryProvenance
              ?.researchSeedUrl ===
            seedA,
        );

      const acquisitionB =
        acquisitions.find(
          (acquisition) =>
            acquisition.candidate
              .discoveryProvenance
              ?.researchSeedUrl ===
            seedB,
        );

      assert.ok(
        acquisitionA,
        "Seed A must produce an acquisition carrying Seed A provenance",
      );

      assert.ok(
        acquisitionB,
        "Seed B must produce an acquisition carrying Seed B provenance",
      );

      assert.equal(
        acquisitionA.candidate
          .discoveryProvenance
          .status,
        "EXPLICIT_RESEARCH_SEED",
      );

      assert.equal(
        acquisitionB.candidate
          .discoveryProvenance
          .status,
        "EXPLICIT_RESEARCH_SEED",
      );

      assert.equal(
        acquisitionA.candidate
          .discoveryProvenance
          .researchSeedUrl,
        seedA,
      );

      assert.equal(
        acquisitionB.candidate
          .discoveryProvenance
          .researchSeedUrl,
        seedB,
      );

      assert.notEqual(
        acquisitionA.candidate
          .discoveryProvenance
          .researchSeedUrl,
        acquisitionB.candidate
          .discoveryProvenance
          .researchSeedUrl,
      );

      /*
       * ------------------------------------------------------------
       * 2. PERSISTED EVIDENCE
       * ------------------------------------------------------------
       */

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
        2,
        "Exactly two independent Evidence records must be persisted",
      );

      const evidenceA =
        evidenceRecords.find(
          (record) =>
            record.payload
              .discoveryProvenance
              ?.researchSeedUrl ===
            seedA,
        );

      const evidenceB =
        evidenceRecords.find(
          (record) =>
            record.payload
              .discoveryProvenance
              ?.researchSeedUrl ===
            seedB,
        );

      assert.ok(
        evidenceA,
        "Persisted Evidence A must retain Seed A provenance",
      );

      assert.ok(
        evidenceB,
        "Persisted Evidence B must retain Seed B provenance",
      );

      /*
       * Provenance must survive the acquisition boundary exactly.
       */

      assert.equal(
        evidenceA.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedA,
      );

      assert.equal(
        evidenceB.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedB,
      );

      assert.equal(
        evidenceA.payload
          .discoveryProvenance
          .discoveredUrl,
        seedA,
      );

      assert.equal(
        evidenceB.payload
          .discoveryProvenance
          .discoveredUrl,
        seedB,
      );

      assert.notEqual(
        evidenceA.aggregateId,
        evidenceB.aggregateId,
        "Independent Evidence must have distinct Evidence identities",
      );

      assert.notEqual(
        evidenceA.fingerprint,
        evidenceB.fingerprint,
        "Independent Evidence records must have distinct fingerprints",
      );

      /*
       * ------------------------------------------------------------
       * 3. PROVENANCE MUST NOT CROSS-CONTAMINATE
       * ------------------------------------------------------------
       */

      assert.notEqual(
        evidenceA.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedB,
        "Evidence A must never inherit Seed B provenance",
      );

      assert.notEqual(
        evidenceB.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedA,
        "Evidence B must never inherit Seed A provenance",
      );

      /*
       * ------------------------------------------------------------
       * 4. VERIFY BOTH EVIDENCE RECORDS
       * ------------------------------------------------------------
       */

      const verifiedEvidenceA =
        service.verifyEvidence(
          evidenceA.aggregateId,
          auditor,
        );

      const verifiedEvidenceB =
        service.verifyEvidence(
          evidenceB.aggregateId,
          auditor,
        );

      assert.equal(
        verifiedEvidenceA.state,
        "VERIFIED",
      );

      assert.equal(
        verifiedEvidenceB.state,
        "VERIFIED",
      );

      /*
       * Verification must preserve the exact provenance payload.
       */

      assert.equal(
        verifiedEvidenceA.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedA,
      );

      assert.equal(
        verifiedEvidenceB.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedB,
      );

      /*
       * ------------------------------------------------------------
       * 5. CREATE CLAIM A
       * ------------------------------------------------------------
       */

      const claimA =
        service.createClaim(
          {
            id:
              "v8-28-claim-seed-a",

            statement:
              "Seed A contains governed injection molding wall thickness evidence.",

            evidenceIds: [
              evidenceA.aggregateId,
            ],

            status:
              "VERIFIED",

            fingerprint:
              "ignored",
          },

          auditor,
        );

      assert.equal(
        claimA.state,
        "VERIFIED",
      );

      /*
       * Claim A must bind to the exact Evidence A version
       * and fingerprint used at Claim creation.
       */

      const claimAEvidenceLineage =
        claimA.lineage.find(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceA.aggregateId,
        );

      assert.ok(
        claimAEvidenceLineage,
        "Claim A must contain exact Evidence A lineage",
      );

      assert.equal(
        claimAEvidenceLineage.version,
        verifiedEvidenceA.version,
      );

      assert.equal(
        claimAEvidenceLineage.fingerprint,
        verifiedEvidenceA.fingerprint,
      );

      /*
       * Claim A must retain the complete upstream chain.
       */

      assert.ok(
        claimA.lineage.some(
          (item) =>
            item.type ===
            "SNAPSHOT",
        ),
        "Claim A must contain Snapshot lineage",
      );

      assert.ok(
        claimA.lineage.some(
          (item) =>
            item.type ===
            "SOURCE",
        ),
        "Claim A must contain Source lineage",
      );

      /*
       * ------------------------------------------------------------
       * 6. CREATE CLAIM B
       * ------------------------------------------------------------
       */

      const claimB =
        service.createClaim(
          {
            id:
              "v8-28-claim-seed-b",

            statement:
              "Seed B contains governed injection molding wall thickness evidence.",

            evidenceIds: [
              evidenceB.aggregateId,
            ],

            status:
              "VERIFIED",

            fingerprint:
              "ignored",
          },

          auditor,
        );

      assert.equal(
        claimB.state,
        "VERIFIED",
      );

      const claimBEvidenceLineage =
        claimB.lineage.find(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceB.aggregateId,
        );

      assert.ok(
        claimBEvidenceLineage,
        "Claim B must contain exact Evidence B lineage",
      );

      assert.equal(
        claimBEvidenceLineage.version,
        verifiedEvidenceB.version,
      );

      assert.equal(
        claimBEvidenceLineage.fingerprint,
        verifiedEvidenceB.fingerprint,
      );

      /*
       * Claim B must retain the complete upstream chain.
       */

      assert.ok(
        claimB.lineage.some(
          (item) =>
            item.type ===
            "SNAPSHOT",
        ),
        "Claim B must contain Snapshot lineage",
      );

      assert.ok(
        claimB.lineage.some(
          (item) =>
            item.type ===
            "SOURCE",
        ),
        "Claim B must contain Source lineage",
      );

      /*
       * ------------------------------------------------------------
       * 7. CLAIMS MUST NOT CROSS THEIR EVIDENCE
       * ------------------------------------------------------------
       */

      assert.notEqual(
        claimA.aggregateId,
        claimB.aggregateId,
      );

      assert.ok(
        claimA.lineage.some(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceA.aggregateId,
        ),
      );

      assert.ok(
        claimB.lineage.some(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceB.aggregateId,
        ),
      );

      assert.equal(
        claimA.lineage.some(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceB.aggregateId,
        ),
        false,
        "Claim A must never bind to Evidence B",
      );

      assert.equal(
        claimB.lineage.some(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceA.aggregateId,
        ),
        false,
        "Claim B must never bind to Evidence A",
      );

      /*
       * ------------------------------------------------------------
       * 8. READBACK FROM FOUNDATION STORE
       * ------------------------------------------------------------
       */

      const persistedClaimA =
        store.get(
          "CLAIM",
          claimA.aggregateId,
        );

      const persistedClaimB =
        store.get(
          "CLAIM",
          claimB.aggregateId,
        );

      assert.ok(
        persistedClaimA,
        "Claim A must be persisted",
      );

      assert.ok(
        persistedClaimB,
        "Claim B must be persisted",
      );

      const persistedClaimAEvidence =
        persistedClaimA.lineage.find(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceA.aggregateId,
        );

      const persistedClaimBEvidence =
        persistedClaimB.lineage.find(
          (item) =>
            item.type ===
              "EVIDENCE" &&
            item.id ===
              evidenceB.aggregateId,
        );

      assert.equal(
        persistedClaimAEvidence.version,
        verifiedEvidenceA.version,
      );

      assert.equal(
        persistedClaimAEvidence.fingerprint,
        verifiedEvidenceA.fingerprint,
      );

      assert.equal(
        persistedClaimBEvidence.version,
        verifiedEvidenceB.version,
      );

      assert.equal(
        persistedClaimBEvidence.fingerprint,
        verifiedEvidenceB.fingerprint,
      );

      /*
       * The Evidence records themselves remain the authoritative
       * persisted location for discovery provenance.
       *
       * Claim lineage therefore reaches the exact Evidence record
       * that carries the ResearchSeed provenance.
       */
      const readbackEvidenceA =
        store.get(
          "EVIDENCE",
          persistedClaimAEvidence.id,
        );

      const readbackEvidenceB =
        store.get(
          "EVIDENCE",
          persistedClaimBEvidence.id,
        );

      assert.ok(
        readbackEvidenceA,
      );

      assert.ok(
        readbackEvidenceB,
      );

      assert.equal(
        readbackEvidenceA.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedA,
      );

      assert.equal(
        readbackEvidenceB.payload
          .discoveryProvenance
          .researchSeedUrl,
        seedB,
      );

      /*
       * ------------------------------------------------------------
       * 9. FOUNDATION CHAIN INTEGRITY
       * ------------------------------------------------------------
       */

      store.verifyChain();
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);