import type {
  PageFetcher,
} from "../acquisition/types.js";

import type {
  DiscoveryCandidate,
} from "./types.js";

import {
  canonicalizeUrl,
} from "./discovery.js";

import {
  crawl,
  type CrawlFailure,
  type CrawlOptions,
} from "./crawler.js";

export interface SelfOwnedDiscoveryOptions
  extends CrawlOptions {
  readonly maxCandidates?: number;
  readonly sourceHint?: string;
}

export interface SelfOwnedDiscoveryResult {
  readonly provider:
    "SELF_OWNED_CRAWL";
  readonly seeds:
    readonly string[];
  readonly candidates:
    readonly DiscoveryCandidate[];
  readonly pagesFetched: number;
  readonly fetchErrors:
    readonly CrawlFailure[];
}

export async function discoverWithSelfOwnedCrawl(
  seedUrls: readonly string[],
  fetcher: PageFetcher,
  options: SelfOwnedDiscoveryOptions = {},
): Promise<SelfOwnedDiscoveryResult> {
  const normalizedSeeds =
    normalizeSeeds(
      seedUrls,
    );

  if (
    normalizedSeeds.length === 0
  ) {
    throw new Error(
      "V8_RESEARCH_SELF_OWNED_NO_VALID_SEEDS",
    );
  }

  const maxCandidates =
    normalizePositiveInteger(
      options.maxCandidates ?? 200,
      "maxCandidates",
    );

  const fetchErrors:
    CrawlFailure[] =
    [];

  const pages =
    await crawl(
      normalizedSeeds,
      fetcher,
      {
        ...options,

        onFetchFailure:
          (failure) => {
            fetchErrors.push(
              failure,
            );

            options.onFetchFailure?.(
              failure,
            );
          },
      },
    );

  const candidates:
    DiscoveryCandidate[] =
    [];

  const seen =
    new Set<string>();

  /**
   * Explicit seeds are identified against the complete
   * normalized seed set.
   */
  const explicitSeedSet =
    new Set(
      normalizedSeeds,
    );

  /*
   * Phase 1:
   *
   * Materialize crawled page candidates before discovered
   * links can consume the candidate budget.
   *
   * Provenance:
   *
   *   explicit seed page
   *       -> options.sourceHint
   *
   *   crawled page
   *       -> page.discoveryRoot
   */
  for (
    const page of pages
  ) {
    if (
      candidates.length >=
      maxCandidates
    ) {
      break;
    }

    const normalizedUrl =
      canonicalizeUrl(
        page.url,
      );

    const isExplicitSeed =
      explicitSeedSet.has(
        normalizedUrl,
      );

    const discoveryRoot =
      page.discoveryRoot ??
      (
        isExplicitSeed
          ? normalizedUrl
          : undefined
      );

    addCandidate({
      candidates,
      seen,

      candidate: {
        url:
          page.url,

        normalizedUrl,

        kind:
          isExplicitSeed
            ? "SEED"
            : "REFERENCE",

        provider:
          "SELF_OWNED_CRAWL",

        discoveredAt:
          page.fetchedAt,

        ...(page.title
          ? {
              title:
                page.title,
            }
          : {}),

        ...(isExplicitSeed
          ? options.sourceHint
            ? {
                sourceUrl:
                  options.sourceHint,
              }
            : {}
          : discoveryRoot
            ? {
                sourceUrl:
                  discoveryRoot,
              }
            : {}),
      },

      maxCandidates,
    });
  }

  /*
   * Phase 2:
   *
   * Materialize discovered links only after crawled page
   * candidates have entered the bounded candidate set.
   *
   * Every link inherits the ResearchSeed that originated
   * the page from which that link was observed.
   */
  for (
    const page of pages
  ) {
    if (
      candidates.length >=
      maxCandidates
    ) {
      break;
    }

    for (
      const link of page.links
    ) {
      if (
        candidates.length >=
        maxCandidates
      ) {
        break;
      }

      let normalizedUrl: string;

      try {
        normalizedUrl =
          canonicalizeUrl(
            link,
          );
      } catch {
        continue;
      }

      addCandidate({
        candidates,
        seen,

        candidate: {
          url:
            link,

          normalizedUrl,

          kind:
            "LINK",

          provider:
            "SELF_OWNED_CRAWL",

          discoveredAt:
            page.fetchedAt,

          ...(page.url
            ? {
                sourceUrl:
                  page.url,
              }
            : {}),
        },

        maxCandidates,
      });
    }
  }

  return Object.freeze({
    provider:
      "SELF_OWNED_CRAWL",

    seeds:
      Object.freeze([
        ...normalizedSeeds,
      ]),

    candidates:
      Object.freeze([
        ...candidates,
      ]),

    pagesFetched:
      pages.length,

    fetchErrors:
      Object.freeze([
        ...fetchErrors,
      ]),
  });
}

function normalizeSeeds(
  seedUrls: readonly string[],
): readonly string[] {
  const normalized:
    string[] =
    [];

  const seen =
    new Set<string>();

  for (
    const seedUrl of seedUrls
  ) {
    let canonicalUrl: string;

    try {
      canonicalUrl =
        canonicalizeUrl(
          seedUrl,
        );
    } catch {
      continue;
    }

    if (
      seen.has(
        canonicalUrl,
      )
    ) {
      continue;
    }

    seen.add(
      canonicalUrl,
    );

    normalized.push(
      canonicalUrl,
    );
  }

  return Object.freeze(
    normalized,
  );
}

function addCandidate(args: {
  readonly candidates:
    DiscoveryCandidate[];
  readonly seen:
    Set<string>;
  readonly candidate:
    DiscoveryCandidate;
  readonly maxCandidates:
    number;
}): void {
  if (
    args.candidates.length >=
    args.maxCandidates
  ) {
    return;
  }

  if (
    args.seen.has(
      args.candidate.normalizedUrl,
    )
  ) {
    return;
  }

  args.seen.add(
    args.candidate.normalizedUrl,
  );

  args.candidates.push(
    Object.freeze(
      args.candidate,
    ),
  );
}

function normalizePositiveInteger(
  value: number,
  fieldName: string,
): number {
  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    throw new Error(
      `V8_RESEARCH_SELF_OWNED_INVALID_${fieldName.toUpperCase()}`,
    );
  }

  return value;
}