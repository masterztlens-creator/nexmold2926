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
  MarketDecisionId,
} from "./decision.js";

export type ResearchActionId =
  string & {
    readonly __brand: "ResearchActionId";
  };

export type ResearchActionType =
  | "SEARCH_DEMAND"
  | "SEARCH_ENTITY"
  | "SEARCH_PROBLEM"
  | "SEARCH_COMPETITOR"
  | "SEARCH_STANDARD"
  | "SEARCH_EVIDENCE"
  | "SEARCH_CONTRADICTION"
  | "SEARCH_COVERAGE"
  | "OPEN_SOURCE"
  | "FOLLOW_LINK"
  | "FOLLOW_REFERENCE"
  | "EXPLORE_SITEMAP";

export type ResearchActionStatus =
  | "PLANNED"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

export type ResearchActionPriority =
  | "LOW"
  | "NORMAL"
  | "HIGH"
  | "CRITICAL";

export interface ResearchAction {
  readonly id: ResearchActionId;
  readonly decisionId: MarketDecisionId;
  readonly type: ResearchActionType;
  readonly question: string;
  readonly target: string;
  readonly priority: ResearchActionPriority;
  readonly requiredEvidence: readonly string[];
  readonly status: ResearchActionStatus;
  readonly fingerprint: Fingerprint;
}

export interface CreateResearchActionInput
  extends Omit<
    ResearchAction,
    "fingerprint"
  > {
  readonly fingerprint?: Fingerprint;
}

function researchActionId(
  value: string,
): ResearchActionId {
  return nonEmpty(
    value,
    "ResearchActionId",
  ) as ResearchActionId;
}

const ACTION_TYPES: readonly ResearchActionType[] = [
  "SEARCH_DEMAND",
  "SEARCH_ENTITY",
  "SEARCH_PROBLEM",
  "SEARCH_COMPETITOR",
  "SEARCH_STANDARD",
  "SEARCH_EVIDENCE",
  "SEARCH_CONTRADICTION",
  "SEARCH_COVERAGE",
  "OPEN_SOURCE",
  "FOLLOW_LINK",
  "FOLLOW_REFERENCE",
  "EXPLORE_SITEMAP",
];

const ACTION_STATUSES: readonly ResearchActionStatus[] = [
  "PLANNED",
  "RUNNING",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
];

export function createResearchAction(
  input: CreateResearchActionInput,
): Readonly<ResearchAction> {
  const id = researchActionId(
    String(input.id),
  );

  const decisionId =
    nonEmpty(
      String(input.decisionId),
      "ResearchAction.decisionId",
    ) as MarketDecisionId;

  invariant(
    ACTION_TYPES.includes(input.type),
    "V8_RESEARCH_ACTION_INVALID_TYPE",
    `Unsupported research action type: ${String(input.type)}.`,
  );

  invariant(
    ACTION_STATUSES.includes(input.status),
    "V8_RESEARCH_ACTION_INVALID_STATUS",
    `Unsupported research action status: ${String(input.status)}.`,
  );

  const question = nonEmpty(
    input.question,
    "ResearchAction.question",
  );

  const target = nonEmpty(
    input.target,
    "ResearchAction.target",
  );

  const requiredEvidence =
    sortedUnique(
      input.requiredEvidence,
    );

  invariant(
    requiredEvidence.length > 0,
    "V8_RESEARCH_ACTION_NO_EVIDENCE_REQUIREMENT",
    "ResearchAction requires at least one evidence requirement.",
  );

  const canonical = {
    id,
    decisionId,
    type: input.type,
    question,
    target,
    priority: input.priority,
    requiredEvidence,
    status: input.status,
  };

  const computedFingerprint =
    contentFingerprint(canonical);

  if (input.fingerprint !== undefined) {
    invariant(
      String(input.fingerprint) ===
        String(computedFingerprint),
      "V8_RESEARCH_ACTION_FINGERPRINT_MISMATCH",
      "ResearchAction fingerprint does not match canonical content.",
    );
  }

  return immutable({
    ...canonical,
    fingerprint: computedFingerprint,
  });
}