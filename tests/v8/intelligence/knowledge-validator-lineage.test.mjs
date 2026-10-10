
import test from "node:test";
import assert from "node:assert/strict";

import {
  createEntity,
} from "../../../.v8-build/src/v8/intelligence/knowledge/entity-model.js";

import {
  createConstraint,
} from "../../../.v8-build/src/v8/intelligence/knowledge/constraint-model.js";

import {
  createException,
} from "../../../.v8-build/src/v8/intelligence/knowledge/exception-model.js";

import {
  createFailureMode,
} from "../../../.v8-build/src/v8/intelligence/knowledge/failure-mode.js";

import {
  createRule,
} from "../../../.v8-build/src/v8/intelligence/knowledge/rule-model.js";

import {
  validateKnowledge,
} from "../../../.v8-build/src/v8/intelligence/knowledge/validator.js";

const KNOWLEDGE_ID = "knowledge:v8:lineage-regression";
const CLAIM_ID = "claim:v8:lineage-regression";
const EVIDENCE_ID = "evidence:v8:lineage-regression";

const OUTSIDE_CLAIM_ID = "claim:v8:outside-lineage";
const OUTSIDE_EVIDENCE_ID = "evidence:v8:outside-lineage";

const PROPOSITION =
  "ABS injection molding requires engineering constraints to remain traceable.";

const ENTITY = createEntity(
  "MATERIAL",
  "Lineage Regression ABS Material",
);

const MODEL_CASES = [
  {
    label: "Constraint",
    collection: "constraints",
    claimCode:
      "V8_KNOWLEDGE_CONSTRAINT_CLAIM_OUTSIDE_LINEAGE",
    evidenceCode:
      "V8_KNOWLEDGE_CONSTRAINT_EVIDENCE_OUTSIDE_LINEAGE",
    create(claimIds, evidenceIds) {
      return createConstraint({
        type: "OTHER",
        statement: "Fixture constraint for lineage validation.",
        subjectEntityIds: [ENTITY.entityId],
        claimIds,
        evidenceIds,
        confidence: "HIGH",
      });
    },
  },
  {
    label: "Exception",
    collection: "exceptions",
    claimCode:
      "V8_KNOWLEDGE_EXCEPTION_CLAIM_OUTSIDE_LINEAGE",
    evidenceCode:
      "V8_KNOWLEDGE_EXCEPTION_EVIDENCE_OUTSIDE_LINEAGE",
    create(claimIds, evidenceIds) {
      return createException({
        type: "OTHER",
        statement: "Fixture exception for lineage validation.",
        subjectEntityIds: [ENTITY.entityId],
        claimIds,
        evidenceIds,
        confidence: "HIGH",
      });
    },
  },
  {
    label: "FailureMode",
    collection: "failureModes",
    claimCode:
      "V8_KNOWLEDGE_FAILUREMODE_CLAIM_OUTSIDE_LINEAGE",
    evidenceCode:
      "V8_KNOWLEDGE_FAILUREMODE_EVIDENCE_OUTSIDE_LINEAGE",
    create(claimIds, evidenceIds) {
      return createFailureMode({
        name: "Lineage Regression Failure Mode",
        statement:
          "A semantic record references unsupported provenance.",
        causes: ["Invalid provenance reference"],
        effects: ["Knowledge integrity failure"],
        detectionSignals: ["Out-of-lineage identifier"],
        preventionMeasures: ["Validate canonical lineage"],
        severity: "HIGH",
        likelihood: "POSSIBLE",
        subjectEntityIds: [ENTITY.entityId],
        claimIds,
        evidenceIds,
        confidence: "HIGH",
      });
    },
  },
  {
    label: "Rule",
    collection: "rules",
    claimCode:
      "V8_KNOWLEDGE_RULE_CLAIM_OUTSIDE_LINEAGE",
    evidenceCode:
      "V8_KNOWLEDGE_RULE_EVIDENCE_OUTSIDE_LINEAGE",
    create(claimIds, evidenceIds) {
      return createRule({
        type: "VALIDATION",
        name: "Lineage Regression Rule",
        statement:
          "Every semantic record must remain within canonical lineage.",
        subjectEntityIds: [ENTITY.entityId],
        claimIds,
        evidenceIds,
        confidence: "HIGH",
        applicability: "UNIVERSAL",
      });
    },
  },
];

