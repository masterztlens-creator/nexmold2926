import assert from "node:assert/strict";
import test from "node:test";

import {
  expandEvidenceFromInternet,
  rankEvidenceCandidates,
} from "../../../.v8-build/src/v8/intelligence/evidence-expansion/expansion.js";

import {
  qualifyDiscoveryCandidate,
} from "../../../.v8-build/src/v8/intelligence/evidence-expansion/qualification.js";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

test(
  "V8-07 ranks candidates without fabricating authority",
  () => {
    const ranked =
      rankEvidenceCandidates(
        "wall thickness",
        [
          {
            url:
              "https://example.com/a",
            title:
              "Wall thickness design",
            publisher:
              "example.com",
            authority:
              0,
            relevance:
              0.7,
            query:
              "wall thickness",
          },
          {
            url:
              "https://example.com/b",
            title:
              "Other topic",
            publisher:
              "example.com",
            authority:
              0,
            relevance:
              0.8,
            query:
              "wall thickness",
          },
        ],
      );

    assert.equal(
      ranked[0]?.url,
      "https://example.com/a",
    );

    assert.equal(
      ranked[0]?.authority,
      0,
    );
  },
);

test(
  "V8-08 rejects a candidate blocked by source policy",
  () => {
    const result =
      qualifyDiscoveryCandidate({
        candidate: {
          url:
            "http://127.0.0.1/internal",
          canonicalUrl:
            "http://127.0.0.1/internal",
          provider:
            "DIRECT",
          discoveredAt:
            "2026-01-01T00:00:00.000Z",
          sourceHint:
            "V8_RESEARCH_SEED",
        },
        relevanceScore:
          1,
        provenance:
          "EXPLICIT_RESEARCH_SEED",
        authorityScore:
          null,
        freshnessStatus:
          "NOT_OBSERVED",
      });

    assert.equal(
      result.status,
      "REJECTED",
    );

    assert.ok(
      result.reasons.includes(
        "SOURCE_POLICY_BLOCKED",
      ),
    );
  },
);

test(
  "V8-08 rejects unknown provenance",
  () => {
    const result =
      qualifyDiscoveryCandidate({
        candidate: {
          url:
            "https://example.com/source",
          canonicalUrl:
            "https://example.com/source",
          provider:
            "DIRECT",
          discoveredAt:
            "2026-01-01T00:00:00.000Z",
        },
        relevanceScore:
          1,
        provenance:
          "UNKNOWN",
        authorityScore:
          null,
        freshnessStatus:
          "NOT_OBSERVED",
      });

    assert.equal(
      result.status,
      "REJECTED",
    );

    assert.ok(
      result.reasons.includes(
        "PROVENANCE_UNKNOWN",
      ),
    );

    assert.ok(
      result.reasons.includes(
        "AUTHORITY_UNKNOWN",
      ),
    );
  },
);

test(
  "V8-08 does not fabricate authority for an explicit seed",
  () => {
    const result =
      qualifyDiscoveryCandidate({
        candidate: {
          url:
            "https://example.com/authority",
          canonicalUrl:
            "https://example.com/authority",
          provider:
            "DIRECT",
          discoveredAt:
            "2026-01-01T00:00:00.000Z",
          sourceHint:
            "V8_RESEARCH_SEED",
        },
        relevanceScore:
          1,
        provenance:
          "EXPLICIT_RESEARCH_SEED",
        authorityScore:
          null,
        freshnessStatus:
          "NOT_OBSERVED",
      });

    assert.equal(
      result.status,
      "QUALIFIED",
    );

    assert.equal(
      result.authorityStatus,
      "UNKNOWN",
    );

    assert.equal(
      result.authorityScore,
      null,
    );

    assert.equal(
      result.freshnessStatus,
      "NOT_OBSERVED",
    );
  },
);

test(
  "V8-08 rejects relevance below threshold",
  () => {
    const result =
      qualifyDiscoveryCandidate({
        candidate: {
          url:
            "https://example.com/unrelated",
          canonicalUrl:
            "https://example.com/unrelated",
          provider:
            "DIRECT",
          discoveredAt:
            "2026-01-01T00:00:00.000Z",
          sourceHint:
            "V8_RESEARCH_SEED",
        },
        relevanceScore:
          0.05,
        provenance:
          "EXPLICIT_RESEARCH_SEED",
        authorityScore:
          null,
        freshnessStatus:
          "NOT_OBSERVED",
      });

    assert.equal(
      result.status,
      "REJECTED",
    );

    assert.ok(
      result.reasons.includes(
        "RELEVANCE_BELOW_THRESHOLD",
      ),
    );
  },
);

