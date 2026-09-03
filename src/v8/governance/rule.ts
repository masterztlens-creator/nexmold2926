import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { knowledgeId, nonEmpty, sortedUnique, stableFingerprint, type Fingerprint, type KnowledgeId, type Brand } from "../domain/primitives.js";

export type RuleId = Brand<string, "RuleId">;
export const ruleId = (v: string) => nonEmpty(v, "RuleId") as RuleId;
export type RuleStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "RETIRED" | "UNKNOWN";
export type RuleEffect = "ALLOW" | "DENY" | "REQUIRE_REVIEW";

export interface Rule {
  readonly id: RuleId;
  readonly statement: string;
  readonly knowledgeIds: readonly KnowledgeId[];
  readonly effect: RuleEffect;
  readonly status: Exclude<RuleStatus, "UNKNOWN">;
  readonly fingerprint: Fingerprint;
}

export function createRule(input: Omit<Rule, "id" | "fingerprint"> & { id?: string }): Readonly<Rule> {
  const status = requireKnown(input.status, "V8_RULE_UNKNOWN", "rule.status");
  const effect = requireKnown(input.effect, "V8_RULE_EFFECT_UNKNOWN", "rule.effect");
  const knowledgeIds = sortedUnique(input.knowledgeIds.map(String), "rule.knowledgeIds").map(knowledgeId);
  invariant(knowledgeIds.length > 0, "V8_RULE_NO_KNOWLEDGE", "A rule must be grounded in approved knowledge.");
  const statement = nonEmpty(input.statement, "rule.statement");
  const fp = stableFingerprint({ statement, knowledgeIds, effect, status });
  return immutable({ id: ruleId(input.id ?? `rule:${fp}`), statement, knowledgeIds, effect, status, fingerprint: fp });
}
