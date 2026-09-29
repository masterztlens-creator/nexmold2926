import type {
  FoundationStore,
  DiscoveryProvenance,
} from "../../foundation/types.js";

import {
  ingestFetchedPage,
} from "../../acquisition/foundation-adapter.js";

import type {
  ExtractedEvidenceCandidate,
  FetchedPage,
  PageFetcher,
  SearchProvider,
} from "../../acquisition/types.js";

import {
  extractStructuredEvidence,
  extractTextEvidence,
} from "../../acquisition/source-extractor.js";

import type {
  Opportunity,
} from "../shared.js";

import {
  discoverCandidates,
  type DiscoveryInput,
} from "../web-discovery/discovery.js";

import type {
  DiscoveryBatch,
  DiscoveryCandidate,
} from "../web-discovery/types.js";

import {
  planResearch,
  type ResearchPlan,
} from "./planner.js";

import {
  resolveResearchSeeds,
  type ResearchSeed,
  type ResolvedResearchSeed,
} from "./self-owned-seed-resolver.js";

import {
  discoverWithSelfOwnedCrawl,
} from "../../research/self-owned-discovery.js";

export interface ResearchAcquisitionConfig {
  readonly actorId?: string;
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly signal?: AbortSignal;

  /*
   * Self-owned Internet acquisition is activated only when
   * explicit seeds are supplied.
   *
   * Seed URLs are never inferred from a keyword, query,
   * opportunity, or search result.
   */
  readonly researchSeeds?: readonly ResearchSeed[];

  readonly maxPages?: number;
  readonly maxDepth?: number;
  readonly sameHostOnly?: boolean;
}

export interface ResearchAcquisitionRecord {
  readonly candidateUrl: string;
  readonly page: FetchedPage;
  readonly acquisition: ReturnType<
    typeof ingestFetchedPage
  >;
}

export interface ResearchAcquisitionError {
  readonly query?: string;
  readonly url?: string;
  readonly error: string;
}

export interface ResearchAcquisitionResult {
  readonly plan: ResearchPlan;
  readonly discovery: DiscoveryBatch;
  readonly acquisitions: readonly ResearchAcquisitionRecord[];
  readonly searchErrors: readonly ResearchAcquisitionError[];
  readonly fetchErrors: readonly ResearchAcquisitionError[];
}

