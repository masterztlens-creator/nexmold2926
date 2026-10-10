import {
  invariant,
} from "../../constitution/invariants.js";

import {
  contentFingerprint,
} from "../../foundation/hash.js";

import type {
  Fingerprint,
} from "../../domain/primitives.js";

import type {
  Opportunity,
} from "../shared.js";

import {
  evaluateMarketDecision,
  type MarketCoverageState,
  type MarketDecisionEngineResult,
  type MarketDecisionEvidenceState,
  type MarketReasoningSignal,
} from "../market/decision-engine.js";

import type {
  MarketAssetType,
  MarketDecisionConfidence,
} from "../market/decision.js";

import type {
  MarketDemand,
} from "../market/demand.js";

/**
 * Scope is explicit and fail-closed.
 *
 * UNKNOWN must never be interpreted as IN_SCOPE.
 */
export type SearchOpportunityScope =
  | "IN_SCOPE"
  | "OUT_OF_SCOPE"
  | "UNKNOWN";

/**
 * Strategic recommendation for a search opportunity.
 *
 * This is not a Foundation DECISION record and does not
 * authorize publication.
 */
export type SearchOpportunityRecommendation =
  | "PURSUE"
  | "RESEARCH"
  | "MERGE"
  | "WATCH"
  | "REJECT"
  | "BLOCK";

/**
 * Suggested next operation. The canonical publication
 * pipeline remains responsible for publication eligibility.
 */
export type SearchOpportunityNextStep =
  | "PLAN_CONTENT"
  | "RESEARCH_EVIDENCE"
  | "MERGE_WITH_EXISTING"
  | "REVIEW_SCOPE"
  | "REVIEW_PRIORITY"
  | "DO_NOT_PURSUE"
  | "BLOCKED";

export type SearchOpportunityPriority =
  | "HIGH"
  | "NORMAL"
  | "LOW";

export interface SearchOpportunityPolicy {
  /**
   * Minimum opportunity score for active pursuit.
   * This is a strategy threshold, not an evidence threshold.
   */
  readonly minimumOpportunityScore?: number;

  /**
   * Minimum business relevance required before active
   * planning can proceed.
   */
  readonly minimumRelevance?: number;

  /**
   * Explicit asset type for the existing MarketDecision.
   */
  readonly targetAsset?: MarketAssetType;

  /**
   * Optional confidence input for the canonical
   * MarketDecision engine.
   */
  readonly confidence?: MarketDecisionConfidence;
}

export interface EvaluateSearchOpportunityInput {
  readonly decisionId: string;

  readonly opportunity: Opportunity;

  /**
   * Canonical observed demand. It must already satisfy
   * the MarketDemand invariants.
   */
  readonly demand: MarketDemand;

  /**
   * Scope is mandatory: callers must not infer scope
   * from a keyword score.
   */
  readonly scope: SearchOpportunityScope;

  readonly evidence: MarketDecisionEvidenceState;

  readonly coverage: MarketCoverageState;

  readonly policy?: SearchOpportunityPolicy;

  readonly signals?: readonly MarketReasoningSignal[];

  readonly evidenceRequirements?: readonly string[];
}

export interface SearchOpportunityDecision {
  readonly assessmentId: string;

  readonly keyword: string;

  readonly market: string;

  readonly language: string;

  readonly scope: SearchOpportunityScope;

  readonly opportunityScore: number;

  readonly priority: SearchOpportunityPriority;

  readonly recommendation: SearchOpportunityRecommendation;

  readonly nextStep: SearchOpportunityNextStep;

  /**
   * Canonical MarketDecision and ResearchAction objects.
   * Their original invariants and fingerprints are preserved.
   */
  readonly marketDecision: MarketDecisionEngineResult["decision"];

  readonly researchActions: MarketDecisionEngineResult["researchActions"];

  /**
   * This layer never grants publication authority.
   * Final publication remains governed by the existing
   * unified publication gate.
   */
  readonly publicationEligible: false;

  /**
   * True means this assessment recommends content planning,
   * not publication or release.
   */
  readonly planningEligible: boolean;

  readonly policy: Readonly<{
    minimumOpportunityScore: number;
    minimumRelevance: number;
  }>;

  readonly fingerprint: Fingerprint;
}

const DEFAULT_MINIMUM_OPPORTUNITY_SCORE = 0.62;
const DEFAULT_MINIMUM_RELEVANCE = 0.7;

function isUnitInterval(
  value: number,
): boolean {
  return Number.isFinite(value) &&
    value >= 0 &&
    value <= 1;
}

