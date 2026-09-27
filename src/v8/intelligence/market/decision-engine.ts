import {
  immutable,
  invariant,
} from "../../constitution/invariants.js";

import type {
  MarketDemand,
} from "./demand.js";

import {
  createMarketDecision,
  type MarketAssetType,
  type MarketDecision,
  type MarketDecisionConfidence,
  type MarketDecisionId,
  type MarketDecisionState,
} from "./decision.js";

import {
  createResearchAction,
  type ResearchAction,
  type ResearchActionId,
  type ResearchActionPriority,
  type ResearchActionType,
} from "./research-action.js";

import {
  assertMarketDecisionInvariant,
  assertMarketDecisionResearchConsistency,
  assertResearchActionInvariant,
} from "./invariants.js";

export interface MarketDecisionEvidenceState {
  readonly availableEvidence: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly contradictions: readonly string[];
  readonly unresolvedQuestions: readonly string[];
}

export interface MarketCoverageState {
  readonly existingCoverageRefs: readonly string[];
  readonly equivalentCoverage: readonly string[];
  readonly relatedCoverage: readonly string[];
}

export interface MarketReasoningSignal {
  readonly type:
    | "DEMAND_VALID"
    | "DEMAND_WEAK"
    | "BUSINESS_RELEVANCE"
    | "OUT_OF_SCOPE"
    | "EVIDENCE_SUFFICIENT"
    | "EVIDENCE_INSUFFICIENT"
    | "CONTRADICTION"
    | "DUPLICATE_COVERAGE"
    | "COVERAGE_GAP"
    | "REQUIRES_HUMAN_REVIEW";

  readonly value: string;
}

export interface MarketDecisionEngineInput {
  readonly decisionId: string;
  readonly demand: MarketDemand;
  readonly evidence: MarketDecisionEvidenceState;
  readonly coverage: MarketCoverageState;
  readonly signals?: readonly MarketReasoningSignal[];
  readonly targetAsset?: MarketAssetType;
  readonly confidence?: MarketDecisionConfidence;
  readonly evidenceRequirements?: readonly string[];
  readonly researchPriority?: ResearchActionPriority;
}

export interface MarketDecisionEngineResult {
  readonly decision: Readonly<MarketDecision>;
  readonly researchActions: readonly ResearchAction[];
  readonly terminal: boolean;
}

