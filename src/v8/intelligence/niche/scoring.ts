import { clamp, normalizeText } from "../shared.js";
import type {
  GrowthIntelligenceLifecycle,
  NicheDecision,
  NicheOpportunity,
  NicheScoreComponents,
  NicheScoreWeights,
} from "../growth-intelligence/types.js";

export interface NicheScoringInput {
  readonly nicheId: string;
  readonly name: string;
  readonly components: NicheScoreComponents;
  readonly evidenceIds: readonly string[];
  readonly keywordIds: readonly string[];
  readonly marketIds: readonly string[];
  readonly minimumEvidenceConfidence?: number;
  readonly minimumScore?: number;
  readonly weights?: Partial<NicheScoreWeights>;
  readonly now?: string;
}

export interface NicheScoringResult {
  readonly score: number;
  readonly components: NicheScoreComponents;
  readonly decision: NicheDecision;
  readonly lifecycle: GrowthIntelligenceLifecycle;
  readonly reasons: readonly string[];
  readonly blockers: readonly string[];
}

export const DEFAULT_NICHE_SCORE_WEIGHTS: NicheScoreWeights = {
  demand: 0.16,
  growth: 0.12,
  competition: 0.09,
  contentGap: 0.12,
  commercialIntent: 0.13,
  capabilityFit: 0.12,
  conversionPotential: 0.11,
  evidenceConfidence: 0.08,
  trafficPotential: 0.07,
};

const DEFAULT_MINIMUM_SCORE = 0.65;
const DEFAULT_MINIMUM_EVIDENCE_CONFIDENCE = 0.6;

function normalizeWeights(
  weights?: Partial<NicheScoreWeights>,
): NicheScoreWeights {
  const merged: NicheScoreWeights = {
    ...DEFAULT_NICHE_SCORE_WEIGHTS,
    ...(weights ?? {}),
  };

  const total =
    merged.demand +
    merged.growth +
    merged.competition +
    merged.contentGap +
    merged.commercialIntent +
    merged.capabilityFit +
    merged.conversionPotential +
    merged.evidenceConfidence +
    merged.trafficPotential;

  if (!Number.isFinite(total) || total <= 0) {
    return DEFAULT_NICHE_SCORE_WEIGHTS;
  }

  return {
    demand: merged.demand / total,
    growth: merged.growth / total,
    competition: merged.competition / total,
    contentGap: merged.contentGap / total,
    commercialIntent: merged.commercialIntent / total,
    capabilityFit: merged.capabilityFit / total,
    conversionPotential: merged.conversionPotential / total,
    evidenceConfidence: merged.evidenceConfidence / total,
    trafficPotential: merged.trafficPotential / total,
  };
}

function normalizeComponents(
  components: NicheScoreComponents,
): NicheScoreComponents {
  return {
    demand: clamp(components.demand),
    growth: clamp(components.growth),
    competition: clamp(components.competition),
    contentGap: clamp(components.contentGap),
    commercialIntent: clamp(components.commercialIntent),
    capabilityFit: clamp(components.capabilityFit),
    conversionPotential: clamp(components.conversionPotential),
    evidenceConfidence: clamp(components.evidenceConfidence),
    trafficPotential: clamp(components.trafficPotential),
  };
}

function weightedScore(
  components: NicheScoreComponents,
  weights: NicheScoreWeights,
): number {
  return clamp(
    components.demand * weights.demand +
      components.growth * weights.growth +
      components.competition * weights.competition +
      components.contentGap * weights.contentGap +
      components.commercialIntent * weights.commercialIntent +
      components.capabilityFit * weights.capabilityFit +
      components.conversionPotential * weights.conversionPotential +
      components.evidenceConfidence * weights.evidenceConfidence +
      components.trafficPotential * weights.trafficPotential,
  );
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

function addPositiveReason(
  reasons: string[],
  condition: boolean,
  message: string,
): void {
  if (condition) {
    reasons.push(message);
  }
}

function addBlocker(
  blockers: string[],
  condition: boolean,
  message: string,
): void {
  if (condition) {
    blockers.push(message);
  }
}

function determineDecision(
  score: number,
  components: NicheScoreComponents,
  evidenceCount: number,
  minimumScore: number,
  minimumEvidenceConfidence: number,
): NicheDecision {
  if (evidenceCount === 0) {
    return "REJECT";
  }

  if (components.evidenceConfidence < minimumEvidenceConfidence) {
    return "REJECT";
  }

  if (components.capabilityFit < 0.25) {
    return "REJECT";
  }

  if (
    components.commercialIntent < 0.1 &&
    components.conversionPotential < 0.1
  ) {
    return score >= minimumScore ? "WATCH" : "REJECT";
  }

  if (score >= minimumScore) {
    return "PURSUE";
  }

  if (score >= minimumScore * 0.8) {
    return "WATCH";
  }

  return "REJECT";
}

function lifecycleForDecision(
  decision: NicheDecision,
  evidenceCount: number,
): GrowthIntelligenceLifecycle {
  if (evidenceCount === 0) {
    return "DISCOVERED";
  }

  switch (decision) {
    case "PURSUE":
      return "APPROVED";
    case "WATCH":
      return "VALIDATED";
    case "REJECT":
      return "REJECTED";
    case "EXHAUSTED":
      return "EXHAUSTED";
  }
}

function stableHash(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;

  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;

    first ^= code;
    first = Math.imul(first, 0x01000193);

    second ^= code + 0x7ed55d16;
    second = Math.imul(second, 0x01000193);
  }

  return `${(first >>> 0).toString(16).padStart(8, "0")}${(
    second >>> 0
  )
    .toString(16)
    .padStart(8, "0")}`;
}

