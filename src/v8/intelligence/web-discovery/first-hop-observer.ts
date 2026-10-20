
import type {
  PageFetcher,
  SearchProvider,
  SearchResult,
} from "../../acquisition/types.js";
import { expandSourceReferences } from "./source-expansion.js";
import {
  observeFirstHop,
  type FirstHopObservation,
} from "./first-hop.js";
import {
  resolveBootstrapSources,
  type BootstrapSource,
} from "./bootstrap.js";
import type { DiscoveryBatch } from "./types.js";

export interface FirstHopInternetObservationOptions {
  /**
   * Maximum number of bootstrap sources to select when using the
   * legacy bootstrap discovery path.
   */
  readonly limit?: number;

  readonly signal?: AbortSignal;

  /**
   * A real search-provider implementation.
   *
   * The interface alone does not perform Internet search. The caller
   * must supply a functioning provider implementation.
   */
  readonly searchProvider?: SearchProvider;

  /**
   * Search queries to execute. When omitted, the original query is used.
   * Empty or whitespace-only queries are rejected.
   */
  readonly searchQueries?: readonly string[];

  /**
   * Maximum number of search results accepted across all queries.
   * Defaults to the observation limit, capped by the first-hop limit.
   */
  readonly maxSearchResults?: number;

  /**
   * Maximum number of result pages to fetch.
   * Defaults to the accepted search-result count when a search provider
   * is supplied; otherwise defaults to the selected bootstrap count.
   */
  readonly maxPagesToFetch?: number;

  /**
   * When true, also include bootstrap sources in a search-provider run.
   * Defaults to false so the search-provider path is not silently
   * supplemented by a predefined corpus.
   */
  readonly includeBootstrapWithSearch?: boolean;
}

export interface FirstHopFetchError {
  readonly url: string;
  readonly error: string;
}

export interface FirstHopSearchError {
  readonly query: string;
  readonly provider: string;
  readonly error: string;
}

export interface FirstHopInternetObservationResult {
  readonly query: string;
  readonly bootstrap: ReturnType<typeof resolveBootstrapSources>;
  readonly observation: DiscoveryBatch;
  readonly pagesObserved: number;
  readonly fetchErrors: readonly FirstHopFetchError[];
  readonly searchErrors: readonly FirstHopSearchError[];
  readonly searchProvider: string | null;
  readonly searchQueries: readonly string[];
  readonly searchResultsObserved: number;
}

interface SearchResultRecord {
  readonly query: string;
  readonly result: SearchResult;
  readonly provider: string;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const DEFAULT_MAX_SEARCH_RESULTS = 50;
const MAX_SEARCH_RESULTS = 200;
const DEFAULT_MAX_PAGES = 20;
const MAX_PAGES = 100;

function normalizeQuery(query: string): string {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("V8_FIRST_HOP_QUERY_EMPTY");
  }

  return query.trim().replace(/\s+/g, " ");
}

function resolvePositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number,
  errorCode: string,
): number {
  const resolved = value ?? fallback;

  if (
    !Number.isInteger(resolved) ||
    resolved < 1 ||
    resolved > maximum
  ) {
    throw new Error(errorCode);
  }

  return resolved;
}

function requireNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new Error("V8_FIRST_HOP_INTERNET_ABORTED");
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  try {
    return String(error);
  } catch {
    return "UNKNOWN_ERROR";
  }
}

function currentTimestamp(): string {
  return new Date().toISOString();
}

function normalizeSearchQueries(
  originalQuery: string,
  queries: readonly string[] | undefined,
): readonly string[] {
  if (queries === undefined) {
    return Object.freeze([originalQuery]);
  }

  if (!Array.isArray(queries)) {
    throw new Error("V8_FIRST_HOP_SEARCH_QUERIES_INVALID");
  }

  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    const value = normalizeQuery(query);
    const key = value.toLocaleLowerCase("en-US");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(value);
  }

  if (normalized.length === 0) {
    throw new Error("V8_FIRST_HOP_SEARCH_QUERIES_EMPTY");
  }

  return Object.freeze(normalized);
}

function validateProviderName(provider: SearchProvider): string {
  if (
    provider === null ||
    typeof provider !== "object" ||
    typeof provider.name !== "string" ||
    provider.name.trim() === "" ||
    typeof provider.search !== "function"
  ) {
    throw new Error("V8_FIRST_HOP_SEARCH_PROVIDER_INVALID");
  }

  return provider.name.trim();
}

