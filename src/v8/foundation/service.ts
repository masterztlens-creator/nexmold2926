import { immutable, invariant } from "../constitution/invariants.js";
import { nonEmpty } from "../domain/primitives.js";
import { createSource, type Source } from "../domain/source.js";
import { createEvidence, type Evidence } from "../domain/evidence.js";
import { createClaim, type Claim } from "../domain/claim.js";
import { createKnowledge, type Knowledge } from "../domain/knowledge.js";
import { contentFingerprint, rawBytesFingerprint } from "./hash.js";
import { assertAuthoritativeSource } from "./authority-gate.js";
import { assertEvidenceReady } from "./evidence-gate.js";
import { assertClaimReady } from "./claim-gate.js";
import { recordVerification, hasPassingVerification } from "./verification.js";
import type { AuditActor, ClaimPayload, EvidencePayload, FoundationRecord, FoundationStore, KnowledgePayload, LineageLink, SnapshotPayload } from "./types.js";

export interface SnapshotInput {
  readonly source: Source; readonly capturedAt: string; readonly locator: string; readonly metadataOnly: boolean;
  readonly content?: string; readonly rawBytes?: Uint8Array; readonly requestedUrl?: string; readonly finalUrl?: string;
  readonly redirectChain?: readonly string[]; readonly mediaType?: string; readonly blobLocator?: string;
}

function uniqueLineage(items:readonly LineageLink[]):LineageLink[]{return [...new Map(items.map(l=>[`${l.type}:${l.id}:${l.version}`,l])).values()];}

