import type { PageFetcher } from "../acquisition/types.js";
import type { DiscoveryCandidate } from "./types.js";
import { canonicalizeUrl } from "./discovery.js";
import { crawl, type CrawlOptions } from "./crawler.js";

export interface SelfOwnedDiscoveryOptions extends CrawlOptions {
  /**
   * Maximum number of discovery candidates returned.
   *
   * This is independent from crawler maxPages because one fetched
   * document can expose multiple unique links.
   */
  readonly maxCandidates?: number;

  /**
   * Optional source hint attached to every discovered candidate.
   *
   * This is descriptive metadata only. It does not establish authority,
   * verification, or Evidence status.
   */
  readonly sourceHint?: string;
}

export interface SelfOwnedDiscoveryResult {
  readonly provider: "SELF_OWNED_CRAWL";
  readonly seeds: readonly string[];
  readonly candidates: readonly DiscoveryCandidate[];
  readonly pagesFetched: number;
}

/**
 * Converts crawler observations into provider-independent DiscoveryCandidate
 * records.
 *
 * This layer intentionally does NOT:
 *
 * - create Evidence;
 * - create Claims;
 * - assign authority;
 * - verify source truth;
 * - rank factual claims;
 * - call a third-party search provider.
 *
 * The output remains discovery metadata until it enters the existing
 * acquisition/foundation pipeline.
 */
export async function discoverWithSelfOwnedCrawl(
  seedUrls: readonly string[],
  fetcher: PageFetcher,
  options: SelfOwnedDiscoveryOptions = {},
): Promise<SelfOwnedDiscoveryResult> {
  const normalizedSeeds = normalizeSeeds(seedUrls);

  if (normalizedSeeds.length === 0) {
    throw new Error("V8_RESEARCH_SELF_OWNED_NO_VALID_SEEDS");
  }

  const maxCandidates = normalizePositiveInteger(
    options.maxCandidates ?? 200,
    "maxCandidates",
  );

  const pages = await crawl(
    normalizedSeeds,
    fetcher,
    options,
  );

  const candidates: DiscoveryCandidate[] = [];
  const seen = new Set<string>();

  for (const page of pages) {
    const pageCanonicalUrl = canonicalizeUrl(page.url);

    addCandidate({
      candidates,
      seen,
      candidate: {
        url: page.url,
        canonicalUrl: pageCanonicalUrl,
        provider: "DIRECT",
        discoveredAt: page.fetchedAt,
        ...(page.title
          ? {
              title: page.title,
            }
          : {}),
        ...(options.sourceHint
          ? {
              sourceHint: options.sourceHint,
            }
          : {}),
      },
      maxCandidates,
    });

    for (const link of page.links) {
      if (candidates.length >= maxCandidates) {
        break;
      }

      let canonicalUrl: string;

      try {
        canonicalUrl = canonicalizeUrl(link);
      } catch {
        continue;
      }

      addCandidate({
        candidates,
        seen,
        candidate: {
          url: link,
          canonicalUrl,
          provider: "SEARCH",
          discoveredAt: page.fetchedAt,
          sourceHint: pageCanonicalUrl,
        },
        maxCandidates,
      });
    }

    if (candidates.length >= maxCandidates) {
      break;
    }
  }

  return Object.freeze({
    provider: "SELF_OWNED_CRAWL",
    seeds: Object.freeze([...normalizedSeeds]),
    candidates: Object.freeze(candidates),
    pagesFetched: pages.length,
  });
}

function normalizeSeeds(
  seedUrls: readonly string[],
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const raw of seedUrls) {
    if (typeof raw !== "string") {
      continue;
    }

    try {
      const canonicalUrl = canonicalizeUrl(raw);

      if (seen.has(canonicalUrl)) {
        continue;
      }

      seen.add(canonicalUrl);
      result.push(canonicalUrl);
    } catch {
      continue;
    }
  }

  return result;
}

function addCandidate(input: {
  readonly candidates: DiscoveryCandidate[];
  readonly seen: Set<string>;
  readonly candidate: DiscoveryCandidate;
  readonly maxCandidates: number;
}): void {
  if (input.candidates.length >= input.maxCandidates) {
    return;
  }

  if (input.seen.has(input.candidate.canonicalUrl)) {
    return;
  }

  input.seen.add(input.candidate.canonicalUrl);
  input.candidates.push(
    Object.freeze({
      ...input.candidate,
    }),
  );
}

function normalizePositiveInteger(
  value: number,
  name: string,
): number {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(
      `V8_RESEARCH_SELF_OWNED_${name.toUpperCase()}_INVALID`,
    );
  }

  return value;
}