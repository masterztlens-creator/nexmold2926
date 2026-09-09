import { normalizeText, type EvidenceRef } from "../shared.js";
import type { FoundationStore } from "../../foundation/types.js";
import { ingestFetchedPage } from "../../acquisition/foundation-adapter.js";
import { extractTextEvidence } from "../../acquisition/source-extractor.js";
import type {
  FetchedPage,
  PageFetcher,
  SearchProvider,
  SearchResult,
} from "../../acquisition/types.js";
export interface EvidenceCandidate {
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly authority: number;
  readonly relevance: number;
  readonly query: string;
}
export interface EvidenceExpansionConfig {
  readonly actorId?: string;
  readonly maxQueries?: number;
  readonly maxCandidates?: number;
  readonly signal?: AbortSignal;
}
export interface EvidenceExpansionError {
  readonly query?: string;
  readonly url?: string;
  readonly error: string;
}
export interface EvidenceExpansionRecord {
  readonly candidate: EvidenceCandidate;
  readonly page: FetchedPage;
  readonly evidence: ReturnType<typeof ingestFetchedPage>;
}
export interface EvidenceExpansionResult {
  readonly candidates: readonly EvidenceCandidate[];
  readonly rankedCandidates: readonly EvidenceCandidate[];
  readonly evidenceRefs: readonly EvidenceRef[];
  readonly acquisitions: readonly EvidenceExpansionRecord[];
  readonly searchErrors: readonly EvidenceExpansionError[];
  readonly fetchErrors: readonly EvidenceExpansionError[];
}
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
function publisherFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
function relevanceFor(query: string, result: SearchResult): number {
  const terms = new Set(normalizeText(query).split(/\s+/).filter(Boolean));
  const text = normalizeText(`${result.title ?? ""} ${result.snippet ?? ""}`);
  if (terms.size === 0 || !text) {
    return 0;
  }
  let matches = 0;
  for (const term of terms) {
    if (text.includes(term)) {
      matches += 1;
    }
  }
  return Math.min(1, matches / terms.size);
}
function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("V8_EVIDENCE_EXPANSION_ABORTED");
  }
}
export function rankEvidenceCandidates(
  query: string,
  candidates: readonly EvidenceCandidate[],
): readonly EvidenceCandidate[] {
  return Object.freeze(
    [...candidates]
      .map((candidate) => ({
        ...candidate,
        relevance: Math.min(
          1,
          candidate.relevance +
            (normalizeText(candidate.title).includes(normalizeText(query))
              ? 0.15
              : 0),
        ),
      }))
      .sort(
        (a, b) =>
          b.authority +
          b.relevance -
          (a.authority + a.relevance),
      ),
  );
}
export function toEvidenceRefs(
  candidates: readonly EvidenceCandidate[],
  limit = 8,
): readonly EvidenceRef[] {
  return Object.freeze(
    candidates
      .slice(0, Math.max(0, limit))
      .map((candidate) => ({
        sourceUrl: candidate.url,
        title: candidate.title,
        publisher: candidate.publisher,
      })),
  );
}
export async function expandEvidenceFromInternet(
  queries: readonly string[],
  searchProvider: SearchProvider,
  pageFetcher: PageFetcher,
  store: FoundationStore,
  config: EvidenceExpansionConfig = {},
): Promise<EvidenceExpansionResult> {
  const maxQueries = Math.max(1, config.maxQueries ?? queries.length);
  const maxCandidates = Math.max(1, config.maxCandidates ?? 8);
  const candidates: EvidenceCandidate[] = [];
  const searchErrors: EvidenceExpansionError[] = [];
  for (const query of queries.slice(0, maxQueries)) {
    throwIfAborted(config.signal);
    try {
      const results = await searchProvider.search(query, {
        signal: config.signal,
      });
      for (const result of results) {
        if (!result.url) {
          continue;
        }
        candidates.push({
          url: result.url,
          title: result.title?.trim() || result.url,
          publisher: publisherFromUrl(result.url),
          authority: 0,
          relevance: relevanceFor(query, result),
          query,
        });
      }
    } catch (error) {
      searchErrors.push({
        query,
        error: errorMessage(error),
      });
    }
  }
  const deduped = [
    ...new Map(
      candidates.map((candidate) => [
        normalizeText(candidate.url),
        candidate,
      ]),
    ).values(),
  ];
  const rankedCandidates = rankEvidenceCandidates(
    queries[0] ?? "",
    deduped,
  ).slice(0, maxCandidates);
  const acquisitions: EvidenceExpansionRecord[] = [];
  const fetchErrors: EvidenceExpansionError[] = [];
  for (const candidate of rankedCandidates) {
    throwIfAborted(config.signal);
    try {
      const page = await pageFetcher.fetch(candidate.url, {
        signal: config.signal,
      });
      const extracted = extractTextEvidence(
        page.body,
        page.finalUrl,
      );
      const evidence = ingestFetchedPage(
        store,
        page,
        extracted,
        { actorId: config.actorId },
      );
      acquisitions.push({
        candidate,
        page,
        evidence,
      });
    } catch (error) {
      fetchErrors.push({
        url: candidate.url,
        error: errorMessage(error),
      });
    }
  }
  return Object.freeze({
    candidates: Object.freeze(deduped),
    rankedCandidates: Object.freeze([...rankedCandidates]),
    evidenceRefs: toEvidenceRefs(rankedCandidates),
    acquisitions: Object.freeze(acquisitions),
    searchErrors: Object.freeze(searchErrors),
    fetchErrors: Object.freeze(fetchErrors),
  });
}