export class FoundationService {
 private readonly store:FoundationStore;
 constructor(store:FoundationStore){this.store=store;}
 get storeView(){return this.store;}
 registerSource(input:Source,a:AuditActor,reason="source registration"){
  const source=createSource(input); assertAuthoritativeSource(source);
  invariant(!this.store.get("SOURCE",source.id),"V8_FOUNDATION_SOURCE_EXISTS","Source identity already exists.");
  return this.store.append({aggregateType:"SOURCE",aggregateId:source.id,version:1,state:"REGISTERED",payload:source,lineage:[],actor:a,reason});
 }
 captureSnapshot(i:SnapshotInput,a:AuditActor,reason="snapshot capture"){
  nonEmpty(i.capturedAt,"snapshot.capturedAt"); nonEmpty(i.locator,"snapshot.locator");
  if(i.metadataOnly) invariant(i.content===undefined&&i.rawBytes===undefined,"V8_FOUNDATION_METADATA_PAYLOAD_FORBIDDEN","Metadata-only sources cannot persist payload.");
  invariant(!(i.content!==undefined&&i.rawBytes!==undefined),"V8_FOUNDATION_DUAL_PAYLOAD","Snapshot must use text or raw bytes, not both.");
  const sr=this.store.get<Source>("SOURCE",i.source.id); invariant(sr!==null,"V8_FOUNDATION_SOURCE_NOT_REGISTERED",`Source ${i.source.id} is not registered.`);
  const hash=i.rawBytes?rawBytesFingerprint(i.rawBytes):contentFingerprint(i.content??{locator:i.locator,capturedAt:i.capturedAt});
  if(i.source.documentHash) invariant(hash===i.source.documentHash,"V8_FOUNDATION_DOCUMENT_HASH_MISMATCH","Captured bytes do not match Source documentHash.");
  const p:SnapshotPayload=immutable({sourceId:i.source.id,capturedAt:i.capturedAt,locator:i.locator.trim(),contentHash:hash,metadataOnly:i.metadataOnly,...(i.content===undefined?{}:{payload:i.content}),...(i.requestedUrl?{requestedUrl:i.requestedUrl}:{}),...(i.finalUrl?{finalUrl:i.finalUrl}:{}),...(i.redirectChain?{redirectChain:[...i.redirectChain]}:{}),...(i.mediaType?{mediaType:i.mediaType}:{}),...(i.rawBytes?{byteLength:i.rawBytes.byteLength}:{}),...(i.blobLocator?{blobLocator:i.blobLocator}:{})});
  const id=`snapshot:${i.source.id}:${hash}`;
  if(this.store.get("SNAPSHOT",id)) return this.store.get<SnapshotPayload>("SNAPSHOT",id)!;
  return this.store.append({aggregateType:"SNAPSHOT",aggregateId:id,version:1,state:"CAPTURED",payload:p,lineage:[{type:"SOURCE",id:sr.aggregateId,version:sr.version,fingerprint:sr.fingerprint}],actor:a,reason});
 }
 sealSnapshot(id:string,a:AuditActor,reason="snapshot sealed"){const c=this.store.get<SnapshotPayload>("SNAPSHOT",id);invariant(c!==null,"V8_FOUNDATION_SNAPSHOT_NOT_FOUND",`Snapshot ${id} not found.`);return this.store.append({aggregateType:"SNAPSHOT",aggregateId:id,version:c.version+1,state:"SEALED",payload:c.payload,lineage:c.lineage,actor:a,reason});}
 ingestEvidence(i:Omit<Evidence,"id">&{id?:string;snapshotId:string},a:AuditActor,reason="evidence ingestion"){
  const s=this.store.get<SnapshotPayload>("SNAPSHOT",i.snapshotId); invariant(s!==null&&s.state==="SEALED","V8_FOUNDATION_SNAPSHOT_NOT_SEALED","Evidence may only be ingested from a sealed snapshot.");
  const e=createEvidence(i); assertEvidenceReady(e);
  const p:EvidencePayload=immutable({sourceId:e.sourceId,snapshotId:i.snapshotId,locator:e.locator,excerpt:e.excerpt,evidenceHash:contentFingerprint({excerpt:e.excerpt,locator:e.locator,snapshot:s.fingerprint}),capturedAt:e.capturedAt,verificationStatus:e.verificationStatus??"UNVERIFIED",...Object.fromEntries(["page","printedPage","section","table","row","parameter","value","unit","materialManufacturer","materialGrade","testMethod","testCondition","flowDirection","extractionMethod","extractionConfidence"].filter(k=>(e as any)[k]!==undefined).map(k=>[k,(e as any)[k]]))});
  const lineage=uniqueLineage([...s.lineage,{type:"SNAPSHOT",id:s.aggregateId,version:s.version,fingerprint:s.fingerprint}]);
  return this.store.append({aggregateType:"EVIDENCE",aggregateId:e.id,version:1,state:"INGESTED",payload:p,lineage,actor:a,reason});
 }
 verifyEvidence(id:string,a:AuditActor,reason="evidence verification"){
  const c=this.store.get<EvidencePayload>("EVIDENCE",id); invariant(c!==null,"V8_FOUNDATION_EVIDENCE_NOT_FOUND",`Evidence ${id} not found.`); invariant(c.state==="INGESTED"||c.state==="AUDITED"||c.state==="REQUIRES_REVIEW","V8_FOUNDATION_EVIDENCE_NOT_AUDITABLE","Evidence is not verifiable.");
  const source=this.store.get<Source>("SOURCE",c.payload.sourceId); invariant(source!==null,"V8_FOUNDATION_SOURCE_NOT_FOUND","Evidence source missing.");
  const snap=this.store.get<SnapshotPayload>("SNAPSHOT",c.payload.snapshotId); invariant(snap!==null&&snap.state==="SEALED","V8_FOUNDATION_SNAPSHOT_NOT_SEALED","Evidence snapshot is not sealed.");
  assertEvidenceReady({...c.payload,id:c.aggregateId,sourceId:c.payload.sourceId,ingestion:"INGESTED"} as Evidence);
  recordVerification(this.store,"EVIDENCE",id,"PASS",["source exists","sealed snapshot exists","exact locator present","raw excerpt present","evidence hash bound to snapshot"],a,c.payload.evidenceHash);
  const audited=this.store.append({aggregateType:"EVIDENCE",aggregateId:id,version:c.version+1,state:"AUDITED",payload:c.payload,lineage:c.lineage,actor:a,reason});
  return this.store.append({aggregateType:"EVIDENCE",aggregateId:id,version:audited.version+1,state:"VERIFIED",payload:{...c.payload,verificationStatus:"VERIFIED"},lineage:audited.lineage,actor:a,reason});
 }
 createClaim(c:Claim,a:AuditActor,reason="claim verification"){
  const p=createClaim({...c,status:"REQUIRES_REVIEW"});
  const er=p.evidenceIds.map(id=>this.store.get<EvidencePayload>("EVIDENCE",id)); invariant(er.every(r=>r!==null&&r.state==="VERIFIED"),"V8_FOUNDATION_CLAIM_EVIDENCE_NOT_VERIFIED","Every cited evidence must be verified.");
  assertClaimReady({...p,epistemicLevel:(c as any).epistemicLevel,isUniversal:(c as any).isUniversal} as any,er as FoundationRecord<EvidencePayload>[]);
  const checks=["all cited evidence exists","all cited evidence is verified","claim provenance is explicit"]; const verification=recordVerification(this.store,"CLAIM",p.id,"PASS",checks,a);
  invariant(verification.state==="VERIFIED","V8_FOUNDATION_CLAIM_VERIFICATION_FAILED","Claim verification did not pass.");
  const lineage=uniqueLineage((er as FoundationRecord<EvidencePayload>[]).flatMap(r=>[...r.lineage,{type:"EVIDENCE",id:r.aggregateId,version:r.version,fingerprint:r.fingerprint}]));
  const payload:ClaimPayload=immutable({statement:p.statement,evidenceIds:p.evidenceIds,...((c as any).scope?{scope:(c as any).scope}:{}),...((c as any).conditions?{conditions:[...(c as any).conditions]}:{}),...((c as any).units?{units:[...(c as any).units]}:{}),...((c as any).confidence?{confidence:(c as any).confidence}:{}),...((c as any).epistemicLevel?{epistemicLevel:(c as any).epistemicLevel}:{}),...((c as any).isUniversal!==undefined?{isUniversal:(c as any).isUniversal}: {})});
  return this.store.append({aggregateType:"CLAIM",aggregateId:p.id,version:1,state:"VERIFIED",payload,lineage,actor:a,reason});
 }
 createKnowledge(k:Knowledge,a:AuditActor,reason="knowledge approval"){
  const p=createKnowledge(k); invariant(p.status==="APPROVED","V8_FOUNDATION_KNOWLEDGE_NOT_APPROVED","Only approved knowledge can persist.");
  const cr=p.claimIds.map(id=>this.store.get<ClaimPayload>("CLAIM",id)); invariant(cr.every(r=>r!==null&&r.state==="VERIFIED"),"V8_FOUNDATION_KNOWLEDGE_CLAIM_NOT_VERIFIED","Every supporting claim must be verified.");
  const lineage=uniqueLineage((cr as FoundationRecord<ClaimPayload>[]).flatMap(r=>[...r.lineage,{type:"CLAIM",id:r.aggregateId,version:r.version,fingerprint:r.fingerprint}]));
  return this.store.append({aggregateType:"KNOWLEDGE",aggregateId:p.id,version:1,state:"VERIFIED",payload:{proposition:p.proposition,claimIds:p.claimIds},lineage,actor:a,reason});
 }
}
