import { immutable, invariant } from "../constitution/invariants.js";
import type { Claim } from "../domain/claim.js";
import type { Knowledge } from "../domain/knowledge.js";
import { FoundationService } from "../foundation/service.js";
import { ClaimVerifier } from "./claim-verifier.js";
import { KnowledgeGovernance } from "./knowledge-governance.js";
import type { GovernanceContext, ClaimVerificationResult, KnowledgeApprovalResult } from "./types.js";

export class TruthGovernance {
  readonly claims: ClaimVerifier;
  readonly knowledge: KnowledgeGovernance;

  constructor(readonly foundation: FoundationService) {
    this.claims = new ClaimVerifier(foundation.storeView);
    this.knowledge = new KnowledgeGovernance(foundation);
  }

  verifyClaim(input: Omit<Claim, "id" | "fingerprint"> & { id?: string }, context: GovernanceContext): ClaimVerificationResult {
    const result = this.claims.verify(input);
    invariant(context.reason.trim().length > 0, "V8_GOVERNANCE_REASON_REQUIRED", "Governance actions require an audit reason.");
    invariant(context.actor.role === "VERIFIER", "V8_GOVERNANCE_VERIFIER_ROLE_REQUIRED", "Claim verification requires a VERIFIER actor.");
    if (result.verdict === "VERIFIED") {
      this.foundation.createClaim(result.claim, context.actor, context.reason);
    }
    return immutable(result);
  }

  approveKnowledge(input: Omit<Knowledge, "id" | "fingerprint"> & { id?: string }, context: GovernanceContext): KnowledgeApprovalResult {
    return this.knowledge.approve(input, context);
  }
}
