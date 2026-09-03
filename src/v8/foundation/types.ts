import type { ClaimId, EvidenceId, Fingerprint, SourceId } from "../domain/primitives.js";

export type AggregateType = "SOURCE" | "SNAPSHOT" | "EVIDENCE" | "CLAIM" | "KNOWLEDGE" | "RULE" | "POLICY";
export type FoundationState = "REGISTERED" | "CAPTURED" | "SEALED" | "INGESTED" | "AUDITED" | "VERIFIED" | "PROPOSED" | "APPROVED" | "REJECTED" | "REQUIRES_REVIEW" | "RETIRED";
export interface LineageLink { readonly type: AggregateType; readonly id: string; readonly version: number; readonly fingerprint: Fingerprint; }
export interface AuditActor { readonly id: string; readonly role: "SYSTEM" | "INGESTOR" | "AUDITOR" | "VERIFIER" | "GOVERNOR"; }
export interface FoundationRecord<TPayload = unknown> { readonly recordId: string; readonly aggregateType: AggregateType; readonly aggregateId: string; readonly version: number; readonly state: FoundationState; readonly payload: Readonly<TPayload>; readonly lineage: readonly LineageLink[]; readonly previousFingerprint: Fingerprint | null; readonly fingerprint: Fingerprint; readonly actor: AuditActor; readonly reason: string; readonly recordedAt: string; }
export interface FoundationStore { append<T>(record: Omit<FoundationRecord<T>, "recordId" | "fingerprint" | "recordedAt" | "previousFingerprint"> & { readonly recordedAt?: string }): FoundationRecord<T>; get<T>(aggregateType: AggregateType, aggregateId: string, version?: number): FoundationRecord<T> | null; history(aggregateType: AggregateType, aggregateId: string): readonly FoundationRecord[]; auditTrail(): readonly FoundationRecord[]; }
export interface SnapshotPayload { readonly sourceId: SourceId; readonly capturedAt: string; readonly locator: string; readonly contentHash: Fingerprint; readonly payload?: string; readonly metadataOnly: boolean; }
export interface EvidencePayload { readonly sourceId: SourceId; readonly snapshotId: string; readonly locator: string; readonly excerpt: string; readonly evidenceHash: Fingerprint; readonly capturedAt: string; }
export interface ClaimPayload { readonly statement: string; readonly evidenceIds: readonly EvidenceId[]; }
export interface KnowledgePayload { readonly proposition: string; readonly claimIds: readonly ClaimId[]; }
