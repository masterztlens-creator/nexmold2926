import type { PageFetcher } from "../acquisition/types.js";
import type { DiscoveryCandidate } from "./types.js";
import { canonicalizeUrl } from "./discovery.js";
import { crawl, type CrawlOptions } from "./crawler.js";

export interface SelfOwnedDiscoveryOptions extends CrawlOptions {
  readonly maxCandidates?: number;
  readonly sourceHint?: string;
}

export interface SelfOwnedDiscoveryResult {
  readonly provider: "SELF_OWNED_CRAWL";
  readonly seeds: readonly string[];
  readonly candidates: readonly DiscoveryCandidate[];
  readonly pagesFetched: number;
}

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

  const discoveryRoot = normalizedSeeds[0];

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
        ...(page.title ? { title: page.title } : {}),
        ...(options.sourceHint
          ? { sourceHint: options.sourceHint }
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
          provider: "DIRECT",
          discoveredAt: page.fetchedAt,
          ...(discoveryRoot
            ? { sourceHint: discoveryRoot }
            : {}),
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
): readonly string[] {
  const normalized: string[] = [];
  const seen = new Set<string>();

  for (const seedUrl of seedUrls) {
    let canonicalUrl: string;

    try {
      canonicalUrl = canonicalizeUrl(seedUrl);
    } catch {
      continue;
    }

    if (seen.has(canonicalUrl)) {
      continue;
    }

    seen.add(canonicalUrl);
    normalized.push(canonicalUrl);
  }

  return Object.freeze(normalized);
}

function addCandidate(args: {
  readonly candidates: DiscoveryCandidate[];
  readonly seen: Set<string>;
  readonly candidate: DiscoveryCandidate;
  readonly maxCandidates: number;
}): void {
  if (args.candidates.length >= args.maxCandidates) {
    return;
  }

  if (args.seen.has(args.candidate.canonicalUrl)) {
    return;
  }

  args.seen.add(args.candidate.canonicalUrl);
  args.candidates.push(Object.freeze(args.candidate));
}

function normalizePositiveInteger(
  value: number,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `V8_RESEARCH_SELF_OWNED_INVALID_${fieldName.toUpperCase()}`,
    );
  }

  return value;
}