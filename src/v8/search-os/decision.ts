import type { EngineeringDecision, SearchIntent } from "./contracts.js";
import type { ApplicabilityDecision } from "./contracts.js";

export function createEngineeringDecision(input: {
  id: string;
  queryId: string;
  intent: SearchIntent;
  statement: string;
  applicability: ApplicabilityDecision;
  evidenceIds: readonly string[];
}): Readonly<EngineeringDecision> {
  if (input.intent.kind === "NON_ENGINEERING") throw new Error("V8_DECISION_NON_ENGINEERING");
  if (!input.statement.trim()) throw new Error("V8_DECISION_STATEMENT_REQUIRED");
  if (input.evidenceIds.length === 0) throw new Error("V8_DECISION_EVIDENCE_REQUIRED");
  if (input.applicability.status === "BLOCKED" || input.applicability.status === "INSUFFICIENT_EVIDENCE") {
    throw new Error("V8_DECISION_APPLICABILITY_BLOCKED");
  }
  return Object.freeze({ ...input, evidenceIds: Object.freeze([...input.evidenceIds]), createdAt: new Date().toISOString() });
}