function createKnowledgeFixture({
  modelCase,
  badReference,
} = {}) {
  const claimIds = [CLAIM_ID];
  const evidenceIds = [EVIDENCE_ID];

  let semanticModel;

  if (modelCase !== undefined) {
    const modelClaimIds =
      badReference === "claim"
        ? [OUTSIDE_CLAIM_ID]
        : claimIds;

    const modelEvidenceIds =
      badReference === "evidence"
        ? [OUTSIDE_EVIDENCE_ID]
        : evidenceIds;

    semanticModel = modelCase.create(
      modelClaimIds,
      modelEvidenceIds,
    );
  }

  const constraints =
    modelCase?.collection === "constraints"
      ? [semanticModel]
      : [];

  const exceptions =
    modelCase?.collection === "exceptions"
      ? [semanticModel]
      : [];

  const failureModes =
    modelCase?.collection === "failureModes"
      ? [semanticModel]
      : [];

  const rules =
    modelCase?.collection === "rules"
      ? [semanticModel]
      : [];

  return {
    knowledgeId: KNOWLEDGE_ID,
    proposition: PROPOSITION,

    claimIds,
    evidenceIds,

    conditions: [],
    constraints,
    exceptions,
    failureModes,
    rules,

    entities: [ENTITY],
    properties: [],
    relationships: [],

    truthState: "VERIFIED",
    lifecycle: "VALIDATED",
    confidence: "HIGH",
    applicability: "UNIVERSAL",
    polarity: "POSITIVE",

    foundationPayload: {
      proposition: PROPOSITION,
    },

    lineage: {
      knowledgeId: KNOWLEDGE_ID,
      claimIds,
      evidenceIds,
      fingerprint: "fixture-lineage-fingerprint",
    },

    evidenceClosure: {
      knowledgeId: KNOWLEDGE_ID,
      claimIds,
      evidenceIds,
      fingerprint: "fixture-evidence-closure-fingerprint",
    },

    fingerprint: "fixture-knowledge-fingerprint",
  };
}

function getLineageIssues(report) {
  return report.issues.filter(
    (issue) => issue.code.includes("OUTSIDE_LINEAGE"),
  );
}

test(
  "V8 Knowledge lineage fixture is valid before negative mutations",
  () => {
    const report = validateKnowledge(
      createKnowledgeFixture(),
    );

    assert.equal(
      report.valid,
      true,
      `Baseline fixture must be valid:\n${JSON.stringify(
        report.issues,
        null,
        2,
      )}`,
    );

    assert.deepEqual(
      report.issues,
      [],
      "Baseline fixture must not contain validation issues.",
    );
  },
);

for (const modelCase of MODEL_CASES) {
  for (const referenceType of ["claim", "evidence"]) {
    test(
      `V8 Knowledge rejects ${modelCase.label} ${referenceType} outside canonical lineage`,
      () => {
        const fixture = createKnowledgeFixture({
          modelCase,
          badReference: referenceType,
        });

        const baseline = validateKnowledge(
          createKnowledgeFixture(),
        );

        assert.equal(
          baseline.valid,
          true,
          "The unmodified baseline must be valid.",
        );

        const report = validateKnowledge(fixture, {
          rejectUnknown: true,
        });

        const expectedCode =
          referenceType === "claim"
            ? modelCase.claimCode
            : modelCase.evidenceCode;

        const matchingIssues = report.issues.filter(
          (issue) => issue.code === expectedCode,
        );

        assert.equal(
          matchingIssues.length,
          1,
          `Expected exactly one ${expectedCode} issue; received:\n${JSON.stringify(
            report.issues,
            null,
            2,
          )}`,
        );

        assert.equal(
          matchingIssues[0].severity,
          "ERROR",
          `${expectedCode} must remain an ERROR.`,
        );

        assert.equal(
          report.valid,
          false,
          "Out-of-lineage references must invalidate Knowledge.",
        );

        assert.deepEqual(
          getLineageIssues(report).map((issue) => issue.code),
          [expectedCode],
          "The mutation must produce only its intended lineage error.",
        );

        assert.equal(
          report.issues.some(
            (issue) =>
              issue.code ===
              "V8_KNOWLEDGE_UNKNOWN_STATE_REJECTED",
          ),
          false,
          "The fixture uses resolved truth and applicability states.",
        );
      },
    );
  }
}