function validateUnitInterval(
  value: number,
  field: string,
): void {
  invariant(
    isUnitInterval(value),
    "V8_SEARCH_OPPORTUNITY_INVALID_SCORE",
    `${field} must be a finite number between 0 and 1.`,
  );
}

function validateOpportunity(
  opportunity: Opportunity,
): void {
  invariant(
    opportunity.keyword.keyword.trim().length > 0,
    "V8_SEARCH_OPPORTUNITY_EMPTY_KEYWORD",
    "An opportunity must reference a non-empty keyword.",
  );

  invariant(
    opportunity.keyword.normalized.trim().length > 0,
    "V8_SEARCH_OPPORTUNITY_EMPTY_NORMALIZED_KEYWORD",
    "An opportunity must have a normalized keyword.",
  );

  validateUnitInterval(
    opportunity.score,
    "opportunity.score",
  );

  validateUnitInterval(
    opportunity.demand,
    "opportunity.demand",
  );

  validateUnitInterval(
    opportunity.relevance,
    "opportunity.relevance",
  );

  validateUnitInterval(
    opportunity.competition,
    "opportunity.competition",
  );

  validateUnitInterval(
    opportunity.authorityGap,
    "opportunity.authorityGap",
  );

  validateUnitInterval(
    opportunity.conversionPotential,
    "opportunity.conversionPotential",
  );
}

function validatePolicy(
  policy: SearchOpportunityPolicy,
): Readonly<{
  minimumOpportunityScore: number;
  minimumRelevance: number;
}> {
  const minimumOpportunityScore =
    policy.minimumOpportunityScore ??
    DEFAULT_MINIMUM_OPPORTUNITY_SCORE;

  const minimumRelevance =
    policy.minimumRelevance ??
    DEFAULT_MINIMUM_RELEVANCE;

  validateUnitInterval(
    minimumOpportunityScore,
    "policy.minimumOpportunityScore",
  );

  validateUnitInterval(
    minimumRelevance,
    "policy.minimumRelevance",
  );

  return Object.freeze({
    minimumOpportunityScore,
    minimumRelevance,
  });
}

function validateScopeSignals(
  scope: SearchOpportunityScope,
  signals: readonly MarketReasoningSignal[],
): void {
  invariant(
    scope === "IN_SCOPE" ||
      scope === "OUT_OF_SCOPE" ||
      scope === "UNKNOWN",
    "V8_SEARCH_OPPORTUNITY_INVALID_SCOPE",
    `Unsupported opportunity scope: ${String(scope)}.`,
  );

  const explicitlyOutOfScope = signals.some(
    (signal) => signal.type === "OUT_OF_SCOPE",
  );

  if (scope === "IN_SCOPE") {
    invariant(
      !explicitlyOutOfScope,
      "V8_SEARCH_OPPORTUNITY_SCOPE_CONFLICT",
      "IN_SCOPE conflicts with an explicit OUT_OF_SCOPE signal.",
    );
  }

  if (scope === "OUT_OF_SCOPE") {
    invariant(
      !signals.some(
        (signal) => signal.type === "BUSINESS_RELEVANCE",
      ),
      "V8_SEARCH_OPPORTUNITY_SCOPE_CONFLICT",
      "OUT_OF_SCOPE cannot be combined with a positive BUSINESS_RELEVANCE signal.",
    );
  }
}

function priorityFor(
  score: number,
): SearchOpportunityPriority {
  if (score >= 0.8) {
    return "HIGH";
  }

  if (score >= 0.6) {
    return "NORMAL";
  }

  return "LOW";
}

function recommendationFor(
  state: MarketDecisionEngineResult["decision"]["state"],
  opportunity: Opportunity,
  scope: SearchOpportunityScope,
  minimumOpportunityScore: number,
): SearchOpportunityRecommendation {
  switch (state) {
    case "BLOCK":
      return "BLOCK";

    case "IGNORE":
      return "REJECT";

    case "MERGE":
      return "MERGE";

    case "RESEARCH_REQUIRED":
      return "RESEARCH";

    case "DEFER":
      return "WATCH";

    case "COVER":
      if (scope !== "IN_SCOPE") {
        return "WATCH";
      }

      if (
        opportunity.score <
        minimumOpportunityScore
      ) {
        return "WATCH";
      }

      return "PURSUE";

    case "DISCOVERED":
    case "INTERPRETED":
    case "EVALUATING":
      return "RESEARCH";

    default: {
      const exhaustive: never = state;
      throw new Error(
        `V8_SEARCH_OPPORTUNITY_UNSUPPORTED_MARKET_STATE:${String(exhaustive)}`,
      );
    }
  }
}

