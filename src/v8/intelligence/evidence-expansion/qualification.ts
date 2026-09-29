import type { DiscoveryCandidate } from "../../research/types.js";
import { evaluateSourceUrl } from "../../acquisition/source-policy.js";

export type QualificationStatus =
  | "QUALIFIED"
  | "REJECTED";

export type QualificationReasonCode =
  | "SOURCE_POLICY_BLOCKED"
  | "INVALID_URL"
  | "RELEVANCE_BELOW_THRESHOLD"
  | "PROVENANCE_UNKNOWN"
  | "AUTHORITY_UNKNOWN"
  | "FRESHNESS_NOT_OBSERVED";

export type ProvenanceStatus =
  | "EXPLICIT_RESEARCH_SEED"
  | "CRAWLED_FROM_RESEARCH_SEED"
  | "SEARCH_PROVIDER_RESULT"
  | "UNKNOWN";

export type AuthorityStatus =
  | "DECLARED"
  | "UNKNOWN";

export type FreshnessStatus =
  | "NOT_OBSERVED"
  | "NEW"
  | "CHANGED"
  | "UNCHANGED"
  | "STALE";

export interface CandidateQualification {
  readonly status: QualificationStatus;
  readonly canonicalUrl: string;
  readonly normalizedUrl: string;
  readonly provenance: ProvenanceStatus;
  readonly authorityStatus: AuthorityStatus;
  readonly authorityScore: number | null;
  readonly relevanceScore: number;
  readonly freshnessStatus: FreshnessStatus;
  readonly reasons: readonly QualificationReasonCode[];
}

export interface CandidateQualificationPolicy {
  /**
   * Minimum relevance required before a candidate can be acquired.
   *
   * The default is intentionally conservative. A value of zero is allowed
   * only when callers explicitly choose to disable relevance gating.
   */
  readonly minimumRelevance?: number;

  /**
   * Whether an explicit ResearchSeed may qualify without an independently
   * declared authority score.
   *
   * This does NOT fabricate authority. The resulting authority status remains
   * UNKNOWN and authorityScore remains null.
   *
   * Default: true.
   */
  readonly allowUnknownAuthorityForExplicitSeed?: boolean;

  /**
   * Whether candidates discovered from an explicit seed may qualify without
   * an independently declared authority score.
   *
   * Default: true.
   *
   * This represents provenance, not source authority.
   */
  readonly allowUnknownAuthorityForSeedDescendant?: boolean;

  /**
   * Whether SearchProvider candidates may qualify when authority is unknown.
   *
   * Default: false.
   */
  readonly allowUnknownAuthorityForSearchResult?: boolean;
}

export interface QualificationInput {
  readonly candidate: DiscoveryCandidate;
  readonly relevanceScore: number;
  readonly provenance?: ProvenanceStatus;
  readonly authorityScore?: number | null;
  readonly freshnessStatus?: FreshnessStatus;
  readonly policy?: CandidateQualificationPolicy;
}

function clampScore(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeAuthorityScore(
  value: number | null | undefined,
): number | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (!Number.isFinite(value)) {
    return null;
  }

  return clampScore(value);
}

function inferProvenance(
  candidate: DiscoveryCandidate,
): ProvenanceStatus {
  if (
    candidate.sourceHint ===
    "V8_RESEARCH_SEED"
  ) {
    return "EXPLICIT_RESEARCH_SEED";
  }

  if (
    candidate.sourceHint &&
    candidate.sourceHint.trim()
  ) {
    return "CRAWLED_FROM_RESEARCH_SEED";
  }

  return "UNKNOWN";
}

function minimumRelevance(
  policy: CandidateQualificationPolicy,
): number {
  const value =
    policy.minimumRelevance ??
    0.2;

  if (!Number.isFinite(value)) {
    return 0.2;
  }

  return Math.max(
    0,
    Math.min(1, value),
  );
}

