import { contentFingerprint } from "../foundation/hash.js";
import {
  evidenceId,
  sourceId,
  fingerprint,
} from "../domain/primitives.js";
import type {
  EvidencePayload,
  FoundationStore,
  SnapshotPayload,
} from "../foundation/types.js";
import type {
  ExtractedEvidenceCandidate,
} from "./types.js";

export function buildEvidencePayloads(
  source: string,
  snapshotId: string,
  snapshot: SnapshotPayload,
  candidates: readonly ExtractedEvidenceCandidate[],
): readonly EvidencePayload[] {
  /*
   * Evidence identity is bound to:
   *
   *   SOURCE
   *   SNAPSHOT ID
   *   SNAPSHOT CONTENT HASH
   *   extracted evidence fields
   *
   * This prevents an otherwise identical-looking Evidence record
   * from becoming detached from the exact Snapshot content that
   * produced it.
   */
  return candidates.map((candidate) => {
    const evidenceHash = contentFingerprint({
      source,
      snapshotId,
      snapshotContentHash: snapshot.contentHash,
      locator: candidate.locator,
      excerpt: candidate.excerpt,
      parameter: candidate.parameter,
      value: candidate.value,
      unit: candidate.unit,
    });

    return {
      sourceId: sourceId(source),
      snapshotId,
      locator: candidate.locator,
      excerpt: candidate.excerpt,
      evidenceHash,
      capturedAt: snapshot.capturedAt,
      verificationStatus: "UNVERIFIED",
      section: candidate.section,
      parameter: candidate.parameter,
      value: candidate.value,
      unit: candidate.unit,
      extractionMethod: "TEXT_EXTRACTION",
      extractionConfidence: candidate.extractionConfidence,
    };
  });
}

export function evidenceAggregateId(
  source: string,
  snapshotId: string,
  candidate: ExtractedEvidenceCandidate,
): string {
  return evidenceId(
    contentFingerprint({
      source,
      snapshotId,
      locator: candidate.locator,
      excerpt: candidate.excerpt,
    }),
  ).toString();
}

export function appendEvidence(
  store: FoundationStore,
  source: string,
  snapshotRecordId: string,
  snapshot: SnapshotPayload,
  candidates: readonly ExtractedEvidenceCandidate[],
  actorId = "v8-acquisition",
): readonly EvidencePayload[] {
  const payloads = buildEvidencePayloads(
    source,
    snapshotRecordId,
    snapshot,
    candidates,
  );

  const snapshotRecord = store.get(
    "SNAPSHOT",
    snapshotRecordId,
  );

  if (!snapshotRecord) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_NOT_FOUND",
    );
  }

  if (snapshotRecord.state !== "SEALED") {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_NOT_SEALED",
    );
  }

  for (const payload of payloads) {
    store.append({
      aggregateType: "EVIDENCE",
      aggregateId: evidenceAggregateId(
        source,
        snapshotRecordId,
        {
          locator: payload.locator,
          excerpt: payload.excerpt,
          parameter: payload.parameter,
          value: payload.value,
          unit: payload.unit,
          extractionConfidence:
            payload.extractionConfidence ?? "LOW",
        },
      ),
      version: 1,
      state: "INGESTED",
      payload,
      lineage: [
        {
          type: "SOURCE",
          id: source,
          version: 1,
          fingerprint:
            store.get("SOURCE", source)?.fingerprint ??
            fingerprint("missing"),
        },
        {
          type: "SNAPSHOT",
          id: snapshotRecordId,
          version: snapshotRecord.version,
          fingerprint: snapshotRecord.fingerprint,
        },
      ],
      actor: {
        id: actorId,
        role: "INGESTOR",
      },
      reason:
        "V8-05 web acquisition evidence ingestion",
    });
  }

  return payloads;
}