import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { evidenceId, sourceId, type EvidenceId, type SourceId } from "./primitives.js";

export type EvidenceIngestionState = "INGESTED" | "AUDITED" | "REJECTED" | "UNKNOWN";
export type EvidenceVerificationStatus = "UNVERIFIED" | "VERIFIED" | "REJECTED" | "CONDITION_DEPENDENT" | "NOT_COMPARABLE" | "INSUFFICIENT_EVIDENCE" | "CONFLICTING_EVIDENCE";
export interface Evidence {
  id: EvidenceId; sourceId: SourceId; locator: string; excerpt: string; ingestion: Exclude<EvidenceIngestionState, "UNKNOWN">; capturedAt: string;
  verificationStatus?: EvidenceVerificationStatus; page?: number; printedPage?: string; section?: string; table?: string; row?: string;
  parameter?: string; value?: string | number; unit?: string; materialManufacturer?: string; materialGrade?: string; testMethod?: string;
  testCondition?: string; flowDirection?: string; extractionMethod?: "MANUAL_TRANSCRIPTION" | "TEXT_EXTRACTION" | "TABLE_EXTRACTION" | "OCR";
  extractionConfidence?: "HIGH" | "MEDIUM" | "LOW";
}
export function createEvidence(i: Omit<Evidence, "id"> & { id?: string }): Readonly<Evidence> {
  const ingestion = requireKnown(i.ingestion, "V8_EVIDENCE_UNKNOWN", "evidence.ingestion");
  invariant(i.excerpt.trim().length > 0, "V8_EVIDENCE_EMPTY", "Evidence excerpt cannot be empty.");
  invariant(i.locator.trim().length > 0, "V8_EVIDENCE_LOCATOR_EMPTY", "Evidence locator cannot be empty.");
  if (i.page !== undefined) invariant(Number.isInteger(i.page) && i.page > 0, "V8_EVIDENCE_PAGE_INVALID", "PDF page must be positive.");
  return immutable({ ...i, id: evidenceId(i.id ?? `${i.sourceId}:${i.locator}:${i.capturedAt}`), sourceId: sourceId(i.sourceId), ingestion, verificationStatus: i.verificationStatus ?? "UNVERIFIED" });
}
