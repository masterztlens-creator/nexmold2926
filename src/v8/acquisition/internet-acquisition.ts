import type {
  AcquisitionConfig,
  AcquisitionResult,
  ExtractedEvidenceCandidate,
  PageFetcher,
} from "./types.js";
import type { FoundationStore } from "../foundation/types.js";
import { HttpPageFetcher } from "./page-fetcher.js";
import { ingestFetchedPage } from "./foundation-adapter.js";
import { extractStructuredEvidence } from "./source-extractor.js";

export interface InternetAcquisitionOptions
  extends AcquisitionConfig {
  readonly fetcher?: PageFetcher;
}

export interface InternetAcquisition {
  acquire(
    url: string,
    store: FoundationStore,
  ): Promise<AcquisitionResult>;
}

/**
 * V8-22C production acquisition boundary.
 *
 * Responsibility:
 *
 * URL
 *   -> PageFetcher
 *   -> semantic source extraction
 *   -> Foundation Snapshot/Evidence persistence
 *
 * This layer deliberately does not implement:
 * - HTTP policy
 * - HTML sanitization
 * - Evidence identity
 * - Snapshot persistence
 * - Evidence verification
 *
 * Those responsibilities remain owned by their existing modules.
 */
export function createInternetAcquisition(
  options: InternetAcquisitionOptions = {},
): InternetAcquisition {
  const fetcher =
    options.fetcher ??
    new HttpPageFetcher({
      timeoutMs: options.timeoutMs,
      maxBytes: options.maxBytes,
    });

  return {
    async acquire(
      url: string,
      store: FoundationStore,
    ): Promise<AcquisitionResult> {
      const page = await fetcher.fetch(url);

      const candidates: readonly ExtractedEvidenceCandidate[] =
        extractStructuredEvidence(page.body);

      return ingestFetchedPage(
        store,
        page,
        candidates,
        {
          actorId:
            options.actorId ??
            "v8-internet-acquisition",
          maxBytes: options.maxBytes,
        },
      );
    },
  };
}

/**
 * Convenience API for callers that do not need to retain
 * an acquisition object.
 */
export async function acquireInternetPage(
  url: string,
  store: FoundationStore,
  options: InternetAcquisitionOptions = {},
): Promise<AcquisitionResult> {
  return createInternetAcquisition(options).acquire(
    url,
    store,
  );
}