/** NEXMOLD V7.14 — Expert Quality Gate. Level 1 monitor / Level 2+ optional fail-closed. */
import type { ExpertArticleContract } from "./expert-article-contract";
export type ExpertGateLevel = 1 | 2 | 3;
export interface ExpertQualityResult { level: ExpertGateLevel; status: "PASS" | "WARN" | "FAIL"; blocking: boolean; score: number; reasons: string[]; }
export function evaluateExpertQuality(contract: ExpertArticleContract, level: ExpertGateLevel = 1): ExpertQualityResult {
  const reasons: string[] = [];
  if (!contract.evidence.length) reasons.push("EVIDENCE_EMPTY");
  if (!contract.claims.length) reasons.push("CLAIMS_EMPTY");
  if (!contract.mechanisms.length) reasons.push("MECHANISMS_EMPTY");
  if (!contract.decisions.length) reasons.push("DECISIONS_EMPTY");
  if (!contract.facts.some((f) => /\d/.test(f.statement))) reasons.push("ENGINEERING_PARAMETER_ABSENT");
  if (contract.quality.unsupportedClaimCount) reasons.push(`UNSUPPORTED_CLAIMS:${contract.quality.unsupportedClaimCount}`);
  if (contract.quality.conflictCount) reasons.push(`CONFLICTING_CLAIMS:${contract.quality.conflictCount}`);
  const score = Math.round(100 * (contract.quality.evidenceCoverage * 0.45 + (contract.mechanisms.length ? 0.2 : 0) + (contract.decisions.length ? 0.2 : 0) + (contract.validations.length ? 0.15 : 0)));
  const blocking = level >= 2 && (reasons.includes("EVIDENCE_EMPTY") || reasons.includes("CLAIMS_EMPTY") || reasons.includes("ENGINEERING_PARAMETER_ABSENT") || (level >= 3 && contract.quality.unsupportedClaimCount > 0));
  return { level, status: blocking ? "FAIL" : reasons.length ? "WARN" : "PASS", blocking, score, reasons };
}
