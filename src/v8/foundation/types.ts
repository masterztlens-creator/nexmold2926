import type {
  ClaimId,
  EvidenceId,
  Fingerprint,
  SourceId,
} from "../domain/primitives.js";

import type {
  ClaimEpistemicLevel,
} from "../domain/claim.js";

export type AggregateType =
  | "SOURCE"
  | "SNAPSHOT"
  | "EVIDENCE"
  | "CLAIM"
  | "KNOWLEDGE"
  | "RULE"
  | "POLICY"
  | "ELIGIBILITY"
  | "PUBLICATION"
  | "PROJECTION"
  | "RELEASE"
  | "VERIFICATION";

export type FoundationState =
  | "REGISTERED"
  | "CAPTURED"
  | "SEALED"
  | "INGESTED"
  | "AUDITED"
  | "VERIFIED"
  | "PROPOSED"
  | "APPROVED"
  | "REJECTED"
  | "REQUIRES_REVIEW"
  | "RETIRED";

export type AuditRole =
  | "SYSTEM"
  | "INGESTOR"
  | "AUDITOR"
  | "VERIFIER"
  | "GOVERNOR";

export interface AuditActor {
  readonly id: string;
  readonly role: AuditRole;
}

export interface LineageLink {
  readonly type: AggregateType;
  readonly id: string;
  readonly version: number;
  readonly fingerprint: Fingerprint;
}

export interface FoundationRecord<T = unknown> {
  readonly recordId: string;
  readonly aggregateType: AggregateType;
  readonly aggregateId: string;
  readonly version: number;
  readonly state: FoundationState;
  readonly payload: Readonly<T>;
  readonly lineage: readonly LineageLink[];
  readonly previousFingerprint: Fingerprint | null;
  readonly fingerprint: Fingerprint;
  readonly actor: AuditActor;
  readonly reason: string;
  readonly recordedAt: string;
}

export interface FoundationStore {
  append<T>(
    record: Omit<
      FoundationRecord<T>,
      | "recordId"
      | "fingerprint"
      | "recordedAt"
      | "previousFingerprint"
    > & {
      readonly recordedAt?: string;
    },
  ): FoundationRecord<T>;

  get<T>(
    type: AggregateType,
    id: string,
    version?: number,
  ): FoundationRecord<T> | null;

  history(
    type: AggregateType,
    id: string,
  ): readonly FoundationRecord[];

  auditTrail(): readonly FoundationRecord[];

  verifyChain(): void;
}

export interface SnapshotPayload {
  readonly sourceId: SourceId;
  readonly capturedAt: string;
  readonly locator: string;
  readonly contentHash: Fingerprint;
  readonly metadataOnly: boolean;

  readonly requestedUrl?: string;
  readonly finalUrl?: string;
  readonly redirectChain?: readonly string[];
  readonly mediaType?: string;
  readonly byteLength?: number;
  readonly blobLocator?: string;
  readonly payload?: string;
}

export interface EvidencePayload {
  readonly sourceId: SourceId;
  readonly snapshotId: string;
  readonly locator: string;
  readonly excerpt: string;
  readonly evidenceHash: Fingerprint;
  readonly capturedAt: string;

  readonly verificationStatus:
    | "UNVERIFIED"
    | "VERIFIED"
    | "REJECTED"
    | "CONDITION_DEPENDENT"
    | "NOT_COMPARABLE"
    | "INSUFFICIENT_EVIDENCE"
    | "CONFLICTING_EVIDENCE";

  readonly page?: number;
  readonly printedPage?: string;
  readonly section?: string;
  readonly table?: string;
  readonly row?: string;
  readonly parameter?: string;
  readonly value?: string | number;
  readonly unit?: string;

  readonly materialManufacturer?: string;
  readonly materialGrade?: string;
  readonly testMethod?: string;
  readonly testCondition?: string;
  readonly flowDirection?: string;

  readonly extractionMethod?:
    | "MANUAL_TRANSCRIPTION"
    | "TEXT_EXTRACTION"
    | "TABLE_EXTRACTION"
    | "OCR";

  readonly extractionConfidence?:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
}

export interface ClaimPayload {
  readonly statement: string;
  readonly evidenceIds: readonly EvidenceId[];

  readonly scope?: string;
  readonly conditions?: readonly string[];
  readonly units?: readonly string[];

  readonly confidence?:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  readonly epistemicLevel?: ClaimEpistemicLevel;

  readonly isUniversal?: boolean;
}

export interface KnowledgePayload {
  readonly proposition: string;
  readonly claimIds: readonly ClaimId[];
}

export interface VerificationPayload {
  readonly targetType:
    | "SOURCE"
    | "SNAPSHOT"
    | "EVIDENCE"
    | "CLAIM";

  readonly targetId: string;

  readonly decision:
    | "PASS"
    | "FAIL"
    | "REQUIRES_REVIEW";

  readonly checks: readonly string[];

  readonly verifier: AuditActor;

  readonly evidenceHash?: Fingerprint;
}