import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSemanticApplicability,
  assertSemanticApplicability,
} from "../../../.v8-build/src/v8/applicability/semantic.js";

const problemId =
  "problem:injection-molding:draft-angle";

const knowledgeId =
  "knowledge:injection-molding:draft-angle";

const scopeId =
  "scope:north-america:injection-molding";

const claimIdA =
  "claim:injection-molding:draft-angle:1";

const claimIdB =
  "claim:injection-molding:draft-angle:2";

function relationSet() {
  return [
    {
      subject: knowledgeId,
      predicate: "RELEVANT_TO",
      object: problemId,
      source: "VERIFIED_DERIVATION",
    },
    {
      subject: claimIdA,
      predicate: "COVERS",
      object: knowledgeId,
      source: "VERIFIED_DERIVATION",
    },
    {
      subject: claimIdB,
      predicate: "COVERS",
      object: knowledgeId,
      source: "VERIFIED_DERIVATION",
    },
    {
      subject: claimIdA,
      predicate: "CONDITION_COMPATIBLE",
      object: problemId,
      source: "VERIFIED_DERIVATION",
    },
    {
      subject: claimIdB,
      predicate: "CONDITION_COMPATIBLE",
      object: problemId,
      source: "VERIFIED_DERIVATION",
    },
    {
      subject: knowledgeId,
      predicate: "SCOPE_COMPATIBLE",
      object: scopeId,
      source: "VERIFIED_DERIVATION",
    },
  ];
}

test(
  "V8-22A semantic applicability requires exact relation identity",
  () => {
    const result =
      evaluateSemanticApplicability({
        problemId,
        knowledgeId,
        scopeId,
        claimIds: [
          claimIdA,
          claimIdB,
        ],
        relations: relationSet(),
      });

    assert.equal(
      result.state,
      "APPLICABLE",
    );

    assert.deepEqual(
      result.reasons,
      [],
    );

    assert.doesNotThrow(() => {
      assertSemanticApplicability({
        problemId,
        knowledgeId,
        scopeId,
        claimIds: [
          claimIdA,
          claimIdB,
        ],
        relations: relationSet(),
      });
    });
  },
);

test(
  "V8-22A rejects unrelated relations with matching predicates",
  () => {
    const result =
      evaluateSemanticApplicability({
        problemId,
        knowledgeId,
        scopeId,
        claimIds: [
          claimIdA,
          claimIdB,
        ],
        relations: [
          {
            subject:
              "knowledge:other",
            predicate: "RELEVANT_TO",
            object:
              "problem:other",
            source: "VERIFIED_DERIVATION",
          },
          {
            subject:
              "claim:other",
            predicate: "COVERS",
            object:
              "knowledge:other",
            source: "VERIFIED_DERIVATION",
          },
          {
            subject:
              "claim:other",
            predicate:
              "CONDITION_COMPATIBLE",
            object:
              "problem:other",
            source: "VERIFIED_DERIVATION",
          },
          {
            subject:
              "knowledge:other",
            predicate:
              "SCOPE_COMPATIBLE",
            object:
              "scope:other",
            source: "VERIFIED_DERIVATION",
          },
        ],
      });

    assert.equal(
      result.state,
      "UNKNOWN",
    );

    assert.ok(
      result.reasons.includes(
        "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM",
      ),
    );

    assert.ok(
      result.reasons.includes(
        "CLAIM_COVERAGE_INSUFFICIENT",
      ),
    );

    assert.ok(
      result.reasons.includes(
        "CLAIM_CONDITION_CONFLICT",
      ),
    );

    assert.ok(
      result.reasons.includes(
        "CLAIM_SCOPE_CONFLICT",
      ),
    );

    assert.throws(
      () =>
        assertSemanticApplicability({
          problemId,
          knowledgeId,
          scopeId,
          claimIds: [
            claimIdA,
            claimIdB,
          ],
          relations: [
            {
              subject:
                "knowledge:other",
              predicate: "RELEVANT_TO",
              object:
                "problem:other",
              source:
                "VERIFIED_DERIVATION",
            },
          ],
        }),
      /V8_SEMANTIC_APPLICABILITY_BLOCKED/,
    );
  },
);

test(
  "V8-22A returns UNKNOWN when semantic relations are absent",
  () => {
    const result =
      evaluateSemanticApplicability({
        problemId,
        knowledgeId,
        scopeId,
        claimIds: [
          claimIdA,
        ],
        relations: [],
      });

    assert.equal(
      result.state,
      "UNKNOWN",
    );

    assert.deepEqual(
      result.reasons,
      [
        "SEMANTIC_RELATION_MISSING",
      ],
    );
  },
);

test(
  "V8-22A blocks explicit semantic conflict",
  () => {
    const relations = [
      ...relationSet(),
      {
        subject: knowledgeId,
        predicate: "CONFLICTS_WITH",
        object: problemId,
        source: "EXPLICIT",
      },
    ];

    const result =
      evaluateSemanticApplicability({
        problemId,
        knowledgeId,
        scopeId,
        claimIds: [
          claimIdA,
          claimIdB,
        ],
        relations,
      });

    assert.equal(
      result.state,
      "BLOCKED",
    );

    assert.deepEqual(
      result.reasons,
      [
        "SEMANTIC_RELATION_CONFLICT",
      ],
    );

    assert.throws(
      () =>
        assertSemanticApplicability({
          problemId,
          knowledgeId,
          scopeId,
          claimIds: [
            claimIdA,
            claimIdB,
          ],
          relations,
        }),
      /V8_SEMANTIC_APPLICABILITY_BLOCKED/,
    );
  },
);

test(
  "V8-22A requires every claim to be covered and condition-compatible",
  () => {
    const relations = [
      relationSet()[0],
      relationSet()[1],
      relationSet()[4],
      relationSet()[5],
    ];

    const result =
      evaluateSemanticApplicability({
        problemId,
        knowledgeId,
        scopeId,
        claimIds: [
          claimIdA,
          claimIdB,
        ],
        relations,
      });

    assert.equal(
      result.state,
      "UNKNOWN",
    );

    assert.ok(
      result.reasons.includes(
        "CLAIM_COVERAGE_INSUFFICIENT",
      ),
    );

    assert.ok(
      result.reasons.includes(
        "CLAIM_CONDITION_CONFLICT",
      ),
    );
  },
);