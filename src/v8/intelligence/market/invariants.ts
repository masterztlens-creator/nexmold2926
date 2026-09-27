import {
  invariant,
} from "../../constitution/invariants.js";

import type {
  MarketDemand,
} from "./demand.js";

import type {
  MarketDecision,
} from "./decision.js";

import type {
  ResearchAction,
} from "./research-action.js";

export function assertMarketDemandInvariant(
  demand: MarketDemand,
): void {
  invariant(
    demand.queryObservations.length > 0,
    "V8_MARKET_DEMAND_NO_OBSERVATIONS",
    "MarketDemand requires at least one observation.",
  );

  invariant(
    demand.problem.trim().length > 0,
    "V8_MARKET_DEMAND_NO_PROBLEM",
    "MarketDemand requires a non-empty problem.",
  );

  const observationIds =
    new Set(
      demand.queryObservations.map(
        (observation) =>
          String(observation.id),
      ),
    );

  for (
    const signal of demand.demandSignals
  ) {
    for (
      const observationId of
        signal.sourceObservationIds
    ) {
      invariant(
        observationIds.has(
          String(observationId),
        ),
        "V8_MARKET_DEMAND_ORPHAN_SIGNAL",
        `Demand signal references unknown observation ${String(observationId)}.`,
      );
    }
  }
}

export function assertMarketDecisionInvariant(
  decision: MarketDecision,
): void {
  invariant(
    decision.demandId !== undefined,
    "V8_MARKET_DECISION_NO_DEMAND",
    "MarketDecision must reference a MarketDemand.",
  );

  if (
    decision.state ===
    "RESEARCH_REQUIRED"
  ) {
    invariant(
      decision.researchActions.length > 0,
      "V8_MARKET_DECISION_RESEARCH_WITHOUT_ACTION",
      "RESEARCH_REQUIRED requires research actions.",
    );
  }

  if (
    decision.state === "COVER"
  ) {
    invariant(
      decision.evidenceRequirements.length > 0,
      "V8_MARKET_DECISION_COVER_WITHOUT_EVIDENCE",
      "COVER requires explicit evidence requirements.",
    );

    invariant(
      decision.confidence !== "UNKNOWN",
      "V8_MARKET_DECISION_UNKNOWN_COVER",
      "UNKNOWN confidence cannot produce COVER.",
    );

    invariant(
      decision.uncertainty === false,
      "V8_MARKET_DECISION_UNRESOLVED_COVER",
      "Unresolved uncertainty cannot produce COVER.",
    );

    invariant(
      decision.targetAsset !== null,
      "V8_MARKET_DECISION_COVER_WITHOUT_TARGET",
      "COVER requires a target asset.",
    );
  }

  if (
    decision.state === "MERGE"
  ) {
    invariant(
      decision.existingCoverageRefs.length > 0,
      "V8_MARKET_DECISION_MERGE_WITHOUT_TARGET",
      "MERGE requires existing coverage references.",
    );
  }
}

export function assertResearchActionInvariant(
  action: ResearchAction,
): void {
  invariant(
    action.decisionId !== undefined,
    "V8_RESEARCH_ACTION_NO_DECISION",
    "ResearchAction must reference a MarketDecision.",
  );

  invariant(
    action.question.trim().length > 0,
    "V8_RESEARCH_ACTION_NO_QUESTION",
    "ResearchAction requires a research question.",
  );

  invariant(
    action.target.trim().length > 0,
    "V8_RESEARCH_ACTION_NO_TARGET",
    "ResearchAction requires a target.",
  );

  invariant(
    action.requiredEvidence.length > 0,
    "V8_RESEARCH_ACTION_NO_REQUIRED_EVIDENCE",
    "ResearchAction requires at least one evidence requirement.",
  );
}

export function assertMarketDecisionResearchConsistency(
  decision: MarketDecision,
  actions: readonly ResearchAction[],
): void {
  const decisionActionIds =
    new Set(
      decision.researchActions,
    );

  for (
    const action of actions
  ) {
    if (
      decisionActionIds.has(
        String(action.id),
      )
    ) {
      invariant(
        String(action.decisionId) ===
          String(decision.id),
        "V8_MARKET_DECISION_ACTION_OWNER_MISMATCH",
        `ResearchAction ${String(action.id)} does not belong to MarketDecision ${String(decision.id)}.`,
      );
    }
  }

  if (
    decision.state ===
    "RESEARCH_REQUIRED"
  ) {
    invariant(
      actions.some(
        (action) =>
          decisionActionIds.has(
            String(action.id),
          ),
      ),
      "V8_MARKET_DECISION_MISSING_ACTION_OBJECT",
      "RESEARCH_REQUIRED decision must resolve to at least one concrete ResearchAction.",
    );
  }
}