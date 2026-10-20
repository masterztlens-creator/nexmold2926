
import type {
  PageFetcher,
  SearchProvider,
  SearchResult,
} from "../../acquisition/types.js";

import {
  expandSourceReferences,
} from "./source-expansion.js";

import {
  observeFirstHop,
  type FirstHopObservation,
} from "./first-hop.js";

import {
  resolveBootstrapSources,
  type BootstrapSource,
} from "./bootstrap.js";

import type {
  DiscoveryBatch,
} from "./types.js";

export interface FirstHopInternetObservationOptions {
  /**
   * Maximum number of final discovery candidates.
   *
   * This is passed to the existing first-hop validation boundary.
   */
  readonly limit?: number;

  readonly signal?: AbortSignal;

  /**
   * A real search-provider implementation.
   *
   * This function does not instantiate a provider or claim that a provider
   * is available when none has been supplied.
   */
  readonly searchProvider?: SearchProvider;

  /**
   * Search queries to execute.
   *
   * Defaults to the original query when a provider is supplied.
   */
  readonly searchQueries?: readonly string[];

  /**
   * Maximum number of unique search results collected across all queries.
   */
  readonly maxSearchResults?: number;

  /**
   * Maximum number of pages fetched after discovery.
   */
  readonly maxPagesToFetch?: number;

  /**
   * Include the predefined bootstrap corpus alongside real search results.
   *
   * Defaults to false when a search provider is supplied.
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
  readonly bootstrap: ReturnType<
    typeof resolveBootstrapSources
  >;
  readonly observation: DiscoveryBatch;
  readonly pagesObserved: number;
  readonly fetchErrors: readonly FirstHopFetchError[];
  readonly searchErrors: readonly FirstHopSearchError[];
  readonly searchProvider: string | null;
  readonly searchQueries: readonly string[];
  readonly searchResultsReturned: number;
  readonly searchResultsObserved: number;
  readonly searchResultsRejected: number;
}

interface SearchResultWithProvenance extends SearchResult {
  /**
   * Actual public URL of the search-results page or response resource.
   *
   * This must be supplied by the provider. It must not be guessed from
   * the provider name or replaced with the target result URL.
   */
  readonly searchSourceUrl?: string;

  /**
   * Optional provider-observed timestamp.
   *
   * When absent, the observer records the time it received the result.
   */
  readonly searchObservedAt?: string;
}

interface SearchResultRecord {
  readonly query: string;
  readonly result: SearchResult;
  readonly provider: string;
  readonly searchSourceUrl?: string;
  readonly observedAt: string;
}

