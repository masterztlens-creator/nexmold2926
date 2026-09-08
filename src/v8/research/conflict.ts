import type {
  ConflictResult,
  ConflictValue,
} from "./types.js";
export function detectClaimConflict(
  values: ConflictValue[],
): ConflictResult {
  if (values.length < 2) {
    return {
      status: "INSUFFICIENT_CONTEXT",
      resolution: "NONE",
      values,
    };
  }
  const distinctValues = new Set(
    values.map((item) => item.value.trim()),
  );
  if (distinctValues.size <= 1) {
    return {
      status: "NO_CONFLICT",
      resolution: "NONE",
      values,
    };
  }
  const ranked = [...values].sort(
    (a, b) => b.authorityScore - a.authorityScore,
  );
  const highest = ranked[0];
  const second = ranked[1];
  /*
   * Authority ranking is useful for triage only.
   *
   * This function NEVER publishes a winner.
   * A conflict with materially different claims remains
   * review-required unless the caller explicitly applies
   * a downstream governance policy.
   */
  if (
    highest.authorityScore > second.authorityScore &&
    highest.authorityScore - second.authorityScore >= 0.25
  ) {
    return {
      status: "CONFLICT",
      resolution: "HIGHEST_AUTHORITY_CANDIDATE",
      values,
      selected: highest,
    };
  }
  return {
    status: "CONFLICT",
    resolution: "REQUIRES_REVIEW",
    values,
  };
}