export function calculateNicheScore(
  components: NicheScoreComponents,
  weights?: Partial<NicheScoreWeights>,
): number {
  return weightedScore(
    normalizeComponents(components),
    normalizeWeights(weights),
  );
}

export function scoreNiche(
  input: NicheScoringInput,
): NicheScoringResult {
  const components = normalizeComponents(input.components);
  const weights = normalizeWeights(input.weights);
  const minimumScore =
    Number.isFinite(input.minimumScore) && input.minimumScore !== undefined
      ? clamp(input.minimumScore)
      : DEFAULT_MINIMUM_SCORE;

  const minimumEvidenceConfidence =
    Number.isFinite(input.minimumEvidenceConfidence) &&
    input.minimumEvidenceConfidence !== undefined
      ? clamp(input.minimumEvidenceConfidence)
      : DEFAULT_MINIMUM_EVIDENCE_CONFIDENCE;

  const evidenceCount = input.evidenceIds.filter(Boolean).length;
  const score = weightedScore(components, weights);

  const reasons: string[] = [];
  const blockers: string[] = [];

  addPositiveReason(
    reasons,
    components.demand >= 0.7,
    `strong demand (${formatScore(components.demand)})`,
  );

  addPositiveReason(
    reasons,
    components.growth >= 0.6,
    `positive growth (${formatScore(components.growth)})`,
  );

  addPositiveReason(
    reasons,
    components.competition >= 0.6,
    `favorable competitive position (${formatScore(components.competition)})`,
  );

  addPositiveReason(
    reasons,
    components.contentGap >= 0.6,
    `meaningful content gap (${formatScore(components.contentGap)})`,
  );

  addPositiveReason(
    reasons,
    components.commercialIntent >= 0.6,
    `strong commercial intent (${formatScore(components.commercialIntent)})`,
  );

  addPositiveReason(
    reasons,
    components.capabilityFit >= 0.7,
    `strong capability fit (${formatScore(components.capabilityFit)})`,
  );

  addPositiveReason(
    reasons,
    components.conversionPotential >= 0.6,
    `strong conversion potential (${formatScore(
      components.conversionPotential,
    )})`,
  );

  addPositiveReason(
    reasons,
    components.trafficPotential >= 0.6,
    `strong traffic potential (${formatScore(
      components.trafficPotential,
    )})`,
  );

  addPositiveReason(
    reasons,
    components.evidenceConfidence >= 0.8,
    `high evidence confidence (${formatScore(
      components.evidenceConfidence,
    )})`,
  );

  addBlocker(
    blockers,
    evidenceCount === 0,
    "no evidence is attached to the niche",
  );

  addBlocker(
    blockers,
    components.evidenceConfidence < minimumEvidenceConfidence,
    `evidence confidence below threshold (${formatScore(
      components.evidenceConfidence,
    )} < ${formatScore(minimumEvidenceConfidence)})`,
  );

  addBlocker(
    blockers,
    components.capabilityFit < 0.25,
    `insufficient capability fit (${formatScore(
      components.capabilityFit,
    )})`,
  );

  addBlocker(
    blockers,
    components.commercialIntent < 0.1 &&
      components.conversionPotential < 0.1,
    "insufficient commercial or conversion potential",
  );

  addBlocker(
    blockers,
    score < minimumScore * 0.8,
    `score materially below pursuit threshold (${formatScore(
      score,
    )} < ${formatScore(minimumScore * 0.8)})`,
  );

  if (reasons.length === 0 && blockers.length === 0) {
    reasons.push(`balanced opportunity score (${formatScore(score)})`);
  }

  const decision = determineDecision(
    score,
    components,
    evidenceCount,
    minimumScore,
    minimumEvidenceConfidence,
  );

  const lifecycle = lifecycleForDecision(decision, evidenceCount);

  return {
    score,
    components,
    decision,
    lifecycle,
    reasons: [...new Set(reasons)],
    blockers: [...new Set(blockers)],
  };
}

