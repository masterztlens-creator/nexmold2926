import {
  normalizeText,
  type EvidenceRef,
} from "../shared.js";

import type {
  ResearchSeed,
} from "../research-planner/self-owned-seed-resolver.js";

import {
  requireResearchSeeds,
} from "../research-planner/self-owned-seed-resolver.js";

import {
  discoverWithSelfOwnedCrawl,
} from "../../research/self-owned-discovery.js";

import type {
  DiscoveryCandidate,
} from "../../research/types.js";

import type {
  FoundationStore,
} from "../../foundation/types.js";

import {
  ingestFetchedPage,
} from "../../acquisition/foundation-adapter.js";

import {
  extractTextEvidence,
} from "../../acquisition/source-extractor.js";

import type {
  FetchedPage,
  PageFetcher,
  SearchProvider,
  SearchResult,
} from "../../acquisition/types.js";

import {
  qualifyDiscoveryCandidate,
  type CandidateQualification,
  type CandidateQualificationPolicy,
  type ProvenanceStatus,
} from "./qualification.js";

export interface EvidenceCandidate {
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly authority: number;
  readonly relevance: number;
  readonly query: string;

  /**
   * V8-08 qualification result.
   *
   * Legacy callers may construct EvidenceCandidate objects without this
   * property. Such candidates are treated as unqualified by the expansion
   * acquisition gate.
   */
  readonly qualification?: CandidateQualification;
}

export interface EvidenceExpansionConfig {
  readonly actorId?: string;
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly signal?: AbortSignal;

  readonly researchSeeds?: readonly ResearchSeed[];

  readonly maxPages?: number;
  readonly maxDepth?: number;
  readonly sameHostOnly?: boolean;

  /**
   * V8-08 candidate qualification policy.
   */
  readonly qualification?: CandidateQualificationPolicy;
}

export interface EvidenceExpansionError {
  readonly query?: string;
  readonly url?: string;
  readonly error: string;
}

export interface EvidenceExpansionRecord {
  readonly candidate: EvidenceCandidate;
  readonly page: FetchedPage;
  readonly evidence: ReturnType<
    typeof ingestFetchedPage
  >;
}

