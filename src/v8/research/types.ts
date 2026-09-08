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
/**
 * Research-layer evidence candidate.
 *
 * IMPORTANT:
 * This is intentionally NOT EvidencePayload.
 *
 * The research layer only extracts a candidate from an Internet
 * document. It must not fabricate Foundation identifiers,
 * snapshot identifiers, evidence hashes, or verification state.
 *
 * The downstream V8 Foundation layer is responsible for creating
 * the actual EvidencePayload and performing audit/verification.
 */
export interface ResearchEvidenceCandidate {
  sourceUrl: string;
  excerpt: string;
  locator: string;
  extractionMethod:
    | "MANUAL_TRANSCRIPTION"
    | "TEXT_EXTRACTION"
    | "TABLE_EXTRACTION"
    | "OCR";
  extractionConfidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  observedAt: string;
  excerptHash: string;
}
/**
 * Evidence extracted from the research layer.
 *
 * This remains a research candidate until it enters the existing
 * V8 Evidence/Foundation pipeline.
 */
export interface EvidenceCandidate {
  evidence: ResearchEvidenceCandidate;
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