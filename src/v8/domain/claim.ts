import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { claimId, evidenceId, nonEmpty, type ClaimId, type EvidenceId, type Fingerprint } from "./primitives.js";
import { contentFingerprint } from "../foundation/hash.js";
export type ClaimStatus="VERIFIED"|"REJECTED"|"REQUIRES_REVIEW"|"UNKNOWN";
export type ClaimEpistemicLevel="OBSERVATION"|"METHOD"|"INTERPRETATION"|"ENGINEERING_INFERENCE"|"RECOMMENDATION";
export interface Claim{id:ClaimId;statement:string;evidenceIds:readonly EvidenceId[];status:Exclude<ClaimStatus,"UNKNOWN">;fingerprint:Fingerprint;scope?:string;conditions?:readonly string[];units?:readonly string[];confidence?:"HIGH"|"MEDIUM"|"LOW";epistemicLevel?:ClaimEpistemicLevel;isUniversal?:boolean;}
export function createClaim(i:Omit<Claim,"id"|"fingerprint">&{id?:string}):Readonly<Claim>{
 const status=requireKnown(i.status,"V8_CLAIM_UNKNOWN","claim.status"); invariant(i.evidenceIds.length>0,"V8_CLAIM_NO_EVIDENCE","A claim must cite at least one evidence record.");
 const evidenceIds=immutable([...new Set(i.evidenceIds.map(evidenceId))].sort()); const statement=nonEmpty(i.statement,"claim.statement");
 const fp=contentFingerprint({statement,evidenceIds,status,scope:i.scope,conditions:i.conditions,units:i.units,confidence:i.confidence,epistemicLevel:i.epistemicLevel,isUniversal:i.isUniversal});
 return immutable({id:claimId(i.id??`claim:${fp}`),statement,evidenceIds,status,fingerprint:fp,...(i.scope?{scope:i.scope}:{}),...(i.conditions?{conditions:[...i.conditions]}:{}),...(i.units?{units:[...i.units]}:{}),...(i.confidence?{confidence:i.confidence}:{}),...(i.epistemicLevel?{epistemicLevel:i.epistemicLevel}:{}),...(i.isUniversal!==undefined?{isUniversal:i.isUniversal}: {})});
}
