import type { AssetCandidate, AssetDecisionResult } from "./contracts.js";

export function decideAsset(candidate: AssetCandidate): Readonly<AssetDecisionResult> {
  const reasons: string[] = [];
  if (candidate.duplicateRisk >= 0.75) {
    reasons.push("High duplicate risk.");
    return Object.freeze({ decision: "MERGE", reasons, candidate });
  }
  if (candidate.cannibalizationRisk >= 0.75) {
    reasons.push("High cannibalization risk.");
    return Object.freeze({ decision: "MERGE", reasons, candidate });
  }
  if (candidate.uniquenessScore < 0.65) {
    reasons.push("Insufficient unique engineering value.");
    return Object.freeze({ decision: "BLOCK", reasons, candidate });
  }
  if (candidate.economicScore < 0.35) {
    reasons.push("Page economics below minimum threshold.");
    return Object.freeze({ decision: "BLOCK", reasons, candidate });
  }
  reasons.push("Unique engineering decision clears asset thresholds.");
  return Object.freeze({ decision: "CREATE", reasons, candidate });
}