export function createNicheOpportunity(
  input: NicheScoringInput,
): NicheOpportunity {
  const name = normalizeText(input.name);

  if (!name) {
    throw new Error("V8 niche opportunity requires a non-empty name");
  }

  const nicheId = normalizeText(input.nicheId);

  if (!nicheId) {
    throw new Error("V8 niche opportunity requires a nicheId");
  }

  const evidenceIds = [...new Set(input.evidenceIds.filter(Boolean))].sort();
  const keywordIds = [...new Set(input.keywordIds.filter(Boolean))].sort();
  const marketIds = [...new Set(input.marketIds.filter(Boolean))].sort();

  const scored = scoreNiche({
    ...input,
    name,
    nicheId,
    evidenceIds,
    keywordIds,
    marketIds,
  });

  const createdAt =
    input.now && !Number.isNaN(Date.parse(input.now))
      ? input.now
      : new Date().toISOString();

  const canonical = JSON.stringify({
    nicheId,
    name,
    score: Number(scored.score.toFixed(8)),
    components: scored.components,
    decision: scored.decision,
    lifecycle: scored.lifecycle,
    evidenceIds,
    keywordIds,
    marketIds,
  });

  const fingerprint = `niche-opportunity:v8:${stableHash(canonical)}`;

  return {
    opportunityId: `niche-opportunity:${nicheId}`,
    nicheId,
    name,
    normalizedName: normalizeText(name),
    score: scored.score,
    components: scored.components,
    reasons: scored.reasons,
    blockers: scored.blockers,
    decision: scored.decision,
    lifecycle: scored.lifecycle,
    evidenceIds,
    keywordIds,
    marketIds,
    createdAt,
    fingerprint,
  };
}

export function assertNicheOpportunityInvariant(
  opportunity: NicheOpportunity,
): void {
  if (!opportunity.nicheId) {
    throw new Error("V8 niche opportunity invariant failed: missing nicheId");
  }

  if (!opportunity.opportunityId) {
    throw new Error(
      "V8 niche opportunity invariant failed: missing opportunityId",
    );
  }

  if (!opportunity.name || !opportunity.normalizedName) {
    throw new Error(
      "V8 niche opportunity invariant failed: missing niche name",
    );
  }

  if (
    !Number.isFinite(opportunity.score) ||
    opportunity.score < 0 ||
    opportunity.score > 1
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: score outside [0,1]",
    );
  }

  const componentValues = Object.values(opportunity.components);

  if (
    componentValues.some(
      (value) => !Number.isFinite(value) || value < 0 || value > 1,
    )
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: component outside [0,1]",
    );
  }

  if (opportunity.evidenceIds.length === 0) {
    if (
      opportunity.decision !== "REJECT" &&
      opportunity.decision !== "EXHAUSTED"
    ) {
      throw new Error(
        "V8 niche opportunity invariant failed: evidence-free niche cannot be pursued",
      );
    }
  }

  if (
    opportunity.decision === "PURSUE" &&
    opportunity.lifecycle !== "APPROVED"
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: PURSUE must be APPROVED",
    );
  }

  if (
    opportunity.decision === "REJECT" &&
    opportunity.lifecycle !== "REJECTED"
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: REJECT must be REJECTED",
    );
  }

  if (!opportunity.fingerprint.startsWith("niche-opportunity:v8:")) {
    throw new Error(
      "V8 niche opportunity invariant failed: invalid fingerprint",
    );
  }
}

export function compareNicheOpportunities(
  left: NicheOpportunity,
  right: NicheOpportunity,
): number {
  return (
    right.score - left.score ||
    right.components.commercialIntent -
      left.components.commercialIntent ||
    right.components.conversionPotential -
      left.components.conversionPotential ||
    right.components.evidenceConfidence -
      left.components.evidenceConfidence ||
    left.normalizedName.localeCompare(right.normalizedName) ||
    left.opportunityId.localeCompare(right.opportunityId)
  );
}