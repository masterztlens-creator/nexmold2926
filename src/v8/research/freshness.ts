import { createHash } from "node:crypto";
import type {
  FreshnessResult,
  NormalizedDocument,
} from "./types.js";
export function evaluateFreshness(
  document: NormalizedDocument,
  previousHash?: string,
  previousObservedAt?: string,
  staleAfterDays = 180,
): FreshnessResult {
  if (
    !Number.isFinite(staleAfterDays) ||
    staleAfterDays <= 0
  ) {
    throw new Error("staleAfterDays must be greater than zero");
  }
  const contentHash = createHash("sha256")
    .update(document.text, "utf8")
    .digest("hex");
  const observedAt = new Date().toISOString();
  let status: FreshnessResult["status"];
  if (!previousHash) {
    status = "NEW";
  } else if (previousHash !== contentHash) {
    status = "CHANGED";
  } else if (previousObservedAt) {
    const previousTime = Date.parse(previousObservedAt);
    if (
      Number.isFinite(previousTime) &&
      Date.now() - previousTime >
        staleAfterDays * 24 * 60 * 60 * 1000
    ) {
      status = "STALE";
    } else {
      status = "UNCHANGED";
    }
  } else {
    status = "UNCHANGED";
  }
  return {
    status,
    contentHash,
    previousHash,
    observedAt,
    staleAfterDays,
  };
}