test(
  "V8-08 self-owned expansion works without SearchProvider",
  async () => {
    const store =
      new InMemoryFoundationStore();

    const seed =
      "https://example.com/seed";

    let fetchCount =
      0;

    const pageFetcher = {
      async fetch(
        url: string,
      ) {
        fetchCount += 1;

        const body =
          "<html><head><title>Plastic Injection Molding Wall Thickness Engineering Source</title></head><body>Injection molding wall thickness engineering evidence.</body></html>";

        return {
          requestedUrl:
            url,
          finalUrl:
            url,
          redirectChain:
            [],
          status:
            200,
          mediaType:
            "text/html",
          body,
          bytes:
            new TextEncoder().encode(
              body,
            ),
          fetchedAt:
            "2026-01-01T00:00:00.000Z",
        };
      },
    };

    const result =
      await expandEvidenceFromInternet(
        [
          "plastic injection molding wall thickness",
        ],
        undefined,
        pageFetcher,
        store,
        {
          actorId:
            "V8-08-SELF-OWNED-TEST",
          maxCandidates:
            1,
          maxPages:
            1,
          maxDepth:
            0,
          sameHostOnly:
            true,
          researchSeeds:
            [
              {
                url:
                  seed,
                source:
                  "DIRECT",
                reason:
                  "Explicit test seed for self-owned Internet discovery.",
              },
            ],
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
      result.candidates.length,
      1,
    );

    assert.equal(
      result.rankedCandidates.length,
      1,
    );

    assert.equal(
      result.qualifiedCandidates.length,
      1,
    );

    assert.equal(
      result.rejectedCandidates.length,
      0,
    );

    assert.equal(
      result.acquisitions.length,
      1,
    );

    assert.equal(
      result.acquisitions[0]
        ?.candidate
        .qualification
        ?.status,
      "QUALIFIED",
    );

    assert.equal(
      result.acquisitions[0]
        ?.candidate
        .qualification
        ?.provenance,
      "EXPLICIT_RESEARCH_SEED",
    );

    assert.equal(
      result.acquisitions[0]
        ?.candidate
        .qualification
        ?.authorityStatus,
      "UNKNOWN",
    );

    assert.equal(
      result.acquisitions[0]
        ?.candidate
        .qualification
        ?.authorityScore,
      null,
    );

    assert.equal(
      result.acquisitions[0]
        ?.evidence.evidence.length,
      1,
    );

    assert.ok(
      fetchCount >= 2,
      "self-owned discovery must crawl the seed before expansion acquisition",
    );

    store.verifyChain();
  },
);

test(
  "V8-08 rejected candidates never cross the acquisition boundary",
  async () => {
    const store =
      new InMemoryFoundationStore();

    const blockedSeed =
      "https://example.com/blocked";

    const blockedFinalUrl =
      "http://127.0.0.1/blocked";

    let acquisitionFetches =
      0;

    const pageFetcher = {
      async fetch(
        url: string,
      ) {
        acquisitionFetches += 1;

        if (
          url ===
          blockedSeed
        ) {
          const body =
            "<html><head><title>Wall Thickness Injection Molding</title></head><body>Wall thickness 2 mm.</body></html>";

          return {
            requestedUrl:
              url,
            finalUrl:
              blockedFinalUrl,
            redirectChain:
              [
                url,
                blockedFinalUrl,
              ],
            status:
              200,
            mediaType:
              "text/html",
            body,
            bytes:
              new TextEncoder().encode(
                body,
              ),
            fetchedAt:
              "2026-01-01T00:00:00.000Z",
          };
        }

        throw new Error(
          `Unexpected acquisition URL: ${url}`,
        );
      },
    };

    const result =
      await expandEvidenceFromInternet(
        [
          "wall thickness injection molding",
        ],
        undefined,
        pageFetcher,
        store,
        {
          actorId:
            "V8-08-REJECTION-TEST",
          maxCandidates:
            1,
          maxPages:
            1,
          maxDepth:
            0,
          sameHostOnly:
            true,
          researchSeeds:
            [
              {
                url:
                  blockedSeed,
                source:
                  "DIRECT",
                reason:
                  "Intentional source-policy rejection test.",
              },
            ],
        },
      );

    /*
     * The seed itself is valid and may be fetched by the self-owned
     * discovery layer. The resulting canonical/final URL is blocked
     * by source policy and therefore must never enter acquisition.
     */
    assert.equal(
      result.qualifiedCandidates.length,
      0,
    );

    assert.equal(
      result.rejectedCandidates.length,
      1,
    );

    assert.equal(
      result.acquisitions.length,
      0,
    );

    assert.equal(
      result.fetchErrors.length,
      0,
    );

    assert.ok(
      result.rejectedCandidates[0]
        ?.qualification
        ?.reasons.includes(
          "SOURCE_POLICY_BLOCKED",
        ),
    );

    const auditTrail =
      store.auditTrail();

    assert.equal(
      auditTrail.filter(
        (record) =>
          record.aggregateType ===
          "EVIDENCE",
      ).length,
      0,
    );

    assert.equal(
      auditTrail.filter(
        (record) =>
          record.aggregateType ===
          "SNAPSHOT",
      ).length,
      0,
    );

    /*
     * Discovery may fetch the valid seed once.
     * Acquisition must not fetch the rejected candidate.
     */
    assert.equal(
      acquisitionFetches,
      1,
    );

    store.verifyChain();
  },
);

test(
  "V8-08 SearchProvider compatibility path fails closed on unknown authority",
  async () => {
    const store =
      new InMemoryFoundationStore();

    let fetchCount =
      0;

    const searchProvider = {
      name:
        "test-search",
      async search() {
        return [
          {
            url:
              "https://example.com/search-result",
            title:
              "Wall thickness engineering source",
            snippet:
              "wall thickness injection molding",
          },
        ];
      },
    };

    const pageFetcher = {
      async fetch(
        url: string,
      ) {
        fetchCount += 1;

        const body =
          "<html><body>Wall thickness 2 mm.</body></html>";

        return {
          requestedUrl:
            url,
          finalUrl:
            url,
          redirectChain:
            [],
          status:
            200,
          mediaType:
            "text/html",
          body,
          bytes:
            new TextEncoder().encode(
              body,
            ),
          fetchedAt:
            "2026-01-01T00:00:00.000Z",
        };
      },
    };

    const result =
      await expandEvidenceFromInternet(
        [
          "wall thickness injection molding",
        ],
        searchProvider,
        pageFetcher,
        store,
        {
          actorId:
            "V8-08-SEARCH-BOUNDARY",
          maxQueries:
            1,
          maxCandidates:
            1,
        },
      );

    assert.equal(
      result.candidates.length,
      1,
    );

    assert.equal(
      result.qualifiedCandidates.length,
      0,
    );

    assert.equal(
      result.rejectedCandidates.length,
      1,
    );

    assert.equal(
      result.acquisitions.length,
      0,
    );

    assert.equal(
      fetchCount,
      0,
    );

    assert.ok(
      result.rejectedCandidates[0]
        ?.qualification
        ?.reasons.includes(
          "AUTHORITY_UNKNOWN",
        ),
    );

    store.verifyChain();
  },
);

test(
  "V8-08 qualification is deterministic",
  () => {
    const candidate = {
      url:
        "https://example.com/dfm",
      canonicalUrl:
        "https://example.com/dfm",
      provider:
        "DIRECT" as const,
      discoveredAt:
        "2026-01-01T00:00:00.000Z",
      sourceHint:
        "V8_RESEARCH_SEED",
    };

    const first =
      qualifyDiscoveryCandidate({
        candidate,
        relevanceScore:
          0.8,
        provenance:
          "EXPLICIT_RESEARCH_SEED",
        authorityScore:
          null,
        freshnessStatus:
          "NOT_OBSERVED",
      });

    const second =
      qualifyDiscoveryCandidate({
        candidate,
        relevanceScore:
          0.8,
        provenance:
          "EXPLICIT_RESEARCH_SEED",
        authorityScore:
          null,
        freshnessStatus:
          "NOT_OBSERVED",
      });

    assert.deepEqual(
      first,
      second,
    );
  },
);