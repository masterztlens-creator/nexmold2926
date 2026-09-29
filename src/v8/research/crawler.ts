import type { PageFetcher } from "../acquisition/types.js";
import { evaluateSourceUrl } from "../acquisition/source-policy.js";
import { canonicalizeUrl } from "./discovery.js";
import {
  ResearchFrontier,
  type FrontierItem,
} from "./frontier.js";

export interface CrawlFailure {
  readonly url: string;
  readonly error: string;
}

export interface CrawlPage {
  readonly url: string;
  readonly title?: string;
  readonly links: readonly string[];
  readonly body: string;
  readonly fetchedAt: string;
  readonly discoveredFrom?: string;

  /**
   * ResearchSeed that originated this crawled page.
   *
   * This value is inherited from the frontier item and must never
   * be recomputed from the first seed supplied to the crawler.
   */
  readonly discoveryRoot?: string;
}

export interface CrawlOptions {
  readonly maxPages?: number;
  readonly maxDepth?: number;
  readonly sameHostOnly?: boolean;
  readonly signal?: AbortSignal;

  /**
   * Reports non-fatal crawl failures to the acquisition layer.
   *
   * The crawler remains fail-soft for individual URLs, but failures
   * are no longer silently discarded.
   */
  readonly onFetchFailure?: (
    failure: CrawlFailure,
  ) => void;
}

function titleOf(
  html: string,
): string | undefined {
  const match = html.match(
    /<title(?:\s[^>]*)?>([\s\S]*?)<\/title>/i,
  );

  return (
    match?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim() || undefined
  );
}

function linksOf(
  html: string,
  base: string,
): string[] {
  const output: string[] = [];

  const pattern =
    /<a(?:\s[^>]*)?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  while (
    (match = pattern.exec(html))
  ) {
    try {
      const canonicalUrl =
        canonicalizeUrl(
          new URL(
            match[1],
            base,
          ).toString(),
        );

      output.push(
        canonicalUrl,
      );
    } catch {
      continue;
    }
  }

  return [
    ...new Set(output),
  ];
}

function reportFailure(
  options: CrawlOptions,
  url: string,
  error: unknown,
): void {
  const message =
    error instanceof Error
      ? error.message
      : String(error);

  options.onFetchFailure?.(
    Object.freeze({
      url,
      error: message,
    }),
  );
}

function isSupportedHtmlMediaType(
  mediaType: string,
): boolean {
  const normalized =
    mediaType
      .split(";", 1)[0]
      .trim()
      .toLowerCase();

  return (
    normalized === "text/html" ||
    normalized === "text/plain" ||
    normalized ===
      "application/xhtml+xml"
  );
}

export async function crawl(
  seedUrls: readonly string[],
  fetcher: PageFetcher,
  options: CrawlOptions = {},
): Promise<readonly CrawlPage[]> {
  const maxPages = Math.max(
    1,
    options.maxPages ?? 50,
  );

  const maxDepth = Math.max(
    0,
    options.maxDepth ?? 2,
  );

  const sameHost =
    options.sameHostOnly ?? true;

  const frontier =
    new ResearchFrontier();

  const seeds: FrontierItem[] = [];

  for (
    const raw of seedUrls
  ) {
    try {
      const url =
        canonicalizeUrl(raw);

      if (
        evaluateSourceUrl(url).status !==
        "ELIGIBLE"
      ) {
        reportFailure(
          options,
          url,
          "V8_RESEARCH_SOURCE_POLICY_BLOCKED",
        );

        continue;
      }

      seeds.push({
        url,
        depth: 0,
        priority: 100,

        /**
         * Every explicit ResearchSeed establishes its own
         * independent provenance root.
         */
        discoveryRoot: url,
      });
    } catch (error) {
      reportFailure(
        options,
        raw,
        error,
      );
    }
  }

  frontier.enqueue(
    seeds,
  );

  const pages: CrawlPage[] = [];

  const hosts = new Set(
    seeds.map(
      (seed) =>
        new URL(seed.url).host,
    ),
  );

  while (
    frontier.size &&
    pages.length < maxPages
  ) {
    if (
      options.signal?.aborted
    ) {
      throw new Error(
        "V8_RESEARCH_ABORTED",
      );
    }

    const item =
      frontier.next();

    if (!item) {
      break;
    }

    try {
      const page =
        await fetcher.fetch(
          item.url,
          {
            signal:
              options.signal,
          },
        );

      if (
        !isSupportedHtmlMediaType(
          page.mediaType,
        )
      ) {
        reportFailure(
          options,
          item.url,
          `V8_RESEARCH_UNSUPPORTED_MEDIA_TYPE:${
            page.mediaType || "UNKNOWN"
          }`,
        );

        continue;
      }

      const links =
        linksOf(
          page.body,
          page.finalUrl,
        ).filter(
          (url) =>
            !sameHost ||
            hosts.has(
              new URL(url).host,
            ),
        );

      pages.push(
        Object.freeze({
          url:
            page.finalUrl,

          title:
            titleOf(
              page.body,
            ),

          links:
            Object.freeze(
              links,
            ),

          body:
            page.body,

          fetchedAt:
            page.fetchedAt,

          ...(item.discoveredFrom
            ? {
                discoveredFrom:
                  item.discoveredFrom,
              }
            : {}),

          ...(item.discoveryRoot
            ? {
                discoveryRoot:
                  item.discoveryRoot,
              }
            : {}),
        }),
      );

      if (
        item.depth <
        maxDepth
      ) {
        frontier.enqueue(
          links.map(
            (url) => ({
              url,

              depth:
                item.depth + 1,

              discoveredFrom:
                page.finalUrl,

              /**
               * Preserve the originating ResearchSeed
               * for every descendant.
               */
              ...(item.discoveryRoot
                ? {
                    discoveryRoot:
                      item.discoveryRoot,
                  }
                : {}),

              priority:
                100 -
                item.depth -
                1,
            }),
          ),
        );
      }
    } catch (error) {
      reportFailure(
        options,
        item.url,
        error,
      );

      continue;
    }
  }

  return Object.freeze(
    pages,
  );
}