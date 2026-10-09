import test from "node:test";
import assert from "node:assert/strict";

import {
  createCondition,
  assertConditionIntegrity,
  deriveConditionId,
} from "../../../.v8-build/src/v8/intelligence/knowledge/condition-model.js";

const VALID_OPERATORS = [
  "EQ",
  "NEQ",
  "GT",
  "GTE",
  "LT",
  "LTE",
  "IN",
  "NOT_IN",
  "BETWEEN",
  "CONTAINS",
  "NOT_CONTAINS",
  "MATCHES",
  "EXISTS",
  "NOT_EXISTS",
];

const INVALID_OPERATORS = [
  "EQUALS",
  "NOT_EQUALS",
  "GREATER_THAN",
  "GREATER_THAN_OR_EQUAL",
  "LESS_THAN",
  "LESS_THAN_OR_EQUAL",
  "NOT_MATCHES",
  "OUTSIDE",
  "",
  "UNKNOWN",
];

function conditionInput(operator) {
  return {
    subjectEntityId: "entity:material:abs",
    propertyId: "property:shrinkage",
    operator,
    expected: {
      kind: "NUMBER",
      value: 1.2,
      unit: "%",
    },
    unit: "%",
    statement: "Material shrinkage is evaluated.",
  };
}

test("V8 Condition Model accepts every canonical operator", () => {
  for (const operator of VALID_OPERATORS) {
    const condition = createCondition(
      conditionInput(operator),
    );

    assert.equal(condition.operator, operator);
    assert.ok(condition.conditionId.length > 0);
    assert.ok(condition.fingerprint.length > 0);

    assert.doesNotThrow(() => {
      assertConditionIntegrity(condition);
    });
  }
});

test("V8 Condition Model rejects operators outside the canonical contract", () => {
  for (const operator of INVALID_OPERATORS) {
    assert.throws(
      () => {
        createCondition(
          conditionInput(operator),
        );
      },
      {
        message: new RegExp(
          "V8_KNOWLEDGE_INVALID_CONDITION_OPERATOR",
        ),
      },
      `Expected operator "${operator}" to be rejected`,
    );
  }
});

test("V8 Condition Model derives distinct identities for distinct operators", () => {
  const identities = VALID_OPERATORS.map(
    (operator) =>
      deriveConditionId(
        conditionInput(operator),
      ),
  );

  assert.equal(
    new Set(identities).size,
    VALID_OPERATORS.length,
  );
});

test("V8 Condition Model produces deterministic identity for identical input", () => {
  const input = conditionInput("LTE");

  assert.equal(
    deriveConditionId(input),
    deriveConditionId({ ...input }),
  );

  const first = createCondition(input);
  const second = createCondition({ ...input });

  assert.equal(
    first.conditionId,
    second.conditionId,
  );

  assert.equal(
    first.fingerprint,
    second.fingerprint,
  );
});

test("V8 Condition Model rejects conditions without an entity or property", () => {
  assert.throws(
    () => {
      createCondition({
        operator: "EQ",
        expected: {
          kind: "NUMBER",
          value: 1,
        },
        statement: "Missing subject.",
      });
    },
    {
      message: /V8_KNOWLEDGE_CONDITION_SUBJECT_MISSING/,
    },
  );
});

test("V8 Condition Model rejects a mutated fingerprint", () => {
  const condition = createCondition(
    conditionInput("LTE"),
  );

  const tampered = {
    ...condition,
    statement: "Tampered statement.",
  };

  assert.throws(
    () => assertConditionIntegrity(tampered),
    {
      message: /V8_KNOWLEDGE_CONDITION_FINGERPRINT_MISMATCH/,
    },
  );
});