function nextStepFor(
  recommendation: SearchOpportunityRecommendation,
  scope: SearchOpportunityScope,
): SearchOpportunityNextStep {
  if (scope === "UNKNOWN") {
    return "REVIEW_SCOPE";
  }

  switch (recommendation) {
    case "PURSUE":
      return "PLAN_CONTENT";

    case "RESEARCH":
      return "RESEARCH_EVIDENCE";

    case "MERGE":
      return "MERGE_WITH_EXISTING";

    case "WATCH":
      return "REVIEW_PRIORITY";

    case "REJECT":
      return "DO_NOT_PURSUE";

    case "BLOCK":
      return "BLOCKED";

    default: {
      const exhaustive: never = recommendation;
      throw new Error(
        `V8_SEARCH_OPPORTUNITY_UNSUPPORTED_RECOMMENDATION:${String(exhaustive)}`,
      );
    }
  }
}

/**
 * Evaluates a search opportunity by adapting existing
 * Opportunity and MarketDemand objects to the canonical
 * MarketDecision engine.
 *
 * Architectural guarantees:
 *
 * 1. No second MarketDecision implementation is created.
 * 2. No Foundation record is fabricated.
 * 3. Missing evidence is handled by the canonical engine.
 * 4. Unknown scope cannot become an approval.
 * 5. Opportunity score affects strategic priority only.
 * 6. Publication is never authorized by this function.
 */
export function evaluateSearchOpportunity(
  input: EvaluateSearchOpportunityInput,
): Readonly<SearchOpportunityDecision> {
  invariant(
    input.decisionId.trim().length > 0,
    "V8_SEARCH_OPPORTUNITY_EMPTY_DECISION_ID",
    "decisionId is required.",
  );

  validateOpportunity(input.opportunity);

  const policy = validatePolicy(
    input.policy ?? {},
  );

  const signals = [
    ...(input.signals ?? []),
  ];

  validateScopeSignals(
    input.scope,
    signals,
  );

  if (input.scope === "OUT_OF_SCOPE") {
    signals.push({
      type: "OUT_OF_SCOPE",
      value: "Opportunity is outside the configured business scope.",
    });
  } else if (input.scope === "UNKNOWN") {
    signals.push({
      type: "REQUIRES_HUMAN_REVIEW",
      value: "Business scope has not been established.",
    });
  }

  if (
    input.scope === "IN_SCOPE" &&
    input.opportunity.relevance <
      policy.minimumRelevance
  ) {
    signals.push({
      type: "REQUIRES_HUMAN_REVIEW",
      value:
        "Business relevance is below the configured minimum threshold.",
    });
  }

  const marketResult = evaluateMarketDecision({
    decisionId: input.decisionId,
    demand: input.demand,
    evidence: input.evidence,
    coverage: input.coverage,
    signals,
    targetAsset:
      input.policy?.targetAsset ?? "ARTICLE",
    confidence:
      input.policy?.confidence,
    evidenceRequirements:
      input.evidenceRequirements,
  });

  const recommendation = recommendationFor(
    marketResult.decision.state,
    input.opportunity,
    input.scope,
    policy.minimumOpportunityScore,
  );

  const nextStep = nextStepFor(
    recommendation,
    input.scope,
  );

  const planningEligible =
    input.scope === "IN_SCOPE" &&
    marketResult.decision.state === "COVER" &&
    recommendation === "PURSUE";

  const canonical = {
    assessmentId: input.decisionId,
    keyword: input.opportunity.keyword.keyword,
    market: input.demand.market,
    language: input.demand.language,
    scope: input.scope,
    opportunityScore: input.opportunity.score,
    priority: priorityFor(
      input.opportunity.score,
    ),
    recommendation,
    nextStep,
    marketDecision: marketResult.decision,
    researchActions: marketResult.researchActions,
    publicationEligible: false as const,
    planningEligible,
    policy,
  };

  const fingerprint = contentFingerprint({
    ...canonical,
    opportunityFingerprintInput: {
      keyword: input.opportunity.keyword.normalized,
      score: input.opportunity.score,
      demand: input.opportunity.demand,
      relevance: input.opportunity.relevance,
      competition: input.opportunity.competition,
      authorityGap: input.opportunity.authorityGap,
      conversionPotential:
        input.opportunity.conversionPotential,
    },
    demandFingerprint: input.demand.fingerprint,
    evidence: input.evidence,
    coverage: input.coverage,
    signals,
  });

  return Object.freeze({
    ...canonical,
    fingerprint,
  });
}