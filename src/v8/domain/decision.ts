import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { decisionId, knowledgeId, problemId, stableFingerprint, type DecisionId, type Fingerprint, type KnowledgeId, type ProblemId } from "./primitives.js";

export type DecisionStatus = "APPROVED" | "BLOCKED" | "REQUIRES_REVIEW" | "UNKNOWN";
export interface Decision { readonly id: DecisionId; readonly problemId: ProblemId; readonly knowledgeIds: readonly KnowledgeId[]; readonly outcome: string; readonly status: Exclude<DecisionStatus, "UNKNOWN">; readonly fingerprint: Fingerprint; }
export function createDecision(input: Omit<Decision, "id" | "fingerprint"> & { id?: string }): Readonly<Decision> {
  const status = requireKnown(input.status, "V8_DECISION_UNKNOWN", "decision.status");
  invariant(input.knowledgeIds.length > 0, "V8_DECISION_NO_KNOWLEDGE", "Decision requires approved knowledge references.");
  const knowledgeIds = immutable([...new Set(input.knowledgeIds.map(knowledgeId))].sort());
  const semantic = { problemId: problemId(input.problemId), knowledgeIds, outcome: input.outcome.trim(), status };
  invariant(semantic.outcome.length > 0, "V8_DECISION_EMPTY_OUTCOME", "Decision outcome cannot be empty.");
  const fp = stableFingerprint(semantic);
  return immutable({ id: decisionId(input.id ?? `decision:${fp}`), ...semantic, fingerprint: fp });
}
