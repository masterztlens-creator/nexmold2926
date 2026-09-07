import type { AuditActor, FoundationRecord, FoundationStore, VerificationPayload } from "./types.js";
import { contentFingerprint } from "./hash.js";
import { invariant, immutable } from "../constitution/invariants.js";

export function recordVerification(store:FoundationStore,targetType:VerificationPayload["targetType"],targetId:string,decision:VerificationPayload["decision"],checks:readonly string[],verifier:AuditActor,evidenceHash?:string){
 invariant(checks.length>0,"V8_VERIFICATION_CHECKS_REQUIRED","Verification requires explicit checks.");
 const payload:VerificationPayload=immutable({targetType,targetId,decision,checks:[...checks],verifier,...(evidenceHash?{evidenceHash}: {})});
 const id=`verification:${targetType}:${targetId}:${contentFingerprint(payload)}`;
 const existing=store.get<VerificationPayload>("VERIFICATION",id);
 if(existing)return existing;
 return store.append({aggregateType:"VERIFICATION",aggregateId:id,version:1,state:decision==="PASS"?"VERIFIED":decision==="FAIL"?"REJECTED":"REQUIRES_REVIEW",payload,lineage:[],actor:verifier,reason:"verification event"});
}
export function hasPassingVerification(store:FoundationStore,targetType:VerificationPayload["targetType"],targetId:string):boolean{
 return store.auditTrail().some(r=>r.aggregateType==="VERIFICATION"&&r.payload&& (r.payload as VerificationPayload).targetType===targetType&&(r.payload as VerificationPayload).targetId===targetId&&r.state==="VERIFIED");
}
