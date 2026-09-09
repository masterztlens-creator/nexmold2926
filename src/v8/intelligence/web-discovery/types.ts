
export type DiscoveryCandidateKind = "SEED" | "LINK" | "SITEMAP" | "SERP_RESULT" | "REFERENCE";

export interface DiscoveryCandidate {
  readonly url: string;
  readonly normalizedUrl: string;
  readonly kind: DiscoveryCandidateKind;
  readonly sourceUrl?: string;
  readonly title?: string;
  readonly discoveredAt: string;
}

export interface DiscoveryBatch {
  readonly candidates: readonly DiscoveryCandidate[];
  readonly accepted: number;
  readonly rejected: number;
}
