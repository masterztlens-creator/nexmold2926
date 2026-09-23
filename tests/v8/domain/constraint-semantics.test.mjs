import assert from "node:assert/strict";
import test from "node:test";

import {
  createConstraint,
} from "../../../.v8-build/src/v8/domain/constraint.js";

import {
  createConstraintSemanticRequirements,
  hasExactConstraintSemanticRequirement,
  hasRequiredConstraintSemanticRelations,
} from "../../../.v8-build/src/v8/domain/constraint-semantics.js";

const problemId =
  "problem:injection-molding:draft-angle";

const knowledgeId =
  "knowledge:draft-angle";

const scopeId =
  "scope:injection-molding";

const claimId =
  "claim:draft-angle";

function createFixture() {
  return createConstraint({
    problemId,
    statement:
      "Knowledge must be relevant to the problem.",
  });
}

test(
  "V8-27 creates explicit semantic requirements",
  () => {
    const constraint =
      createFixture();

    const relation = {
      subject: knowledgeId,
      predicate: "RELEVANT_TO",
      object: problemId,
      source: "EXPLICIT",
    };

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        [relation],
      );

    assert.equal(
      requirements.length,
      1,
    );

    assert.equal(
      requirements[0].constraintId,
      constraint.id,
    );

    assert.deepEqual(
      requirements[0].relation,
      relation,
    );
  },
);

test(
  "V8-27 requires at least one explicit semantic relation",
  () => {
    const constraint =
      createFixture();

    assert.throws(
      () =>
        createConstraintSemanticRequirements(
          constraint.id,
          [],
        ),
      /V8_CONSTRAINT_SEMANTIC_REQUIREMENT_EMPTY/,
    );
  },
);

test(
  "V8-27 matches semantic requirements by exact relation identity",
  () => {
    const constraint =
      createFixture();

    const required = {
      subject: knowledgeId,
      predicate: "RELEVANT_TO",
      object: problemId,
      source: "EXPLICIT",
    };

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        [required],
      );

    assert.equal(
      hasExactConstraintSemanticRequirement(
        requirements,
        required,
      ),
      true,
    );

    assert.equal(
      hasExactConstraintSemanticRequirement(
        requirements,
        {
          subject: knowledgeId,
          predicate: "RELEVANT_TO",
          object: problemId,
          source: "VERIFIED_DERIVATION",
        },
      ),
      false,
    );
  },
);

test(
  "V8-27 does not accept a different predicate as satisfaction",
  () => {
    const constraint =
      createFixture();

    const required = {
      subject: knowledgeId,
      predicate: "RELEVANT_TO",
      object: problemId,
      source: "EXPLICIT",
    };

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        [required],
      );

    assert.equal(
      hasRequiredConstraintSemanticRelations(
        requirements,
        [
          {
            subject: knowledgeId,
            predicate: "SCOPE_COMPATIBLE",
            object: scopeId,
            source: "EXPLICIT",
          },
        ],
      ),
      false,
    );
  },
);

test(
  "V8-27 accepts all required exact relations",
  () => {
    const constraint =
      createFixture();

    const relations = [
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
    ];

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        relations,
      );

    assert.equal(
      hasRequiredConstraintSemanticRelations(
        requirements,
        relations,
      ),
      true,
    );
  },
);

test(
  "V8-27 treats missing required relations as unresolved",
  () => {
    const constraint =
      createFixture();

    const required = [
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
        source: "EXPLICIT",
      },
    ];

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        required,
      );

    assert.equal(
      hasRequiredConstraintSemanticRelations(
        requirements,
        [
          required[0],
        ],
      ),
      false,
    );
  },
);

test(
  "V8-27 preserves distinct relation sources",
  () => {
    const constraint =
      createFixture();

    const explicit = {
      subject: knowledgeId,
      predicate: "RELEVANT_TO",
      object: problemId,
      source: "EXPLICIT",
    };

    const derived = {
      subject: knowledgeId,
      predicate: "RELEVANT_TO",
      object: problemId,
      source: "VERIFIED_DERIVATION",
    };

    const requirements =
      createConstraintSemanticRequirements(
        constraint.id,
        [
          explicit,
          derived,
        ],
      );

    assert.equal(
      requirements.length,
      2,
    );
  },
);