import { invariant, immutable } from "../constitution/invariants.js";
import type { FoundationRecord, FoundationStore, AuditActor } from "../foundation/types.js";
import { createRule, type Rule } from "./rule.js";
import { createPolicy, type Policy } from "./policy.js";

function requireGovernor(actor: AuditActor): void {
  invariant(actor.role === "GOVERNOR", "V8_GOVERNANCE_ROLE_REQUIRED", "Rule and policy governance requires GOVERNOR role.");
}
function requireReason(reason: string): string {
  invariant(typeof reason === "string" && reason.trim().length > 0, "V8_GOVERNANCE_REASON_REQUIRED", "Governance reason is required.");
  return reason.trim();
}

export class RulePolicyGovernance {
  constructor(private readonly store: FoundationStore) {}

  proposeRule(rule: Rule, actor: AuditActor, reason: string): FoundationRecord {
    const payload = createRule({ ...rule, status: "PROPOSED" });
    requireReason(reason);
    return this.store.append({ aggregateType: "RULE", aggregateId: payload.id, version: 1, state: "PROPOSED", payload, lineage: this.knowledgeLineage(payload.knowledgeIds), actor, reason });
  }

  approveRule(ruleId: string, actor: AuditActor, reason: string): FoundationRecord {
    requireGovernor(actor); requireReason(reason);
    const current = this.store.get("RULE", ruleId);
    invariant(current !== null, "V8_RULE_NOT_FOUND", `Rule ${ruleId} not found.`);
    invariant(current.state === "PROPOSED", "V8_RULE_NOT_PROPOSABLE", "Only PROPOSED rules may be approved.");
    this.assertApprovedKnowledge(current.payload as Rule);
    return this.store.append({ aggregateType: "RULE", aggregateId: ruleId, version: current.version + 1, state: "APPROVED", payload: createRule({ ...(current.payload as Rule), status: "APPROVED" }), lineage: current.lineage, actor, reason });
  }

  rejectRule(ruleId: string, actor: AuditActor, reason: string): FoundationRecord {
    requireGovernor(actor); requireReason(reason);
    const current = this.store.get("RULE", ruleId);
    invariant(current !== null, "V8_RULE_NOT_FOUND", `Rule ${ruleId} not found.`);
    invariant(current.state === "PROPOSED", "V8_RULE_NOT_REJECTABLE", "Only PROPOSED rules may be rejected.");
    return this.store.append({ aggregateType: "RULE", aggregateId: ruleId, version: current.version + 1, state: "REJECTED", payload: current.payload, lineage: current.lineage, actor, reason });
  }

  proposePolicy(policy: Policy, actor: AuditActor, reason: string): FoundationRecord {
    const payload = createPolicy({ ...policy, status: "PROPOSED" });
    requireReason(reason);
    this.assertApprovedRules(payload.ruleIds);
    return this.store.append({ aggregateType: "POLICY", aggregateId: payload.id, version: 1, state: "PROPOSED", payload, lineage: this.ruleLineage(payload.ruleIds), actor, reason });
  }

  approvePolicy(policyId: string, actor: AuditActor, reason: string): FoundationRecord {
    requireGovernor(actor); requireReason(reason);
    const current = this.store.get("POLICY", policyId);
    invariant(current !== null, "V8_POLICY_NOT_FOUND", `Policy ${policyId} not found.`);
    invariant(current.state === "PROPOSED", "V8_POLICY_NOT_PROPOSABLE", "Only PROPOSED policies may be approved.");
    this.assertApprovedRules((current.payload as Policy).ruleIds);
    return this.store.append({ aggregateType: "POLICY", aggregateId: policyId, version: current.version + 1, state: "APPROVED", payload: createPolicy({ ...(current.payload as Policy), status: "APPROVED" }), lineage: current.lineage, actor, reason });
  }

  private assertApprovedKnowledge(ids: readonly string[]): void {
    for (const id of ids) {
      const record = this.store.get("KNOWLEDGE", id);
      invariant(record !== null && record.state === "VERIFIED", "V8_RULE_KNOWLEDGE_NOT_APPROVED", `Rule references knowledge ${id} that is not approved.`);
    }
  }

  private assertApprovedRules(ids: readonly string[]): void {
    for (const id of ids) {
      const record = this.store.get("RULE", id);
      invariant(record !== null && record.state === "APPROVED", "V8_POLICY_RULE_NOT_APPROVED", `Policy references rule ${id} that is not approved.`);
    }
  }

  private knowledgeLineage(ids: readonly string[]) {
    return ids.map(id => {
      const r = this.store.get("KNOWLEDGE", id);
      invariant(r !== null && r.state === "VERIFIED", "V8_RULE_KNOWLEDGE_NOT_APPROVED", `Knowledge ${id} is not approved.`);
      return { type: "KNOWLEDGE" as const, id: r.aggregateId, version: r.version, fingerprint: r.fingerprint };
    });
  }

  private ruleLineage(ids: readonly string[]) {
    return ids.map(id => {
      const r = this.store.get("RULE", id);
      invariant(r !== null && r.state === "APPROVED", "V8_POLICY_RULE_NOT_APPROVED", `Rule ${id} is not approved.`);
      return { type: "RULE" as const, id: r.aggregateId, version: r.version, fingerprint: r.fingerprint };
    });
  }
}