interface SelfOwnedDiscoveryExecution {
  readonly discovery: DiscoveryBatch;
  readonly fetchErrors: readonly ResearchAcquisitionError[];
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

function throwIfAborted(
  signal?: AbortSignal,
): void {
  if (
    signal?.aborted
  ) {
    throw new Error(
      "V8_RESEARCH_ACQUISITION_ABORTED",
    );
  }
}

function evidenceKey(
  candidate: ExtractedEvidenceCandidate,
): string {
  return [
    candidate.locator,
    candidate.excerpt,
    candidate.section ?? "",
    candidate.parameter ?? "",
    candidate.value ?? "",
    candidate.unit ?? "",
  ].join("\u001f");
}

function deduplicateEvidence(
  candidates: readonly ExtractedEvidenceCandidate[],
): readonly ExtractedEvidenceCandidate[] {
  const seen =
    new Set<string>();

  const output:
    ExtractedEvidenceCandidate[] =
      [];

  for (
    const candidate of candidates
  ) {
    const key =
      evidenceKey(
        candidate,
      );

    if (
      seen.has(key)
    ) {
      continue;
    }

    seen.add(
      key,
    );

    output.push(
      candidate,
    );
  }

  return output;
}

function extractResearchEvidence(
  page: FetchedPage,
): readonly ExtractedEvidenceCandidate[] {
  const structured =
    extractStructuredEvidence(
      page.body,
    );

  const documentText =
    extractTextEvidence(
      page.body,
      page.finalUrl,
    );

  return deduplicateEvidence([
    ...structured,
    ...documentText,
  ]);
}

function selfOwnedDiscoveryInputs(
  candidates: readonly {
    readonly url: string;
    readonly normalizedUrl: string;
    readonly sourceUrl?: string;
    readonly title?: string;
    readonly discoveredAt: string;
  }[],
  seeds: readonly ResolvedResearchSeed[],
): DiscoveryInput[] {
  const seedCanonicalUrls =
    new Set(
      seeds.map(
        (seed) =>
          seed.canonicalUrl,
      ),
    );

  return candidates.map(
    (
      candidate,
    ): DiscoveryInput => ({
      url:
        candidate.url,

      kind:
        seedCanonicalUrls.has(
          candidate.normalizedUrl,
        )
          ? "SEED"
          : "LINK",

      ...(candidate.sourceUrl ===
      undefined
        ? {}
        : {
            sourceUrl:
              candidate.sourceUrl,
          }),

      ...(candidate.title ===
      undefined
        ? {}
        : {
            title:
              candidate.title,
          }),

      discoveredAt:
        candidate.discoveredAt,
    }),
  );
}

function discoveryProvenanceForSelfOwnedCandidate(
  candidate: DiscoveryCandidate,
  seeds: readonly ResolvedResearchSeed[],
): DiscoveryProvenance {
  /*
   * This function consumes the intelligence/web-discovery candidate.
   *
   * SELF_OWNED_CRAWL provenance has already been materialized by the
   * Research layer and is represented in the intelligence candidate
   * through its kind/sourceUrl fields.
   */
  if (
    candidate.kind !==
      "SEED" &&
    candidate.kind !==
      "LINK"
  ) {
    throw new Error(
      "V8_RESEARCH_SELF_OWNED_INVALID_DISCOVERY_KIND",
    );
  }

  if (
    candidate.kind ===
    "SEED"
  ) {
    const matchingSeed =
      seeds.find(
        (seed) =>
          seed.canonicalUrl ===
          candidate.normalizedUrl,
      );

    if (
      !matchingSeed
    ) {
      throw new Error(
        "V8_RESEARCH_SELF_OWNED_SEED_PROVENANCE_NOT_FOUND",
      );
    }

    return Object.freeze({
      status:
        "EXPLICIT_RESEARCH_SEED",

      provider:
        "DIRECT",

      discoveredUrl:
        candidate.url,

      canonicalUrl:
        candidate.normalizedUrl,

      discoveredAt:
        candidate.discoveredAt,

      researchSeedUrl:
        matchingSeed.canonicalUrl,

      sourceHint:
        "V8_RESEARCH_SEED",
    });
  }

  if (
    typeof candidate.sourceUrl ===
      "string" &&
    candidate.sourceUrl.trim()
  ) {
    const researchSeedUrl =
      candidate.sourceUrl.trim();

    return Object.freeze({
      status:
        "CRAWLED_FROM_RESEARCH_SEED",

      provider:
        "DIRECT",

      discoveredUrl:
        candidate.url,

      canonicalUrl:
        candidate.normalizedUrl,

      discoveredAt:
        candidate.discoveredAt,

      researchSeedUrl,

      sourceHint:
        researchSeedUrl,
    });
  }

  throw new Error(
    "V8_RESEARCH_SELF_OWNED_LINK_PROVENANCE_UNKNOWN",
  );
}

async function runSelfOwnedDiscovery(
  seeds: readonly ResolvedResearchSeed[],
  pageFetcher: PageFetcher,
  config: ResearchAcquisitionConfig,
): Promise<SelfOwnedDiscoveryExecution> {
  const result =
    await discoverWithSelfOwnedCrawl(
      seeds.map(
        (seed) =>
          seed.url,
      ),

      pageFetcher,

      {
        signal:
          config.signal,

        maxPages:
          config.maxPages ??
          config.maxCandidates ??
          50,

        maxDepth:
          config.maxDepth ??
          2,

        sameHostOnly:
          config.sameHostOnly ??
          true,

        maxCandidates:
          config.maxCandidates ??
          10,
      },
    );

  const discovery =
    discoverCandidates(
      selfOwnedDiscoveryInputs(
        result.candidates,
        seeds,
      ),
    );

  const fetchErrors =
    result.fetchErrors.map(
      (
        failure,
      ): ResearchAcquisitionError => ({
        url:
          failure.url,

        error:
          failure.error,
      }),
    );

  return {
    discovery,
    fetchErrors,
  };
}

export async function runResearchAcquisition(
  opportunity: Opportunity,
  searchProvider: SearchProvider | undefined,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: ResearchAcquisitionConfig = {},
): Promise<ResearchAcquisitionResult> {
  const plan =
    planResearch(
      opportunity,
    );

  const maxQueries =
    Math.max(
      1,
      config.maxQueries ??
        plan.sourceQueries.length,
    );

  const maxCandidates =
    Math.max(
      1,
      config.maxCandidates ??
        10,
    );

  /*
   * Explicit self-owned seeds take precedence over
   * third-party search discovery.
   *
   * No URL is ever inferred from the opportunity keyword.
   */
  if (
    config.researchSeeds !==
      undefined &&
    config.researchSeeds.length >
      0
  ) {
    const seedResolution =
      resolveResearchSeeds(
        config.researchSeeds,
      );

    if (
      seedResolution.accepted.length ===
      0
    ) {
      throw new Error(
        "V8_RESEARCH_SEED_NO_VALID_SEEDS",
      );
    }

    const selfOwned =
      await runSelfOwnedDiscovery(
        seedResolution.accepted,
        pageFetcher,
        config,
      );

    const acquisitions:
      ResearchAcquisitionRecord[] =
      [];

    const fetchErrors:
      ResearchAcquisitionError[] =
      [
        ...selfOwned.fetchErrors,
      ];

    for (
      const candidate of
        selfOwned.discovery.candidates
    ) {
      if (
        acquisitions.length >=
        maxCandidates
      ) {
        break;
      }

      throwIfAborted(
        config.signal,
      );

      let discoveryProvenance:
        DiscoveryProvenance;

      try {
        discoveryProvenance =
          discoveryProvenanceForSelfOwnedCandidate(
            candidate,
            seedResolution.accepted,
          );
      } catch (
        error
      ) {
        fetchErrors.push({
          url:
            candidate.url,

          error:
            errorMessage(
              error,
            ),
        });

        continue;
      }

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
          extractResearchEvidence(
            page,
          );

        const acquisition =
          ingestFetchedPage(
            store,
            page,
            extracted,
            {
              actorId:
                config.actorId,

              discoveryProvenance,
            },
          );

        acquisitions.push({
          candidateUrl:
            candidate.url,

          page,

          acquisition,
        });
      } catch (
        error
      ) {
        fetchErrors.push({
          url:
            candidate.url,

          error:
            errorMessage(
              error,
            ),
        });
      }
    }

    return {
      plan,

      discovery:
        selfOwned.discovery,

      acquisitions,

      searchErrors: [],

      fetchErrors,
    };
  }

