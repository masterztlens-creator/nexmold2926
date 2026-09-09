
import { type ContentDraft, type QualityFinding, type QualityReport } from "../shared.js";
export function validateContentQuality(draft: ContentDraft): QualityReport {
  const findings: QualityFinding[]=[];
  if (!draft.title.trim()) findings.push({code:"TITLE_EMPTY",severity:"BLOCK",message:"Title is empty"});
  if (draft.sections.length<4) findings.push({code:"THIN_STRUCTURE",severity:"BLOCK",message:"Content has fewer than four sections"});
  if (draft.evidence.length===0) findings.push({code:"NO_EVIDENCE",severity:"BLOCK",message:"No evidence references are bound"});
  if (draft.claims.some(c=>c.trim().length<20)) findings.push({code:"WEAK_CLAIM",severity:"WARN",message:"At least one claim is too short"});
  return Object.freeze({passed:!findings.some(f=>f.severity==="BLOCK"),findings:Object.freeze(findings)});
}
