import type {
  PageFetcher,
  SearchProvider,
} from "../../acquisition/types.js";

import type {
  EvidenceStore,
} from "../../acquisition/evidence-store.js";

import {
  discoverWithSelfOwnedCrawl,
  type SelfOwnedDiscoveryCandidate,
} from "../../research/self-owned-discovery.js";

import {
  resolveResearchSeeds,
  type ResearchSeedResolution,
} from "./self-owned-seed-resolver.js";

import {
  discoverCandidates,
  type DiscoveryInput,
} from "../web-discovery/discovery.js";

import type {
  DiscoveryBatch,
} from "../web-discovery/types.js";

import {
  ingestFetchedPage,
} from "../../acquisition/internet-acquisition.js";

import {
  planResearch,
} from "./planner.js";

import type {
  ResearchOpportunity,
  ResearchPlan,
} from "./types.js";

export interface ResearchAcquisitionConfig {
  readonly signal?: AbortSignal;
  readonly maxPages?: number;
  readonly maxDepth?: number;
  readonly sameHostOnly?: boolean;
}

export interface ResearchAcquisitionResult {
  readonly plan: ResearchPlan;
  readonly seedResolution: ResearchSeedResolution;
  readonly discovery: DiscoveryBatch;
  readonly acquisitions: readonly string[];
  readonly searchErrors: readonly string[];
  readonly fetchErrors: readonly string[];
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new DOMException(
      "Research acquisition aborted.",
      "AbortError",
    );
  }
}

function discoveryBatchFromSelfOwnedCandidates(
  candidates: readonly SelfOwnedDiscoveryCandidate[],
): DiscoveryBatch {
  const inputs: DiscoveryInput[] = candidates.map((candidate) => ({
    url: candidate.url,
    kind: candidate.kind === "SEED" ? "SEED" : "LINK",
    ...(candidate.sourceHint === undefined
      ? {}
      : { sourceUrl: candidate.sourceHint }),
    ...(candidate.title === undefined
      ? {}
      : { title: candidate.title }),
    discoveredAt: candidate.discoveredAt,
  }));

  return discoverCandidates(inputs);
}

async function acquireCandidates(
  discovery: DiscoveryBatch,
  pageFetcher: PageFetcher,
  store: EvidenceStore,
  signal?: AbortSignal,
): Promise<{
  acquisitions: readonly string[];
  fetchErrors: readonly string[];
}> {
  const acquisitions: string[] = [];
  const fetchErrors: string[] = [];

  for (const candidate of discovery.candidates) {
    assertNotAborted(signal);

    try {
      const fetched = await pageFetcher.fetch(
        candidate.url,
        signal,
      );

      assertNotAborted(signal);

      const evidenceAggregateId = await ingestFetchedPage(
        fetched,
        store,
      );

      acquisitions.push(evidenceAggregateId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      fetchErrors.push(
        `${candidate.url}: ${message}`,
      );
    }
  }

  return Object.freeze({
    acquisitions: Object.freeze(acquisitions),
    fetchErrors: Object.freeze(fetchErrors),
  });
}

export async function runSelfOwnedResearchAcquisition(
  opportunity: ResearchOpportunity,
  pageFetcher: PageFetcher,
  store: EvidenceStore,
  config: ResearchAcquisitionConfig = {},
): Promise<ResearchAcquisitionResult> {
  assertNotAborted(config.signal);

  const plan = planResearch(opportunity);

  const seedResolution = resolveResearchSeeds(
    opportunity,
  );

  if (seedResolution.accepted.length === 0) {
    throw new Error(
      "V8_RESEARCH_SEED_NO_VALID_SEEDS: " +
      "Research opportunity produced no valid self-owned research seeds.",
    );
  }

  assertNotAborted(config.signal);

  const selfOwnedDiscovery =
    await discoverWithSelfOwnedCrawl(
      seedResolution.accepted,
      pageFetcher,
      {
        signal: config.signal,
        maxPages: config.maxPages,
        maxDepth: config.maxDepth,
        sameHostOnly: config.sameHostOnly,
      },
    );

  assertNotAborted(config.signal);

  const discovery =
    discoveryBatchFromSelfOwnedCandidates(
      selfOwnedDiscovery.candidates,
    );

  const acquisition =
    await acquireCandidates(
      discovery,
      pageFetcher,
      store,
      config.signal,
    );

  return Object.freeze({
    plan,
    seedResolution,
    discovery,
    acquisitions: acquisition.acquisitions,
    searchErrors: Object.freeze([]),
    fetchErrors: acquisition.fetchErrors,
  });
}

export async function runResearchAcquisition(
  opportunity: ResearchOpportunity,
  searchProvider: SearchProvider,
  pageFetcher: PageFetcher,
  store: EvidenceStore,
  config: ResearchAcquisitionConfig = {},
): Promise<ResearchAcquisitionResult> {
  assertNotAborted(config.signal);

  const plan = planResearch(opportunity);

  const searchErrors: string[] = [];
  const discoveryInputs: DiscoveryInput[] = [];

  for (const query of plan.sourceQueries) {
    assertNotAborted(config.signal);

    try {
      const results = await searchProvider.search(
        query,
        {
          signal: config.signal,
        },
      );

      for (const result of results) {
        discoveryInputs.push({
          url: result.url,
          kind: "SERP_RESULT",
          ...(result.title === undefined
            ? {}
            : { title: result.title }),
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw error;
      }

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      searchErrors.push(
        `${query}: ${message}`,
      );
    }
  }

  assertNotAborted(config.signal);

  const discovery = discoverCandidates(
    discoveryInputs,
  );

  const acquisition = await acquireCandidates(
    discovery,
    pageFetcher,
    store,
    config.signal,
  );

  return Object.freeze({
    plan,
    seedResolution: Object.freeze({
      accepted: Object.freeze([]),
      rejected: Object.freeze([]),
    }),
    discovery,
    acquisitions: acquisition.acquisitions,
    searchErrors: Object.freeze(searchErrors),
    fetchErrors: acquisition.fetchErrors,
  });
}