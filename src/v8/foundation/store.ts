import {immutable,invariant} from "../constitution/invariants.js";
import {existsSync, mkdirSync, appendFileSync, readFileSync} from "node:fs";
import {dirname} from "node:path";import {nonEmpty} from "../domain/primitives.js";import {contentFingerprint} from "./hash.js";import {assertKnownState,assertTransition} from "./state-machine.js";import type {AggregateType,FoundationRecord,FoundationState,FoundationStore} from "./types.js";
const TYPES=new Set<AggregateType>(["SOURCE","SNAPSHOT","EVIDENCE","CLAIM","KNOWLEDGE","RULE","POLICY","ELIGIBILITY","PUBLICATION","PROJECTION","RELEASE"]);
function clone<T>(r:FoundationRecord<T>):FoundationRecord<T>{return immutable({...r,lineage:[...r.lineage]});}
export class JsonlFoundationStore implements FoundationStore {
  private readonly memory = new InMemoryFoundationStore();
  constructor(private readonly filePath: string) {
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf8");
      for (const line of raw.split(/\r?\n/).filter(Boolean)) {
        let parsed: FoundationRecord;
        try { parsed = JSON.parse(line) as FoundationRecord; }
        catch { throw new Error("V8_FOUNDATION_PERSISTED_RECORD_INVALID"); }
        try { this.memory.append(parsed as any); }
        catch (error) { throw new Error(`V8_FOUNDATION_PERSISTED_RECORD_INVALID: ${error instanceof Error ? error.message : String(error)}`); }
        const stored = this.memory.get(parsed.aggregateType, parsed.aggregateId, parsed.version);
        if (!stored || stored.fingerprint !== parsed.fingerprint) throw new Error("V8_FOUNDATION_PERSISTED_RECORD_INVALID: FINGERPRINT_MISMATCH");
      }
      this.memory.verifyChain();
    } else {
      mkdirSync(dirname(filePath), {recursive: true});
    }
  }
  append<T>(record: Omit<FoundationRecord<T>, "recordId"|"fingerprint"|"recordedAt"|"previousFingerprint"> & {recordedAt?: string}): FoundationRecord<T> {
    const created = this.memory.append(record);
    appendFileSync(this.filePath, JSON.stringify(created) + "\n", "utf8");
    return created;
  }
  get<T>(type: AggregateType, id: string, version?: number) { return this.memory.get<T>(type, id, version); }
  history(type: AggregateType, id: string) { return this.memory.history(type, id); }
  auditTrail() { return this.memory.auditTrail(); }
  verifyChain() { this.memory.verifyChain(); }
}

export class InMemoryFoundationStore implements FoundationStore{private readonly records:FoundationRecord[]=[];
 append<T>(i:Omit<FoundationRecord<T>,"recordId"|"fingerprint"|"recordedAt"|"previousFingerprint">&{recordedAt?:string}):FoundationRecord<T>{invariant(Number.isInteger(i.version)&&i.version>0,"V8_FOUNDATION_VERSION_INVALID","Version must be a positive integer.");assertKnownState(i.state);invariant(TYPES.has(i.aggregateType),"V8_FOUNDATION_AGGREGATE_INVALID",`Unknown aggregate type: ${i.aggregateType}.`);nonEmpty(i.aggregateId,"aggregateId");nonEmpty(i.reason,"reason");invariant(typeof i.actor?.id==="string"&&i.actor.id.trim().length>0,"V8_FOUNDATION_AUDIT_ACTOR_REQUIRED","Audit actor id is required.");invariant(["SYSTEM","INGESTOR","AUDITOR","VERIFIER","GOVERNOR"].includes(i.actor.role),"V8_FOUNDATION_AUDIT_ROLE_INVALID","Audit actor role is invalid.");invariant(i.lineage.every(l=>Number.isInteger(l.version)&&l.version>0&&l.id.length>0&&l.fingerprint.length>0),"V8_FOUNDATION_LINEAGE_INVALID","Invalid lineage link.");const prev=this.get(i.aggregateType,i.aggregateId);if(prev){invariant(i.version===prev.version+1,"V8_FOUNDATION_VERSION_GAP","Aggregate versions must be contiguous.");assertTransition(prev.state,i.state);}else invariant(i.version===1,"V8_FOUNDATION_FIRST_VERSION","A new aggregate must start at version 1.");const recordedAt=i.recordedAt??new Date().toISOString();const previousFingerprint=prev?.fingerprint??null;const body={aggregateType:i.aggregateType,aggregateId:i.aggregateId,version:i.version,state:i.state,payload:i.payload,lineage:i.lineage,previousFingerprint,actor:i.actor,reason:i.reason,recordedAt};const record=immutable({recordId:`${i.aggregateType}:${i.aggregateId}:${i.version}`,...body,fingerprint:contentFingerprint(body)}) as FoundationRecord<T>;this.records.push(record);return clone(record);}
 get<T>(t:AggregateType,id:string,v?:number){const a=this.records.filter(r=>r.aggregateType===t&&r.aggregateId===id);if(!a.length)return null;const r=v===undefined?a[a.length-1]:a.find(x=>x.version===v);return r?clone(r as FoundationRecord<T>):null;}
 history(t:AggregateType,id:string){return this.records.filter(r=>r.aggregateType===t&&r.aggregateId===id).map(clone);}
 auditTrail(){return this.records.map(clone);}
 verifyChain(){const groups=new Map<string,FoundationRecord[]>();for(const r of this.records){const k=`${r.aggregateType}:${r.aggregateId}`;const a=groups.get(k)??[];a.push(r);groups.set(k,a);}for(const a of groups.values())for(let n=0;n<a.length;n++){const r=a[n];invariant(r.previousFingerprint===(n? a[n-1].fingerprint:null),"V8_FOUNDATION_CHAIN_BROKEN",`${r.recordId} previous fingerprint mismatch.`);const {recordId,fingerprint,...body}=r;void recordId;invariant(contentFingerprint(body)===fingerprint,"V8_FOUNDATION_FINGERPRINT_MISMATCH",`${r.recordId} fingerprint mismatch.`);}}
}
