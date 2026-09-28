import type { PageFetcher } from "../acquisition/types.js";
import { evaluateSourceUrl } from "../acquisition/source-policy.js";
import { canonicalizeUrl } from "./discovery.js";
import { ResearchFrontier, type FrontierItem } from "./frontier.js";

export interface CrawlPage {
  readonly url: string;
  readonly title?: string;
  readonly links: readonly string[];
  readonly body: string;
  readonly fetchedAt: string;
}

export interface CrawlOptions {
  readonly maxPages?: number;
  readonly maxDepth?: number;
  readonly sameHostOnly?: boolean;
  readonly signal?: AbortSignal;
}

function titleOf(html: string): string | undefined {
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

function linksOf(html: string, base: string): string[] {
  const output: string[] = [];

  const pattern =
    /<a(?:\s[^>]*)?\bhref\s*=\s*["']([^"']+)["'][^>]*>/gi;

  let match: RegExpExecArray | null;

  while ((match = pattern.exec(html))) {
    try {
      const canonicalUrl = canonicalizeUrl(
        new URL(match[1], base).toString(),
      );

      output.push(canonicalUrl);
    } catch {
      continue;
    }
  }

  return [...new Set(output)];
}

export async function crawl(
  seedUrls: readonly string[],
  fetcher: PageFetcher,
  options: CrawlOptions = {},
): Promise<readonly CrawlPage[]> {
  const maxPages = Math.max(1, options.maxPages ?? 50);
  const maxDepth = Math.max(0, options.maxDepth ?? 2);
  const sameHost = options.sameHostOnly ?? true;

  const frontier = new ResearchFrontier();
  const seeds: FrontierItem[] = [];

  for (const raw of seedUrls) {
    try {
      const url = canonicalizeUrl(raw);

      if (evaluateSourceUrl(url).status !== "ELIGIBLE") {
        continue;
      }

      seeds.push({
        url,
        depth: 0,
        priority: 100,
      });
    } catch {
      continue;
    }
  }

  frontier.enqueue(seeds);

  const pages: CrawlPage[] = [];

  const hosts = new Set(
    seeds.map((seed) => new URL(seed.url).host),
  );

  while (frontier.size && pages.length < maxPages) {
    if (options.signal?.aborted) {
      throw new Error("V8_RESEARCH_ABORTED");
    }

    const item = frontier.next();

    if (!item) {
      break;
    }

    try {
      const page = await fetcher.fetch(item.url, {
        signal: options.signal,
      });

      if (
        !/^text\/(html|plain)|application\/xhtml\+xml$/i.test(
          page.mediaType,
        )
      ) {
        continue;
      }

      const links = linksOf(page.body, page.finalUrl).filter(
        (url) =>
          !sameHost ||
          hosts.has(new URL(url).host),
      );

      pages.push(
        Object.freeze({
          url: page.finalUrl,
          title: titleOf(page.body),
          links: Object.freeze(links),
          body: page.body,
          fetchedAt: page.fetchedAt,
        }),
      );

      if (item.depth < maxDepth) {
        frontier.enqueue(
          links.map((url) => ({
            url,
            depth: item.depth + 1,
            discoveredFrom: page.finalUrl,
            priority: 100 - item.depth - 1,
          })),
        );
      }
    } catch {
      continue;
    }
  }

  return Object.freeze(pages);
}