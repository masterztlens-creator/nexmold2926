import type { ApplicabilityDecision, ApplicabilityStatus } from "./contracts.js";

export interface EvidenceCondition {
  id: string;
  verified: boolean;
  applicable: boolean;
  conditionKey?: string;
}

export function evaluateApplicability(evidence: readonly EvidenceCondition[], requiredEvidenceIds: readonly string[]): Readonly<ApplicabilityDecision> {
  if (requiredEvidenceIds.length === 0) return Object.freeze({ status: "INSUFFICIENT_EVIDENCE", reasons: ["No evidence requirements declared."], evidenceIds: [] });
  const cited = evidence.filter((item) => requiredEvidenceIds.includes(item.id));
  if (cited.length !== requiredEvidenceIds.length) return Object.freeze({ status: "INSUFFICIENT_EVIDENCE", reasons: ["Required evidence is missing."], evidenceIds: cited.map((x) => x.id) });
  if (cited.some((x) => !x.verified)) return Object.freeze({ status: "BLOCKED", reasons: ["Unverified evidence cannot support an engineering decision."], evidenceIds: cited.map((x) => x.id) });
  if (cited.some((x) => !x.applicable)) return Object.freeze({ status: "NOT_COMPARABLE", reasons: ["Evidence conditions are not applicable to this decision."], evidenceIds: cited.map((x) => x.id) });
  const conditioned = cited.some((x) => Boolean(x.conditionKey));
  const status: ApplicabilityStatus = conditioned ? "CONDITION_DEPENDENT" : "APPLICABLE";
  return Object.freeze({ status, reasons: conditioned ? ["Decision is valid only under explicit evidence conditions."] : ["All required verified evidence is applicable."], evidenceIds: cited.map((x) => x.id) });
}
