
import { contentFingerprint } from "../foundation/hash.js";
import { sourceId } from "../domain/primitives.js";

import type {
  FoundationStore,
  SnapshotPayload,
  EvidencePayload,
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

const DEFAULT_ACTOR_ID = "v8-acquisition";
const DEFAULT_MAX_BYTES = 5_000_000;

function requireNonEmpty(
  value: string,
  code: string,
): void {
  if (
    typeof value !== "string" ||
    value.trim().length === 0
  ) {
    throw new Error(code);
  }
}

function assertSnapshotMapping(
  snapshot: SnapshotPayload,
  expectedSourceId: string,
  expectedContentHash: string,
  expectedRequestedUrl: string,
  expectedFinalUrl: string,
): void {
  if (
    snapshot.sourceId !== expectedSourceId
  ) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_SOURCE_MAPPING_CONFLICT",
    );
  }

  if (
    snapshot.contentHash !== expectedContentHash
  ) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_CONTENT_HASH_CONFLICT",
    );
  }

  if (
    snapshot.requestedUrl !== expectedRequestedUrl ||
    snapshot.finalUrl !== expectedFinalUrl
  ) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_URL_MAPPING_CONFLICT",
    );
  }
}

function assertEvidenceMapping(
  payload: EvidencePayload,
  expectedSourceId: string,
  expectedSnapshotId: string,
  expectedAggregateId: string,
  actualAggregateId: string,
): void {
  if (
    actualAggregateId !== expectedAggregateId
  ) {
    throw new Error(
      "V8_ACQUISITION_EVIDENCE_ID_MAPPING_CONFLICT",
    );
  }

  if (
    payload.sourceId !== expectedSourceId
  ) {
    throw new Error(
      "V8_ACQUISITION_EVIDENCE_SOURCE_MAPPING_CONFLICT",
    );
  }

  if (
    payload.snapshotId !== expectedSnapshotId
  ) {
    throw new Error(
      "V8_ACQUISITION_EVIDENCE_SNAPSHOT_MAPPING_CONFLICT",
    );
  }

  requireNonEmpty(
    payload.evidenceHash,
    "V8_ACQUISITION_EVIDENCE_HASH_MISSING",
  );
}

