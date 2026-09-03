import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { evidenceId, sourceId, type EvidenceId, type SourceId } from "./primitives.js";

export type EvidenceIngestionState = "INGESTED" | "AUDITED" | "REJECTED" | "UNKNOWN";

export interface Evidence {
  readonly id: EvidenceId;
  readonly sourceId: SourceId;
  readonly locator: string;
  readonly excerpt: string;
  readonly ingestion: EvidenceIngestionState;
  readonly capturedAt: string;
}

export function createEvidence(input: Omit<Evidence, "id"> & { id?: string }): Readonly<Evidence> {
  const ingestion = requireKnown(input.ingestion, "V8_EVIDENCE_UNKNOWN", "evidence.ingestion");
  invariant(input.excerpt.trim().length > 0, "V8_EVIDENCE_EMPTY", "Evidence excerpt cannot be empty.");
  return immutable({
    ...input,
    id: evidenceId(input.id ?? `${input.sourceId}:${input.locator}:${input.capturedAt}`),
    sourceId: sourceId(input.sourceId),
    ingestion,
  });
}
