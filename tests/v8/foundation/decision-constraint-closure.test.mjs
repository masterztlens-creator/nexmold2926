import assert from "node:assert/strict";
import test from "node:test";

import {
  createProblem,
} from "../../../.v8-build/src/v8/domain/problem.js";

import {
  createConstraint,
} from "../../../.v8-build/src/v8/domain/constraint.js";

import {
  createConstraintResolution,
} from "../../../.v8-build/src/v8/domain/constraint-resolution.js";

import {
  assertDecisionConstraintClosure,
} from "../../../.v8-build/src/v8/foundation/decision-constraint-closure.js";

const problemId =
  "problem:injection-molding:draft-angle";

const contextId =
  "context:injection-molding";

function createFixture() {
  const problem =
    createProblem({
      id: problemId,
      contextId,
      question:
        "What draft angle is appropriate?",
      constraints: [
        "Knowledge must be relevant to the problem.",
        "Evidence must be condition compatible.",
      ],
    });

  const constraints = problem.constraints.map(
    (statement) =>
      createConstraint({
        problemId:
          problem.id,
        statement,
      }),
  );

  const resolutions =
    constraints.map(
      (constraint) =>
        createConstraintResolution({
          constraintId:
            constraint.id,
          status:
            "SATISFIED",
          proof: {
            knowledgeIds: [
              "knowledge:draft-angle",
            ],
            claimIds: [
              "claim:draft-angle",
            ],
          },
          reason:
            "All declared semantic requirements are satisfied.",
        }),
    );

  return {
    problem,
    constraints,
    resolutions,
  };
}

test(
  "V8-27 accepts a fully satisfied Problem constraint closure",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    const closure =
      assertDecisionConstraintClosure({
        problemId:
          problem.id,
        problem,
        constraints,
        resolutions,
      });

    assert.equal(
      closure.problemId,
      problem.id,
    );

    assert.equal(
      closure.constraintIds.length,
      2,
    );

    assert.equal(
      closure.resolutions.length,
      2,
    );
  },
);

test(
  "V8-27 rejects a Decision bound to another Problem",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            "problem:other",
          problem,
          constraints,
          resolutions,
        }),
      /V8_DECISION_CONSTRAINT_PROBLEM_MISMATCH/,
    );
  },
);

test(
  "V8-27 rejects a missing Constraint resolution",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            problem.id,
          problem,
          constraints,
          resolutions: [
            resolutions[0],
          ],
        }),
      /V8_DECISION_CONSTRAINT_RESOLUTION_MISSING/,
    );
  },
);

test(
  "V8-27 rejects an UNKNOWN Constraint resolution",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    const unknown =
      createConstraintResolution({
        constraintId:
          constraints[1].id,
        status:
          "UNKNOWN",
        proof: {
          knowledgeIds: [],
          claimIds: [],
        },
        reason:
          "Required semantic relation is missing.",
      });

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            problem.id,
          problem,
          constraints,
          resolutions: [
            resolutions[0],
            unknown,
          ],
        }),
      /V8_DECISION_CONSTRAINT_NOT_SATISFIED/,
    );
  },
);

test(
  "V8-27 rejects an UNSATISFIED Constraint resolution",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    const unsatisfied =
      createConstraintResolution({
        constraintId:
          constraints[1].id,
        status:
          "UNSATISFIED",
        proof: {
          knowledgeIds: [],
          claimIds: [],
        },
        reason:
          "Semantic conflict detected.",
      });

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            problem.id,
          problem,
          constraints,
          resolutions: [
            resolutions[0],
            unsatisfied,
          ],
        }),
      /V8_DECISION_CONSTRAINT_NOT_SATISFIED/,
    );
  },
);

test(
  "V8-27 rejects duplicate Constraint resolutions",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    const duplicate =
      createConstraintResolution({
        constraintId:
          constraints[0].id,
        status:
          "SATISFIED",
        proof: {
          knowledgeIds: [
            "knowledge:other",
          ],
          claimIds: [
            "claim:other",
          ],
        },
        reason:
          "Duplicate resolution.",
      });

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            problem.id,
          problem,
          constraints,
          resolutions: [
            resolutions[0],
            duplicate,
            resolutions[1],
          ],
        }),
      /V8_DECISION_CONSTRAINT_DUPLICATE_RESOLUTION/,
    );
  },
);

test(
  "V8-27 rejects a resolution for a foreign Constraint",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    const foreignConstraint =
      createConstraint({
        problemId:
          "problem:foreign",
        statement:
          "Foreign constraint.",
      });

    const foreignResolution =
      createConstraintResolution({
        constraintId:
          foreignConstraint.id,
        status:
          "SATISFIED",
        proof: {
          knowledgeIds: [
            "knowledge:foreign",
          ],
          claimIds: [
            "claim:foreign",
          ],
        },
        reason:
          "Foreign resolution.",
      });

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            problem.id,
          problem,
          constraints,
          resolutions: [
            resolutions[0],
            resolutions[1],
            foreignResolution,
          ],
        }),
      /V8_DECISION_CONSTRAINT_RESOLUTION_FOREIGN/,
    );
  },
);

test(
  "V8-27 rejects a Constraint not declared by the Problem",
  () => {
    const {
      problem,
      constraints,
      resolutions,
    } = createFixture();

    const foreignConstraint =
      createConstraint({
        problemId:
          problem.id,
        statement:
          "Constraint not declared by the Problem.",
      });

    const foreignResolution =
      createConstraintResolution({
        constraintId:
          foreignConstraint.id,
        status:
          "SATISFIED",
        proof: {
          knowledgeIds: [
            "knowledge:foreign",
          ],
          claimIds: [
            "claim:foreign",
          ],
        },
        reason:
          "Foreign declaration.",
      });

    assert.throws(
      () =>
        assertDecisionConstraintClosure({
          problemId:
            problem.id,
          problem,
          constraints: [
            ...constraints,
            foreignConstraint,
          ],
          resolutions: [
            ...resolutions,
            foreignResolution,
          ],
        }),
      /V8_DECISION_CONSTRAINT_NOT_DECLARED/,
    );
  },
);