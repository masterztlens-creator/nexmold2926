import {
  invariant,
} from "../../constitution/invariants.js";

import type {
  MarketDecisionState,
} from "./decision.js";

export type MarketDecisionTransition =
  | {
      readonly from: "DISCOVERED";
      readonly to: "INTERPRETED";
    }
  | {
      readonly from: "INTERPRETED";
      readonly to: "EVALUATING";
    }
  | {
      readonly from: "EVALUATING";
      readonly to:
        | "RESEARCH_REQUIRED"
        | "COVER"
        | "MERGE"
        | "DEFER"
        | "IGNORE"
        | "BLOCK";
    }
  | {
      readonly from: "RESEARCH_REQUIRED";
      readonly to: "EVALUATING";
    }
  | {
      readonly from:
        | "COVER"
        | "MERGE"
        | "DEFER"
        | "IGNORE"
        | "BLOCK";
      readonly to: "EVALUATING";
    };

const TERMINAL_STATES: readonly MarketDecisionState[] = [
  "COVER",
  "MERGE",
  "DEFER",
  "IGNORE",
  "BLOCK",
];

export function canTransitionMarketDecision(
  from: MarketDecisionState,
  to: MarketDecisionState,
): boolean {
  if (
    from === "DISCOVERED" &&
    to === "INTERPRETED"
  ) {
    return true;
  }

  if (
    from === "INTERPRETED" &&
    to === "EVALUATING"
  ) {
    return true;
  }

  if (
    from === "EVALUATING" &&
    (
      to === "RESEARCH_REQUIRED" ||
      to === "COVER" ||
      to === "MERGE" ||
      to === "DEFER" ||
      to === "IGNORE" ||
      to === "BLOCK"
    )
  ) {
    return true;
  }

  if (
    from === "RESEARCH_REQUIRED" &&
    to === "EVALUATING"
  ) {
    return true;
  }

  if (
    TERMINAL_STATES.includes(from) &&
    to === "EVALUATING"
  ) {
    return true;
  }

  return false;
}

export function assertMarketDecisionTransition(
  from: MarketDecisionState,
  to: MarketDecisionState,
): void {
  invariant(
    canTransitionMarketDecision(
      from,
      to,
    ),
    "V8_MARKET_DECISION_INVALID_TRANSITION",
    `Invalid MarketDecision transition: ${from} -> ${to}.`,
  );

  invariant(
    !(
      from === "DISCOVERED" &&
      to === "COVER"
    ),
    "V8_MARKET_DECISION_DIRECT_COVER",
    "DISCOVERED cannot transition directly to COVER.",
  );

  invariant(
    !(
      from === "RESEARCH_REQUIRED" &&
      to === "COVER"
    ),
    "V8_MARKET_DECISION_RESEARCH_BYPASS",
    "RESEARCH_REQUIRED must return to EVALUATING before a terminal decision.",
  );
}

export function transitionMarketDecision(
  from: MarketDecisionState,
  to: MarketDecisionState,
): MarketDecisionState {
  assertMarketDecisionTransition(
    from,
    to,
  );

  return to;
}

export function isTerminalMarketDecisionState(
  state: MarketDecisionState,
): boolean {
  return TERMINAL_STATES.includes(
    state,
  );
}