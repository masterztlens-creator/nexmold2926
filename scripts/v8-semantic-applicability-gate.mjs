import assert from "node:assert/strict";

import {
  evaluateSemanticApplicability,
  assertSemanticApplicability,
} from "../.v8-build/src/v8/applicability/semantic.js";

const problemId = "problem:v8:semantic-applicability";
const knowledgeId = "knowledge:v8:semantic-applicability";
const scopeId = "scope:v8:semantic-applicability";

const claimIds = [
  "claim:v8:semantic-applicability:1",
  "claim:v8:semantic-applicability:2",
];

function relation(
  subject,
  predicate,
  object,
  source = "VERIFIED_DERIVATION",
) {
  return {
    subject,
    predicate,
    object,
    source,
  };
}

function expectState(input, expectedState, expectedReasons = []) {
  const result = evaluateSemanticApplicability(input);

  assert.equal(
    result.state,
    expectedState,
    `Expected semantic state ${expectedState}, got ${result.state}`,
  );

  for (const reason of expectedReasons) {
    assert.ok(
      result.reasons.includes(reason),
      `Expected reason ${reason}, got ${result.reasons.join(",")}`,
    );
  }

  return result;
}

function expectBlocked(input, expectedCode) {
  assert.throws(
    () => assertSemanticApplicability(input),
    (error) => {
      assert.equal(
        error?.code,
        expectedCode,
        `Expected ${expectedCode}, got ${error?.code}`,
      );

      return true;
    },
  );
}

function main() {
  const validRelations = [
    relation(
      knowledgeId,
      "RELEVANT_TO",
      problemId,
    ),
    relation(
      claimIds[0],
      "COVERS",
      knowledgeId,
    ),
    relation(
      claimIds[0],
      "CONDITION_COMPATIBLE",
      problemId,
    ),
    relation(
      claimIds[1],
      "COVERS",
      knowledgeId,
    ),
    relation(
      claimIds[1],
      "CONDITION_COMPATIBLE",
      problemId,
    ),
    relation(
      knowledgeId,
      "SCOPE_COMPATIBLE",
      scopeId,
    ),
  ];

  const validInput = {
    problemId,
    knowledgeId,
    scopeId,
    claimIds,
    relations: validRelations,
  };

  const valid = expectState(
    validInput,
    "APPLICABLE",
  );

  assert.deepEqual(valid.reasons, []);
  assert.doesNotThrow(() =>
    assertSemanticApplicability(validInput),
  );

  const unrelatedPredicateMatches = {
    ...validInput,
    relations: [
      relation(
        "knowledge:v8:other",
        "RELEVANT_TO",
        problemId,
      ),
      relation(
        claimIds[0],
        "COVERS",
        "knowledge:v8:other",
      ),
      relation(
        claimIds[0],
        "CONDITION_COMPATIBLE",
        problemId,
      ),
      relation(
        claimIds[1],
        "COVERS",
        knowledgeId,
      ),
      relation(
        claimIds[1],
        "CONDITION_COMPATIBLE",
        "problem:v8:other",
      ),
      relation(
        knowledgeId,
        "SCOPE_COMPATIBLE",
        "scope:v8:other",
      ),
    ],
  };

  expectState(
    unrelatedPredicateMatches,
    "UNKNOWN",
    [
      "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM",
      "CLAIM_COVERAGE_INSUFFICIENT",
      "CLAIM_CONDITION_CONFLICT",
      "CLAIM_SCOPE_CONFLICT",
    ],
  );

  expectBlocked(
    unrelatedPredicateMatches,
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  const emptyRelations = {
    ...validInput,
    relations: [],
  };

  expectState(
    emptyRelations,
    "UNKNOWN",
    [
      "SEMANTIC_RELATION_MISSING",
    ],
  );

  expectBlocked(
    emptyRelations,
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  const conflictRelations = [
    ...validRelations,
    relation(
      knowledgeId,
      "CONFLICTS_WITH",
      problemId,
    ),
  ];

  const conflictInput = {
    ...validInput,
    relations: conflictRelations,
  };

  const conflictResult = expectState(
    conflictInput,
    "BLOCKED",
    [
      "SEMANTIC_RELATION_CONFLICT",
    ],
  );

  assert.equal(
    conflictResult.state,
    "BLOCKED",
  );

  expectBlocked(
    conflictInput,
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  const missingClaimCoverage = {
    ...validInput,
    relations: validRelations.filter(
      (item) =>
        !(
          item.subject === claimIds[1] &&
          item.predicate === "COVERS" &&
          item.object === knowledgeId
        ),
    ),
  };

  expectState(
    missingClaimCoverage,
    "UNKNOWN",
    [
      "CLAIM_COVERAGE_INSUFFICIENT",
    ],
  );

  const missingClaimCondition = {
    ...validInput,
    relations: validRelations.filter(
      (item) =>
        !(
          item.subject === claimIds[1] &&
          item.predicate ===
            "CONDITION_COMPATIBLE" &&
          item.object === problemId
        ),
    ),
  };

  expectState(
    missingClaimCondition,
    "UNKNOWN",
    [
      "CLAIM_CONDITION_CONFLICT",
    ],
  );

  const wrongSubjectObject = {
    ...validInput,
    relations: [
      relation(
        knowledgeId,
        "RELEVANT_TO",
        "problem:v8:wrong",
      ),
      relation(
        claimIds[0],
        "COVERS",
        knowledgeId,
      ),
      relation(
        claimIds[0],
        "CONDITION_COMPATIBLE",
        problemId,
      ),
      relation(
        claimIds[1],
        "COVERS",
        knowledgeId,
      ),
      relation(
        claimIds[1],
        "CONDITION_COMPATIBLE",
        problemId,
      ),
      relation(
        knowledgeId,
        "SCOPE_COMPATIBLE",
        scopeId,
      ),
    ],
  };

  expectState(
    wrongSubjectObject,
    "UNKNOWN",
    [
      "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM",
    ],
  );

  console.log(
    "[NEXMOLD][V8-22A] SEMANTIC APPLICABILITY GATE PASS",
  );
  console.log(
    "[V8-22A] validState=APPLICABLE",
  );
  console.log(
    "[V8-22A] unrelatedPredicateMatches=REJECTED",
  );
  console.log(
    "[V8-22A] emptyRelations=UNKNOWN",
  );
  console.log(
    "[V8-22A] conflictRelation=BLOCKED",
  );
  console.log(
    "[V8-22A] missingClaimCoverage=UNKNOWN",
  );
  console.log(
    "[V8-22A] missingClaimCondition=UNKNOWN",
  );
  console.log(
    "[V8-22A] wrongSubjectObject=REJECTED",
  );
  console.log(
    "[V8-22A] failClosed=true",
  );
}

main();