export function ingestFetchedPage(
  store: FoundationStore,
  page: FetchedPage,
  candidates: readonly ExtractedEvidenceCandidate[],
  config: AcquisitionConfig = {},
): AcquisitionResult {
  const actorId =
    config.actorId ??
    DEFAULT_ACTOR_ID;

  const maxBytes =
    config.maxBytes ??
    DEFAULT_MAX_BYTES;

  requireNonEmpty(
    actorId,
    "V8_ACQUISITION_ACTOR_ID_MISSING",
  );

  requireNonEmpty(
    page.requestedUrl,
    "V8_ACQUISITION_REQUESTED_URL_MISSING",
  );

  requireNonEmpty(
    page.finalUrl,
    "V8_ACQUISITION_FINAL_URL_MISSING",
  );

  requireNonEmpty(
    page.fetchedAt,
    "V8_ACQUISITION_FETCH_TIMESTAMP_MISSING",
  );

  if (
    !Number.isSafeInteger(maxBytes) ||
    maxBytes <= 0
  ) {
    throw new Error(
      "V8_ACQUISITION_INVALID_MAX_BYTES",
    );
  }

  if (
    !Number.isInteger(page.status) ||
    page.status < 200 ||
    page.status >= 300
  ) {
    throw new Error(
      `V8_ACQUISITION_HTTP_STATUS_${page.status}`,
    );
  }

  if (
    page.bytes.byteLength > maxBytes
  ) {
    throw new Error(
      "V8_ACQUISITION_RESPONSE_TOO_LARGE",
    );
  }

  if (
    !(page.bytes instanceof Uint8Array)
  ) {
    throw new Error(
      "V8_ACQUISITION_INVALID_RESPONSE_BYTES",
    );
  }

  if (
    typeof page.body !== "string"
  ) {
    throw new Error(
      "V8_ACQUISITION_INVALID_RESPONSE_BODY",
    );
  }

  if (
    !Array.isArray(page.redirectChain)
  ) {
    throw new Error(
      "V8_ACQUISITION_INVALID_REDIRECT_CHAIN",
    );
  }

  const contentHash =
    HttpPageFetcher.contentHash(
      page.bytes,
    );

  /*
   * SOURCE identity is the requested source URL.
   *
   * The redirect target is recorded as Snapshot provenance;
   * it must not silently replace the requested Source identity.
   *
   * sourceId() brands the supplied string. It does not hash it
   * or normalize it, so this exact value is used consistently
   * throughout Source, Snapshot and Evidence records.
   */
  const sid =
    sourceId(
      page.requestedUrl,
    ).toString();

  const existingSource =
    store.get(
      "SOURCE",
      sid,
    );

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
      reason:
        "V8-05 web source registration",
    });
  } else {
    const existingSourceUrl =
      (
        existingSource.payload as {
          readonly url?: unknown;
        }
      ).url;

    if (
      existingSourceUrl !== page.requestedUrl
    ) {
      throw new Error(
        "V8_ACQUISITION_SOURCE_IDENTITY_CONFLICT",
      );
    }
  }

  const sourceRecord =
    store.get(
      "SOURCE",
      sid,
    );

  if (
    !sourceRecord ||
    sourceRecord.state !== "REGISTERED"
  ) {
    throw new Error(
      "V8_ACQUISITION_SOURCE_NOT_REGISTERED",
    );
  }

  const snapshotId =
    `snapshot:${contentFingerprint({
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

  const existingSnapshot =
    store.get<SnapshotPayload>(
      "SNAPSHOT",
      snapshotId,
    );

  if (!existingSnapshot) {
    store.append<SnapshotPayload>({
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
      reason:
        "V8-05 web page capture",
    });

    store.append<SnapshotPayload>({
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
      reason:
        "V8-05 immutable snapshot seal",
    });
  }

  const sealed =
    store.get<SnapshotPayload>(
      "SNAPSHOT",
      snapshotId,
    );

  if (
    !sealed ||
    sealed.state !== "SEALED"
  ) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_NOT_SEALED",
    );
  }

  /*
   * The persisted SEALED Snapshot is the authority.
   *
   * Never return a newly reconstructed transient Snapshot
   * when this identity already exists. Its capturedAt,
   * redirectChain or other metadata may differ from the
   * immutable record already committed to the store.
   */
  const persistedSnapshot =
    sealed.payload;

  assertSnapshotMapping(
    persistedSnapshot,
    sid,
    contentHash,
    page.requestedUrl,
    page.finalUrl,
  );

  /*
   * Verify that the sealed Snapshot still has the expected
   * Source lineage. This prevents a valid-looking Snapshot
   * payload from masking a broken aggregate relationship.
   */
  const snapshotSourceLink =
    sealed.lineage.find(
      (link) =>
        link.type === "SOURCE" &&
        link.id === sid,
    );

  if (
    !snapshotSourceLink
  ) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_SOURCE_LINEAGE_MISSING",
    );
  }

  const linkedSource =
    store.get(
      "SOURCE",
      snapshotSourceLink.id,
      snapshotSourceLink.version,
    );

  if (
    !linkedSource ||
    linkedSource.fingerprint !==
      snapshotSourceLink.fingerprint
  ) {
    throw new Error(
      "V8_ACQUISITION_SNAPSHOT_SOURCE_LINEAGE_INVALID",
    );
  }

  /*
   * Discovery provenance is persisted as immutable Evidence
   * metadata. It is not part of Evidence identity because the
   * same physical evidence can be discovered through multiple
   * legitimate discovery paths.
   */
  const builtEvidence =
    buildEvidencePayloads(
      sid,
      snapshotId,
      persistedSnapshot,
      candidates,
    );

  const evidenceWithProvenance =
    builtEvidence.map(
      (payload) => ({
        ...payload,
        ...(config.discoveryProvenance
          ? {
              discoveryProvenance:
                config.discoveryProvenance,
            }
          : {}),
      }),
    );

  const authoritativeEvidence:
    EvidencePayload[] = [];

  for (
    const payload of evidenceWithProvenance
  ) {
    const candidate: ExtractedEvidenceCandidate = {
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
    };

    const aggregateId =
      evidenceAggregateId(
        sid,
        snapshotId,
        candidate,
        persistedSnapshot.contentHash,
      );

    const existingEvidence =
      store.get<EvidencePayload>(
        "EVIDENCE",
        aggregateId,
      );

    if (existingEvidence) {
      if (
        existingEvidence.state !== "INGESTED" &&
        existingEvidence.state !== "VERIFIED"
      ) {
        throw new Error(
          "V8_ACQUISITION_EXISTING_EVIDENCE_STATE_INVALID",
        );
      }

      /*
       * A repeated Evidence identity must return the persisted
       * payload, not a newly reconstructed payload whose
       * discovery provenance may differ from the original.
       */
      assertEvidenceMapping(
        existingEvidence.payload,
        sid,
        snapshotId,
        aggregateId,
        existingEvidence.aggregateId,
      );

      const evidenceSourceLink =
        existingEvidence.lineage.find(
          (link) =>
            link.type === "SOURCE" &&
            link.id === sid,
        );

      const evidenceSnapshotLink =
        existingEvidence.lineage.find(
          (link) =>
            link.type === "SNAPSHOT" &&
            link.id === snapshotId,
        );

      if (
        !evidenceSourceLink ||
        !evidenceSnapshotLink
      ) {
        throw new Error(
          "V8_ACQUISITION_EXISTING_EVIDENCE_LINEAGE_MISSING",
        );
      }

      const linkedEvidenceSource =
        store.get(
          "SOURCE",
          evidenceSourceLink.id,
          evidenceSourceLink.version,
        );

      const linkedEvidenceSnapshot =
        store.get(
          "SNAPSHOT",
          evidenceSnapshotLink.id,
          evidenceSnapshotLink.version,
        );

      if (
        !linkedEvidenceSource ||
        linkedEvidenceSource.fingerprint !==
          evidenceSourceLink.fingerprint
      ) {
        throw new Error(
          "V8_ACQUISITION_EXISTING_EVIDENCE_SOURCE_LINEAGE_INVALID",
        );
      }

      if (
        !linkedEvidenceSnapshot ||
        linkedEvidenceSnapshot.fingerprint !==
          evidenceSnapshotLink.fingerprint ||
        linkedEvidenceSnapshot.state !== "SEALED"
      ) {
        throw new Error(
          "V8_ACQUISITION_EXISTING_EVIDENCE_SNAPSHOT_LINEAGE_INVALID",
        );
      }

      authoritativeEvidence.push(
        existingEvidence.payload,
      );

      continue;
    }

    /*
     * Re-check the current Source record immediately before
     * writing Evidence so that the lineage uses the exact
     * committed Source version and fingerprint.
     */
    const currentSource =
      store.get(
        "SOURCE",
        sid,
      );

    if (
      !currentSource ||
      currentSource.state !== "REGISTERED"
    ) {
      throw new Error(
        "V8_ACQUISITION_SOURCE_NOT_FOUND",
      );
    }

    const currentSnapshot =
      store.get<SnapshotPayload>(
        "SNAPSHOT",
        snapshotId,
      );

    if (
      !currentSnapshot ||
      currentSnapshot.state !== "SEALED" ||
      currentSnapshot.fingerprint !==
        sealed.fingerprint
    ) {
      throw new Error(
        "V8_ACQUISITION_SNAPSHOT_CHANGED_BEFORE_EVIDENCE_WRITE",
      );
    }

    const appended =
      store.append<EvidencePayload>({
        aggregateType: "EVIDENCE",
        aggregateId,
        version: 1,
        state: "INGESTED",
        payload,
        lineage: [
          {
            type: "SOURCE",
            id: sid,
            version: currentSource.version,
            fingerprint: currentSource.fingerprint,
          },
          {
            type: "SNAPSHOT",
            id: snapshotId,
            version: currentSnapshot.version,
            fingerprint: currentSnapshot.fingerprint,
          },
        ],
        actor: {
          id: actorId,
          role: "INGESTOR",
        },
        reason:
          "V8-05 extracted web evidence ingestion",
      });

    assertEvidenceMapping(
      appended.payload,
      sid,
      snapshotId,
      aggregateId,
      appended.aggregateId,
    );

    authoritativeEvidence.push(
      appended.payload,
    );
  }

  /*
   * Fail closed on duplicate Evidence IDs in the returned
   * mapping. A single Evidence record must not be counted as
   * multiple independent items in downstream closure checks.
   */
  const evidenceIds =
    authoritativeEvidence.map(
      (payload) =>
        evidenceAggregateId(
          sid,
          snapshotId,
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
            testMethod: payload.testMethod,
            testCondition: payload.testCondition,
            flowDirection: payload.flowDirection,
            extractionConfidence:
              payload.extractionConfidence ?? "LOW",
          },
          persistedSnapshot.contentHash,
        ),
    );

  if (
    new Set(evidenceIds).size !==
    evidenceIds.length
  ) {
    throw new Error(
      "V8_ACQUISITION_DUPLICATE_EVIDENCE_MAPPING",
    );
  }

  return {
    sourceId: sid,
    snapshotId,
    snapshot: persistedSnapshot,
    evidence: authoritativeEvidence,
  };
}
