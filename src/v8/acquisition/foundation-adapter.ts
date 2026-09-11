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

  if (page.status < 200 || page.status >= 300) {
    throw new Error(`V8_ACQUISITION_HTTP_STATUS_${page.status}`);
  }

  if (page.bytes.byteLength > maxBytes) {
    throw new Error("V8_ACQUISITION_RESPONSE_TOO_LARGE");
  }

  const contentHash = HttpPageFetcher.contentHash(page.bytes);

  // SOURCE identity is the normalized requested source, not the resolved redirect target.
  // Redirect resolution belongs to Snapshot provenance.
  const sid = sourceId(page.requestedUrl).toString();

  const existingSource = store.get("SOURCE", sid);

  if (!existingSource) {
    store.append({
      aggregateType: "SOURCE",
      aggregateId: sid,
      version: 1,
      state: "REGISTERED",
      payload: {
        url: page.requestedUrl,
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

  const existingSnapshot = store.get("SNAPSHOT", snapshotId);

  if (!existingSnapshot) {
    const sourceRecord = store.get("SOURCE", sid);

    if (!sourceRecord) {
      throw new Error("V8_ACQUISITION_SOURCE_NOT_FOUND");
    }

    store.append({
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
  }

  const sealed = store.get<SnapshotPayload>(
    "SNAPSHOT",
    snapshotId,
  );

  if (!sealed || sealed.state !== "SEALED") {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_NOT_SEALED",
    );
  }

  /*
   * V8-10-C:
   * Once a Snapshot identity already exists, the persisted SEALED payload
   * is the authoritative immutable representation.
   *
   * Do not return or use the newly reconstructed transient `snapshot`,
   * because fields such as capturedAt / redirectChain may differ from the
   * original immutable record even though snapshotId is identical.
   */
  const persistedSnapshot = sealed.payload;

  const evidence = buildEvidencePayloads(
    sid,
    snapshotId,
    persistedSnapshot,
    candidates,
  );

  const sourceRecord = store.get("SOURCE", sid);

  if (!sourceRecord) {
    throw new Error(
      "V8_ACQUISITION_SOURCE_NOT_FOUND",
    );
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
      persistedSnapshot.contentHash,
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
    snapshot: persistedSnapshot,
    evidence,
  };
}