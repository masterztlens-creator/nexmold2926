import {
  evaluateSourceUrl,
} from "../../acquisition/source-policy.js";

import {
  createDiscoveryCandidate,
} from "./discovery.js";

import type {
  DiscoveryCandidate,
} from "./types.js";

export interface BootstrapSource {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly terms: readonly string[];
  readonly authority:
    | "AUTHORITATIVE_STANDARD"
    | "OFFICIAL_PRIMARY"
    | "ENGINEERING_REFERENCE";
}

export interface BootstrapResolution {
  readonly query: string;
  readonly matched: readonly BootstrapSource[];
  readonly rejected: readonly {
    readonly id: string;
    readonly reason: string;
  }[];
}

const MAX_BOOTSTRAP_SOURCES = 100;

function normalizeText(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function tokenize(
  value: string,
): readonly string[] {
  return Object.freeze(
    [
      ...new Set(
        normalizeText(value)
          .split(/[^a-z0-9]+/)
          .filter(
            (token) =>
              token.length >= 2,
          ),
      ),
    ],
  );
}

function requireQuery(
  query: string,
): string {
  if (
    typeof query !== "string" ||
    !query.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_QUERY_EMPTY",
    );
  }

  return normalizeText(query);
}

function requireBootstrapSource(
  source: BootstrapSource,
): BootstrapSource {
  if (
    source === null ||
    typeof source !== "object"
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_INVALID",
    );
  }

  if (
    typeof source.id !== "string" ||
    !source.id.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_ID_INVALID",
    );
  }

  if (
    typeof source.title !== "string" ||
    !source.title.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_TITLE_INVALID",
    );
  }

  if (
    !Array.isArray(source.terms) ||
    source.terms.length === 0
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_TERMS_INVALID",
    );
  }

  const policy =
    evaluateSourceUrl(
      source.url,
    );

  if (
    policy.status !== "ELIGIBLE"
  ) {
    throw new Error(
      policy.reason ??
        "V8_BOOTSTRAP_SOURCE_URL_BLOCKED",
    );
  }

  if (
    source.authority !==
      "AUTHORITATIVE_STANDARD" &&
    source.authority !==
      "OFFICIAL_PRIMARY" &&
    source.authority !==
      "ENGINEERING_REFERENCE"
  ) {
    throw new Error(
      "V8_BOOTSTRAP_SOURCE_AUTHORITY_INVALID",
    );
  }

  return Object.freeze({
    id:
      source.id.trim(),
    url:
      policy.normalizedUrl ??
      source.url.trim(),
    title:
      source.title.trim(),
    terms:
      Object.freeze(
        source.terms
          .map(normalizeText)
          .filter(Boolean),
      ),
    authority:
      source.authority,
  });
}

function scoreSource(
  queryTokens: readonly string[],
  source: BootstrapSource,
): number {
  const sourceTokens =
    new Set(
      tokenize(
        [
          source.title,
          ...source.terms,
        ].join(" "),
      ),
    );

  let score = 0;

  for (
    const token of queryTokens
  ) {
    if (
      sourceTokens.has(token)
    ) {
      score += 1;
    }
  }

  return score;
}

/**
 * Resolve a research query against the V8-owned Bootstrap Corpus.
 *
 * This function deliberately performs no network access.
 *
 * It never manufactures a URL from query text.
 * A URL can only enter the result if it already exists as an
 * explicitly registered BootstrapSource.
 */
export function resolveBootstrapSources(
  query: string,
  corpus: readonly BootstrapSource[],
  limit = 10,
): BootstrapResolution {
  const normalizedQuery =
    requireQuery(query);

  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > MAX_BOOTSTRAP_SOURCES
  ) {
    throw new Error(
      "V8_BOOTSTRAP_LIMIT_INVALID",
    );
  }

  if (
    !Array.isArray(corpus)
  ) {
    throw new Error(
      "V8_BOOTSTRAP_CORPUS_INVALID",
    );
  }

  const queryTokens =
    tokenize(
      normalizedQuery,
    );

  const validated: BootstrapSource[] =
    [];

  const rejected: {
    id: string;
    reason: string;
  }[] = [];

  const seen =
    new Set<string>();

  for (
    const source of corpus
  ) {
    try {
      const validatedSource =
        requireBootstrapSource(
          source,
        );

      if (
        seen.has(
          validatedSource.id,
        )
      ) {
        continue;
      }

      seen.add(
        validatedSource.id,
      );

      validated.push(
        validatedSource,
      );
    } catch (error) {
      rejected.push({
        id:
          typeof source?.id ===
          "string"
            ? source.id
            : "",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  const ranked =
    validated
      .map(
        (
          source,
          index,
        ) => ({
          source,
          score:
            scoreSource(
              queryTokens,
              source,
            ),
          index,
        }),
      )
      .filter(
        (item) =>
          item.score > 0,
      )
      .sort(
        (left, right) =>
          right.score -
            left.score ||
          left.index -
            right.index ||
          left.source.id.localeCompare(
            right.source.id,
          ),
      )
      .slice(
        0,
        limit,
      );

  return Object.freeze({
    query:
      normalizedQuery,
    matched:
      Object.freeze(
        ranked.map(
          (item) =>
            item.source,
        ),
      ),
    rejected:
      Object.freeze(
        rejected,
      ),
  });
}

/**
 * Convert explicitly registered BootstrapSources into DiscoveryCandidates.
 *
 * No network request is performed here.
 *
 * These candidates represent the controlled V8 bootstrap boundary and
 * therefore use the existing DiscoveryCandidate identity contract.
 */
export function bootstrapSourcesToCandidates(
  sources: readonly BootstrapSource[],
  observedAt: string,
): readonly DiscoveryCandidate[] {
  if (
    typeof observedAt !== "string" ||
    !observedAt.trim()
  ) {
    throw new Error(
      "V8_BOOTSTRAP_OBSERVED_AT_INVALID",
    );
  }

  const output:
    DiscoveryCandidate[] =
    [];

  const seen =
    new Set<string>();

  for (
    const source of sources
  ) {
    const validated =
      requireBootstrapSource(
        source,
      );

    const candidate =
      createDiscoveryCandidate({
        url:
          validated.url,
        kind:
          "SEED",
        discoveredAt:
          observedAt.trim(),
        sourceUrl:
          validated.url,
        title:
          validated.title,
      });

    if (
      candidate === null
    ) {
      throw new Error(
        "V8_BOOTSTRAP_CANDIDATE_INVALID",
      );
    }

    if (
      seen.has(
        candidate.normalizedUrl,
      )
    ) {
      continue;
    }

    seen.add(
      candidate.normalizedUrl,
    );

    output.push(
      Object.freeze(
        candidate,
      ),
    );
  }

  return Object.freeze(
    output,
  );
}