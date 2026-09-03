import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { nonEmpty, sortedUnique, stableFingerprint, type Brand, type Fingerprint } from "../domain/primitives.js";
import type { RuleId } from "./rule.js";

export type PolicyId = Brand<string, "PolicyId">;
export const policyId = (v: string) => nonEmpty(v, "PolicyId") as PolicyId;
export type PolicyMode = "ALL" | "FIRST_MATCH_DENY";
export type PolicyStatus = "PROPOSED" | "APPROVED" | "REJECTED" | "RETIRED" | "UNKNOWN";

export interface Policy {
  readonly id: PolicyId;
  readonly name: string;
  readonly ruleIds: readonly RuleId[];
  readonly mode: PolicyMode;
  readonly status: Exclude<PolicyStatus, "UNKNOWN">;
  readonly fingerprint: Fingerprint;
}

export function createPolicy(input: Omit<Policy, "id" | "fingerprint"> & { id?: string }): Readonly<Policy> {
  const status = requireKnown(input.status, "V8_POLICY_UNKNOWN", "policy.status");
  const mode = requireKnown(input.mode, "V8_POLICY_MODE_UNKNOWN", "policy.mode");
  const name = nonEmpty(input.name, "policy.name");
  const ruleIds = sortedUnique(input.ruleIds.map(String), "policy.ruleIds") as readonly RuleId[];
  invariant(ruleIds.length > 0, "V8_POLICY_NO_RULE", "A policy must contain at least one rule.");
  const fp = stableFingerprint({ name, ruleIds, mode, status });
  return immutable({ id: policyId(input.id ?? `policy:${fp}`), name, ruleIds, mode, status, fingerprint: fp });
}
