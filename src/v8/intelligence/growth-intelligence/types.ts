import type {
  JsonValue,
  KeywordRecord,
  Opportunity,
  SearchIntent,
} from "../shared.js";

export type GrowthIntelligenceEntityType =
  | "INDUSTRY"
  | "MARKET"
  | "SIGNAL"
  | "NICHE"
  | "NICHE_EVIDENCE"
  | "NICHE_OPPORTUNITY"
  | "KEYWORD"
  | "TOPIC"
  | "CONTENT_OPPORTUNITY"
  | "COMMERCIAL_INTENT"
  | "GROWTH_METRIC"
  | "DECISION";

export type GrowthIntelligenceLifecycle =
  | "DISCOVERED"
  | "VALIDATING"
  | "VALIDATED"
  | "APPROVED"
  | "REJECTED"
  | "EXHAUSTED";

export type GrowthSignalType =
  | "SEARCH_DEMAND"
  | "SEARCH_GROWTH"
  | "COMPETITOR_GAP"
  | "CONTENT_GAP"
  | "COMMERCIAL_INTENT"
  | "PRODUCT_FIT"
  | "CAPABILITY_FIT"
  | "TRAFFIC"
  | "ENGAGEMENT"
  | "INQUIRY"
  | "QUALIFIED_LEAD"
  | "CONVERSION"
  | "MARKET_CHANGE"
  | "EMERGING_TOPIC";

export type CommercialIntentLevel =
  | "NONE"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type NicheDecision =
  | "PURSUE"
  | "WATCH"
  | "REJECT"
  | "EXHAUSTED";

export interface IndustryProfile {
  readonly industryId: string;
  readonly name: string;
  readonly description?: string;
  readonly capabilities: readonly string[];
  readonly products: readonly string[];
  readonly services: readonly string[];
  readonly targetMarkets: readonly string[];
  readonly targetAudiences: readonly string[];
  readonly languages: readonly string[];
  readonly markets: readonly string[];
  readonly exclusions: readonly string[];
  readonly version: string;
}

export interface MarketProfile {
  readonly marketId: string;
  readonly industryId: string;
  readonly name: string;
  readonly region?: string;
  readonly country?: string;
  readonly language?: string;
  readonly audienceSegments: readonly string[];
  readonly capabilityFit: number;
  readonly commercialFit: number;
}

export interface GrowthSignal {
  readonly signalId: string;
  readonly type: GrowthSignalType;
  readonly source: string;
  readonly observedAt: string;
  readonly subject: string;
  readonly normalizedSubject: string;
  readonly marketId?: string;
  readonly industryId?: string;
  readonly value: number;
  readonly confidence: number;
  readonly evidenceRefs: readonly string[];
  readonly metadata: Readonly<Record<string, JsonValue>>;
}

export interface NicheEvidence {
  readonly evidenceId: string;
  readonly nicheId: string;
  readonly signalId: string;
  readonly sourceUrl: string;
  readonly sourceTitle?: string;
  readonly publisher?: string;
  readonly excerpt?: string;
  readonly observedAt: string;
  readonly fingerprint: string;
  readonly confidence: number;
}

export interface NicheCluster {
  readonly clusterId: string;
  readonly canonicalName: string;
  readonly normalizedName: string;
  readonly keywords: readonly KeywordRecord[];
  readonly signals: readonly GrowthSignal[];
  readonly marketIds: readonly string[];
  readonly intentDistribution: Readonly<
    Partial<Record<SearchIntent, number>>
  >;
  readonly tokenSet: readonly string[];
}

export interface NicheScoreComponents {
  readonly demand: number;
  readonly growth: number;
  readonly competition: number;
  readonly contentGap: number;
  readonly commercialIntent: number;
  readonly capabilityFit: number;
  readonly conversionPotential: number;
  readonly evidenceConfidence: number;
  readonly trafficPotential: number;
}

export interface NicheScoreWeights {
  readonly demand: number;
  readonly growth: number;
  readonly competition: number;
  readonly contentGap: number;
  readonly commercialIntent: number;
  readonly capabilityFit: number;
  readonly conversionPotential: number;
  readonly evidenceConfidence: number;
  readonly trafficPotential: number;
}

