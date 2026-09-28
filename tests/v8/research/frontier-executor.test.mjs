import type {
  FetchedPage,
  PageFetcher,
} from "../acquisition/types.js";

import {
  discoverCandidates,
} from "../intelligence/web-discovery/discovery.js";

import type {
  DiscoveryCandidate,
} from "../intelligence/web-discovery/types.js";

import {
  expandSourceReferences,
} from "../intelligence/web-discovery/source-expansion.js";

import {
  ResearchFrontier,
  type FrontierItem,
} from "./frontier.js";

export interface ResearchFrontierExecutorOptions {
  readonly maxPages?: number;
  readonly maxDepth?: number;
  readonly sameHostOnly?: boolean;
  readonly signal?: AbortSignal;
}

export interface ResearchFrontierExecutionError {
  readonly url: string;
  readonly depth: number;
  readonly error: string;
}

export interface ResearchFrontierExecutionResult {
  readonly candidates: readonly DiscoveryCandidate[];
  readonly fetchedPages: readonly FetchedPage[];
  readonly errors: readonly ResearchFrontierExecutionError[];
  readonly pagesFetched: number;
  readonly candidatesDiscovered: number;
}

function normalizePositiveInteger(
  value: number,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(
      `V8_RESEARCH_FRONTIER_INVALID_${fieldName.toUpperCase()}`,
    );
  }

  return value;
}

function normalizeNonNegativeInteger(
  value: number,
  fieldName: string,
): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `V8_RESEARCH_FRONTIER_INVALID_${fieldName.toUpperCase()}`,
    );
  }

  return value;
}

function toFrontierItem(
  candidate: DiscoveryCandidate,
  depth: number,
): FrontierItem {
  return {
    url: candidate.normalizedUrl,
    depth,
    priority:
      depth === 0
        ? 100
        : Math.max(1, 100 - depth),
    ...(candidate.sourceUrl === undefined
      ? {}
      : {
          discoveredFrom: candidate.sourceUrl,
          sourceUrl: candidate.sourceUrl,
        }),
    kind: candidate.kind,
    ...(candidate.title === undefined
      ? {}
      : {
          title: candidate.title,
        }),
    discoveredAt: candidate.discoveredAt,
  };
}

function cloneCandidate(
  candidate: DiscoveryCandidate,
): DiscoveryCandidate {
  return Object.freeze({
    url: candidate.url,
    normalizedUrl: candidate.normalizedUrl,
    kind: candidate.kind,
    ...(candidate.sourceUrl === undefined
      ? {}
      : {
          sourceUrl: candidate.sourceUrl,
        }),
    ...(candidate.title === undefined
      ? {}
      : {
          title: candidate.title,
        }),
    discoveredAt: candidate.discoveredAt,
  });
}

function isAllowedHost(
  url: string,
  allowedHosts: ReadonlySet<string>,
): boolean {
  try {
    return allowedHosts.has(
      new URL(url).host,
    );
  } catch {
    return false;
  }
}

function errorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

export async function executeResearchFrontier(
  seeds: readonly DiscoveryCandidate[],
  pageFetcher: PageFetcher,
  options: ResearchFrontierExecutorOptions = {},
): Promise<ResearchFrontierExecutionResult> {
  const maxPages =
    normalizePositiveInteger(
      options.maxPages ?? 50,
      "maxPages",
    );

  const maxDepth =
    normalizeNonNegativeInteger(
      options.maxDepth ?? 2,
      "maxDepth",
    );

  const sameHostOnly =
    options.sameHostOnly ?? true;

  const frontier =
    new ResearchFrontier();

  const initialCandidates =
    seeds.map(cloneCandidate);

  frontier.enqueue(
    initialCandidates.map(
      (candidate) =>
        toFrontierItem(
          candidate,
          0,
        ),
    ),
  );

  const allowedHosts =
    new Set<string>();

  if (sameHostOnly) {
    for (
      const candidate of initialCandidates
    ) {
      try {
        allowedHosts.add(
          new URL(
            candidate.normalizedUrl,
          ).host,
        );
      } catch {
        continue;
      }
    }
  }

  const candidates:
    DiscoveryCandidate[] = [
      ...initialCandidates,
    ];

  const candidateKeys =
    new Set(
      initialCandidates.map(
        (candidate) =>
          candidate.normalizedUrl,
      ),
    );

  const fetchedPages:
    FetchedPage[] = [];

  const errors:
    ResearchFrontierExecutionError[] = [];

  while (
    frontier.size > 0 &&
    fetchedPages.length < maxPages
  ) {
    if (options.signal?.aborted) {
      throw new Error(
        "V8_RESEARCH_ABORTED",
      );
    }

    const item =
      frontier.next();

    if (!item) {
      break;
    }

    if (item.depth > maxDepth) {
      continue;
    }

    if (
      sameHostOnly &&
      !isAllowedHost(
        item.url,
        allowedHosts,
      )
    ) {
      continue;
    }

    let page: FetchedPage;

    try {
      page =
        await pageFetcher.fetch(
          item.url,
          {
            signal:
              options.signal,
          },
        );
    } catch (error) {
      errors.push(
        Object.freeze({
          url: item.url,
          depth: item.depth,
          error:
            errorMessage(error),
        }),
      );

      continue;
    }

    fetchedPages.push(page);

    const expandedInputs =
      expandSourceReferences(
        page,
      );

    if (
      expandedInputs.length === 0
    ) {
      continue;
    }

    const discovered =
      discoverCandidates(
        expandedInputs,
      );

    const nextFrontier:
      FrontierItem[] = [];

    for (
      const candidate
      of discovered.candidates
    ) {
      if (
        sameHostOnly &&
        !isAllowedHost(
          candidate.normalizedUrl,
          allowedHosts,
        )
      ) {
        continue;
      }

      if (
        candidateKeys.has(
          candidate.normalizedUrl,
        )
      ) {
        continue;
      }

      const normalizedCandidate =
        cloneCandidate(
          candidate,
        );

      candidateKeys.add(
        normalizedCandidate.normalizedUrl,
      );

      candidates.push(
        normalizedCandidate,
      );

      if (
        item.depth < maxDepth
      ) {
        nextFrontier.push(
          toFrontierItem(
            normalizedCandidate,
            item.depth + 1,
          ),
        );
      }
    }

    frontier.enqueue(
      nextFrontier,
    );
  }

  return Object.freeze({
    candidates:
      Object.freeze([
        ...candidates,
      ]),
    fetchedPages:
      Object.freeze([
        ...fetchedPages,
      ]),
    errors:
      Object.freeze([
        ...errors,
      ]),
    pagesFetched:
      fetchedPages.length,
    candidatesDiscovered:
      Math.max(
        0,
        candidates.length -
          initialCandidates.length,
      ),
  });
}