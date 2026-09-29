export type DiscoveryProvider =
  | "SEARCH"
  | "SITEMAP"
  | "DIRECT"
  | "SELF_OWNED_CRAWL";

export type DiscoveryCandidateKind =
  | "SEED"
  | "LINK"
  | "SITEMAP"
  | "SERP_RESULT"
  | "REFERENCE";

export interface DiscoveryCandidate {
  readonly url: string;
  readonly normalizedUrl: string;
  readonly kind: DiscoveryCandidateKind;
  readonly provider: DiscoveryProvider;
  readonly discoveredAt: string;
  readonly sourceUrl?: string;
  readonly title?: string;
}

export interface NormalizedDocument {
  readonly requestedUrl: string;
  readonly finalUrl: string;
  readonly canonicalUrl: string;
  readonly title: string;
  readonly text: string;
  readonly contentHash: string;
  readonly normalizedAt: string;
}

/**
 * Research-layer evidence candidate.
 *
 * IMPORTANT:
 *
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
  readonly sourceUrl: string;
  readonly excerpt: string;
  readonly locator: string;
  readonly extractionMethod:
    | "MANUAL_TRANSCRIPTION"
    | "TEXT_EXTRACTION"
    | "TABLE_EXTRACTION"
    | "OCR";
  readonly extractionConfidence:
    | "HIGH"
    | "MEDIUM"
    | "LOW";
  readonly observedAt: string;
  readonly excerptHash: string;
}

/**
 * Evidence extracted from the research layer.
 *
 * This remains a research candidate until it enters the existing
 * V8 Evidence/Foundation pipeline.
 */
export interface EvidenceCandidate {
  readonly evidence: ResearchEvidenceCandidate;
  readonly sourceUrl: string;
  readonly excerpt: string;
  readonly locator: string;
  readonly excerptHash: string;
}

export interface FreshnessResult {
  readonly status:
    | "NEW"
    | "CHANGED"
    | "UNCHANGED"
    | "STALE";
  readonly contentHash: string;
  readonly previousHash?: string;
  readonly observedAt: string;
  readonly staleAfterDays: number;
}

export interface ConflictValue {
  readonly value: string;
  readonly sourceUrl: string;
  readonly authorityScore: number;
}

export interface ConflictResult {
  readonly status:
    | "INSUFFICIENT_CONTEXT"
    | "NO_CONFLICT"
    | "CONFLICT";
  readonly resolution:
    | "NONE"
    | "HIGHEST_AUTHORITY_CANDIDATE"
    | "REQUIRES_REVIEW";
  readonly values: ConflictValue[];
  readonly selected?: ConflictValue;
}

export interface KnowledgeRequirement {
  readonly id: string;
  readonly description: string;
  readonly requiredSignals: string[];
}

export interface KnowledgeGap {
  readonly requirementId: string;
  readonly description: string;
  readonly status: "OPEN" | "COVERED";
  readonly missingSignals: string[];
  readonly observedSignals: string[];
}