export interface NicheOpportunity {
  readonly opportunityId: string;
  readonly nicheId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly score: number;
  readonly components: NicheScoreComponents;
  readonly reasons: readonly string[];
  readonly blockers: readonly string[];
  readonly decision: NicheDecision;
  readonly lifecycle: GrowthIntelligenceLifecycle;
  readonly evidenceIds: readonly string[];
  readonly keywordIds: readonly string[];
  readonly marketIds: readonly string[];
  readonly createdAt: string;
  readonly fingerprint: string;
}

export interface Niche {
  readonly nicheId: string;
  readonly industryId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly description: string;
  readonly lifecycle: GrowthIntelligenceLifecycle;
  readonly decision: NicheDecision;
  readonly score: number;
  readonly opportunityId: string;
  readonly evidenceIds: readonly string[];
  readonly keywordIds: readonly string[];
  readonly marketIds: readonly string[];
  readonly commercialIntent: CommercialIntentLevel;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly fingerprint: string;
}

export interface TopicCandidate {
  readonly topicId: string;
  readonly nicheId: string;
  readonly keyword: string;
  readonly normalizedKeyword: string;
  readonly intent: SearchIntent;
  readonly opportunity: Opportunity;
  readonly commercialIntent: CommercialIntentLevel;
  readonly evidenceIds: readonly string[];
}

export interface ContentOpportunity {
  readonly contentOpportunityId: string;
  readonly nicheId: string;
  readonly topicId: string;
  readonly primaryKeyword: string;
  readonly intent: SearchIntent;
  readonly commercialIntent: CommercialIntentLevel;
  readonly score: number;
  readonly reasons: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly decision: NicheDecision;
}

export interface GrowthMetric {
  readonly metricId: string;
  readonly type:
    | "IMPRESSIONS"
    | "CLICKS"
    | "CTR"
    | "RANK"
    | "SESSIONS"
    | "ENGAGEMENT"
    | "INQUIRIES"
    | "QUALIFIED_LEADS"
    | "CONVERSIONS"
    | "REVENUE";
  readonly subjectId: string;
  readonly value: number;
  readonly previousValue?: number;
  readonly observedAt: string;
  readonly source: string;
  readonly confidence: number;
}

export interface GrowthFeedback {
  readonly feedbackId: string;
  readonly subjectId: string;
  readonly metrics: readonly GrowthMetric[];
  readonly signalIds: readonly string[];
  readonly scoreDelta: number;
  readonly observedAt: string;
}

export interface GrowthIntelligenceInput {
  readonly cycleId: string;
  readonly industry: IndustryProfile;
  readonly markets: readonly MarketProfile[];
  readonly keywords: readonly KeywordRecord[];
  readonly opportunities?: readonly Opportunity[];
  readonly signals: readonly GrowthSignal[];
  readonly existingNiches?: readonly Niche[];
  readonly existingTopics?: readonly string[];
  readonly publishedSlugs?: readonly string[];
  readonly minimumNicheScore?: number;
  readonly minimumEvidenceConfidence?: number;
  readonly maximumNiches?: number;
}

export interface GrowthIntelligenceResult {
  readonly cycleId: string;
  readonly industry: IndustryProfile;
  readonly markets: readonly MarketProfile[];
  readonly clusters: readonly NicheCluster[];
  readonly evidence: readonly NicheEvidence[];
  readonly niches: readonly Niche[];
  readonly opportunities: readonly NicheOpportunity[];
  readonly topics: readonly TopicCandidate[];
  readonly contentOpportunities: readonly ContentOpportunity[];
  readonly blocked: readonly {
    readonly subject: string;
    readonly reason:
      | "LOW_SCORE"
      | "LOW_EVIDENCE_CONFIDENCE"
      | "ALREADY_EXISTS"
      | "NO_COMMERCIAL_FIT"
      | "NO_CAPABILITY_FIT"
      | "EXHAUSTED";
  }[];
  readonly fingerprint: string;
}

export interface GrowthIntelligenceInvariantReport {
  readonly passed: boolean;
  readonly violations: readonly string[];
}