import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import {
  nonEmpty,
  type ClaimId,
  type Fingerprint,
  type KnowledgeId,
} from "./primitives.js";

import type {
  Constraint,
} from "./constraint.js";

export type ConstraintResolutionStatus =
  | "SATISFIED"
  | "UNSATISFIED"
  | "UNKNOWN";

export interface ConstraintProof {
  readonly knowledgeIds: readonly KnowledgeId[];
  readonly claimIds: readonly ClaimId[];
}

export interface ConstraintResolution {
  readonly constraintId: Constraint["id"];
  readonly status: ConstraintResolutionStatus;
  readonly proof: ConstraintProof;
  readonly reason: string;
  readonly fingerprint: Fingerprint;
}

function uniqueSorted<T extends string>(
  values: readonly T[],
): readonly T[] {
  const normalized = values.map(
    (value) => value.trim() as T,
  );

  return immutable(
    [
      ...new Set<T>(normalized),
    ].sort(),
  );
}

function normalizeProof(
  proof: ConstraintProof,
): ConstraintProof {
  return immutable({
    knowledgeIds:
      uniqueSorted(
        proof.knowledgeIds,
      ),
    claimIds:
      uniqueSorted(
        proof.claimIds,
      ),
  });
}

function normalizeStatus(
  status: ConstraintResolutionStatus,
): ConstraintResolutionStatus {
  invariant(
    status === "SATISFIED" ||
      status === "UNSATISFIED" ||
      status === "UNKNOWN",
    "V8_CONSTRAINT_RESOLUTION_INVALID_STATUS",
    "Constraint resolution status is invalid.",
  );

  return status;
}

export function createConstraintResolution(
  input: Omit<
    ConstraintResolution,
    "fingerprint"
  >,
): Readonly<ConstraintResolution> {
  const status =
    normalizeStatus(
      input.status,
    );

  const constraintId =
    nonEmpty(
      input.constraintId,
      "constraintResolution.constraintId",
    ) as Constraint["id"];

  const reason =
    nonEmpty(
      input.reason,
      "constraintResolution.reason",
    );

  const proof =
    normalizeProof(
      input.proof,
    );

  if (
    status === "SATISFIED"
  ) {
    invariant(
      proof.knowledgeIds.length > 0 ||
        proof.claimIds.length > 0,
      "V8_CONSTRAINT_SATISFIED_WITHOUT_PROOF",
      "A satisfied constraint requires at least one knowledge or claim proof reference.",
    );
  }

  if (
    status === "UNKNOWN"
  ) {
    invariant(
      proof.knowledgeIds.length === 0 &&
        proof.claimIds.length === 0,
      "V8_CONSTRAINT_UNKNOWN_WITH_PROOF",
      "An unknown constraint cannot carry a satisfaction proof.",
    );
  }

  const fingerprint =
    contentFingerprint({
      constraintId,
      status,
      proof,
      reason,
    });

  return immutable({
    constraintId,
    status,
    proof,
    reason,
    fingerprint,
  });
}