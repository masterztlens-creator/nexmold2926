import {
  immutable,
} from "../../constitution/invariants.js";

import type {
  FoundationStore,
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

import {
  discoverCandidates,
  type DiscoveryInput,
} from "../web-discovery/discovery.js";

import {
  normalizeDiscoveryUrl,
} from "../web-discovery/candidate-normalizer.js";

import type {
  DiscoveryBatch,
} from "../web-discovery/types.js";

import type {
  MarketResearchPlan,
} from "./research-strategy.js";

export interface MarketAcquisitionConfig {
  readonly actorId?: string;
  readonly maxCandidates?: number;
  readonly signal?: AbortSignal;
}

export interface MarketAcquisitionRecord {
  readonly actionId: string;
  readonly candidateUrl: string;
  readonly page: FetchedPage;
  readonly acquisition: ReturnType<
    typeof ingestFetchedPage
  >;
}

export interface MarketAcquisitionResult {
  readonly discovery: DiscoveryBatch;

  readonly acquisitions:
    readonly MarketAcquisitionRecord[];

  readonly searchErrors:
    readonly {
      query: string;
      error: string;
    }[];

  readonly fetchErrors:
    readonly {
      url: string;
      error: string;
    }[];
}

const message = (
  error: unknown,
): string =>
  error instanceof Error
    ? error.message
    : String(error);

function throwIfAborted(
  signal: AbortSignal | undefined,
): void {
  if (signal?.aborted) {
    throw new Error(
      "V8_MARKET_RESEARCH_ABORTED",
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

function extractEvidence(
  page: FetchedPage,
): readonly ExtractedEvidenceCandidate[] {
  const all = [
    ...extractStructuredEvidence(
      page.body,
    ),
    ...extractTextEvidence(
      page.body,
      page.finalUrl,
    ),
  ];

  const seen = new Set<string>();

  return all.filter(
    (candidate) => {
      const key = evidenceKey(candidate);

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    },
  );
}

/**
 * Executes market research while preserving the relationship between
 * each discovered candidate URL and the research action that produced it.
 *
 * Provenance rules:
 * - URL identity uses the same normalizer as candidate discovery.
 * - The first research action producing a normalized URL owns attribution.
 * - Duplicate URLs do not overwrite their original attribution.
 * - A candidate without an action mapping is not acquired.
 * - No candidate is silently attributed to the first plan action.
 */
export async function runMarketAcquisition(
  plan: MarketResearchPlan,
  searchProvider: SearchProvider,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: MarketAcquisitionConfig = {},
): Promise<MarketAcquisitionResult> {
  const inputs: DiscoveryInput[] = [];

  const searchErrors: {
    query: string;
    error: string;
  }[] = [];

  const fetchErrors: {
    url: string;
    error: string;
  }[] = [];

  /*
   * Key: canonical discovery URL.
   * Value: the research action responsible for discovering it.
   */
  const candidateActionByUrl =
    new Map<string, string>();

  for (const item of plan.queries) {
    throwIfAborted(config.signal);

    try {
      const results =
        await searchProvider.search(
          item.query,
          {
            signal: config.signal,
          },
        );

      for (const result of results) {
        const normalizedUrl =
          normalizeDiscoveryUrl(result.url);

        /*
         * Invalid URLs are left for discovery validation to reject.
         * They must never receive a fabricated provenance mapping.
         */
        if (normalizedUrl !== null) {
          /*
           * Deterministic ownership:
           * the first query/action producing this normalized URL wins.
           */
          if (
            !candidateActionByUrl.has(
              normalizedUrl,
            )
          ) {
            candidateActionByUrl.set(
              normalizedUrl,
              item.actionId,
            );
          }
        }

        inputs.push({
          url: result.url,
          kind: "SERP_RESULT",
          title: result.title,
          sourceUrl: item.query,
        });
      }
    } catch (error) {
      throwIfAborted(config.signal);

      searchErrors.push({
        query: item.query,
        error: message(error),
      });
    }
  }

  throwIfAborted(config.signal);

  const discovery =
    discoverCandidates(inputs);

  const acquisitions: MarketAcquisitionRecord[] = [];

  const configuredMaxCandidates =
    config.maxCandidates ?? 10;

  if (
    !Number.isInteger(
      configuredMaxCandidates,
    ) ||
    configuredMaxCandidates < 0
  ) {
    throw new Error(
      "V8_MARKET_ACQUISITION_MAX_CANDIDATES_INVALID",
    );
  }

  for (const candidate of discovery.candidates) {
    if (
      acquisitions.length >=
      configuredMaxCandidates
    ) {
      break;
    }

    throwIfAborted(config.signal);

    /*
     * Candidate URLs are normalized by discovery. Resolve attribution
     * using the same canonical identity rather than comparing a URL
     * against a search-query string.
     */
    const normalizedUrl =
      candidate.normalizedUrl;

    const actionId =
      candidateActionByUrl.get(
        normalizedUrl,
      );

    /*
     * Fail closed: do not fetch or ingest evidence when action provenance
     * is missing. This also makes the failure visible in the result.
     */
    if (
      actionId === undefined ||
      actionId.trim() === ""
    ) {
      fetchErrors.push({
        url: candidate.url,
        error:
          "V8_MARKET_ACQUISITION_ACTION_PROVENANCE_MISSING",
      });

      continue;
    }

    try {
      const page =
        await pageFetcher.fetch(
          candidate.url,
          {
            signal: config.signal,
          },
        );

      throwIfAborted(config.signal);

      const acquisition =
        ingestFetchedPage(
          store,
          page,
          extractEvidence(page),
          {
            actorId: config.actorId,
          },
        );

      acquisitions.push({
        actionId,
        candidateUrl: candidate.url,
        page,
        acquisition,
      });
    } catch (error) {
      throwIfAborted(config.signal);

      fetchErrors.push({
        url: candidate.url,
        error: message(error),
      });
    }
  }

  return immutable({
    discovery,
    acquisitions,
    searchErrors,
    fetchErrors,
  });
}