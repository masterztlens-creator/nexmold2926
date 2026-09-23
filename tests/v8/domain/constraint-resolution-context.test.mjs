import assert from "node:assert/strict";
import test from "node:test";

import {
  createProblem,
} from "../../../.v8-build/src/v8/domain/problem.js";

import {
  createConstraint,
} from "../../../.v8-build/src/v8/domain/constraint.js";

import {
  createConstraintSemanticRequirements,
} from "../../../.v8-build/src/v8/domain/constraint-semantics.js";

import {
  resolveProblemConstraint,
} from "../../../.v8-build/src/v8/domain/constraint-resolution-context.js";

const problemId =
  "problem:injection-molding:draft-angle";

const otherProblemId =
  "problem:injection-molding:wall-thickness";

const contextId =
  "context:injection-molding";

const knowledgeId =
  "knowledge:draft-angle";

function createProblemFixture() {
  return createProblem({
    id: problemId,
    contextId,
    question:
      "What draft angle is appropriate?",
    constraints: [
      "Knowledge must be relevant to the problem.",
      "Evidence must be condition compatible.",
    ],
  });
}

function createConstraintFixture(problem) {
  return createConstraint({
    problemId: problem.id,
    statement:
      "Knowledge must be relevant to the problem.",
  });
}

function createSemanticFixture(constraint) {
  const requirements =
    createConstraintSemanticRequirements(
      constraint.id,
      [
        {
          subject: knowledgeId,
          predicate: "RELEVANT_TO",
          object: problemId,
          source: "EXPLICIT",
        },
      ],
    );

  return {
    requirements,
    relations: [
      {
        subject: knowledgeId,
        predicate: "RELEVANT_TO",
        object: problemId,
        source: "EXPLICIT",
      },
    ],
  };
}

test(
  "V8-27 resolves a constraint only when it belongs to the Problem",
  () => {
    const problem =
      createProblemFixture();

    const constraint =
      createConstraintFixture(
        problem,
      );

    const semantic =
      createSemanticFixture(
        constraint,
      );

    const result =
      resolveProblemConstraint({
        problem,
        constraint,
        semantic,
      });

    assert.equal(
      result.status,
      "SATISFIED",
    );

    assert.deepEqual(
      result.proof.knowledgeIds,
      [knowledgeId],
    );
  },
);

test(
  "V8-27 rejects a Constraint bound to another Problem",
  () => {
    const problem =
      createProblemFixture();

    const otherProblem =
      createProblem({
        id: otherProblemId,
        contextId,
        question:
          "What wall thickness is appropriate?",
        constraints: [
          "Knowledge must be relevant to the problem.",
        ],
      });

    const constraint =
      createConstraintFixture(
        otherProblem,
      );

    const semantic =
      createSemanticFixture(
        constraint,
      );

    assert.throws(
      () =>
        resolveProblemConstraint({
          problem,
          constraint,
          semantic,
        }),
      /V8_CONSTRAINT_PROBLEM_MISMATCH/,
    );
  },
);

test(
  "V8-27 rejects a Constraint whose statement is absent from the Problem",
  () => {
    const problem =
      createProblemFixture();

    const constraint =
      createConstraint({
        problemId: problem.id,
        statement:
          "A statement never declared by this Problem.",
      });

    const semantic =
      createSemanticFixture(
        constraint,
      );

    assert.throws(
      () =>
        resolveProblemConstraint({
          problem,
          constraint,
          semantic,
        }),
      /V8_CONSTRAINT_NOT_DECLARED_BY_PROBLEM/,
    );
  },
);

test(
  "V8-27 preserves UNKNOWN from semantic resolution",
  () => {
    const problem =
      createProblemFixture();

    const constraint =
      createConstraintFixture(
        problem,
      );

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        [
          {
            subject: knowledgeId,
            predicate: "RELEVANT_TO",
            object: problemId,
            source: "EXPLICIT",
          },
        ],
      );

    const result =
      resolveProblemConstraint({
        problem,
        constraint,
        semantic: {
          requirements,
          relations: [],
        },
      });

    assert.equal(
      result.status,
      "UNKNOWN",
    );

    assert.deepEqual(
      result.proof.knowledgeIds,
      [],
    );

    assert.deepEqual(
      result.proof.claimIds,
      [],
    );
  },
);