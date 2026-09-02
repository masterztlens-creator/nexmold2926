/**
 * NEXMOLD V7.14 — Expert Article Contract v1
 *
 * The contract deliberately separates facts from claims, mechanisms and
 * decisions. Producers may synthesize only from authorized evidence.
 */
export type EvidenceTier = 1 | 2 | 3 | 4;
export type ClaimStatus = "SUPPORTED" | "CONDITIONAL" | "UNSUPPORTED" | "CONFLICTING";

export interface ExpertSource {
  readonly id: string;
  readonly url: string;
  readonly title: string;
  readonly domain: string;
  readonly tier: EvidenceTier;
  readonly retrievedAt: string;
  readonly publishedAt?: string;
  readonly contentHash: string;
}

export interface ExpertEvidence {
  readonly id: string;
  readonly sourceId: string;
  readonly locator?: string;
  readonly quote: string;
  readonly context?: string;
  readonly topicTerms: readonly string[];
}

export interface ExpertFact {
  readonly id: string;
  readonly statement: string;
  readonly evidenceIds: readonly string[];
  readonly scope?: string;
  readonly conditions?: readonly string[];
}

export interface ExpertClaim {
  readonly id: string;
  readonly statement: string;
  readonly status: ClaimStatus;
  readonly factIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly confidence: number;
  readonly conditions?: readonly string[];
  readonly limitations?: readonly string[];
}

export interface ExpertMechanismStep {
  readonly id: string;
  readonly cause: string;
  readonly effect: string;
  readonly evidenceIds: readonly string[];
}

export interface ExpertMechanism {
  readonly id: string;
  readonly name: string;
  readonly steps: readonly ExpertMechanismStep[];
}

export interface ExpertDecisionOption {
  readonly option: string;
  readonly advantages: readonly string[];
  readonly risks: readonly string[];
  readonly conditions: readonly string[];
  readonly supportingClaimIds: readonly string[];
}

export interface ExpertDecision {
  readonly id: string;
  readonly question: string;
  readonly decisionFactors: readonly string[];
  readonly options: readonly ExpertDecisionOption[];
}

export interface ExpertValidation {
  readonly id: string;
  readonly method: string;
  readonly observable: string;
  readonly acceptanceBasis: string;
  readonly claimIds: readonly string[];
}

export interface ExpertArticleContract {
  readonly schema: "nexmold.v7.14.expert-article-contract.v1";
  readonly articleId: string;
  readonly targetSlug: string;
  readonly title: string;
  readonly intent: string;
  readonly sources: readonly ExpertSource[];
  readonly evidence: readonly ExpertEvidence[];
  readonly facts: readonly ExpertFact[];
  readonly claims: readonly ExpertClaim[];
  readonly mechanisms: readonly ExpertMechanism[];
  readonly decisions: readonly ExpertDecision[];
  readonly validations: readonly ExpertValidation[];
  readonly quality: {
    readonly evidenceCoverage: number;
    readonly tier1or2Coverage: number;
    readonly unsupportedClaimCount: number;
    readonly conflictCount: number;
  };
}