function validateSearchResult(
  value: unknown,
): SearchResult | null {
  if (value === null || typeof value !== "object") {
    return null;
  }

  const candidate = value as Partial<SearchResult>;

  if (
    typeof candidate.url !== "string" ||
    candidate.url.trim() === ""
  ) {
    return null;
  }

  const url = candidate.url.trim();

  let parsed: URL;

  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  if (
    parsed.protocol !== "https:" &&
    parsed.protocol !== "http:"
  ) {
    return null;
  }

  if (
    candidate.title !== undefined &&
    typeof candidate.title !== "string"
  ) {
    return null;
  }

  if (
    candidate.snippet !== undefined &&
    typeof candidate.snippet !== "string"
  ) {
    return null;
  }

  const title =
    typeof candidate.title === "string"
      ? candidate.title.trim().slice(0, 500)
      : undefined;

  const snippet =
    typeof candidate.snippet === "string"
      ? candidate.snippet.trim().slice(0, 4000)
      : undefined;

  return Object.freeze({
    url,
    ...(title ? { title } : {}),
    ...(snippet ? { snippet } : {}),
  });
}

async function executeSearches(
  provider: SearchProvider,
  queries: readonly string[],
  maximumResults: number,
  signal?: AbortSignal,
): Promise<{
  readonly results: readonly SearchResultRecord[];
  readonly errors: readonly FirstHopSearchError[];
}> {
  const providerName = validateProviderName(provider);
  const results: SearchResultRecord[] = [];
  const errors: FirstHopSearchError[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    requireNotAborted(signal);

    let rawResults: readonly SearchResult[];

    try {
      rawResults = await provider.search(query, { signal });
    } catch (error) {
      requireNotAborted(signal);

      errors.push(
        Object.freeze({
          query,
          provider: providerName,
          error: errorMessage(error),
        }),
      );

      continue;
    }

    requireNotAborted(signal);

    if (!Array.isArray(rawResults)) {
      errors.push(
        Object.freeze({
          query,
          provider: providerName,
          error: "V8_FIRST_HOP_SEARCH_RESULTS_INVALID",
        }),
      );

      continue;
    }

    for (const rawResult of rawResults) {
      if (results.length >= maximumResults) {
        break;
      }

      const result = validateSearchResult(rawResult);

      if (!result) {
        continue;
      }

      let normalizedUrl: string;

      try {
        const parsed = new URL(result.url);
        parsed.hash = "";
        normalizedUrl = parsed.toString();
      } catch {
        continue;
      }

      if (seenUrls.has(normalizedUrl)) {
        continue;
      }

      seenUrls.add(normalizedUrl);

      results.push(
        Object.freeze({
          query,
          result,
          provider: providerName,
        }),
      );
    }

    if (results.length >= maximumResults) {
      break;
    }
  }

  return Object.freeze({
    results: Object.freeze(results),
    errors: Object.freeze(errors),
  });
}

function createSearchResultObservation(
  record: SearchResultRecord,
  observedAt: string,
): FirstHopObservation {
  return Object.freeze({
    url: record.result.url,
    discoveryProvider: record.provider,
    observedAt,
    kind: "DIRECT",
    candidateKind: "SERP_RESULT",
    ...(record.result.title
      ? { title: record.result.title }
      : {}),
  });
}

function createFetchedPageObservation(
  url: string,
  observedFrom: string,
  observedAt: string,
  provider: string | undefined,
  title: string | undefined,
  candidateKind: "SERP_RESULT" | "SEED",
): FirstHopObservation {
  return Object.freeze({
    url,
    observedFrom,
    observedAt,
    ...(provider ? { discoveryProvider: provider } : {}),
    kind: "AUTHORITY",
    candidateKind,
    ...(title ? { title } : {}),
  });
}

function createReferenceObservation(
  reference: {
    readonly url: string;
    readonly discoveredAt?: string;
    readonly kind?: string;
    readonly title?: string;
  },
  observedFrom: string,
  fallbackTimestamp: string,
  provider: string | undefined,
): FirstHopObservation {
  const candidateKind =
    reference.kind === "SITEMAP"
      ? "SITEMAP"
      : reference.kind === "REFERENCE"
        ? "REFERENCE"
        : "LINK";

  return Object.freeze({
    url: reference.url,
    observedFrom,
    observedAt: reference.discoveredAt ?? fallbackTimestamp,
    ...(provider ? { discoveryProvider: provider } : {}),
    kind:
      reference.kind === "SITEMAP"
        ? "SITEMAP"
        : reference.kind === "REFERENCE"
          ? "REFERENCE"
          : "INDEX_REFERENCE",
    candidateKind,
    ...(reference.title ? { title: reference.title } : {}),
  });
}

/**
 * Observe first-hop Internet sources.
 *
 * With searchProvider supplied:
 * 1. Execute actual provider searches.
 * 2. Record returned SERP URLs with provider provenance.
 * 3. Fetch a bounded number of result pages.
 * 4. Record fetched-page observations and expand page references.
 *
 * Without searchProvider:
 * Preserve the existing bootstrap-corpus discovery behavior.
 *
 * This function does not instantiate a search provider, manufacture
 * search results, or claim that a provider is available.
 */
