import { contentFingerprint } from "../foundation/hash.js";
import { sourceId } from "../domain/primitives.js";
import type {
  FoundationStore,
  SnapshotPayload,
} from "../foundation/types.js";
import type {
  ExtractedEvidenceCandidate,
  FetchedPage,
  AcquisitionConfig,
  AcquisitionResult,
} from "./types.js";
import {
  evidenceAggregateId,
  buildEvidencePayloads,
} from "./evidence-builder.js";
import { HttpPageFetcher } from "./page-fetcher.js";

export function ingestFetchedPage(
  store: FoundationStore,
  page: FetchedPage,
  candidates: readonly ExtractedEvidenceCandidate[],
  config: AcquisitionConfig = {},
): AcquisitionResult {
  const actorId = config.actorId ?? "v8-acquisition";
  const maxBytes = config.maxBytes ?? 5_000_000;

  /*
   * V8-05 fail-closed acquisition boundary.
   *
   * A non-2xx response is not a valid source snapshot and must never
   * progress into Snapshot/Evidence persistence.
   */
  if (page.status < 200 || page.status >= 300) {
    throw new Error(
      `V8_ACQUISITION_HTTP_STATUS_${page.status}`,
    );
  }

  if (page.bytes.byteLength > maxBytes) {
    throw new Error("V8_ACQUISITION_RESPONSE_TOO_LARGE");
  }

  /*
   * Snapshot integrity is based on the original response bytes,
   * not on the decoded text representation.
   */
  const contentHash = HttpPageFetcher.contentHash(page.bytes);

  const sid = sourceId(page.finalUrl).toString();

  const existingSource = store.get("SOURCE", sid);

  if (!existingSource) {
    store.append({
      aggregateType: "SOURCE",
      aggregateId: sid,
      version: 1,
      state: "REGISTERED",
      payload: {
        url: page.finalUrl,
        kind: "WEB",
        firstSeenAt: page.fetchedAt,
      },
      lineage: [],
      actor: {
        id: actorId,
        role: "INGESTOR",
      },
      reason: "V8-05 web source registration",
    });
  }

  /*
   * Snapshot identity includes the raw-byte content fingerprint.
   * Therefore identical source/URL/content resolves to the same
   * immutable Snapshot identity, while changed content produces a
   * distinct Snapshot.
   */
  const snapshotId = `snapshot:${contentFingerprint({
    sourceId: sid,
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    contentHash,
  })}`;

  const snapshot: SnapshotPayload = {
    sourceId: sourceId(sid),
    capturedAt: page.fetchedAt,
    locator: page.finalUrl,
    contentHash,
    metadataOnly: false,
    requestedUrl: page.requestedUrl,
    finalUrl: page.finalUrl,
    redirectChain: page.redirectChain,
    mediaType: page.mediaType,
    byteLength: page.bytes.byteLength,
    payload: page.body,
  };

  const existingSnapshot = store.get(
    "SNAPSHOT",
    snapshotId,
  );

  if (!existingSnapshot) {
    const sourceRecord = store.get("SOURCE", sid);

    if (!sourceRecord) {
      throw new Error("V8_ACQUISITION_SOURCE_NOT_FOUND");
    }

    const captured = store.append({
      aggregateType: "SNAPSHOT",
      aggregateId: snapshotId,
      version: 1,
      state: "CAPTURED",
      payload: snapshot,
      lineage: [
        {
          type: "SOURCE",
          id: sid,
          version: sourceRecord.version,
          fingerprint: sourceRecord.fingerprint,
        },
      ],
      actor: {
        id: actorId,
        role: "INGESTOR",
      },
      reason: "V8-05 web page capture",
    });

    store.append({
      aggregateType: "SNAPSHOT",
      aggregateId: snapshotId,
      version: 2,
      state: "SEALED",
      payload: snapshot,
      lineage: [
        {
          type: "SOURCE",
          id: sid,
          version: sourceRecord.version,
          fingerprint: sourceRecord.fingerprint,
        },
      ],
      actor: {
        id: actorId,
        role: "INGESTOR",
      },
      reason: "V8-05 immutable snapshot seal",
    });

    void captured;
  }

  const sealed = store.get(
    "SNAPSHOT",
    snapshotId,
  );

  if (!sealed || sealed.state !== "SEALED") {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_NOT_SEALED",
    );
  }

  /*
   * Evidence construction is explicitly bound to the exact Snapshot
   * payload and therefore to its raw-byte contentHash.
   */
  const evidence = buildEvidencePayloads(
    sid,
    snapshotId,
    snapshot,
    candidates,
  );

  const sourceRecord = store.get("SOURCE", sid);

  if (!sourceRecord) {
    throw new Error("V8_ACQUISITION_SOURCE_NOT_FOUND");
  }

  for (const payload of evidence) {
    const aggregateId = evidenceAggregateId(
      sid,
      snapshotId,
      {
        locator: payload.locator,
        excerpt: payload.excerpt,
        parameter: payload.parameter,
        value: payload.value,
        unit: payload.unit,
        extractionConfidence:
          payload.extractionConfidence ?? "LOW",
      },
    );

    if (!store.get("EVIDENCE", aggregateId)) {
      store.append({
        aggregateType: "EVIDENCE",
        aggregateId,
        version: 1,
        state: "INGESTED",
        payload,
        lineage: [
          {
            type: "SOURCE",
            id: sid,
            version: sourceRecord.version,
            fingerprint: sourceRecord.fingerprint,
          },
          {
            type: "SNAPSHOT",
            id: snapshotId,
            version: sealed.version,
            fingerprint: sealed.fingerprint,
          },
        ],
        actor: {
          id: actorId,
          role: "INGESTOR",
        },
        reason:
          "V8-05 extracted web evidence ingestion",
      });
    }
  }

  return {
    sourceId: sid,
    snapshotId,
    snapshot,
    evidence,
  };
}