function normalize(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function uniqueSorted(
  values: readonly string[],
): readonly string[] {
  return immutable(
    [
      ...new Set(
        values
          .map(normalize)
          .filter(Boolean),
      ),
    ].sort(),
  );
}

function nonEmptyList(
  values: readonly string[],
): readonly string[] {
  return uniqueSorted(values);
}

function hasSignal(
  signals: readonly MarketReasoningSignal[],
  type: MarketReasoningSignal["type"],
): boolean {
  return signals.some(
    (signal) => signal.type === type,
  );
}

function signalValue(
  signals: readonly MarketReasoningSignal[],
  type: MarketReasoningSignal["type"],
): readonly string[] {
  return immutable(
    signals
      .filter(
        (signal) =>
          signal.type === type,
      )
      .map(
        (signal) => signal.value,
      )
      .filter(
        (value) =>
          value.trim().length > 0,
      ),
  );
}

function assertDecisionId(
  value: string,
): MarketDecisionId {
  const normalized = value.trim();

  invariant(
    normalized.length > 0,
    "V8_MARKET_DECISION_ENGINE_EMPTY_DECISION_ID",
    "MarketDecisionEngine requires a deterministic decisionId.",
  );

  return normalized as MarketDecisionId;
}

function selectResearchActionType(
  input: MarketDecisionEngineInput,
): ResearchActionType {
  if (
    input.evidence.contradictions.length > 0 ||
    hasSignal(
      input.signals ?? [],
      "CONTRADICTION",
    )
  ) {
    return "SEARCH_CONTRADICTION";
  }

  if (
    input.coverage.equivalentCoverage.length > 0
  ) {
    return "SEARCH_COVERAGE";
  }

  if (
    input.demand.entities.length > 0 &&
    input.evidence.missingEvidence.length === 0
  ) {
    return "SEARCH_EVIDENCE";
  }

  if (
    input.demand.entities.length > 0
  ) {
    return "SEARCH_ENTITY";
  }

  if (
    input.demand.problem.trim().length > 0
  ) {
    return "SEARCH_PROBLEM";
  }

  return "SEARCH_DEMAND";
}

function createAction(
  input: MarketDecisionEngineInput,
  decisionId: MarketDecisionId,
  index: number,
): Readonly<ResearchAction> {
  const type =
    selectResearchActionType(input);

  const target =
    input.demand.problem.trim();

  const question =
    input.evidence.contradictions.length > 0
      ? `Resolve contradictory evidence for: ${target}`
      : input.evidence.unresolvedQuestions.length > 0
        ? input.evidence.unresolvedQuestions[0]
        : input.evidence.missingEvidence.length > 0
          ? `Find authoritative evidence for: ${input.evidence.missingEvidence[0]}`
          : `Validate evidence requirements for: ${target}`;

  const requiredEvidence =
    nonEmptyList([
      ...input.evidence.missingEvidence,
      ...input.evidence.unresolvedQuestions,
      "source-bound evidence",
    ]);

  const id =
    `research-action:${decisionId}:${type.toLowerCase()}:${index + 1}`;

  return createResearchAction({
    id,
    decisionId,
    type,
    question,
    target,
    priority:
      input.researchPriority ??
      (
        type ===
        "SEARCH_CONTRADICTION"
          ? "CRITICAL"
          : "HIGH"
      ),
    requiredEvidence,
    status: "PLANNED",
  });
}

function buildResearchActions(
  input: MarketDecisionEngineInput,
  decisionId: MarketDecisionId,
): readonly ResearchAction[] {
  const actions: ResearchAction[] = [];

  if (
    input.evidence.contradictions.length > 0 ||
    hasSignal(
      input.signals ?? [],
      "CONTRADICTION",
    )
  ) {
    actions.push(
      createAction(
        input,
        decisionId,
        actions.length,
      ),
    );
  }

  for (
    const question of input.evidence
      .unresolvedQuestions
  ) {
    const action = createResearchAction({
      id:
        `research-action:${decisionId}:question:${actions.length + 1}`,
      decisionId,
      type: "SEARCH_EVIDENCE",
      question,
      target:
        input.demand.problem,
      priority:
        input.researchPriority ??
        "HIGH",
      requiredEvidence: [
        "authoritative source",
        question,
      ],
      status: "PLANNED",
    });

    actions.push(action);
  }

  for (
    const missing of input.evidence
      .missingEvidence
  ) {
    const action = createResearchAction({
      id:
        `research-action:${decisionId}:evidence:${actions.length + 1}`,
      decisionId,
      type: "SEARCH_EVIDENCE",
      question:
        `What authoritative evidence establishes ${missing}?`,
      target:
        input.demand.problem,
      priority:
        input.researchPriority ??
        "HIGH",
      requiredEvidence: [
        "authoritative source",
        missing,
      ],
      status: "PLANNED",
    });

    actions.push(action);
  }

  if (
    actions.length === 0 &&
    hasSignal(
      input.signals ?? [],
      "EVIDENCE_INSUFFICIENT",
    )
  ) {
    actions.push(
      createAction(
        input,
        decisionId,
        0,
      ),
    );
  }

  return immutable(
    actions.map(
      (action) => {
        assertResearchActionInvariant(
          action,
        );

        return action;
      },
    ),
  );
}

function buildRationale(
  state: MarketDecisionState,
  input: MarketDecisionEngineInput,
): string {
  const signalText =
    signalValue(
      input.signals ?? [],
      "BUSINESS_RELEVANCE",
    );

  switch (state) {
    case "BLOCK":
      return [
        "Market demand cannot proceed because an explicit blocking condition was identified.",
        ...signalText,
      ].join(" ");

    case "IGNORE":
      return "Market demand does not establish a sufficiently valid or relevant coverage opportunity.";

    case "DEFER":
      return "Market demand remains unresolved and requires a later evaluation cycle.";

    case "MERGE":
      return "Equivalent existing coverage already addresses the identified market demand.";

    case "COVER":
      return "Demand is sufficiently established, evidence requirements are satisfied, contradictions are absent, and no equivalent coverage exists.";

    case "RESEARCH_REQUIRED":
      return "Evidence or uncertainty remains unresolved; additional research is required before coverage can be approved.";

    default:
      return "Market demand is being evaluated.";
  }
}

function evaluateState(
  input: MarketDecisionEngineInput,
): MarketDecisionState {
  const signals =
    input.signals ?? [];

  if (
    hasSignal(
      signals,
      "OUT_OF_SCOPE",
    )
  ) {
    return "BLOCK";
  }

  if (
    hasSignal(
      signals,
      "REQUIRES_HUMAN_REVIEW",
    )
  ) {
    return "DEFER";
  }

  if (
    hasSignal(
      signals,
      "DEMAND_WEAK",
    )
  ) {
    return "IGNORE";
  }

  const contradictions =
    input.evidence.contradictions
      .length > 0 ||
    hasSignal(
      signals,
      "CONTRADICTION",
    );

  const unresolved =
    input.evidence.unresolvedQuestions
      .length > 0;

  const missing =
    input.evidence.missingEvidence
      .length > 0;

  if (
    contradictions ||
    unresolved ||
    missing ||
    hasSignal(
      signals,
      "EVIDENCE_INSUFFICIENT",
    )
  ) {
    return "RESEARCH_REQUIRED";
  }

  const equivalentCoverage =
    input.coverage.equivalentCoverage
      .length > 0;

  if (
    equivalentCoverage ||
    hasSignal(
      signals,
      "DUPLICATE_COVERAGE",
    )
  ) {
    return "MERGE";
  }

  const evidenceSufficient =
    input.evidence.availableEvidence
      .length > 0 &&
    (
      hasSignal(
        signals,
        "EVIDENCE_SUFFICIENT",
      ) ||
      (
        input.evidenceRequirements?.length ??
        0
      ) === 0
    );

  if (
    !evidenceSufficient
  ) {
    return "RESEARCH_REQUIRED";
  }

  if (
    input.demand.uncertainty ===
    "UNKNOWN"
  ) {
    return "RESEARCH_REQUIRED";
  }

  return "COVER";
}

function resolveConfidence(
  state: MarketDecisionState,
  input: MarketDecisionEngineInput,
): MarketDecisionConfidence {
  if (
    state === "COVER" &&
    input.confidence !== undefined &&
    input.confidence !== "UNKNOWN"
  ) {
    return input.confidence;
  }

  if (
    state === "COVER"
  ) {
    return "HIGH";
  }

  if (
    state === "RESEARCH_REQUIRED"
  ) {
    return "LOW";
  }

  return (
    input.confidence ??
    "UNKNOWN"
  );
}

function resolveUncertainty(
  state: MarketDecisionState,
  input: MarketDecisionEngineInput,
): boolean {
  if (
    state === "COVER"
  ) {
    return false;
  }

  return (
    input.demand.uncertainty !==
      "LOW" ||
    input.evidence.contradictions
      .length > 0 ||
    input.evidence.unresolvedQuestions
      .length > 0 ||
    input.evidence.missingEvidence
      .length > 0
  );
}

function resolveEvidenceRequirements(
  input: MarketDecisionEngineInput,
): readonly string[] {
  return nonEmptyList([
    ...(input.evidenceRequirements ?? []),
    ...input.evidence.availableEvidence,
    ...input.evidence.missingEvidence,
    "claim-level source binding",
  ]);
}

export function evaluateMarketDecision(
  input: MarketDecisionEngineInput,
): MarketDecisionEngineResult {
  const decisionId =
    assertDecisionId(
      input.decisionId,
    );

  invariant(
    input.demand.queryObservations
      .length > 0,
    "V8_MARKET_DECISION_ENGINE_NO_DEMAND_OBSERVATION",
    "Market decision requires observed market demand.",
  );

  invariant(
    input.demand.problem.trim()
      .length > 0,
    "V8_MARKET_DECISION_ENGINE_NO_PROBLEM",
    "Market decision requires a concrete market problem.",
  );

  const state =
    evaluateState(input);

  const actions =
    state ===
      "RESEARCH_REQUIRED"
      ? buildResearchActions(
          input,
          decisionId,
        )
      : immutable([]);

  if (
    state ===
      "RESEARCH_REQUIRED"
  ) {
    invariant(
      actions.length > 0,
      "V8_MARKET_DECISION_ENGINE_RESEARCH_WITHOUT_ACTION",
      "RESEARCH_REQUIRED must produce concrete research actions.",
    );
  }

  const evidenceRequirements =
    resolveEvidenceRequirements(
      input,
    );

  const existingCoverageRefs =
    uniqueSorted([
      ...input.coverage.existingCoverageRefs,
      ...input.coverage.equivalentCoverage,
    ]);

  const targetAsset =
    state === "COVER"
      ? (
          input.targetAsset ??
          "ARTICLE"
        )
      : state === "MERGE"
        ? input.targetAsset ?? "ARTICLE"
        : null;

  const confidence =
    resolveConfidence(
      state,
      input,
    );

  const uncertainty =
    resolveUncertainty(
      state,
      input,
    );

  const decision =
    createMarketDecision({
      id: decisionId,
      demandId: input.demand.id,
      state,
      rationale:
        buildRationale(
          state,
          input,
        ),
      evidenceRequirements,
      researchActions:
        actions.map(
          (action) =>
            String(action.id),
        ),
      existingCoverageRefs,
      targetAsset,
      confidence,
      uncertainty,
    });

  assertMarketDecisionInvariant(
    decision,
  );

  assertMarketDecisionResearchConsistency(
    decision,
    actions,
  );

  return immutable({
    decision,
    researchActions:
      actions,
    terminal:
      state === "COVER" ||
      state === "MERGE" ||
      state === "DEFER" ||
      state === "IGNORE" ||
      state === "BLOCK",
  });
}