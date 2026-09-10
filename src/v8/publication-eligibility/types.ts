import type { LineageLink } from "../foundation/types.js";
import type { CompiledContent } from "../content-compiler/types.js";

export type PublicationEligibilityStatus =
  | "ELIGIBLE"
  | "BLOCKED"
  | "REQUIRES_REVIEW";

export interface PublicationEligibilityInput {
  readonly compiled: CompiledContent;
  readonly scopeId: string;
  readonly contextId: string;
}

export interface PublicationEligibilityResult {
  readonly eligible: boolean;
  readonly status: PublicationEligibilityStatus;
  readonly contentId: string;
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly fingerprint: string;
  readonly reasons: readonly string[];
  readonly lineage: readonly LineageLink[];
}