  /*
   * Traditional query-based discovery is a separate execution path.
   *
   * Self-owned acquisition does not require a SearchProvider.
   * If no explicit self-owned seeds were supplied, the caller
   * must explicitly provide a SearchProvider.
   */
  if (
    !searchProvider
  ) {
    throw new Error(
      "V8_RESEARCH_SEARCH_PROVIDER_REQUIRED",
    );
  }

  const discoveryInputs:
    DiscoveryInput[] =
    [];

  const searchErrors:
    ResearchAcquisitionError[] =
    [];

  for (
    const query of
      plan.sourceQueries.slice(
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
        discoveryInputs.push({
          url:
            result.url,

          kind:
            "SERP_RESULT",

          title:
            result.title,

          sourceUrl:
            searchProvider.name,
        });
      }
    } catch (
      error
    ) {
      searchErrors.push({
        query,

        error:
          errorMessage(
            error,
          ),
      });
    }
  }

  const discovery =
    discoverCandidates(
      discoveryInputs,
    );

  const acquisitions:
    ResearchAcquisitionRecord[] =
    [];

  const fetchErrors:
    ResearchAcquisitionError[] =
    [];

  for (
    const candidate of
      discovery.candidates
  ) {
    if (
      acquisitions.length >=
      maxCandidates
    ) {
      break;
    }

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
        extractResearchEvidence(
          page,
        );

      const acquisition =
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
        candidateUrl:
          candidate.url,

        page,

        acquisition,
      });
    } catch (
      error
    ) {
      fetchErrors.push({
        url:
          candidate.url,

        error:
          errorMessage(
            error,
          ),
      });
    }
  }

  return {
    plan,

    discovery,

    acquisitions,

    searchErrors,

    fetchErrors,
  };
}