import type { FoundationStore } from "../../foundation/types.js";
import { ingestFetchedPage } from "../../acquisition/foundation-adapter.js";
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
import type { Opportunity } from "../shared.js";
import {
  discoverCandidates,
  type DiscoveryInput,
} from "../web-discovery/discovery.js";
import type { DiscoveryBatch } from "../web-discovery/types.js";
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
  readonly acquisition: ReturnType<typeof ingestFetchedPage>;
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

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("V8_RESEARCH_ACQUISITION_ABORTED");
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
  const seen = new Set<string>();
  const output: ExtractedEvidenceCandidate[] = [];

  for (const candidate of candidates) {
    const key = evidenceKey(candidate);

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(candidate);
  }

  return output;
}

function extractResearchEvidence(
  page: FetchedPage,
): readonly ExtractedEvidenceCandidate[] {
  const structured = extractStructuredEvidence(page.body);

  const documentText = extractTextEvidence(
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
    readonly canonicalUrl: string;
    readonly sourceHint?: string;
    readonly title?: string;
    readonly discoveredAt: string;
  }[],
  seeds: readonly ResolvedResearchSeed[],
): DiscoveryInput[] {
  const seedCanonicalUrls = new Set(
    seeds.map(
      (seed) => seed.canonicalUrl,
    ),
  );

  return candidates.map(
    (candidate): DiscoveryInput => ({
      url: candidate.url,
      kind: seedCanonicalUrls.has(
        candidate.canonicalUrl,
      )
        ? "SEED"
        : "LINK",
      ...(candidate.sourceHint === undefined
        ? {}
        : {
            sourceUrl: candidate.sourceHint,
          }),
      ...(candidate.title === undefined
        ? {}
        : {
            title: candidate.title,
          }),
      discoveredAt: candidate.discoveredAt,
    }),
  );
}

async function runSelfOwnedDiscovery(
  seeds: readonly ResolvedResearchSeed[],
  pageFetcher: PageFetcher,
  config: ResearchAcquisitionConfig,
): Promise<DiscoveryBatch> {
  const result =
    await discoverWithSelfOwnedCrawl(
      seeds.map(
        (seed) => seed.url,
      ),
      pageFetcher,
      {
        signal: config.signal,
        maxPages:
          config.maxPages ??
          config.maxCandidates ??
          50,
        maxDepth:
          config.maxDepth ?? 2,
        sameHostOnly:
          config.sameHostOnly ?? true,
        maxCandidates:
          config.maxCandidates ?? 10,
      },
    );

  return discoverCandidates(
    selfOwnedDiscoveryInputs(
      result.candidates,
      seeds,
    ),
  );
}

export async function runResearchAcquisition(
  opportunity: Opportunity,
  searchProvider: SearchProvider | undefined,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: ResearchAcquisitionConfig = {},
): Promise<ResearchAcquisitionResult> {
  const plan = planResearch(opportunity);

  const maxQueries = Math.max(
    1,
    config.maxQueries ??
      plan.sourceQueries.length,
  );

  const maxCandidates = Math.max(
    1,
    config.maxCandidates ?? 10,
  );

  /*
   * Explicit self-owned seeds take precedence over
   * third-party search discovery.
   *
   * No URL is ever inferred from the opportunity keyword.
   */
  if (
    config.researchSeeds !== undefined &&
    config.researchSeeds.length > 0
  ) {
    const seedResolution =
      resolveResearchSeeds(
        config.researchSeeds,
      );

    if (
      seedResolution.accepted.length === 0
    ) {
      throw new Error(
        "V8_RESEARCH_SEED_NO_VALID_SEEDS",
      );
    }

    const discovery =
      await runSelfOwnedDiscovery(
        seedResolution.accepted,
        pageFetcher,
        config,
      );

    const acquisitions: ResearchAcquisitionRecord[] =
      [];

    const fetchErrors: ResearchAcquisitionError[] =
      [];

    for (const candidate of discovery.candidates) {
      if (
        acquisitions.length >=
        maxCandidates
      ) {
        break;
      }

      throwIfAborted(config.signal);

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
      } catch (error) {
        fetchErrors.push({
          url: candidate.url,
          error:
            errorMessage(error),
        });
      }
    }

    return {
      plan,
      discovery,
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
   * must explicitly provide a SearchProvider rather than allowing
   * the runtime to fabricate or silently bypass Internet discovery.
   */
  if (!searchProvider) {
    throw new Error(
      "V8_RESEARCH_SEARCH_PROVIDER_REQUIRED",
    );
  }

  const discoveryInputs: DiscoveryInput[] =
    [];

  const searchErrors: ResearchAcquisitionError[] =
    [];

  for (
    const query of plan.sourceQueries.slice(
      0,
      maxQueries,
    )
  ) {
    throwIfAborted(config.signal);

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
        const result of results
      ) {
        discoveryInputs.push({
          url: result.url,
          kind: "SERP_RESULT",
          title: result.title,
        });
      }
    } catch (error) {
      searchErrors.push({
        query,
        error:
          errorMessage(error),
      });
    }
  }

  const discovery =
    discoverCandidates(
      discoveryInputs,
    );

  const acquisitions: ResearchAcquisitionRecord[] =
    [];

  const fetchErrors: ResearchAcquisitionError[] =
    [];

  for (
    const candidate of discovery.candidates
  ) {
    if (
      acquisitions.length >=
      maxCandidates
    ) {
      break;
    }

    throwIfAborted(config.signal);

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
    } catch (error) {
      fetchErrors.push({
        url:
          candidate.url,
        error:
          errorMessage(error),
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