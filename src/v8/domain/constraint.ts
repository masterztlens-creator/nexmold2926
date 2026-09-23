import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import {
  nonEmpty,
  problemId,
  type Fingerprint,
  type ProblemId,
} from "./primitives.js";

export type ConstraintId =
  `${ProblemId}:constraint:${string}`;

export interface Constraint {
  readonly id: ConstraintId;
  readonly problemId: ProblemId;
  readonly statement: string;
  readonly fingerprint: Fingerprint;
}

function normalizeStatement(
  statement: string,
): string {
  return nonEmpty(
    statement,
    "constraint.statement",
  );
}

export function constraintId(
  problem: ProblemId,
  statement: string,
): ConstraintId {
  const normalized =
    normalizeStatement(statement);

  const suffix =
    contentFingerprint({
      problemId: problem,
      statement: normalized,
    });

  return `${problem}:constraint:${suffix}`;
}

export function createConstraint(
  input: Omit<
    Constraint,
    "id" | "fingerprint"
  > & {
    readonly id?: string;
  },
): Readonly<Constraint> {
  const problem =
    problemId(input.problemId);

  const statement =
    normalizeStatement(
      input.statement,
    );

  const fingerprint =
    contentFingerprint({
      problemId: problem,
      statement,
    });

  const id =
    input.id === undefined
      ? constraintId(
          problem,
          statement,
        )
      : input.id;

  invariant(
    id.trim().length > 0,
    "V8_CONSTRAINT_ID_EMPTY",
    "Constraint id cannot be empty.",
  );

  const expectedId =
    constraintId(
      problem,
      statement,
    );

  invariant(
    id === expectedId,
    "V8_CONSTRAINT_ID_MISMATCH",
    "Constraint id does not match its canonical identity.",
  );

  return immutable({
    id: id as ConstraintId,
    problemId: problem,
    statement,
    fingerprint,
  });
}