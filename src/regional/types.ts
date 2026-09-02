/**
 * NEXMOLD V7.14 — Single Regional Publication Contract
 * Contract chain: Evidence -> Semantic -> Eligibility -> Epistemic Firewall -> Artifact -> Publication -> Projection.
 * This patch is intentionally self-contained: no hidden eligibility/firewall/publication modules are required.
 */

export type Locale = "en-US" | "en-GB" | "de-DE";
export type Region = "US" | "GB" | "DE";
export type PageId = string & { readonly __brand: "PageId" };
export type CanonicalUrl = string & { readonly __brand: "CanonicalUrl" };
export type ContentHash = string & { readonly __brand: "ContentHash" };
export type EvidenceId = string & { readonly __brand: "EvidenceId" };
export type SemanticClaimId = string & { readonly __brand: "SemanticClaimId" };

export type RegionalApplicability = "APPLICABLE" | "NOT_APPLICABLE" | "UNKNOWN";
export type ComplianceClaim = "VERIFIED" | "NOT_VERIFIED" | "REQUIRES_REVIEW" | "UNKNOWN";
export type EvidenceCompleteness = "COMPLETE" | "INCOMPLETE" | "UNKNOWN";
export type RegionalEligibilityStatus = "ELIGIBLE" | "BLOCKED" | "NOT_APPLICABLE" | "REQUIRES_REVIEW";

export interface EvidenceRef {
  readonly id: EvidenceId;
  readonly sourceType: string;
  readonly sourceLocator: string;
  readonly contentHash: ContentHash;
}
export interface SemanticClaimRef {
  readonly id: SemanticClaimId;
  readonly claimKey: string;
}
export interface RegionalEvidenceSnapshot {
  readonly evidence: readonly EvidenceRef[];
  readonly semanticClaims: readonly SemanticClaimRef[];
  readonly completeness: EvidenceCompleteness;
}
export interface ClaimEvidenceBinding {
  readonly claim: SemanticClaimRef;
  readonly evidenceIds: readonly EvidenceId[];
}

export interface RegionalEligibilityDecisionBase {
  readonly pageId: PageId;
  readonly locale: Locale;
  readonly region: Region;
  readonly applicability: RegionalApplicability;
  readonly compliance: ComplianceClaim;
  readonly evidence: RegionalEvidenceSnapshot;
  readonly status: RegionalEligibilityStatus;
  readonly reasonCodes: readonly string[];
}
export interface EligibleRegionalDecision extends RegionalEligibilityDecisionBase {
  readonly status: "ELIGIBLE";
  readonly applicability: "APPLICABLE";
  readonly compliance: "VERIFIED";
  readonly evidence: RegionalEvidenceSnapshot & { readonly completeness: "COMPLETE" };
}
export interface BlockedRegionalDecision extends RegionalEligibilityDecisionBase { readonly status: "BLOCKED"; }
export interface NotApplicableRegionalDecision extends RegionalEligibilityDecisionBase {
  readonly status: "NOT_APPLICABLE";
  readonly applicability: "NOT_APPLICABLE";
}
export interface ReviewRequiredRegionalDecision extends RegionalEligibilityDecisionBase {
  readonly status: "REQUIRES_REVIEW";
  readonly compliance: "REQUIRES_REVIEW" | "UNKNOWN";
}
export type RegionalEligibilityDecision = EligibleRegionalDecision | BlockedRegionalDecision | NotApplicableRegionalDecision | ReviewRequiredRegionalDecision;

export interface RegionalSemanticProjection {
  readonly pageId: PageId;
  readonly locale: Locale;
  readonly region: Region;
  readonly semanticClaimIds: readonly SemanticClaimId[];
}
export interface RegionalCompileInput {
  readonly pageId: PageId;
  readonly locale: Locale;
  readonly region: Region;
  readonly applicability: RegionalApplicability;
  readonly compliance: ComplianceClaim;
  readonly semantic: RegionalSemanticProjection;
  readonly evidence: RegionalEvidenceSnapshot;
}

export const regionalPublishArtifactBrand: unique symbol = Symbol("RegionalPublishArtifact");
export interface RegionalPublishArtifact {
  readonly [regionalPublishArtifactBrand]: "RegionalPublishArtifact";
  readonly pageId: PageId;
  readonly locale: Locale;
  readonly region: Region;
  readonly canonicalUrl: CanonicalUrl;
  readonly hreflangSet: readonly Locale[];
  readonly seoEligibility: EligibleRegionalDecision;
  readonly evidence: RegionalEvidenceSnapshot;
  readonly bindings: readonly ClaimEvidenceBinding[];
  readonly pageContentHash: ContentHash;
  readonly contractVersion: "V7.14-PUBLISH-ARTIFACT-3";
}
export interface RegionalRouteProjection {
  readonly pageId: PageId;
  readonly locale: Locale;
  readonly region: Region;
  readonly canonicalUrl: CanonicalUrl;
  readonly contentHash: ContentHash;
  readonly artifact: RegionalPublishArtifact;
}
export interface HreflangEdge {
  readonly sourcePageId: PageId;
  readonly sourceLocale: Locale;
  readonly targetLocale: Locale;
  readonly targetCanonicalUrl: CanonicalUrl;
}
export interface HreflangProjection { readonly pageId: PageId; readonly edges: readonly HreflangEdge[]; }
export interface RegionalCompileResult {
  readonly eligibility: RegionalEligibilityDecision;
  readonly artifact: RegionalPublishArtifact | null;
  readonly route: RegionalRouteProjection | null;
  readonly hreflang: HreflangProjection | null;
}

export interface V714ArticleContentBlock { readonly heading?: string; readonly content: string; readonly type?: string; }
export interface V714ArticleFaq { readonly question: string; readonly answer: string; }
export interface V714ArticleLineage {
  readonly pageId: PageId;
  readonly locale: Locale;
  readonly region: Region;
  readonly canonicalUrl: CanonicalUrl;
  readonly evidenceIds: readonly string[];
  readonly semanticClaimIds: readonly string[];
  readonly sourceArtifactHash: ContentHash;
}
export interface V714ArticleContract {
  readonly schema: "nexmold.v7.14.article-contract.v2";
  readonly articleId: PageId;
  readonly title: string;
  readonly slug: string;
  readonly category: string;
  readonly categorySlug: string;
  readonly description: string;
  readonly directAnswer: string;
  readonly keyTakeaways: readonly string[];
  readonly content: readonly V714ArticleContentBlock[];
  readonly faq: readonly V714ArticleFaq[];
  readonly seoKeywords: readonly string[];
  readonly lineage: V714ArticleLineage;
  readonly sourceArtifact: RegionalPublishArtifact;
}

export const V714_CONTRACT_VERSION = "V7.14-SINGLE-CONTRACT-2026-09-02" as const;
export type UnknownApplicabilityMustBlock = true;
export type ReviewRequiredMustBlock = true;
export type NotApplicableMustNotPublish = true;
export type ArtifactIsSingleProjectionSource = true;
