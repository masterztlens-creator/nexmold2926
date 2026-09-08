import type { EvidencePayload } from "../foundation/types.js";
export type DiscoveryProvider =
  | "SEARCH"
  | "SITEMAP"
  | "DIRECT";
export interface DiscoveryCandidate {
  url: string;
  canonicalUrl: string;
  provider: DiscoveryProvider;
  discoveredAt: string;
  title?: string;
  sourceHint?: string;
}
export interface NormalizedDocument {
  requestedUrl: string;
  finalUrl: string;
  canonicalUrl: string;
  title: string;
  text: string;
  contentHash: string;
  normalizedAt: string;
}
export interface EvidenceCandidate {
  evidence: EvidencePayload;
  sourceUrl: string;
  excerpt: string;
  locator: string;
  excerptHash: string;
}
export interface FreshnessResult {
  status:
    | "NEW"
    | "CHANGED"
    | "UNCHANGED"
    | "STALE";
  contentHash: string;
  previousHash?: string;
  observedAt: string;
  staleAfterDays: number;
}
export interface ConflictValue {
  value: string;
  sourceUrl: string;
  authorityScore: number;
}
export interface ConflictResult {
  status:
    | "INSUFFICIENT_CONTEXT"
    | "NO_CONFLICT"
    | "CONFLICT";
  resolution:
    | "NONE"
    | "HIGHEST_AUTHORITY_CANDIDATE"
    | "REQUIRES_REVIEW";
  values: ConflictValue[];
  selected?: ConflictValue;
}
export interface KnowledgeRequirement {
  id: string;
  description: string;
  requiredSignals: string[];
}
export interface KnowledgeGap {
  requirementId: string;
  description: string;
  status: "OPEN" | "COVERED";
  missingSignals: string[];
  observedSignals: string[];
}