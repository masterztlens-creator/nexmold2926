import {
  acquireHttpDocument,
  persistRawSnapshot,
  type AcquisitionOptions,
  type AcquiredDocument,
} from "./acquisition.js";
import { FoundationService, type SnapshotInput } from "./service.js";
import type { AuditActor, FoundationRecord, SnapshotPayload } from "./types.js";
import { createSource, type Source } from "../domain/source.js";

export interface InternetIngestionInput {
  readonly url: string;
  readonly title: string;
  readonly publisher: string;
  readonly authority: Source["authority"];
  readonly version?: string;
  readonly language?: string;
  readonly sourceType?: string;
  readonly actor: AuditActor;
  readonly acquisition?: AcquisitionOptions;
  readonly snapshotRoot?: string;
  readonly reason?: string;
}

export interface InternetIngestionResult {
  readonly acquisition: Readonly<AcquiredDocument>;
  readonly source: Readonly<Source>;
  readonly sourceRecord: FoundationRecord<Source>;
  readonly snapshotRecord: FoundationRecord<SnapshotPayload>;
  readonly rawSnapshotPath: string;
}

export async function ingestInternetDocument(
  service: FoundationService,
  input: InternetIngestionInput,
): Promise<Readonly<InternetIngestionResult>> {
  const acquisition = await acquireHttpDocument(input.url, input.acquisition);

  const source = createSource({
    kind: "PUBLIC_WEB",
    locator: acquisition.finalUrl,
    access: "PAYLOAD_ALLOWED",
    title: input.title,
    version: input.version?.trim() || "retrieved-document",
    publisher: input.publisher,
    authority: input.authority,
    canonicalUrl: acquisition.finalUrl,
    retrievedAt: acquisition.retrievedAt,
    documentHash: acquisition.documentHash,
    ...(input.language === undefined ? {} : { language: input.language }),
    sourceType: input.sourceType ?? "HTTP_DOCUMENT",
  });

  const sourceRecord = service.registerSource(
    source,
    input.actor,
    input.reason ?? "internet source registration",
  );

  const rawSnapshotPath = persistRawSnapshot(
    acquisition.bytes,
    acquisition.documentHash,
    input.snapshotRoot,
  );

  const snapshotInput: SnapshotInput = {
    source,
    capturedAt: acquisition.retrievedAt,
    locator: acquisition.finalUrl,
    metadataOnly: false,
    rawBytes: acquisition.bytes,
    requestedUrl: acquisition.requestedUrl,
    finalUrl: acquisition.finalUrl,
    redirectChain: acquisition.redirectChain,
    mediaType: acquisition.mediaType,
    blobLocator: rawSnapshotPath,
  };

  const captured = service.captureSnapshot(
    snapshotInput,
    input.actor,
    input.reason ?? "internet snapshot capture",
  );

  const snapshotRecord = service.sealSnapshot(
    captured.aggregateId,
    input.actor,
    input.reason ?? "internet snapshot seal",
  );

  return Object.freeze({
    acquisition,
    source,
    sourceRecord,
    snapshotRecord,
    rawSnapshotPath,
  });
}
