import type {
  PageFetcher,
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
  readonly limit?: number;
  readonly signal?: AbortSignal;
}

export interface FirstHopInternetObservationResult {
  readonly query: string;
  readonly bootstrap:
    ReturnType<
      typeof resolveBootstrapSources
    >;
  readonly observation:
    DiscoveryBatch;
  readonly pagesObserved: number;
  readonly fetchErrors: readonly {
    readonly url: string;
    readonly error: string;
  }[];
}

/**
 * V8-owned first-hop Internet observation.
 *
 * Pipeline:
 *
 *   Query
 *     -> V8-owned Bootstrap Corpus
 *     -> real HTTP observation
 *     -> real page references
 *     -> FirstHopObservation
 *     -> existing DiscoveryCandidate identity
 *
 * This function does not use SearchProvider.
 * It does not call SearXNG.
 * It does not call Tavily.
 * It does not manufacture URLs from query text.
 */
export async function observeInternetFirstHop(
  query: string,
  corpus: readonly BootstrapSource[],
  fetcher: PageFetcher,
  options: FirstHopInternetObservationOptions = {},
): Promise<FirstHopInternetObservationResult> {
  if (
    options.signal?.aborted
  ) {
    throw new Error(
      "V8_FIRST_HOP_INTERNET_ABORTED",
    );
  }

  const bootstrap =
    resolveBootstrapSources(
      query,
      corpus,
      options.limit ?? 10,
    );

  const observations:
    FirstHopObservation[] =
    [];

  const fetchErrors: {
    url: string;
    error: string;
  }[] = [];

  let pagesObserved = 0;

  for (
    const source of
      bootstrap.matched
  ) {
    if (
      options.signal?.aborted
    ) {
      throw new Error(
        "V8_FIRST_HOP_INTERNET_ABORTED",
      );
    }

    try {
      const page =
        await fetcher.fetch(
          source.url,
          {
            signal:
              options.signal,
          },
        );

      pagesObserved += 1;

      observations.push({
        url:
          page.finalUrl,
        observedFrom:
          source.url,
        observedAt:
          page.fetchedAt,
        kind:
          "AUTHORITY",
        candidateKind:
          "SEED",
        title:
          source.title,
      });

      const references =
        expandSourceReferences(
          page,
        );

      for (
        const reference of
          references
      ) {
        observations.push({
          url:
            reference.url,
          observedFrom:
            page.finalUrl,
          observedAt:
            reference.discoveredAt ??
            page.fetchedAt,
          kind:
            reference.kind ===
            "SITEMAP"
              ? "SITEMAP"
              : reference.kind ===
                "REFERENCE"
                ? "REFERENCE"
                : "INDEX_REFERENCE",
          candidateKind:
            reference.kind,
          title:
            reference.title,
        });
      }
    } catch (error) {
      fetchErrors.push({
        url:
          source.url,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const observation =
    observeFirstHop({
      query,
      observations,
      limit:
        options.limit ?? 20,
    });

  return Object.freeze({
    query:
      query
        .trim()
        .replace(/\s+/g, " "),

    bootstrap,

    observation,

    pagesObserved,

    fetchErrors:
      Object.freeze(
        fetchErrors,
      ),
  });
}