import type {
  DiscoveryProvenance,
  EvidencePayload,
  FoundationStore,
  SnapshotPayload,
} from "../foundation/types.js";

export interface SearchProvider {
  readonly name: string;

  search(
    query: string,
    options?: {
      readonly signal?: AbortSignal;
    },
  ): Promise<readonly SearchResult[]>;
}

export interface SearchResult {
  readonly url: string;
  readonly title?: string;
  readonly snippet?: string;
}

export interface PageFetcher {
  fetch(
    url: string,
    options?: {
      readonly signal?: AbortSignal;
    },
  ): Promise<FetchedPage>;
}

export interface FetchedPage {
  readonly requestedUrl: string;
  readonly finalUrl: string;

  /** Complete observed redirect chain. */
  readonly redirectChain: readonly string[];

  readonly status: number;
  readonly mediaType: string;
  readonly body: string;
  readonly bytes: Uint8Array;
  readonly fetchedAt: string;
}

export interface ExtractedEvidenceCandidate {
  readonly locator: string;
  readonly excerpt: string;

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

  readonly extractionConfidence: "HIGH" | "MEDIUM" | "LOW";
}

export interface SourcePayload {
  readonly url: string;
  readonly kind: "WEB";
  readonly firstSeenAt: string;
}

export interface AcquisitionConfig {
  readonly actorId?: string;
  readonly timeoutMs?: number;
  readonly maxBytes?: number;

  /**
   * Discovery provenance supplied by the research layer.
   *
   * Acquisition does not infer provenance from URL shape. It persists
   * only the provenance explicitly supplied by the discovery/qualification
   * boundary.
   */
  readonly discoveryProvenance?: DiscoveryProvenance;
}

export interface AcquisitionResult {
  readonly sourceId: string;
  readonly snapshotId: string;
  readonly snapshot: SnapshotPayload;
  readonly evidence: readonly EvidencePayload[];
}

export interface FoundationAcquisitionAdapter {
  acquire(
    url: string,
    store: FoundationStore,
    candidates: readonly ExtractedEvidenceCandidate[],
    config?: AcquisitionConfig,
  ): Promise<AcquisitionResult>;
}