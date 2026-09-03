import { nonEmpty } from "../domain/primitives.js";
import { contentFingerprint } from "./hash.js";
import { immutable, invariant } from "../constitution/invariants.js";
import { assertKnownState, assertTransition } from "./state-machine.js";
import type { AggregateType, FoundationRecord, FoundationState, FoundationStore } from "./types.js";

function deepFreeze<T>(value:T):T { if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.freeze(value);for(const child of Object.values(value as Record<string,unknown>))deepFreeze(child);}return value;}
function cloneRecord<T>(record:FoundationRecord<T>):FoundationRecord<T>{return immutable(deepFreeze({...record,lineage:[...record.lineage]}));}

export class InMemoryFoundationStore implements FoundationStore {
 private readonly records:FoundationRecord[]=[];
 append<T>(input:Omit<FoundationRecord<T>,"recordId"|"fingerprint"|"recordedAt"|"previousFingerprint">&{readonly recordedAt?:string}):FoundationRecord<T>{
  invariant(input.version>=1&&Number.isInteger(input.version),"V8_FOUNDATION_VERSION_INVALID","Version must be a positive integer."); assertKnownState(input.state);
  invariant(["SOURCE","SNAPSHOT","EVIDENCE","CLAIM","KNOWLEDGE","RULE","POLICY"].includes(input.aggregateType),"V8_FOUNDATION_AGGREGATE_INVALID",`Unknown aggregate type: ${input.aggregateType}.`);
  nonEmpty(input.aggregateId,"aggregateId"); nonEmpty(input.reason,"reason");
  invariant(input.actor!==undefined&&typeof input.actor.id==="string"&&input.actor.id.trim().length>0,"V8_FOUNDATION_AUDIT_ACTOR_REQUIRED","Audit actor id is required.");
  invariant(["SYSTEM","INGESTOR","AUDITOR","VERIFIER","GOVERNOR"].includes(input.actor.role),"V8_FOUNDATION_AUDIT_ROLE_INVALID","Audit actor role is invalid.");
  invariant(input.lineage.every(link=>link.version>=1),"V8_FOUNDATION_LINEAGE_INVALID","Lineage versions must be positive.");
  const previous=this.get(input.aggregateType,input.aggregateId);
  if(previous){invariant(input.version===previous.version+1,"V8_FOUNDATION_VERSION_GAP","Aggregate versions must be contiguous.");assertTransition(previous.state,input.state);}else invariant(input.version===1,"V8_FOUNDATION_FIRST_VERSION","A new aggregate must start at version 1.");
  const recordedAt=input.recordedAt??new Date().toISOString(); const previousFingerprint=previous?.fingerprint??null;
  const body={aggregateType:input.aggregateType,aggregateId:input.aggregateId,version:input.version,state:input.state,payload:input.payload,lineage:input.lineage,previousFingerprint,actor:input.actor,reason:input.reason,recordedAt};
  const fingerprint=contentFingerprint(body); const record=immutable({recordId:`${input.aggregateType}:${input.aggregateId}:${input.version}`,...body,fingerprint}) as FoundationRecord<T>; this.records.push(record as FoundationRecord); return cloneRecord(record);
 }
 get<T>(aggregateType:AggregateType,aggregateId:string,version?:number):FoundationRecord<T>|null{const matches=this.records.filter(r=>r.aggregateType===aggregateType&&r.aggregateId===aggregateId);if(!matches.length)return null;const record=version===undefined?matches[matches.length-1]:matches.find(r=>r.version===version);return record?cloneRecord(record as FoundationRecord<T>):null;}
 history(aggregateType:AggregateType,aggregateId:string):readonly FoundationRecord[]{return this.records.filter(r=>r.aggregateType===aggregateType&&r.aggregateId===aggregateId).map(cloneRecord);}
 auditTrail():readonly FoundationRecord[]{return this.records.map(cloneRecord);}
 verifyChain():void{const grouped=new Map<string,FoundationRecord[]>();for(const record of this.records){const key=`${record.aggregateType}:${record.aggregateId}`;const list=grouped.get(key)??[];list.push(record);grouped.set(key,list);}for(const list of grouped.values()){for(let i=0;i<list.length;i++){const record=list[i];const expectedPrevious=i===0?null:list[i-1].fingerprint;invariant(record.previousFingerprint===expectedPrevious,"V8_FOUNDATION_CHAIN_BROKEN",`${record.recordId} previous fingerprint mismatch.`);const {fingerprint:actual,...withoutFingerprint}=record;invariant(contentFingerprint(withoutFingerprint)===actual,"V8_FOUNDATION_FINGERPRINT_MISMATCH",`${record.recordId} fingerprint mismatch.`);}}}
}