function authorityMayBeUnknown(
  provenance: ProvenanceStatus,
  policy: CandidateQualificationPolicy,
): boolean {
  switch (provenance) {
    case "EXPLICIT_RESEARCH_SEED":
      return (
        policy.allowUnknownAuthorityForExplicitSeed ??
        true
      );

    case "CRAWLED_FROM_RESEARCH_SEED":
      return (
        policy.allowUnknownAuthorityForSeedDescendant ??
        true
      );

    case "SEARCH_PROVIDER_RESULT":
      return (
        policy.allowUnknownAuthorityForSearchResult ??
        false
      );

    default:
      return false;
  }
}

/**
 * V8-08 candidate qualification boundary.
 *
 * This function intentionally does NOT:
 * - create Foundation identifiers;
 * - create Sources;
 * - create Snapshots;
 * - create Evidence;
 * - verify claims;
 * - infer publisher authority from a hostname;
 * - assign arbitrary authority scores;
 * - infer freshness from discovery time.
 *
 * Qualification is a gate between Internet discovery and acquisition.
 */
export function qualifyDiscoveryCandidate(
  input: QualificationInput,
): CandidateQualification {
  const policy =
    input.policy ?? {};

  const provenance =
    input.provenance ??
    inferProvenance(
      input.candidate,
    );

  const relevanceScore =
    clampScore(
      input.relevanceScore,
    );

  const authorityScore =
    normalizeAuthorityScore(
      input.authorityScore,
    );

  const freshnessStatus =
    input.freshnessStatus ??
    "NOT_OBSERVED";

  const reasons:
    QualificationReasonCode[] = [];

  let normalizedUrl = "";
  let sourcePolicyBlocked = false;

  try {
    const decision =
      evaluateSourceUrl(
        input.candidate.url,
      );

    if (
      decision.status !==
      "ELIGIBLE" ||
      !decision.normalizedUrl
    ) {
      sourcePolicyBlocked = true;

      reasons.push(
        "SOURCE_POLICY_BLOCKED",
      );
    } else {
      normalizedUrl =
        decision.normalizedUrl;
    }
  } catch {
    reasons.push(
      "INVALID_URL",
    );
  }

  if (
    relevanceScore <
    minimumRelevance(policy)
  ) {
    reasons.push(
      "RELEVANCE_BELOW_THRESHOLD",
    );
  }

  if (
    provenance ===
    "UNKNOWN"
  ) {
    reasons.push(
      "PROVENANCE_UNKNOWN",
    );
  }

  const authorityStatus:
    AuthorityStatus =
    authorityScore === null
      ? "UNKNOWN"
      : "DECLARED";

  if (
    authorityStatus ===
      "UNKNOWN" &&
    !authorityMayBeUnknown(
      provenance,
      policy,
    )
  ) {
    reasons.push(
      "AUTHORITY_UNKNOWN",
    );
  }

  /*
   * Freshness is deliberately not a rejection criterion at this stage.
   *
   * A DiscoveryCandidate contains no immutable page representation, so
   * freshness cannot be truthfully calculated before acquisition.
   *
   * NOT_OBSERVED is therefore an explicit state, never silently treated as
   * NEW or CHANGED.
   */
  void freshnessStatus;

  if (
    sourcePolicyBlocked ||
    reasons.includes(
      "INVALID_URL",
    ) ||
    reasons.includes(
      "RELEVANCE_BELOW_THRESHOLD",
    ) ||
    reasons.includes(
      "PROVENANCE_UNKNOWN",
    ) ||
    reasons.includes(
      "AUTHORITY_UNKNOWN",
    )
  ) {
    return Object.freeze({
      status: "REJECTED",
      canonicalUrl:
        input.candidate.canonicalUrl,
      normalizedUrl,
      provenance,
      authorityStatus,
      authorityScore,
      relevanceScore,
      freshnessStatus,
      reasons: Object.freeze([
        ...reasons,
      ]),
    });
  }

  return Object.freeze({
    status: "QUALIFIED",
    canonicalUrl:
      input.candidate.canonicalUrl,
    normalizedUrl,
    provenance,
    authorityStatus,
    authorityScore,
    relevanceScore,
    freshnessStatus,
    reasons: Object.freeze([]),
  });
}