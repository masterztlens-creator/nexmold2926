import type { Claim } from "../domain/claim.js";
import type { Knowledge } from "../domain/knowledge.js";
import type { AuditActor, FoundationRecord } from "../foundation/types.js";

export type VerificationVerdict = "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW";

export interface ClaimVerificationResult {
  readonly verdict: VerificationVerdict;
  readonly claim: Readonly<Claim>;
  readonly evidenceCount: number;
  readonly reasons: readonly string[];
}

export interface KnowledgeApprovalResult {
  readonly verdict: "APPROVED" | "REJECTED" | "REQUIRES_REVIEW";
  readonly knowledge: Readonly<Knowledge>;
  readonly verifiedClaimCount: number;
  readonly reasons: readonly string[];
  readonly record?: FoundationRecord;
}

export interface GovernanceContext {
  readonly actor: AuditActor;
  readonly reason: string;
}
