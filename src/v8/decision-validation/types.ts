import type { DecisionStatus } from "../domain/decision.js";
import type {
  FoundationRecord,
  FoundationStore,
  LineageLink,
} from "../foundation/types.js";

export interface DecisionValidationInput {
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
}

export interface DecisionValidationResult {
  readonly valid: boolean;
  readonly decisionId: string;
  readonly status: DecisionStatus;
  readonly reasons: readonly string[];
  readonly lineage: readonly LineageLink[];
}

export type DecisionValidationRecord = FoundationRecord;

export type DecisionValidationStore = FoundationStore;

