import { invariant } from "../constitution/invariants.js";
import type { ClaimPayload, FoundationRecord, EvidencePayload } from "./types.js";
export function assertClaimReady(claim:ClaimPayload,evidence:readonly FoundationRecord<EvidencePayload>[]):void{
 invariant(claim.statement.trim().length>0,"V8_CLAIM_STATEMENT_REQUIRED","Claim statement is required.");
 invariant(claim.evidenceIds.length>0,"V8_CLAIM_EVIDENCE_REQUIRED","Claim requires Evidence.");
 const cited=new Set(evidence.map(e=>e.aggregateId));
 invariant(claim.evidenceIds.every(id=>cited.has(id)),"V8_CLAIM_EVIDENCE_MISSING","Every cited Evidence must exist.");
 invariant(evidence.every(e=>e.state==="VERIFIED"),"V8_CLAIM_EVIDENCE_NOT_VERIFIED","Only verified Evidence may support a verified Claim.");
 invariant(!(claim.isUniversal===true && evidence.some(e=>e.payload.materialGrade||e.payload.testCondition||e.payload.testMethod)),"V8_CLAIM_UNSUPPORTED_UNIVERSALIZATION","Conditioned evidence cannot be silently promoted to a universal claim.");
}
