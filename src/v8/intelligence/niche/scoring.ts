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
const MINIMUM_CAPABILITY_FIT = 0.25;
const MINIMUM_COMMERCIAL_SIGNAL = 0.1;
const WATCH_SCORE_RATIO = 0.8;

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

  return (
    `${(first >>> 0).toString(16).padStart(8, "0")}` +
    `${(second >>> 0).toString(16).padStart(8, "0")}`
  );
}

function normalizeFiniteScore(
  value: number | undefined,
  fallback: number,
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return clamp(value);
}

function normalizeWeights(
  weights?: Partial<NicheScoreWeights>,
): NicheScoreWeights {
  const raw = {
    ...DEFAULT_NICHE_SCORE_WEIGHTS,
    ...(weights ?? {}),
  };

  const values = [
    raw.demand,
    raw.growth,
    raw.competition,
    raw.contentGap,
    raw.commercialIntent,
    raw.capabilityFit,
    raw.conversionPotential,
    raw.evidenceConfidence,
    raw.trafficPotential,
  ];

  if (
    values.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0,
    )
  )
  {
    return DEFAULT_NICHE_SCORE_WEIGHTS;
  }

  const total = values.reduce(
    (sum, value) => sum + value,
    0,
  );

  if (!Number.isFinite(total) || total <= 0) {
    return DEFAULT_NICHE_SCORE_WEIGHTS;
  }

  return {
    demand: raw.demand / total,
    growth: raw.growth / total,
    competition: raw.competition / total,
    contentGap: raw.contentGap / total,
    commercialIntent:
      raw.commercialIntent / total,
    capabilityFit: raw.capabilityFit / total,
    conversionPotential:
      raw.conversionPotential / total,
    evidenceConfidence:
      raw.evidenceConfidence / total,
    trafficPotential:
      raw.trafficPotential / total,
  };
}

function normalizeComponents(
  components: NicheScoreComponents,
): NicheScoreComponents {
  const values = Object.values(components);

  if (
    values.some(
      (value) => !Number.isFinite(value),
    )
  ) {
    throw new Error(
      "V8 niche scoring requires all score components to be finite",
    );
  }

  return {
    demand: clamp(components.demand),
    growth: clamp(components.growth),
    competition: clamp(components.competition),
    contentGap: clamp(components.contentGap),
    commercialIntent: clamp(
      components.commercialIntent,
    ),
    capabilityFit: clamp(
      components.capabilityFit,
    ),
    conversionPotential: clamp(
      components.conversionPotential,
    ),
    evidenceConfidence: clamp(
      components.evidenceConfidence,
    ),
    trafficPotential: clamp(
      components.trafficPotential,
    ),
  };
}

function weightedScore(
  components: NicheScoreComponents,
  weights: NicheScoreWeights,
): number {
  const score =
    components.demand * weights.demand +
    components.growth * weights.growth +
    components.competition *
      weights.competition +
    components.contentGap *
      weights.contentGap +
    components.commercialIntent *
      weights.commercialIntent +
    components.capabilityFit *
      weights.capabilityFit +
    components.conversionPotential *
      weights.conversionPotential +
    components.evidenceConfidence *
      weights.evidenceConfidence +
    components.trafficPotential *
      weights.trafficPotential;

  return clamp(score);
}

function formatScore(value: number): string {
  return value.toFixed(3);
}

