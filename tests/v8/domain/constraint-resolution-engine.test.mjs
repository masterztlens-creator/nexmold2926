import assert from "node:assert/strict";
import test from "node:test";

import {
  createConstraint,
} from "../../../.v8-build/src/v8/domain/constraint.js";

import {
  createConstraintSemanticRequirements,
} from "../../../.v8-build/src/v8/domain/constraint-semantics.js";

import {
  resolveConstraintSemanticRequirements,
} from "../../../.v8-build/src/v8/domain/constraint-resolution-engine.js";

const problemId =
  "problem:injection-molding:draft-angle";

const knowledgeId =
  "knowledge:draft-angle";

const claimId =
  "claim:draft-angle";

function createFixture() {
  const constraint =
    createConstraint({
      problemId,
      statement:
        "Knowledge must be relevant to the problem.",
    });

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
        {
          subject: claimId,
          predicate: "CONDITION_COMPATIBLE",
          object: problemId,
          source: "VERIFIED_DERIVATION",
        },
      ],
    );

  return {
    constraint,
    requirements,
  };
}

test(
  "V8-27 resolves all exact semantic requirements as SATISFIED",
  () => {
    const {
      constraint,
      requirements,
    } = createFixture();

    const result =
      resolveConstraintSemanticRequirements({
        constraint,
        requirements,
        relations: [
          {
            subject: knowledgeId,
            predicate: "RELEVANT_TO",
            object: problemId,
            source: "EXPLICIT",
          },
          {
            subject: claimId,
            predicate: "CONDITION_COMPATIBLE",
            object: problemId,
            source: "VERIFIED_DERIVATION",
          },
        ],
      });

    assert.equal(
      result.status,
      "SATISFIED",
    );

    assert.deepEqual(
      result.proof.knowledgeIds,
      [knowledgeId],
    );

    assert.deepEqual(
      result.proof.claimIds,
      [claimId],
    );
  },
);

test(
  "V8-27 resolves a missing semantic requirement as UNKNOWN",
  () => {
    const {
      constraint,
      requirements,
    } = createFixture();

    const result =
      resolveConstraintSemanticRequirements({
        constraint,
        requirements,
        relations: [
          {
            subject: knowledgeId,
            predicate: "RELEVANT_TO",
            object: problemId,
            source: "EXPLICIT",
          },
        ],
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

    assert.match(
      result.reason,
      /Missing semantic requirements/,
    );
  },
);

test(
  "V8-27 resolves an exact semantic conflict as UNSATISFIED",
  () => {
    const {
      constraint,
      requirements,
    } = createFixture();

    const conflict = {
      subject: claimId,
      predicate: "CONFLICTS_WITH",
      object: problemId,
      source: "EXPLICIT",
    };

    const result =
      resolveConstraintSemanticRequirements({
        constraint,
        requirements: [
          ...requirements,
          {
            constraintId: constraint.id,
            relation: conflict,
          },
        ],
        relations: [
          {
            subject: knowledgeId,
            predicate: "RELEVANT_TO",
            object: problemId,
            source: "EXPLICIT",
          },
          {
            subject: claimId,
            predicate: "CONDITION_COMPATIBLE",
            object: problemId,
            source: "VERIFIED_DERIVATION",
          },
          conflict,
        ],
      });

    assert.equal(
      result.status,
      "UNSATISFIED",
    );

    assert.deepEqual(
      result.proof.knowledgeIds,
      [],
    );

    assert.deepEqual(
      result.proof.claimIds,
      [],
    );

    assert.match(
      result.reason,
      /Semantic conflict/,
    );
  },
);

test(
  "V8-27 does not accept a different relation source",
  () => {
    const {
      constraint,
      requirements,
    } = createFixture();

    const result =
      resolveConstraintSemanticRequirements({
        constraint,
        requirements,
        relations: [
          {
            subject: knowledgeId,
            predicate: "RELEVANT_TO",
            object: problemId,
            source: "VERIFIED_DERIVATION",
          },
          {
            subject: claimId,
            predicate: "CONDITION_COMPATIBLE",
            object: problemId,
            source: "VERIFIED_DERIVATION",
          },
        ],
      });

    assert.equal(
      result.status,
      "UNKNOWN",
    );
  },
);

test(
  "V8-27 rejects requirements belonging to another constraint",
  () => {
    const {
      constraint,
    } = createFixture();

    const otherConstraint =
      createConstraint({
        problemId,
        statement:
          "Another independent requirement.",
      });

    const requirements =
      createConstraintSemanticRequirements(
        otherConstraint.id,
        [
          {
            subject: knowledgeId,
            predicate: "RELEVANT_TO",
            object: problemId,
            source: "EXPLICIT",
          },
        ],
      );

    assert.throws(
      () =>
        resolveConstraintSemanticRequirements({
          constraint,
          requirements,
          relations: [
            {
              subject: knowledgeId,
              predicate: "RELEVANT_TO",
              object: problemId,
              source: "EXPLICIT",
            },
          ],
        }),
      /V8_CONSTRAINT_RESOLUTION_CONSTRAINT_MISMATCH/,
    );
  },
);