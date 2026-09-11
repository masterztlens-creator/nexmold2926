import { normalizeSourceUrl } from "./url-normalizer.js";
export type SourcePolicyStatus = "ELIGIBLE" | "BLOCKED";
export interface SourcePolicyDecision {
  readonly status: SourcePolicyStatus;
  readonly normalizedUrl?: string;
  readonly reason?: string;
}
/** Pure, conservative Internet-source eligibility boundary. */
export function evaluateSourceUrl(input: string): SourcePolicyDecision {
  try { return { status: "ELIGIBLE", normalizedUrl: normalizeSourceUrl(input) }; }
  catch (error) {
    return { status: "BLOCKED", reason: error instanceof Error ? error.message : "V8_ACQUISITION_SOURCE_POLICY_UNKNOWN" };
  }
}