export interface EvidenceExpansionResult {
  readonly candidates: readonly EvidenceCandidate[];
  readonly rankedCandidates: readonly EvidenceCandidate[];
  readonly qualifiedCandidates: readonly EvidenceCandidate[];
  readonly rejectedCandidates: readonly EvidenceCandidate[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly acquisitions: readonly EvidenceExpansionRecord[];
  readonly searchErrors: readonly EvidenceExpansionError[];
  readonly fetchErrors: readonly EvidenceExpansionError[];
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function publisherFromUrl(
  url: string,
): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function relevanceFor(
  query: string,
  result: SearchResult,
): number {
  const terms = new Set(
    normalizeText(query)
      .split(/\s+/)
      .filter(Boolean),
  );

  const text = normalizeText(
    `${result.title ?? ""} ${
      result.snippet ?? ""
    }`,
  );

  if (
    terms.size === 0 ||
    !text
  ) {
    return 0;
  }

  let matches = 0;

  for (const term of terms) {
    if (text.includes(term)) {
      matches += 1;
    }
  }

  return Math.min(
    1,
    matches / terms.size,
  );
}

function throwIfAborted(
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    throw new Error(
      "V8_EVIDENCE_EXPANSION_ABORTED",
    );
  }
}

function provenanceForDiscoveryCandidate(
  candidate: DiscoveryCandidate,
): ProvenanceStatus {
  if (
    candidate.sourceHint ===
    "V8_RESEARCH_SEED"
  ) {
    return "EXPLICIT_RESEARCH_SEED";
  }

  if (
    candidate.sourceHint &&
    candidate.sourceHint.trim()
  ) {
    return "CRAWLED_FROM_RESEARCH_SEED";
  }

  return "UNKNOWN";
}

function toEvidenceCandidate(
  query: string,
  candidate: DiscoveryCandidate,
  qualificationPolicy?: CandidateQualificationPolicy,
): EvidenceCandidate {
  const title =
    candidate.title?.trim() ||
    candidate.url;

  const relevance =
    relevanceFor(
      query,
      {
        url:
          candidate.url,
        title,
      },
    );

  const qualification =
    qualifyDiscoveryCandidate({
      candidate,
      relevanceScore:
        relevance,
      provenance:
        provenanceForDiscoveryCandidate(
          candidate,
        ),
      authorityScore:
        null,
      freshnessStatus:
        "NOT_OBSERVED",
      policy:
        qualificationPolicy,
    });

  return Object.freeze({
    url:
      candidate.url,

    title,

    publisher:
      publisherFromUrl(
        candidate.url,
      ),

    /*
     * IMPORTANT:
     * Unknown authority remains 0 only for the legacy numeric ranking field.
     * The authoritative V8-08 value is qualification.authorityScore === null.
     *
     * This field is retained solely for compatibility with the V8-07 API.
     */
    authority:
      qualification.authorityScore ??
      0,

    relevance,

    query,

    qualification,
  });
}

function isQualified(
  candidate: EvidenceCandidate,
): boolean {
  return (
    candidate.qualification
      ?.status ===
    "QUALIFIED"
  );
}

export function rankEvidenceCandidates(
  query: string,
  candidates: readonly EvidenceCandidate[],
): readonly EvidenceCandidate[] {
  return Object.freeze(
    [...candidates]
      .map(
        (candidate) => ({
          ...candidate,
          relevance:
            Math.min(
              1,
              candidate.relevance +
                (
                  normalizeText(
                    candidate.title,
                  ).includes(
                    normalizeText(
                      query,
                    ),
                  )
                    ? 0.15
                    : 0
                ),
            ),
        }),
      )
      .sort(
        (a, b) => {
          const authorityA =
            a.qualification
              ?.authorityScore ??
            (
              a.qualification
                ? 0
                : a.authority
            );

          const authorityB =
            b.qualification
              ?.authorityScore ??
            (
              b.qualification
                ? 0
                : b.authority
            );

          const scoreA =
            authorityA +
            a.relevance;

          const scoreB =
            authorityB +
            b.relevance;

          if (
            scoreB !==
            scoreA
          ) {
            return (
              scoreB -
              scoreA
            );
          }

          return a.url.localeCompare(
            b.url,
          );
        },
      ),
  );
}

export function toEvidenceRefs(
  candidates: readonly EvidenceCandidate[],
  limit = 8,
): readonly EvidenceRef[] {
  return Object.freeze(
    candidates
      .slice(
        0,
        Math.max(0, limit),
      )
      .map(
        (candidate) => ({
          sourceUrl:
            candidate.url,
          title:
            candidate.title,
          publisher:
            candidate.publisher,
        }),
      ),
  );
}

export async function expandEvidenceFromInternet(
  queries: readonly string[],
  searchProvider:
    | SearchProvider
    | undefined,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: EvidenceExpansionConfig = {},
): Promise<EvidenceExpansionResult> {
  const maxQueries =
    Math.max(
      1,
      config.maxQueries ??
        queries.length,
    );

  const maxCandidates =
    Math.max(
      1,
      config.maxCandidates ??
        8,
    );

  const candidates:
    EvidenceCandidate[] = [];

  const searchErrors:
    EvidenceExpansionError[] = [];

  /*
   * Explicit ResearchSeed input is the self-owned discovery path.
   *
   * The query is only a relevance signal. It never determines the URL.
   */
  if (
    config.researchSeeds &&
    config.researchSeeds.length > 0
  ) {
    throwIfAborted(
      config.signal,
    );

    const resolvedSeeds =
      requireResearchSeeds(
        config.researchSeeds,
      );

    const discovery =
      await discoverWithSelfOwnedCrawl(
        resolvedSeeds.map(
          (seed) =>
            seed.canonicalUrl,
        ),
        pageFetcher,
        {
          signal:
            config.signal,
          maxPages:
            config.maxPages,
          maxDepth:
            config.maxDepth,
          sameHostOnly:
            config.sameHostOnly,
          maxCandidates,
          sourceHint:
            "V8_RESEARCH_SEED",
        },
      );

    const query =
      queries[0] ?? "";

    for (
      const candidate of
        discovery.candidates
    ) {
      candidates.push(
        toEvidenceCandidate(
          query,
          candidate,
          config.qualification,
        ),
      );
    }
  } else {
    /*
     * Compatibility path.
     *
     * The production V8 self-owned path does not need a SearchProvider.
     * Existing callers that explicitly supply one remain supported.
     */
    if (!searchProvider) {
      throw new Error(
        "V8_EVIDENCE_EXPANSION_SEARCH_PROVIDER_REQUIRED",
      );
    }

    for (
      const query of queries.slice(
        0,
        maxQueries,
      )
    ) {
      throwIfAborted(
        config.signal,
      );

      try {
        const results =
          await searchProvider.search(
            query,
            {
              signal:
                config.signal,
            },
          );

        for (
          const result of
            results
        ) {
          if (!result.url) {
            continue;
          }

          const candidate:
            DiscoveryCandidate = {
              url:
                result.url,

              canonicalUrl:
                result.url,

              provider:
                "SEARCH",

              discoveredAt:
                new Date().toISOString(),

              title:
                result.title,

              sourceHint:
                searchProvider.name,
            };

          candidates.push(
            toEvidenceCandidate(
              query,
              candidate,
              config.qualification,
            ),
          );
        }
      } catch (error) {
        searchErrors.push({
          query,
          error:
            errorMessage(error),
        });
      }
    }
  }

  /*
   * Canonical URL deduplication is deliberately performed after candidate
   * creation so qualification is retained with the surviving candidate.
   */
  const deduped =
    [
      ...new Map(
        candidates.map(
          (candidate) => [
            candidate
              .qualification
              ?.canonicalUrl ||
              candidate.url,
            candidate,
          ],
        ),
      ).values(),
    ];

  const rankedCandidates =
    rankEvidenceCandidates(
      queries[0] ?? "",
      deduped,
    ).slice(
      0,
      maxCandidates,
    );

  const qualifiedCandidates =
    rankedCandidates.filter(
      isQualified,
    );

  const rejectedCandidates =
    rankedCandidates.filter(
      (candidate) =>
        !isQualified(candidate),
    );

  const acquisitions:
    EvidenceExpansionRecord[] =
    [];

  const fetchErrors:
    EvidenceExpansionError[] =
    [];

  /*
   * V8-08 hard boundary:
   *
   * Only QUALIFIED candidates may cross into HTTP acquisition.
   *
   * Rejected candidates never reach ingestFetchedPage().
   */
  for (
    const candidate of
      qualifiedCandidates
  ) {
    throwIfAborted(
      config.signal,
    );

    try {
      const page =
        await pageFetcher.fetch(
          candidate.url,
          {
            signal:
              config.signal,
          },
        );

      const extracted =
        extractTextEvidence(
          page.body,
          page.finalUrl,
        );

      const evidence =
        ingestFetchedPage(
          store,
          page,
          extracted,
          {
            actorId:
              config.actorId,
          },
        );

      acquisitions.push({
        candidate,
        page,
        evidence,
      });
    } catch (error) {
      fetchErrors.push({
        url:
          candidate.url,
        error:
          errorMessage(error),
      });
    }
  }

  return Object.freeze({
    candidates:
      Object.freeze([
        ...deduped,
      ]),

    rankedCandidates:
      Object.freeze([
        ...rankedCandidates,
      ]),

    qualifiedCandidates:
      Object.freeze([
        ...qualifiedCandidates,
      ]),

    rejectedCandidates:
      Object.freeze([
        ...rejectedCandidates,
      ]),

    evidenceRefs:
      toEvidenceRefs(
        qualifiedCandidates,
      ),

    acquisitions:
      Object.freeze([
        ...acquisitions,
      ]),

    searchErrors:
      Object.freeze([
        ...searchErrors,
      ]),

    fetchErrors:
      Object.freeze([
        ...fetchErrors,
      ]),
  });
}