
import { normalizeDiscoveryUrl } from "./candidate-normalizer.js";
import type { DiscoveryBatch, DiscoveryCandidate, DiscoveryCandidateKind } from "./types.js";

export interface DiscoveryInput {
  readonly url: string;
  readonly kind?: DiscoveryCandidateKind;
  readonly sourceUrl?: string;
  readonly title?: string;
  readonly discoveredAt?: string;
}

export function createDiscoveryCandidate(input: DiscoveryInput): DiscoveryCandidate | null {
  const normalizedUrl = normalizeDiscoveryUrl(input.url);
  if (!normalizedUrl) return null;
  return Object.freeze({
    url: input.url.trim(),
    normalizedUrl,
    kind: input.kind ?? "SEED",
    ...(input.sourceUrl === undefined ? {} : { sourceUrl: input.sourceUrl }),
    ...(input.title === undefined ? {} : { title: input.title }),
    discoveredAt: input.discoveredAt ?? new Date().toISOString(),
  });
}

export function discoverCandidates(inputs: readonly DiscoveryInput[]): DiscoveryBatch {
  const seen = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];
  let rejected = 0;
  for (const input of inputs) {
    const candidate = createDiscoveryCandidate(input);
    if (!candidate) { rejected++; continue; }
    if (seen.has(candidate.normalizedUrl)) continue;
    seen.add(candidate.normalizedUrl);
    candidates.push(candidate);
  }
  return Object.freeze({ candidates: Object.freeze(candidates), accepted: candidates.length, rejected });
}

export function mergeDiscoveryBatches(batches: readonly DiscoveryBatch[]): DiscoveryBatch {
  const seen = new Set<string>();
  const candidates: DiscoveryCandidate[] = [];
  let rejected = 0;
  for (const batch of batches) {
    rejected += batch.rejected;
    for (const candidate of batch.candidates) {
      if (seen.has(candidate.normalizedUrl)) continue;
      seen.add(candidate.normalizedUrl);
      candidates.push(candidate);
    }
  }
  return Object.freeze({ candidates: Object.freeze(candidates), accepted: candidates.length, rejected });
}
