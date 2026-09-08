export type SearchIntentKind =
  | "ENGINEERING_HOW_TO"
  | "ENGINEERING_COMPARISON"
  | "ENGINEERING_CALCULATION"
  | "ENGINEERING_REFERENCE"
  | "ENGINEERING_TROUBLESHOOTING"
  | "COMMERCIAL_EVALUATION"
  | "NAVIGATIONAL"
  | "NON_ENGINEERING";

export type ApplicabilityStatus =
  | "APPLICABLE"
  | "CONDITION_DEPENDENT"
  | "NOT_COMPARABLE"
  | "INSUFFICIENT_EVIDENCE"
  | "CONFLICTING_EVIDENCE"
  | "BLOCKED";

export type AssetDecision = "CREATE" | "UPDATE" | "MERGE" | "BLOCK";

export interface QueryCandidate {
  id: string;
  rawQuery: string;
  normalizedQuery: string;
  language: string;
  country?: string;
  source: "SEARCH_CONSOLE" | "SERP" | "COMPETITOR" | "DISCOVERY" | "MANUAL";
  observedAt: string;
  demandScore?: number;
  commercialScore?: number;
}

export interface SearchIntent {
  queryId: string;
  kind: SearchIntentKind;
  confidence: number;
  engineeringProblem?: string;
  requiredEntities: readonly string[];
}

export interface CompetitorObservation {
  queryId: string;
  url: string;
  title?: string;
  contentType?: string;
  evidenceDensity: number;
  engineeringDepth: number;
  uniqueValue: number;
  observedAt: string;
}

export interface ApplicabilityDecision {
  status: ApplicabilityStatus;
  reasons: readonly string[];
  evidenceIds: readonly string[];
}

export interface EngineeringDecision {
  id: string;
  queryId: string;
  statement: string;
  applicability: ApplicabilityDecision;
  evidenceIds: readonly string[];
  createdAt: string;
}

export interface AssetCandidate {
  id: string;
  queryId: string;
  canonicalKey: string;
  title: string;
  decisionId: string;
  uniquenessScore: number;
  economicScore: number;
  duplicateRisk: number;
  cannibalizationRisk: number;
}

export interface AssetDecisionResult {
  decision: AssetDecision;
  reasons: readonly string[];
  candidate: AssetCandidate;
}

export interface SearchOsRecord {
  query: QueryCandidate;
  intent: SearchIntent;
  competitors: readonly CompetitorObservation[];
  engineeringDecision?: EngineeringDecision;
  asset?: AssetDecisionResult;
}
