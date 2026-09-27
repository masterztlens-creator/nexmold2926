import {
  immutable,
} from "../../constitution/invariants.js";

import type {
  MarketDemand,
} from "./demand.js";

import type {
  MarketDecisionId,
} from "./decision.js";

import {
  createResearchAction,
  type ResearchAction,
  type ResearchActionId,
} from "./research-action.js";

export interface ExplorationInput {
  readonly demand: MarketDemand;
  readonly decisionId: string;
  readonly unresolvedQuestions: readonly string[];
  readonly missingEvidence: readonly string[];
  readonly contradictions: readonly string[];
}

function researchActionId(
  value: string,
): ResearchActionId {
  return value as ResearchActionId;
}

function marketDecisionId(
  value: string,
): MarketDecisionId {
  return value as MarketDecisionId;
}

export function planAutonomousExploration(
  input: ExplorationInput,
): readonly ResearchAction[] {
  const out: ResearchAction[] = [];

  for (
    const question of input.contradictions
  ) {
    out.push(
      createResearchAction({
        id: researchActionId(
          `explore:${input.decisionId}:contradiction:${out.length + 1}`,
        ),
        decisionId: marketDecisionId(
          input.decisionId,
        ),
        type: "SEARCH_CONTRADICTION",
        question: `Resolve: ${question}`,
        target: input.demand.problem,
        priority: "CRITICAL",
        requiredEvidence: [
          "independent authoritative evidence",
          question,
        ],
        status: "PLANNED",
      }),
    );
  }

  for (
    const question of input.unresolvedQuestions
  ) {
    out.push(
      createResearchAction({
        id: researchActionId(
          `explore:${input.decisionId}:question:${out.length + 1}`,
        ),
        decisionId: marketDecisionId(
          input.decisionId,
        ),
        type: "SEARCH_EVIDENCE",
        question,
        target: input.demand.problem,
        priority: "HIGH",
        requiredEvidence: [
          "authoritative evidence",
          question,
        ],
        status: "PLANNED",
      }),
    );
  }

  for (
    const requirement of input.missingEvidence
  ) {
    out.push(
      createResearchAction({
        id: researchActionId(
          `explore:${input.decisionId}:evidence:${out.length + 1}`,
        ),
        decisionId: marketDecisionId(
          input.decisionId,
        ),
        type: "SEARCH_EVIDENCE",
        question:
          `Find evidence for ${requirement}`,
        target: input.demand.problem,
        priority: "HIGH",
        requiredEvidence: [
          "authoritative evidence",
          requirement,
        ],
        status: "PLANNED",
      }),
    );
  }

  return immutable(
    out,
  );
}