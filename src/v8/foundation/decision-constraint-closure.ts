import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import type {
  Constraint,
} from "../domain/constraint.js";

import type {
  ConstraintResolution,
} from "../domain/constraint-resolution.js";

import type {
  Problem,
} from "../domain/problem.js";

import type {
  ProblemId,
} from "../domain/primitives.js";

export interface DecisionConstraintClosureInput {
  readonly problemId: ProblemId;
  readonly problem: Problem;
  readonly constraints: readonly Constraint[];
  readonly resolutions: readonly ConstraintResolution[];
}

export interface DecisionConstraintClosure {
  readonly problemId: ProblemId;
  readonly constraintIds: readonly Constraint["id"][];
  readonly resolutions: readonly ConstraintResolution[];
}

function assertProblemIdentity(
  problemId: ProblemId,
  problem: Problem,
): void {
  invariant(
    problemId === problem.id,
    "V8_DECISION_CONSTRAINT_PROBLEM_MISMATCH",
    "Decision problem id does not match the supplied Problem.",
  );
}

function assertConstraintsBelongToProblem(
  problem: Problem,
  constraints: readonly Constraint[],
): void {
  const seen = new Set<string>();

  for (const constraint of constraints) {
    invariant(
      constraint.problemId === problem.id,
      "V8_DECISION_CONSTRAINT_PROBLEM_MISMATCH",
      `Constraint ${constraint.id} does not belong to Problem ${problem.id}.`,
    );

    invariant(
      problem.constraints.some(
        (statement) =>
          statement ===
          constraint.statement,
      ),
      "V8_DECISION_CONSTRAINT_NOT_DECLARED",
      `Constraint ${constraint.id} is not declared by Problem ${problem.id}.`,
    );

    invariant(
      !seen.has(constraint.id),
      "V8_DECISION_CONSTRAINT_DUPLICATE",
      `Constraint ${constraint.id} appears more than once.`,
    );

    seen.add(
      constraint.id,
    );
  }
}

function assertResolutionUniqueness(
  resolutions: readonly ConstraintResolution[],
): void {
  const seen = new Set<string>();

  for (const resolution of resolutions) {
    invariant(
      !seen.has(
        resolution.constraintId,
      ),
      "V8_DECISION_CONSTRAINT_DUPLICATE_RESOLUTION",
      `Constraint ${resolution.constraintId} has multiple resolutions.`,
    );

    seen.add(
      resolution.constraintId,
    );
  }
}

function assertAllConstraintsResolved(
  constraints: readonly Constraint[],
  resolutions: readonly ConstraintResolution[],
): void {
  const resolutionIds =
    new Set(
      resolutions.map(
        (resolution) =>
          resolution.constraintId,
      ),
    );

  const missing =
    constraints.filter(
      (constraint) =>
        !resolutionIds.has(
          constraint.id,
        ),
    );

  invariant(
    missing.length === 0,
    "V8_DECISION_CONSTRAINT_RESOLUTION_MISSING",
    `Constraints without resolutions: ${missing
      .map(
        (constraint) =>
          constraint.id,
      )
      .join(",")}`,
  );

  const constraintIds =
    new Set(
      constraints.map(
        (constraint) =>
          constraint.id,
      ),
    );

  const foreign =
    resolutions.filter(
      (resolution) =>
        !constraintIds.has(
          resolution.constraintId,
        ),
    );

  invariant(
    foreign.length === 0,
    "V8_DECISION_CONSTRAINT_RESOLUTION_FOREIGN",
    `Resolutions reference constraints outside the Problem: ${foreign
      .map(
        (resolution) =>
          resolution.constraintId,
      )
      .join(",")}`,
  );
}

function assertAllSatisfied(
  resolutions: readonly ConstraintResolution[],
): void {
  const unresolved =
    resolutions.filter(
      (resolution) =>
        resolution.status !==
        "SATISFIED",
    );

  invariant(
    unresolved.length === 0,
    "V8_DECISION_CONSTRAINT_NOT_SATISFIED",
    `Decision constraint closure is not satisfied: ${unresolved
      .map(
        (resolution) =>
          `${resolution.constraintId}:${resolution.status}`,
      )
      .join(",")}`,
  );
}

export function assertDecisionConstraintClosure(
  input: DecisionConstraintClosureInput,
): Readonly<DecisionConstraintClosure> {
  const {
    problemId,
    problem,
    constraints,
    resolutions,
  } = input;

  assertProblemIdentity(
    problemId,
    problem,
  );

  invariant(
    constraints.length > 0,
    "V8_DECISION_CONSTRAINTS_EMPTY",
    "Decision constraint closure requires Problem constraints.",
  );

  invariant(
    resolutions.length > 0,
    "V8_DECISION_CONSTRAINT_RESOLUTIONS_EMPTY",
    "Decision constraint closure requires constraint resolutions.",
  );

  assertConstraintsBelongToProblem(
    problem,
    constraints,
  );

  assertResolutionUniqueness(
    resolutions,
  );

  assertAllConstraintsResolved(
    constraints,
    resolutions,
  );

  assertAllSatisfied(
    resolutions,
  );

  return immutable({
    problemId,
    constraintIds: immutable(
      constraints.map(
        (constraint) =>
          constraint.id,
      ),
    ),
    resolutions: immutable([
      ...resolutions,
    ]),
  });
}