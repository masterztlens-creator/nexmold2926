import {
  immutable,
  invariant,
} from "../../constitution/invariants.js";

import {
  nonEmpty,
  sortedUnique,
  type Fingerprint,
} from "../../domain/primitives.js";

import {
  contentFingerprint,
} from "../../foundation/hash.js";

import type {
  MarketDemandId,
} from "./demand.js";

export type MarketDecisionId =
  string & {
    readonly __brand: "MarketDecisionId";
  };

export type MarketDecisionState =
  | "DISCOVERED"
  | "INTERPRETED"
  | "EVALUATING"
  | "RESEARCH_REQUIRED"
  | "COVER"
  | "MERGE"
  | "DEFER"
  | "IGNORE"
  | "BLOCK";

export type MarketDecisionConfidence =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "UNKNOWN";

export type MarketAssetType =
  | "ARTICLE"
  | "GUIDE"
  | "COMPARISON"
  | "REFERENCE"
  | "LANDING_PAGE"
  | "FAQ"
  | "OTHER";

export interface MarketDecision {
  readonly id: MarketDecisionId;
  readonly demandId: MarketDemandId;
  readonly state: MarketDecisionState;
  readonly rationale: string;
  readonly evidenceRequirements: readonly string[];
  readonly researchActions: readonly string[];
  readonly existingCoverageRefs: readonly string[];
  readonly targetAsset:
    | MarketAssetType
    | null;
  readonly confidence: MarketDecisionConfidence;
  readonly uncertainty: boolean;
  readonly fingerprint: Fingerprint;
}

export interface CreateMarketDecisionInput
  extends Omit<
    MarketDecision,
    "fingerprint"
  > {
  readonly fingerprint?: Fingerprint;
}

function marketDecisionId(
  value: string,
): MarketDecisionId {
  return nonEmpty(
    value,
    "MarketDecisionId",
  ) as MarketDecisionId;
}

function validateState(
  state: MarketDecisionState,
): MarketDecisionState {
  const states: readonly MarketDecisionState[] = [
    "DISCOVERED",
    "INTERPRETED",
    "EVALUATING",
    "RESEARCH_REQUIRED",
    "COVER",
    "MERGE",
    "DEFER",
    "IGNORE",
    "BLOCK",
  ];

  invariant(
    states.includes(state),
    "V8_MARKET_DECISION_INVALID_STATE",
    `Unsupported MarketDecision state: ${String(state)}.`,
  );

  return state;
}

export function createMarketDecision(
  input: CreateMarketDecisionInput,
): Readonly<MarketDecision> {
  const id = marketDecisionId(
    String(input.id),
  );

  const demandId = nonEmpty(
    String(input.demandId),
    "MarketDecision.demandId",
  ) as MarketDemandId;

  const state = validateState(
    input.state,
  );

  const rationale = nonEmpty(
    input.rationale,
    "MarketDecision.rationale",
  );

  const evidenceRequirements =
    sortedUnique(
      input.evidenceRequirements,
    );

  const researchActions =
    sortedUnique(
      input.researchActions,
    );

  const existingCoverageRefs =
    sortedUnique(
      input.existingCoverageRefs,
    );

  if (
    state === "RESEARCH_REQUIRED"
  ) {
    invariant(
      researchActions.length > 0,
      "V8_MARKET_DECISION_RESEARCH_REQUIRED_WITHOUT_ACTION",
      "RESEARCH_REQUIRED requires at least one research action.",
    );
  }

  if (
    state === "COVER"
  ) {
    invariant(
      evidenceRequirements.length > 0,
      "V8_MARKET_DECISION_COVER_WITHOUT_EVIDENCE_REQUIREMENTS",
      "COVER requires explicit evidence requirements.",
    );

    invariant(
      input.confidence !== "UNKNOWN",
      "V8_MARKET_DECISION_UNKNOWN_COVER",
      "MarketDecision cannot COVER with UNKNOWN confidence.",
    );

    invariant(
      input.uncertainty === false,
      "V8_MARKET_DECISION_UNCERTAIN_COVER",
      "MarketDecision cannot COVER while uncertainty remains unresolved.",
    );

    invariant(
      input.targetAsset !== null,
      "V8_MARKET_DECISION_COVER_WITHOUT_ASSET",
      "COVER requires a target asset type.",
    );
  }

  if (
    state === "MERGE"
  ) {
    invariant(
      existingCoverageRefs.length > 0,
      "V8_MARKET_DECISION_MERGE_WITHOUT_COVERAGE",
      "MERGE requires at least one existing coverage reference.",
    );
  }

  const canonical = {
    id,
    demandId,
    state,
    rationale,
    evidenceRequirements,
    researchActions,
    existingCoverageRefs,
    targetAsset: input.targetAsset,
    confidence: input.confidence,
    uncertainty: input.uncertainty,
  };

  const computedFingerprint =
    contentFingerprint(canonical);

  if (input.fingerprint !== undefined) {
    invariant(
      String(input.fingerprint) ===
        String(computedFingerprint),
      "V8_MARKET_DECISION_FINGERPRINT_MISMATCH",
      "MarketDecision fingerprint does not match canonical content.",
    );
  }

  return immutable({
    ...canonical,
    fingerprint: computedFingerprint,
  });
}