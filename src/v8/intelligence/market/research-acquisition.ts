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

  const seen =
    new Set<string>();

  return all.filter(
    (candidate) => {
      const key =
        evidenceKey(candidate);

      if (
        seen.has(key)
      ) {
        return false;
      }

      seen.add(key);

      return true;
    },
  );
}

function actionIdForQuery(
  plan: MarketResearchPlan,
  query: string,
): string {
  const match =
    plan.queries.find(
      (item) =>
        item.query === query,
    );

  return (
    match?.actionId ??
    "unknown"
  );
}

function actionIdForCandidate(
  plan: MarketResearchPlan,
  candidateUrl: string,
): string {
  const matchingQuery =
    plan.queries.find(
      (item) =>
        item.query ===
        candidateUrl,
    );

  return (
    matchingQuery?.actionId ??
    plan.queries[0]?.actionId ??
    "unknown"
  );
}

export async function runMarketAcquisition(
  plan: MarketResearchPlan,
  searchProvider: SearchProvider,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: MarketAcquisitionConfig = {},
): Promise<MarketAcquisitionResult> {
  const inputs:
    DiscoveryInput[] = [];

  const searchErrors:
    {
      query: string;
      error: string;
    }[] = [];

  const queryToAction =
    new Map<string, string>();

  for (
    const item of plan.queries
  ) {
    if (
      config.signal?.aborted
    ) {
      throw new Error(
        "V8_MARKET_RESEARCH_ABORTED",
      );
    }

    queryToAction.set(
      item.query,
      item.actionId,
    );

    try {
      const results =
        await searchProvider.search(
          item.query,
          {
            signal:
              config.signal,
          },
        );

      for (
        const result of results
      ) {
        inputs.push({
          url: result.url,
          kind: "SERP_RESULT",
          title: result.title,
        });
      }
    } catch (
      error
    ) {
      searchErrors.push({
        query: item.query,
        error:
          message(error),
      });
    }
  }

  const discovery =
    discoverCandidates(
      inputs,
    );

  const acquisitions:
    MarketAcquisitionRecord[] =
      [];

  const fetchErrors:
    {
      url: string;
      error: string;
    }[] = [];

  const maxCandidates =
    config.maxCandidates ??
    10;

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

    if (
      config.signal?.aborted
    ) {
      throw new Error(
        "V8_MARKET_RESEARCH_ABORTED",
      );
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

      const acquisition =
        ingestFetchedPage(
          store,
          page,
          extractEvidence(page),
          {
            actorId:
              config.actorId,
          },
        );

      const actionId =
        queryToAction.get(
          candidate.url,
        ) ??
        plan.queries[0]
          ?.actionId ??
        "unknown";

      acquisitions.push({
        actionId,
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
          message(error),
      });
    }
  }

  return {
    discovery,
    acquisitions:
      immutable(
        acquisitions,
      ),
    searchErrors:
      immutable(
        searchErrors,
      ),
    fetchErrors:
      immutable(
        fetchErrors,
      ),
  };
}