function addReason(
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

function uniqueSorted(
  values: readonly string[],
): string[] {
  return [...new Set(
    values
      .map((value) => normalizeText(value))
      .filter(Boolean),
  )].sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeTimestamp(
  value: string | undefined,
): string {
  if (!value) {
    return "1970-01-01T00:00:00.000Z";
  }

  const timestamp = Date.parse(value);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      "V8 niche scoring now must be a valid timestamp",
    );
  }

  return new Date(timestamp).toISOString();
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

  if (
    components.evidenceConfidence <
    minimumEvidenceConfidence
  ) {
    return "REJECT";
  }

  if (
    components.capabilityFit <
    MINIMUM_CAPABILITY_FIT
  ) {
    return "REJECT";
  }

  if (
    components.commercialIntent <
      MINIMUM_COMMERCIAL_SIGNAL &&
    components.conversionPotential <
      MINIMUM_COMMERCIAL_SIGNAL
  ) {
    return score >= minimumScore
      ? "WATCH"
      : "REJECT";
  }

  if (score >= minimumScore) {
    return "PURSUE";
  }

  if (
    score >=
    minimumScore * WATCH_SCORE_RATIO
  ) {
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
  const name = normalizeText(input.name);
  const nicheId = normalizeText(input.nicheId);

  if (!nicheId) {
    throw new Error(
      "V8 niche scoring requires a non-empty nicheId",
    );
  }

  if (!name) {
    throw new Error(
      "V8 niche scoring requires a non-empty niche name",
    );
  }

  const components = normalizeComponents(
    input.components,
  );

  const weights = normalizeWeights(
    input.weights,
  );

  const minimumScore =
    normalizeFiniteScore(
      input.minimumScore,
      DEFAULT_MINIMUM_SCORE,
    );

  const minimumEvidenceConfidence =
    normalizeFiniteScore(
      input.minimumEvidenceConfidence,
      DEFAULT_MINIMUM_EVIDENCE_CONFIDENCE,
    );

  const evidenceIds = uniqueSorted(
    input.evidenceIds,
  );

  const evidenceCount = evidenceIds.length;

  const score = weightedScore(
    components,
    weights,
  );

  const reasons: string[] = [];
  const blockers: string[] = [];

  addReason(
    reasons,
    components.demand >= 0.7,
    `strong demand (${formatScore(
      components.demand,
    )})`,
  );

  addReason(
    reasons,
    components.growth >= 0.6,
    `positive growth (${formatScore(
      components.growth,
    )})`,
  );

  addReason(
    reasons,
    components.competition >= 0.6,
    `favorable competitive position (${formatScore(
      components.competition,
    )})`,
  );

  addReason(
    reasons,
    components.contentGap >= 0.6,
    `meaningful content gap (${formatScore(
      components.contentGap,
    )})`,
  );

  addReason(
    reasons,
    components.commercialIntent >= 0.6,
    `strong commercial intent (${formatScore(
      components.commercialIntent,
    )})`,
  );

  addReason(
    reasons,
    components.capabilityFit >= 0.7,
    `strong capability fit (${formatScore(
      components.capabilityFit,
    )})`,
  );

  addReason(
    reasons,
    components.conversionPotential >= 0.6,
    `strong conversion potential (${formatScore(
      components.conversionPotential,
    )})`,
  );

  addReason(
    reasons,
    components.trafficPotential >= 0.6,
    `strong traffic potential (${formatScore(
      components.trafficPotential,
    )})`,
  );

  addReason(
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
    components.evidenceConfidence <
      minimumEvidenceConfidence,
    `evidence confidence below threshold (${formatScore(
      components.evidenceConfidence,
    )} < ${formatScore(
      minimumEvidenceConfidence,
    )})`,
  );

  addBlocker(
    blockers,
    components.capabilityFit <
      MINIMUM_CAPABILITY_FIT,
    `insufficient capability fit (${formatScore(
      components.capabilityFit,
    )})`,
  );

  addBlocker(
    blockers,
    components.commercialIntent <
        MINIMUM_COMMERCIAL_SIGNAL &&
      components.conversionPotential <
        MINIMUM_COMMERCIAL_SIGNAL,
    "insufficient commercial or conversion potential",
  );

  addBlocker(
    blockers,
    score < minimumScore * WATCH_SCORE_RATIO,
    `score materially below pursuit threshold (${formatScore(
      score,
    )} < ${formatScore(
      minimumScore * WATCH_SCORE_RATIO,
    )})`,
  );

  if (
    reasons.length === 0 &&
    blockers.length === 0
  ) {
    reasons.push(
      `balanced opportunity score (${formatScore(
        score,
      )})`,
    );
  }

  const decision = determineDecision(
    score,
    components,
    evidenceCount,
    minimumScore,
    minimumEvidenceConfidence,
  );

  const lifecycle =
    lifecycleForDecision(
      decision,
      evidenceCount,
    );

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
  const nicheId = normalizeText(
    input.nicheId,
  );

  const name = normalizeText(
    input.name,
  );

  if (!nicheId) {
    throw new Error(
      "V8 niche opportunity requires a nicheId",
    );
  }

  if (!name) {
    throw new Error(
      "V8 niche opportunity requires a non-empty name",
    );
  }

  const evidenceIds = uniqueSorted(
    input.evidenceIds,
  );

  const keywordIds = uniqueSorted(
    input.keywordIds,
  );

  const marketIds = uniqueSorted(
    input.marketIds,
  );

  const scored = scoreNiche({
    ...input,
    nicheId,
    name,
    evidenceIds,
    keywordIds,
    marketIds,
  });

  const createdAt =
    normalizeTimestamp(input.now);

  const normalizedName =
    normalizeText(name);

  const canonical = JSON.stringify({
    nicheId,
    name,
    normalizedName,
    score: Number(
      scored.score.toFixed(8),
    ),
    components: scored.components,
    decision: scored.decision,
    lifecycle: scored.lifecycle,
    evidenceIds,
    keywordIds,
    marketIds,
  });

  const fingerprint =
    `niche-opportunity:v8:${stableHash(
      canonical,
    )}`;

  const opportunity: NicheOpportunity = {
    opportunityId:
      `niche-opportunity:${nicheId}`,
    nicheId,
    name,
    normalizedName,
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

  assertNicheOpportunityInvariant(
    opportunity,
  );

  return opportunity;
}

export function assertNicheOpportunityInvariant(
  opportunity: NicheOpportunity,
): void {
  if (!opportunity.opportunityId) {
    throw new Error(
      "V8 niche opportunity invariant failed: missing opportunityId",
    );
  }

  if (!opportunity.nicheId) {
    throw new Error(
      "V8 niche opportunity invariant failed: missing nicheId",
    );
  }

  if (
    !opportunity.name ||
    !opportunity.normalizedName
  ) {
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

  const componentValues = Object.values(
    opportunity.components,
  );

  if (
    componentValues.some(
      (value) =>
        !Number.isFinite(value) ||
        value < 0 ||
        value > 1,
    )
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: component outside [0,1]",
    );
  }

  const evidenceIds = uniqueSorted(
    opportunity.evidenceIds,
  );

  if (
    JSON.stringify(evidenceIds) !==
    JSON.stringify(opportunity.evidenceIds)
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: evidenceIds are not canonical",
    );
  }

  if (
    opportunity.decision !== "REJECT" &&
    opportunity.decision !== "EXHAUSTED" &&
    opportunity.evidenceIds.length === 0
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: evidence-free niche cannot be pursued or watched",
    );
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
    opportunity.decision === "WATCH" &&
    opportunity.lifecycle !== "VALIDATED"
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: WATCH must be VALIDATED",
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

  if (
    opportunity.decision === "EXHAUSTED" &&
    opportunity.lifecycle !== "EXHAUSTED"
  ) {
    throw new Error(
      "V8 niche opportunity invariant failed: EXHAUSTED must be EXHAUSTED",
    );
  }

  if (
    !opportunity.fingerprint.startsWith(
      "niche-opportunity:v8:",
    )
  ) {
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
    right.components.demand -
      left.components.demand ||
    right.components.growth -
      left.components.growth ||
    right.components.contentGap -
      left.components.contentGap ||
    left.normalizedName.localeCompare(
      right.normalizedName,
    ) ||
    left.opportunityId.localeCompare(
      right.opportunityId,
    )
  );
}