interface FetchSource {
  readonly url: string;
  readonly title?: string;
  readonly provider?: string;
  readonly candidateKind: "SERP_RESULT" | "SEED";
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const DEFAULT_MAX_SEARCH_RESULTS = 50;
const MAX_SEARCH_RESULTS = 200;

const DEFAULT_MAX_PAGES = 20;
const MAX_PAGES = 100;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

function normalizeQuery(query: string): string {
  if (
    typeof query !== "string" ||
    query.trim() === ""
  ) {
    throw new Error(
      "V8_FIRST_HOP_QUERY_EMPTY",
    );
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

function requireNotAborted(
  signal?: AbortSignal,
): void {
  if (signal?.aborted) {
    throw new Error(
      "V8_FIRST_HOP_INTERNET_ABORTED",
    );
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
    throw new Error(
      "V8_FIRST_HOP_SEARCH_QUERIES_INVALID",
    );
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
    throw new Error(
      "V8_FIRST_HOP_SEARCH_QUERIES_EMPTY",
    );
  }

  return Object.freeze(normalized);
}

function validateProviderName(
  provider: SearchProvider,
): string {
  if (
    provider === null ||
    typeof provider !== "object" ||
    typeof provider.name !== "string" ||
    provider.name.trim() === "" ||
    typeof provider.search !== "function"
  ) {
    throw new Error(
      "V8_FIRST_HOP_SEARCH_PROVIDER_INVALID",
    );
  }

  return provider.name.trim();
}

function normalizePublicHttpUrl(
  value: unknown,
): string | null {
  if (
    typeof value !== "string" ||
    value.trim() === ""
  ) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(value.trim());
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
    parsed.username !== "" ||
    parsed.password !== "" ||
    parsed.hostname === "" ||
    parsed.hostname === "localhost" ||
    parsed.hostname.endsWith(".localhost") ||
    parsed.hostname.endsWith(".local")
  ) {
    return null;
  }

  return parsed.toString();
}

function normalizeObservedTimestamp(
  value: unknown,
): string | null {
  if (
    typeof value !== "string" ||
    !ISO_TIMESTAMP_PATTERN.test(value.trim())
  ) {
    return null;
  }

  const timestamp = value.trim();

  if (!Number.isFinite(Date.parse(timestamp))) {
    return null;
  }

  return timestamp;
}

function validateSearchResult(
  value: unknown,
): {
  readonly result: SearchResult;
  readonly searchSourceUrl?: string;
  readonly observedAt: string;
} | null {
  if (
    value === null ||
    typeof value !== "object"
  ) {
    return null;
  }

  const candidate =
    value as Partial<SearchResultWithProvenance>;

  const url = normalizePublicHttpUrl(
    candidate.url,
  );

  if (url === null) {
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

  const searchSourceUrl =
    candidate.searchSourceUrl === undefined
      ? undefined
      : normalizePublicHttpUrl(
          candidate.searchSourceUrl,
        );

  /*
   * If the provider explicitly supplied source metadata but it is invalid,
   * reject the record rather than silently replacing its provenance.
   */
  if (
    candidate.searchSourceUrl !== undefined &&
    searchSourceUrl === null
  ) {
    return null;
  }

  const providerTimestamp =
    candidate.searchObservedAt === undefined
      ? null
      : normalizeObservedTimestamp(
          candidate.searchObservedAt,
        );

  if (
    candidate.searchObservedAt !== undefined &&
    providerTimestamp === null
  ) {
    return null;
  }

  const result: SearchResult = Object.freeze({
    url,
    ...(title ? { title } : {}),
    ...(snippet ? { snippet } : {}),
  });

  return Object.freeze({
    result,
    ...(searchSourceUrl
      ? { searchSourceUrl }
      : {}),
    observedAt:
      providerTimestamp ?? currentTimestamp(),
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
  readonly resultsReturned: number;
  readonly resultsRejected: number;
}> {
  const providerName = validateProviderName(provider);

  const results: SearchResultRecord[] = [];
  const errors: FirstHopSearchError[] = [];
  const seenUrls = new Set<string>();

  let resultsReturned = 0;
  let resultsRejected = 0;

  for (const query of queries) {
    requireNotAborted(signal);

    if (results.length >= maximumResults) {
      break;
    }

    let rawResults: readonly SearchResult[];

    try {
      rawResults = await provider.search(
        query,
        { signal },
      );
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
          error:
            "V8_FIRST_HOP_SEARCH_RESULTS_INVALID",
        }),
      );

      continue;
    }

    resultsReturned += rawResults.length;

    for (const rawResult of rawResults) {
      requireNotAborted(signal);

      if (results.length >= maximumResults) {
        break;
      }

      const validated =
        validateSearchResult(rawResult);

      if (validated === null) {
        resultsRejected += 1;
        continue;
      }

      let normalizedUrl: string;

      try {
        const parsed = new URL(
          validated.result.url,
        );

        parsed.hash = "";
        normalizedUrl = parsed.toString();
      } catch {
        resultsRejected += 1;
        continue;
      }

      if (seenUrls.has(normalizedUrl)) {
        continue;
      }

      seenUrls.add(normalizedUrl);

      results.push(
        Object.freeze({
          query,
          result: validated.result,
          provider: providerName,
          ...(validated.searchSourceUrl
            ? {
                searchSourceUrl:
                  validated.searchSourceUrl,
              }
            : {}),
          observedAt: validated.observedAt,
        }),
      );
    }
  }

  return Object.freeze({
    results: Object.freeze(results),
    errors: Object.freeze(errors),
    resultsReturned,
    resultsRejected,
  });
}

function createSearchResultObservation(
  record: SearchResultRecord,
): FirstHopObservation | null {
  /*
   * The baseline SearchResult contract does not require a SERP URL.
   * Therefore, do not manufacture observedFrom from the result URL.
   *
   * Providers that return genuine search-source metadata can create a
   * direct SERP_RESULT observation. Other results remain eligible for
   * the bounded page-fetch path below.
   */
  if (!record.searchSourceUrl) {
    return null;
  }

  return Object.freeze({
    url: record.result.url,
    observedFrom: record.searchSourceUrl,
    observedAt: record.observedAt,
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
  title: string | undefined,
  candidateKind: "SERP_RESULT" | "SEED",
): FirstHopObservation {
  return Object.freeze({
    url,
    observedFrom,
    observedAt,
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
    observedAt:
      reference.discoveredAt ??
      fallbackTimestamp,
    kind:
      reference.kind === "SITEMAP"
        ? "SITEMAP"
        : reference.kind === "REFERENCE"
          ? "REFERENCE"
          : "INDEX_REFERENCE",
    candidateKind,
    ...(reference.title
      ? { title: reference.title }
      : {}),
  });
}

/**
 * Observe first-hop Internet sources.
 *
 * With searchProvider supplied:
 * 1. Execute real provider searches.
 * 2. Preserve valid provider-supplied SERP source URLs when available.
 * 3. Fetch a bounded number of returned result pages.
 * 4. Record each fetched page against the URL that was actually requested.
 * 5. Expand references using the existing source-expansion implementation.
 *
 * Without searchProvider:
 * Preserve the original bootstrap-corpus discovery path.
 *
 * This function does not create a provider, invent search results, or
 * assign a target URL as its own search-result provenance.
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
    throw new Error(
      "V8_FIRST_HOP_PAGE_FETCHER_INVALID",
    );
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
  let searchResultsReturned = 0;
  let searchResultsObserved = 0;
  let searchResultsRejected = 0;
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
    Math.min(
      DEFAULT_MAX_PAGES,
      observationLimit,
    ),
    MAX_PAGES,
    "V8_FIRST_HOP_MAX_PAGES_INVALID",
  );

  const searchRecords: SearchResultRecord[] = [];

  if (options.searchProvider) {
    providerName = validateProviderName(
      options.searchProvider,
    );

    const searchOutcome = await executeSearches(
      options.searchProvider,
      searchQueries,
      selectedSearchLimit,
      options.signal,
    );

    searchRecords.push(...searchOutcome.results);
    searchErrors.push(...searchOutcome.errors);

    searchResultsReturned =
      searchOutcome.resultsReturned;

    searchResultsRejected =
      searchOutcome.resultsRejected;

    searchResultsObserved =
      searchOutcome.results.length;

    for (const record of searchRecords) {
      const observation =
        createSearchResultObservation(record);

      if (observation !== null) {
        observations.push(observation);
      }
    }
  }

  const sourcesToFetch: FetchSource[] = [];

  if (options.searchProvider) {
    for (const record of searchRecords) {
      if (
        sourcesToFetch.length >= selectedPageLimit
      ) {
        break;
      }

      sourcesToFetch.push(
        Object.freeze({
          url: record.result.url,
          ...(record.result.title
            ? { title: record.result.title }
            : {}),
          provider: record.provider,
          candidateKind: "SERP_RESULT",
        }),
      );
    }

    if (options.includeBootstrapWithSearch === true) {
      const alreadySelected = new Set(
        sourcesToFetch.map((source) => source.url),
      );

      for (const source of bootstrap.matched) {
        if (
          sourcesToFetch.length >= selectedPageLimit
        ) {
          break;
        }

        if (alreadySelected.has(source.url)) {
          continue;
        }

        alreadySelected.add(source.url);

        sourcesToFetch.push(
          Object.freeze({
            url: source.url,
            title: source.title,
            candidateKind: "SEED",
          }),
        );
      }
    }
  } else {
    for (const source of bootstrap.matched) {
      if (
        sourcesToFetch.length >= selectedPageLimit
      ) {
        break;
      }

      sourcesToFetch.push(
        Object.freeze({
          url: source.url,
          title: source.title,
          candidateKind: "SEED",
        }),
      );
    }
  }

  for (const source of sourcesToFetch) {
    requireNotAborted(options.signal);

    try {
      const page = await fetcher.fetch(
        source.url,
        { signal: options.signal },
      );

      requireNotAborted(options.signal);

      pagesObserved += 1;

      /*
       * The fetched page is observed from the URL actually requested.
       * Its final URL records redirect resolution without overwriting
       * the original requested URL in the provenance chain.
       */
      observations.push(
        createFetchedPageObservation(
          page.finalUrl,
          source.url,
          page.fetchedAt,
          source.title,
          source.candidateKind,
        ),
      );

      const references =
        expandSourceReferences(page);

      for (const reference of references) {
        observations.push(
          createReferenceObservation(
            reference,
            page.finalUrl,
            page.fetchedAt,
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

  /*
   * Keep the established validation boundary responsible for:
   * - public URL eligibility;
   * - observation-source URL eligibility;
   * - timestamp validation;
   * - candidate construction;
   * - normalized URL deduplication;
   * - accepted/rejected candidate counts.
   */
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
    searchResultsReturned,
    searchResultsObserved,
    searchResultsRejected,
  });
}
