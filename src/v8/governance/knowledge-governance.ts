import { immutable, invariant } from "../constitution/invariants.js";
import { createKnowledge, type Knowledge } from "../domain/knowledge.js";
import type { ClaimPayload, FoundationRecord, FoundationStore } from "../foundation/types.js";
import { FoundationService } from "../foundation/service.js";
import type { GovernanceContext, KnowledgeApprovalResult } from "./types.js";

export class KnowledgeGovernance {
  constructor(private readonly foundation: FoundationService) {}

  approve(input: Omit<Knowledge, "id" | "fingerprint"> & { id?: string }, context: GovernanceContext): KnowledgeApprovalResult {
    invariant(context.reason.trim().length > 0, "V8_GOVERNANCE_REASON_REQUIRED", "Governance actions require an audit reason.");
    invariant(context.actor.role === "VERIFIER", "V8_GOVERNANCE_VERIFIER_ROLE_REQUIRED", "Knowledge approval requires a VERIFIER actor.");
    const knowledge = createKnowledge(input);
    const records = knowledge.claimIds.map(id => this.foundation.storeView.get<ClaimPayload>("CLAIM", id));
    if (records.some(r => r === null)) {
      return immutable({ verdict: "REJECTED", knowledge, verifiedClaimCount: records.filter(Boolean).length, reasons: ["Knowledge must reference existing claims."] });
    }
    const verified = records.filter((r): r is FoundationRecord<ClaimPayload> => r !== null && r.state === "VERIFIED");
    if (verified.length !== records.length) {
      return immutable({ verdict: "REQUIRES_REVIEW", knowledge, verifiedClaimCount: verified.length, reasons: ["Every supporting claim must be VERIFIED before knowledge can be approved."] });
    }
    if (knowledge.status !== "APPROVED") {
      return immutable({ verdict: "REQUIRES_REVIEW", knowledge, verifiedClaimCount: verified.length, reasons: ["Knowledge status must be APPROVED for persistence."] });
    }
    const record = this.foundation.createKnowledge(knowledge, context.actor, context.reason);
    return immutable({ verdict: "APPROVED", knowledge, verifiedClaimCount: verified.length, reasons: [], record });
  }

  assertApproved(input: Omit<Knowledge, "id" | "fingerprint"> & { id?: string }, context: GovernanceContext): Readonly<Knowledge> {
    const result = this.approve(input, context);
    invariant(result.verdict === "APPROVED", "V8_GOVERNANCE_KNOWLEDGE_NOT_APPROVED", result.reasons.join(" ") || "Knowledge approval failed.");
    return result.knowledge;
  }
}
