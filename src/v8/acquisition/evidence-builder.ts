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

function evidenceIdentityInput(
  source: string,
  snapshotId: string,
  snapshotContentHash: string | undefined,
  candidate: ExtractedEvidenceCandidate,
): Record<string, unknown> {
  return {
    source,
    snapshotId,
    snapshotContentHash,
    locator: candidate.locator,
    excerpt: candidate.excerpt,

    page: candidate.page,
    printedPage: candidate.printedPage,

    section: candidate.section,
    table: candidate.table,
    row: candidate.row,

    parameter: candidate.parameter,
    value: candidate.value,
    unit: candidate.unit,

    materialManufacturer:
      candidate.materialManufacturer,
    materialGrade:
      candidate.materialGrade,

    testMethod:
      candidate.testMethod,
    testCondition:
      candidate.testCondition,
    flowDirection:
      candidate.flowDirection,

    extractionConfidence:
      candidate.extractionConfidence,
  };
}

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
   *   exact extracted evidence fields
   *
   * Semantic source metadata is deliberately included in the
   * identity input so that two otherwise identical excerpts
   * cannot collapse into the same Evidence identity when their
   * technical conditions or material metadata differ.
   */
  return candidates.map((candidate) => {
    const evidenceHash = contentFingerprint(
      evidenceIdentityInput(
        source,
        snapshotId,
        snapshot.contentHash,
        candidate,
      ),
    );

    return {
      sourceId: sourceId(source),
      snapshotId,
      locator: candidate.locator,
      excerpt: candidate.excerpt,
      evidenceHash,
      capturedAt: snapshot.capturedAt,
      verificationStatus: "UNVERIFIED",

      page: candidate.page,
      printedPage: candidate.printedPage,

      section: candidate.section,
      table: candidate.table,
      row: candidate.row,

      parameter: candidate.parameter,
      value: candidate.value,
      unit: candidate.unit,

      materialManufacturer:
        candidate.materialManufacturer,
      materialGrade:
        candidate.materialGrade,

      testMethod:
        candidate.testMethod,
      testCondition:
        candidate.testCondition,
      flowDirection:
        candidate.flowDirection,

      extractionMethod: "TEXT_EXTRACTION",
      extractionConfidence:
        candidate.extractionConfidence,
    };
  });
}

export function evidenceAggregateId(
  source: string,
  snapshotId: string,
  candidate: ExtractedEvidenceCandidate,
  snapshotContentHash?: string,
): string {
  return evidenceId(
    contentFingerprint(
      evidenceIdentityInput(
        source,
        snapshotId,
        snapshotContentHash,
        candidate,
      ),
    ),
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

          page: payload.page,
          printedPage: payload.printedPage,

          section: payload.section,
          table: payload.table,
          row: payload.row,

          parameter: payload.parameter,
          value: payload.value,
          unit: payload.unit,

          materialManufacturer:
            payload.materialManufacturer,
          materialGrade:
            payload.materialGrade,

          testMethod:
            payload.testMethod,
          testCondition:
            payload.testCondition,
          flowDirection:
            payload.flowDirection,

          extractionConfidence:
            payload.extractionConfidence ?? "LOW",
        },
        snapshot.contentHash,
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