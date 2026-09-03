import { invariant, requireKnown } from "../constitution/invariants.js";
import type { FoundationState } from "./types.js";

const TRANSITIONS: Readonly<Record<FoundationState, readonly FoundationState[]>> = {
  REGISTERED: ["RETIRED"],
  CAPTURED: ["SEALED", "REJECTED"],
  SEALED: ["RETIRED"],
  INGESTED: ["AUDITED", "REJECTED", "REQUIRES_REVIEW"],
  AUDITED: ["REJECTED", "VERIFIED", "REQUIRES_REVIEW"],
  VERIFIED: ["RETIRED"],
  REJECTED: ["RETIRED"],
  REQUIRES_REVIEW: ["AUDITED", "REJECTED"],
  RETIRED: [],
};

export function assertKnownState(state: FoundationState | string): FoundationState {
  requireKnown(state as FoundationState | "UNKNOWN", "V8_FOUNDATION_UNKNOWN_STATE", "state");
  invariant(Object.prototype.hasOwnProperty.call(TRANSITIONS, state), "V8_FOUNDATION_INVALID_STATE", `Unknown foundation state: ${state}.`);
  return state as FoundationState;
}

export function assertTransition(from: FoundationState, to: FoundationState): void {
  assertKnownState(from);
  assertKnownState(to);
  invariant(TRANSITIONS[from].includes(to), "V8_FOUNDATION_INVALID_TRANSITION", `${from} -> ${to} is not permitted.`);
}

export function allowedTransitions(state: FoundationState): readonly FoundationState[] {
  assertKnownState(state);
  return TRANSITIONS[state];
}
