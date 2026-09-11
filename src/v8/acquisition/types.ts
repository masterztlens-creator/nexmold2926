import type { EvidencePayload, FoundationStore, SnapshotPayload } from "../foundation/types.js";
export interface SearchProvider {
  readonly name: string;
  search(query: string, options?: { readonly signal?: AbortSignal }): Promise<readonly SearchResult[]>;
}
export interface SearchResult { readonly url: string; readonly title?: string; readonly snippet?: string; }
export interface PageFetcher { fetch(url: string, options?: { readonly signal?: AbortSignal }): Promise<FetchedPage>; }
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
  readonly locator: string; readonly excerpt: string; readonly section?: string;
  readonly parameter?: string; readonly value?: string | number; readonly unit?: string;
  readonly extractionConfidence: "HIGH" | "MEDIUM" | "LOW";
}
export interface SourcePayload { readonly url: string; readonly kind: "WEB"; readonly firstSeenAt: string; }
export interface AcquisitionConfig { readonly actorId?: string; readonly timeoutMs?: number; readonly maxBytes?: number; }
export interface AcquisitionResult { readonly sourceId: string; readonly snapshotId: string; readonly snapshot: SnapshotPayload; readonly evidence: readonly EvidencePayload[]; }
export interface FoundationAcquisitionAdapter {
  acquire(url: string, store: FoundationStore, candidates: readonly ExtractedEvidenceCandidate[]): Promise<AcquisitionResult>;
}
