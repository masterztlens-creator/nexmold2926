import type {
  DiscoveryCandidateKind,
} from "../intelligence/web-discovery/types.js";

export interface FrontierItem {
  readonly url: string;
  readonly depth: number;
  readonly discoveredFrom?: string;
  readonly priority: number;

  /**
   * ResearchSeed that originated this frontier item.
   *
   * This value must be propagated unchanged from an explicit
   * ResearchSeed through every descendant discovered by crawling.
   */
  readonly discoveryRoot?: string;

  /**
   * Discovery provenance.
   *
   * The frontier must preserve how a URL was discovered so that
   * downstream research can distinguish direct seeds, internal links,
   * references, sitemaps, and search-derived candidates.
   */
  readonly kind?: DiscoveryCandidateKind;

  /**
   * Immediate source page that produced this candidate.
   */
  readonly sourceUrl?: string;

  /**
   * Human-readable title observed during discovery.
   */
  readonly title?: string;

  /**
   * Stable observation timestamp supplied by the discovery layer.
   *
   * The frontier does not generate this value when it is provided by
   * upstream discovery, preserving deterministic discovery metadata.
   */
  readonly discoveredAt?: string;
}

function compareFrontierItems(
  left: FrontierItem,
  right: FrontierItem,
): number {
  return (
    right.priority - left.priority ||
    left.depth - right.depth ||
    left.url.localeCompare(right.url)
  );
}

export class ResearchFrontier {
  private readonly queue: FrontierItem[] = [];
  private readonly seen = new Set<string>();

  enqueue(
    items: readonly FrontierItem[],
  ): void {
    for (const item of items) {
      if (this.seen.has(item.url)) {
        continue;
      }

      this.seen.add(item.url);
      this.queue.push(item);
    }

    this.queue.sort(compareFrontierItems);
  }

  next(): FrontierItem | undefined {
    return this.queue.shift();
  }

  get size(): number {
    return this.queue.length;
  }

  has(url: string): boolean {
    return this.seen.has(url);
  }
}