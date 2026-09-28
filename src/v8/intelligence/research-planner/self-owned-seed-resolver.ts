import { evaluateSourceUrl } from "../../acquisition/source-policy.js";
import { canonicalizeUrl } from "../../research/discovery.js";

export type ResearchSeedSource =
  | "AUTHORITY"
  | "ENTITY"
  | "DIRECT";

export interface ResearchSeed {
  readonly url: string;
  readonly source: ResearchSeedSource;
  readonly reason: string;
}

export interface ResolvedResearchSeed {
  readonly url: string;
  readonly canonicalUrl: string;
  readonly source: ResearchSeedSource;
  readonly reason: string;
}

export interface ResearchSeedResolutionResult {
  readonly accepted: readonly ResolvedResearchSeed[];
  readonly rejected: readonly {
    readonly url: string;
    readonly reason: string;
  }[];
}

function normalizeReason(
  value: string,
): string {
  const reason = value
    .trim()
    .replace(/\s+/g, " ");

  if (!reason) {
    throw new Error(
      "V8_RESEARCH_SEED_EMPTY_REASON",
    );
  }

  return reason;
}

function validateSource(
  value: ResearchSeedSource,
): ResearchSeedSource {
  if (
    value !== "AUTHORITY" &&
    value !== "ENTITY" &&
    value !== "DIRECT"
  ) {
    throw new Error(
      "V8_RESEARCH_SEED_INVALID_SOURCE",
    );
  }

  return value;
}

function resolveSeed(
  seed: ResearchSeed,
): ResolvedResearchSeed {
  if (
    typeof seed.url !== "string" ||
    !seed.url.trim()
  ) {
    throw new Error(
      "V8_RESEARCH_SEED_EMPTY_URL",
    );
  }

  const reason = normalizeReason(
    seed.reason,
  );

  const source = validateSource(
    seed.source,
  );

  const policy =
    evaluateSourceUrl(seed.url);

  if (
    policy.status !== "ELIGIBLE" ||
    !policy.normalizedUrl
  ) {
    throw new Error(
      policy.reason ??
        "V8_RESEARCH_SEED_SOURCE_POLICY_BLOCKED",
    );
  }

  const canonicalUrl =
    canonicalizeUrl(
      policy.normalizedUrl,
    );

  /*
   * canonicalizeUrl() is intentionally applied after
   * evaluateSourceUrl().
   *
   * The acquisition policy remains the authoritative
   * Internet-source eligibility boundary, while research
   * canonicalization provides deterministic identity.
   */
  return Object.freeze({
    url: policy.normalizedUrl,
    canonicalUrl,
    source,
    reason,
  });
}

export function resolveResearchSeeds(
  seeds: readonly ResearchSeed[],
): ResearchSeedResolutionResult {
  const accepted: ResolvedResearchSeed[] = [];
  const rejected: {
    url: string;
    reason: string;
  }[] = [];

  const seen = new Set<string>();

  for (const seed of seeds) {
    try {
      const resolved =
        resolveSeed(seed);

      if (
        seen.has(
          resolved.canonicalUrl,
        )
      ) {
        continue;
      }

      seen.add(
        resolved.canonicalUrl,
      );

      accepted.push(
        resolved,
      );
    } catch (error) {
      rejected.push({
        url:
          typeof seed.url === "string"
            ? seed.url.trim()
            : "",
        reason:
          error instanceof Error
            ? error.message
            : String(error),
      });
    }
  }

  return Object.freeze({
    accepted: Object.freeze(
      accepted,
    ),
    rejected: Object.freeze(
      rejected,
    ),
  });
}

export function requireResearchSeeds(
  seeds: readonly ResearchSeed[],
): readonly ResolvedResearchSeed[] {
  const result =
    resolveResearchSeeds(
      seeds,
    );

  if (
    result.accepted.length === 0
  ) {
    throw new Error(
      "V8_RESEARCH_SEED_NO_VALID_SEEDS",
    );
  }

  return result.accepted;
}