export async function observeInternetFirstHop(
  query: string,
  corpus: readonly BootstrapSource[],
  fetcher: PageFetcher,
  options: FirstHopInternetObservationOptions = {},
): Promise<FirstHopInternetObservationResult> {
  requireNotAborted(options.signal);

  const normalizedQuery = normalizeQuery(query);

  const observationLimit = resolvePositiveInteger(
    options.limit,
    DEFAULT_LIMIT,
    MAX_LIMIT,
    "V8_FIRST_HOP_LIMIT_INVALID",
  );

  if (
    fetcher === null ||
    typeof fetcher !== "object" ||
    typeof fetcher.fetch !== "function"
  ) {
    throw new Error("V8_FIRST_HOP_PAGE_FETCHER_INVALID");
  }

  const bootstrap = resolveBootstrapSources(
    normalizedQuery,
    corpus,
    observationLimit,
  );

  const observations: FirstHopObservation[] = [];
  const fetchErrors: FirstHopFetchError[] = [];
  const searchErrors: FirstHopSearchError[] = [];

  let pagesObserved = 0;
  let searchResultsObserved = 0;
  let providerName: string | null = null;

  const searchQueries = options.searchProvider
    ? normalizeSearchQueries(
        normalizedQuery,
        options.searchQueries,
      )
    : Object.freeze([] as string[]);

  const selectedSearchLimit = resolvePositiveInteger(
    options.maxSearchResults,
    Math.min(
      DEFAULT_MAX_SEARCH_RESULTS,
      observationLimit * 2,
    ),
    MAX_SEARCH_RESULTS,
    "V8_FIRST_HOP_MAX_SEARCH_RESULTS_INVALID",
  );

  const selectedPageLimit = resolvePositiveInteger(
    options.maxPagesToFetch,
    Math.min(DEFAULT_MAX_PAGES, observationLimit),
    MAX_PAGES,
    "V8_FIRST_HOP_MAX_PAGES_INVALID",
  );

  const searchRecords: SearchResultRecord[] = [];

  if (options.searchProvider) {
    providerName = validateProviderName(options.searchProvider);

    const searchOutcome = await executeSearches(
      options.searchProvider,
      searchQueries,
      selectedSearchLimit,
      options.signal,
    );

    searchRecords.push(...searchOutcome.results);
    searchErrors.push(...searchOutcome.errors);
    searchResultsObserved = searchOutcome.results.length;

    const searchObservedAt = currentTimestamp();

    for (const record of searchRecords) {
      observations.push(
        createSearchResultObservation(
          record,
          searchObservedAt,
        ),
      );
    }
  }

  const sourcesToFetch: Array<{
    readonly url: string;
    readonly title?: string;
    readonly provider?: string;
    readonly candidateKind: "SERP_RESULT" | "SEED";
  }> = [];

  if (options.searchProvider) {
    for (const record of searchRecords) {
      if (sourcesToFetch.length >= selectedPageLimit) {
        break;
      }

      sourcesToFetch.push({
        url: record.result.url,
        ...(record.result.title
          ? { title: record.result.title }
          : {}),
        provider: record.provider,
        candidateKind: "SERP_RESULT",
      });
    }

    if (options.includeBootstrapWithSearch === true) {
      const alreadySelected = new Set(
        sourcesToFetch.map((source) => source.url),
      );

      for (const source of bootstrap.matched) {
        if (sourcesToFetch.length >= selectedPageLimit) {
          break;
        }

        if (alreadySelected.has(source.url)) {
          continue;
        }

        alreadySelected.add(source.url);

        sourcesToFetch.push({
          url: source.url,
          title: source.title,
          candidateKind: "SEED",
        });
      }
    }
  } else {
    for (const source of bootstrap.matched) {
      if (sourcesToFetch.length >= selectedPageLimit) {
        break;
      }

      sourcesToFetch.push({
        url: source.url,
        title: source.title,
        candidateKind: "SEED",
      });
    }
  }

  for (const source of sourcesToFetch) {
    requireNotAborted(options.signal);

    try {
      const page = await fetcher.fetch(source.url, {
        signal: options.signal,
      });

      requireNotAborted(options.signal);

      pagesObserved++;

      observations.push(
        createFetchedPageObservation(
          page.finalUrl,
          source.url,
          page.fetchedAt,
          source.provider,
          source.title,
          source.candidateKind,
        ),
      );

      const references = expandSourceReferences(page);

      for (const reference of references) {
        observations.push(
          createReferenceObservation(
            reference,
            page.finalUrl,
            page.fetchedAt,
            source.provider,
          ),
        );
      }
    } catch (error) {
      requireNotAborted(options.signal);

      fetchErrors.push(
        Object.freeze({
          url: source.url,
          error: errorMessage(error),
        }),
      );
    }
  }

  requireNotAborted(options.signal);

  const observation = observeFirstHop({
    query: normalizedQuery,
    observations,
    limit: observationLimit,
  });

  return Object.freeze({
    query: normalizedQuery,
    bootstrap,
    observation,
    pagesObserved,
    fetchErrors: Object.freeze(fetchErrors),
    searchErrors: Object.freeze(searchErrors),
    searchProvider: providerName,
    searchQueries,
    searchResultsObserved,
  });
}
