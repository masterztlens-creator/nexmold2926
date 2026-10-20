import {
  evaluateSourceUrl,
} from "../../acquisition/source-policy.js";

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

  /**
   * URL of the page from which this URL was discovered.
   * Required for crawled links; not required for search results.
   */
  readonly observedFrom?: string;

  /**
   * Identifier of the actual search provider that returned a SERP result.
   * This is provider provenance, not a fabricated source URL.
   */
  readonly discoveryProvider?: string;

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

  if (
    !Number.isFinite(Date.parse(timestamp))
  ) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVED_AT_INVALID",
    );
  }

  return timestamp;
}

function requirePublicUrl(
  url: string,
  emptyCode: string,
  invalidCode: string,
): string {
  if (
    typeof url !== "string" ||
    url.trim() === ""
  ) {
    throw new Error(emptyCode);
  }

  const rawUrl =
    url.trim();

  const decision =
    evaluateSourceUrl(rawUrl);

  if (decision.status !== "ELIGIBLE") {
    throw new Error(invalidCode);
  }

  const candidate =
    createDiscoveryCandidate({
      url: rawUrl,
      kind: "SEED",
      discoveredAt:
        new Date(0).toISOString(),
    });

  if (!candidate) {
    throw new Error(invalidCode);
  }

  return candidate.normalizedUrl;
}

function requireObservationSource(
  observedFrom: string,
): string {
  return requirePublicUrl(
    observedFrom,
    "V8_FIRST_HOP_OBSERVED_FROM_EMPTY",
    "V8_FIRST_HOP_OBSERVED_FROM_INVALID",
  );
}

function requireObservationUrl(
  url: string,
): string {
  return requirePublicUrl(
    url,
    "V8_FIRST_HOP_URL_EMPTY",
    "V8_FIRST_HOP_URL_INVALID",
  );
}

function resolveCandidateKind(
  candidateKind:
    | DiscoveryCandidateKind
    | undefined,
): DiscoveryCandidateKind {
  return candidateKind ?? "SEED";
}

function validateProvider(
  provider: string | undefined,
): string | undefined {
  if (provider === undefined) {
    return undefined;
  }

  if (
    typeof provider !== "string" ||
    provider.trim() === ""
  ) {
    throw new Error(
      "V8_FIRST_HOP_PROVIDER_INVALID",
    );
  }

  return provider.trim();
}

/**
 * Convert externally observed URLs into V8 discovery candidates.
 *
 * Every accepted URL must be a valid public URL and must have either:
 * - an eligible public page as its discovery source; or
 * - an explicitly identified search provider.
 *
 * The function does not perform network access and does not invent URLs.
 */
export function observeFirstHop(
  input: FirstHopDiscoveryInput,
): DiscoveryBatch {
  requireQuery(input.query);

  if (!Array.isArray(input.observations)) {
    throw new Error(
      "V8_FIRST_HOP_OBSERVATIONS_INVALID",
    );
  }

  const limit =
    resolveLimit(input.limit);

  const candidates = [];
  const seen =
    new Set<string>();

  let rejected = 0;

  for (const observation of input.observations) {
    if (candidates.length >= limit) {
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

      const observedAt =
        requireObservationTimestamp(
          observation.observedAt,
        );

      const discoveryProvider =
        validateProvider(
          observation.discoveryProvider,
        );

      let observedFrom:
        string | undefined;

      if (
        observation.observedFrom !==
        undefined
      ) {
        observedFrom =
          requireObservationSource(
            observation.observedFrom,
          );
      }

      /*
       * A result must retain its actual origin.
       * Do not silently treat a SERP result as a page link.
       */
      if (
        !observedFrom &&
        !discoveryProvider
      ) {
        throw new Error(
          "V8_FIRST_HOP_DISCOVERY_PROVENANCE_MISSING",
        );
      }

      if (
        seen.has(normalizedUrl)
      ) {
        continue;
      }

      const candidate =
        createDiscoveryCandidate({
          url: normalizedUrl,
          kind:
            resolveCandidateKind(
              observation.candidateKind,
            ),

          ...(observedFrom
            ? { sourceUrl: observedFrom }
            : {}),

          ...(discoveryProvider
            ? { discoveryProvider }
            : {}),

          ...(observation.title
            ? { title: observation.title }
            : {}),

          discoveredAt: observedAt,
        });

      if (!candidate) {
        throw new Error(
          "V8_FIRST_HOP_CANDIDATE_INVALID",
        );
      }

      seen.add(candidate.normalizedUrl);
      candidates.push(candidate);
    } catch {
      rejected += 1;
    }
  }

  return Object.freeze({
    candidates:
      Object.freeze(candidates),
    accepted:
      candidates.length,
    rejected,
  });
}