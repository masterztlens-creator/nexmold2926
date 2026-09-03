import { nonEmpty } from "../domain/primitives.js";
import { invariant, immutable } from "../constitution/invariants.js";
import { createSource, type Source } from "../domain/source.js";
import { createEvidence, type Evidence } from "../domain/evidence.js";
import { createClaim, type Claim } from "../domain/claim.js";
import { contentFingerprint } from "./hash.js";
import type { AuditActor, ClaimPayload, EvidencePayload, FoundationRecord, FoundationStore, LineageLink, SnapshotPayload } from "./types.js";

export interface SnapshotInput {
  readonly source: Source;
  readonly capturedAt: string;
  readonly locator: string;
  readonly content?: string;
  readonly metadataOnly: boolean;
}

export class FoundationService {
  constructor(private readonly store: FoundationStore) {}

  registerSource(source: Source, actor: AuditActor, reason = "source registration"): FoundationRecord<Source> {
    const payload = createSource(source);
    return this.store.append({ aggregateType: "SOURCE", aggregateId: payload.id, version: 1, state: "REGISTERED", payload, lineage: [], actor, reason });
  }

  captureSnapshot(input: SnapshotInput, actor: AuditActor, reason = "snapshot capture"): FoundationRecord<SnapshotPayload> {
    nonEmpty(input.capturedAt, "snapshot.capturedAt");
    nonEmpty(input.locator, "snapshot.locator");
    if (input.metadataOnly) invariant(input.content === undefined, "V8_FOUNDATION_METADATA_PAYLOAD_FORBIDDEN", "Metadata-only sources cannot persist payload.");
    const payload: SnapshotPayload = immutable({
      sourceId: input.source.id,
      capturedAt: input.capturedAt,
      locator: input.locator.trim(),
      contentHash: contentFingerprint(input.content ?? { locator: input.locator, capturedAt: input.capturedAt }),
      ...(input.content === undefined ? {} : { payload: input.content }),
      metadataOnly: input.metadataOnly,
    });
    const snapshotId = `snapshot:${input.source.id}:${payload.contentHash}`;
    const sourceRecord = this.store.get<Source>("SOURCE", input.source.id);
    if (sourceRecord === null) throw new Error(`V8_FOUNDATION_SOURCE_NOT_REGISTERED: Source ${input.source.id} is not registered.`);
    const lineage: LineageLink[] = [{ type: "SOURCE", id: sourceRecord.aggregateId, version: sourceRecord.version, fingerprint: sourceRecord.fingerprint }];
    return this.store.append({ aggregateType: "SNAPSHOT", aggregateId: snapshotId, version: 1, state: "CAPTURED", payload, lineage, actor, reason });
  }

  sealSnapshot(snapshotId: string, actor: AuditActor, reason = "snapshot sealed"): FoundationRecord<SnapshotPayload> {
    const current = this.store.get<SnapshotPayload>("SNAPSHOT", snapshotId);
    if (current === null) throw new Error(`V8_FOUNDATION_SNAPSHOT_NOT_FOUND: Snapshot ${snapshotId} not found.`);
    return this.store.append({ aggregateType: "SNAPSHOT", aggregateId: snapshotId, version: current.version + 1, state: "SEALED", payload: current.payload, lineage: current.lineage, actor, reason });
  }

  ingestEvidence(input: Omit<Evidence, "id"> & { id?: string; snapshotId: string }, actor: AuditActor, reason = "evidence ingestion"): FoundationRecord<EvidencePayload> {
    const snapshot = this.store.get<SnapshotPayload>("SNAPSHOT", input.snapshotId);
    if (snapshot === null || snapshot.state !== "SEALED") throw new Error("V8_FOUNDATION_SNAPSHOT_NOT_SEALED: Evidence may only be ingested from a sealed snapshot.");
    const evidence = createEvidence(input);
    const payload: EvidencePayload = immutable({
      sourceId: evidence.sourceId,
      snapshotId: input.snapshotId,
      locator: evidence.locator,
      excerpt: evidence.excerpt,
      evidenceHash: contentFingerprint({ excerpt: evidence.excerpt, locator: evidence.locator, snapshot: snapshot.fingerprint }),
      capturedAt: evidence.capturedAt,
    });
    const lineage: LineageLink[] = [
      ...snapshot.lineage,
      { type: "SNAPSHOT", id: snapshot.aggregateId, version: snapshot.version, fingerprint: snapshot.fingerprint },
    ];
    return this.store.append({ aggregateType: "EVIDENCE", aggregateId: evidence.id, version: 1, state: "INGESTED", payload, lineage, actor, reason });
  }

  auditEvidence(evidenceId: string, actor: AuditActor, reason = "evidence audit"): FoundationRecord<EvidencePayload> {
    const current = this.store.get<EvidencePayload>("EVIDENCE", evidenceId);
    if (current === null) throw new Error(`V8_FOUNDATION_EVIDENCE_NOT_FOUND: Evidence ${evidenceId} not found.`);
    invariant(current.state === "INGESTED" || current.state === "REQUIRES_REVIEW", "V8_FOUNDATION_EVIDENCE_NOT_AUDITABLE", "Evidence is not in an auditable state.");
    return this.store.append({ aggregateType: "EVIDENCE", aggregateId: evidenceId, version: current.version + 1, state: "AUDITED", payload: current.payload, lineage: current.lineage, actor, reason });
  }

  createClaim(claim: Claim, actor: AuditActor, reason = "claim verification"): FoundationRecord<ClaimPayload> {
    const payload = createClaim(claim);
    const evidenceRecords = payload.evidenceIds.map(id => this.store.get<EvidencePayload>("EVIDENCE", id));
    invariant(evidenceRecords.every(r => r !== null && r.state === "AUDITED"), "V8_FOUNDATION_CLAIM_EVIDENCE_NOT_AUDITED", "A claim may only be persisted when every cited evidence record is AUDITED.");
    const auditedEvidence = evidenceRecords.filter((r): r is FoundationRecord<EvidencePayload> => r !== null);
    const lineage: LineageLink[] = [];
    for (const record of auditedEvidence) {
      for (const link of record.lineage) lineage.push(link);
      lineage.push({ type: "EVIDENCE", id: record.aggregateId, version: record.version, fingerprint: record.fingerprint });
    }
    const uniqueLineage = Array.from(new Map(lineage.map(link => [`${link.type}:${link.id}:${link.version}`, link])).values());
    return this.store.append({ aggregateType: "CLAIM", aggregateId: payload.id, version: 1, state: "VERIFIED", payload: { statement: payload.statement, evidenceIds: payload.evidenceIds }, lineage: uniqueLineage, actor, reason });
  }

  get storeView(): FoundationStore { return this.store; }
}
