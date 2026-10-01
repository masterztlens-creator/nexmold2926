import {
  createDiscoveryCandidate,
} from "./discovery.js";

import type {
  DiscoveryBatch,
  DiscoveryCandidateKind,
} from "./types.js";

export type FirstHopObservationKind =
  | "AUTHORITY"
  | "DIRECT"
  | "INDEX_REFERENCE"
  | "SITEMAP"
  | "REFERENCE";

export interface FirstHopObservation {
  readonly url: string;
  readonly observedFrom: string;
  readonly observedAt: string;
  readonly kind?: FirstHopObservationKind;
  readonly candidateKind?: DiscoveryCandidateKind;
  readonly title?: string;
}

export interface FirstHopDiscoveryInput {
  readonly query: string;
  readonly observations: readonly FirstHopObservation[];
  readonly limit?: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

function requireQuery(
  query: string,
): string {
  if (
    typeof query !== "string" ||
    query.trim() === ""
  ) {
    throw new Error(
      "V8_FIRST_HOP_QUERY_EMPTY",
    );
  }

  return query
    .trim()
    .replace(/\s+/g, " ");
}

function resolveLimit(
  limit: number | undefined,
): number {
  const resolved =
    limit === undefined
      ? DEFAULT_LIMIT
      : limit;

  if (
    !Number.isInteger(resolved) ||
    resolved < 1 ||
    resolved > MAX_LIMIT
  ) {
    throw new Error(
      "V8_FIRST_HOP_LIMIT_INVALID",
    );
  }

  return resolved;
}

function requireObservationTimestamp(
  observedAt: string,
): string {
  if (
    typeof observedAt !== "string" ||
    observedAt.trim() === "" ||
    !ISO_TIMESTAMP_PATTERN.test(
      observedAt.trim(),
    )
  ) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVED_AT_INVALID",
    );
  }

  const timestamp =
    observedAt.trim();

  const milliseconds =
    Date.parse(timestamp);

  if (!Number.isFinite(milliseconds)) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVED_AT_INVALID",
    );
  }

  return timestamp;
}

function requireObservationSource(
  observedFrom: string,
): string {
  if (
    typeof observedFrom !== "string" ||
    observedFrom.trim() === ""
  ) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVED_FROM_EMPTY",
    );
  }

  const source =
    observedFrom.trim();

  const normalizedSource =
    createDiscoveryCandidate({
      url: source,
      kind: "REFERENCE",
      discoveredAt:
        new Date(0).toISOString(),
    });

  if (normalizedSource === null) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVED_FROM_INVALID",
    );
  }

  return normalizedSource.normalizedUrl;
}

function requireObservationUrl(
  url: string,
): string {
  if (
    typeof url !== "string" ||
    url.trim() === ""
  ) {
    throw new Error(
      "V8_FIRST_HOP_URL_EMPTY",
    );
  }

  const candidate =
    createDiscoveryCandidate({
      url,
      kind: "SEED",
      discoveredAt:
        new Date(0).toISOString(),
    });

  if (candidate === null) {
    throw new Error(
      "V8_FIRST_HOP_URL_INVALID",
    );
  }

  return candidate.normalizedUrl;
}

function resolveCandidateKind(
  candidateKind:
    | DiscoveryCandidateKind
    | undefined,
): DiscoveryCandidateKind {
  return (
    candidateKind ??
    "SEED"
  );
}

/**
 * Converts real, externally observed first-hop URLs into the existing
 * DiscoveryCandidate contract.
 *
 * This function deliberately does not perform network access and does not
 * derive URLs from the research query. Every accepted candidate must be
 * explicitly supplied by a FirstHopObservation.
 */
export function observeFirstHop(
  input: FirstHopDiscoveryInput,
): DiscoveryBatch {
  requireQuery(input.query);

  if (
    !Array.isArray(
      input.observations,
    )
  ) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVATIONS_INVALID",
    );
  }

  const limit =
    resolveLimit(input.limit);

  const candidates = [];
  const seen = new Set<string>();
  let rejected = 0;

  for (
    const observation of
      input.observations
  ) {
    if (
      candidates.length >= limit
    ) {
      break;
    }

    try {
      if (
        observation === null ||
        typeof observation !== "object"
      ) {
        throw new Error(
          "V8_FIRST_HOP_OBSERVATION_INVALID",
        );
      }

      const normalizedUrl =
        requireObservationUrl(
          observation.url,
        );

      const observedFrom =
        requireObservationSource(
          observation.observedFrom,
        );

      const observedAt =
        requireObservationTimestamp(
          observation.observedAt,
        );

      if (
        seen.has(normalizedUrl)
      ) {
        continue;
      }

      const candidate =
        createDiscoveryCandidate({
          url:
            normalizedUrl,
          kind:
            resolveCandidateKind(
              observation.candidateKind,
            ),
          sourceUrl:
            observedFrom,
          title:
            observation.title,
          discoveredAt:
            observedAt,
        });

      if (
        candidate === null
      ) {
        throw new Error(
          "V8_FIRST_HOP_CANDIDATE_INVALID",
        );
      }

      seen.add(
        candidate.normalizedUrl,
      );

      candidates.push(
        candidate,
      );
    } catch {
      rejected += 1;
    }
  }

  return Object.freeze({
    candidates:
      Object.freeze(
        candidates,
      ),
    accepted:
      candidates.length,
    rejected,
  });
}