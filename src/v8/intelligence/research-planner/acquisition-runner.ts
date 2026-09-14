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

export interface ResearchAcquisitionConfig {
  readonly actorId?: string;
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly signal?: AbortSignal;
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

export async function runResearchAcquisition(
  opportunity: Opportunity,
  searchProvider: SearchProvider,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: ResearchAcquisitionConfig = {},
): Promise<ResearchAcquisitionResult> {
  const plan = planResearch(opportunity);

  const maxQueries = Math.max(
    1,
    config.maxQueries ?? plan.sourceQueries.length,
  );

  const maxCandidates = Math.max(
    1,
    config.maxCandidates ?? 10,
  );

  const discoveryInputs: DiscoveryInput[] = [];
  const searchErrors: ResearchAcquisitionError[] = [];

  for (const query of plan.sourceQueries.slice(0, maxQueries)) {
    throwIfAborted(config.signal);

    try {
      const results = await searchProvider.search(query, {
        signal: config.signal,
      });

      for (const result of results) {
        discoveryInputs.push({
          url: result.url,
          kind: "SERP_RESULT",
          title: result.title,
        });
      }
    } catch (error) {
      searchErrors.push({
        query,
        error: errorMessage(error),
      });
    }
  }

  const discovery = discoverCandidates(discoveryInputs);

  const acquisitions: ResearchAcquisitionRecord[] = [];
  const fetchErrors: ResearchAcquisitionError[] = [];

  for (
    const candidate of discovery.candidates.slice(
      0,
      maxCandidates,
    )
  ) {
    throwIfAborted(config.signal);

    try {
      const page = await pageFetcher.fetch(
        candidate.url,
        {
          signal: config.signal,
        },
      );

      const extracted =
        extractResearchEvidence(page);

      const acquisition =
        ingestFetchedPage(
          store,
          page,
          extracted,
          {
            actorId: config.actorId,
          },
        );

      acquisitions.push({
        candidateUrl: candidate.url,
        page,
        acquisition,
      });
    } catch (error) {
      fetchErrors.push({
        url: candidate.url,
        error: errorMessage(error),
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