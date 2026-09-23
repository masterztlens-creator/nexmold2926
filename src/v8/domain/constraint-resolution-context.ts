import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  resolveConstraintSemanticRequirements,
  type ResolveConstraintSemanticInput,
} from "./constraint-resolution-engine.js";

import type {
  ConstraintResolution,
} from "./constraint-resolution.js";

import type {
  Constraint,
} from "./constraint.js";

import type {
  Problem,
} from "./problem.js";

export interface ResolveProblemConstraintInput {
  readonly problem: Problem;
  readonly constraint: Constraint;
  readonly semantic: Omit<
    ResolveConstraintSemanticInput,
    "constraint"
  >;
}

function assertConstraintBelongsToProblem(
  problem: Problem,
  constraint: Constraint,
): void {
  invariant(
    constraint.problemId === problem.id,
    "V8_CONSTRAINT_PROBLEM_MISMATCH",
    "Constraint does not belong to the supplied Problem.",
  );

  invariant(
    problem.constraints.some(
      (statement) =>
        statement === constraint.statement,
    ),
    "V8_CONSTRAINT_NOT_DECLARED_BY_PROBLEM",
    "Constraint statement is not declared by the supplied Problem.",
  );
}

export function resolveProblemConstraint(
  input: ResolveProblemConstraintInput,
): Readonly<ConstraintResolution> {
  const {
    problem,
    constraint,
    semantic,
  } = input;

  assertConstraintBelongsToProblem(
    problem,
    constraint,
  );

  const resolution =
    resolveConstraintSemanticRequirements({
      constraint,
      requirements:
        semantic.requirements,
      relations:
        semantic.relations,
    });

  return immutable({
    constraintId:
      resolution.constraintId,
    status:
      resolution.status,
    proof:
      resolution.proof,
    reason:
      resolution.reason,
    fingerprint:
      resolution.fingerprint,
  });
}