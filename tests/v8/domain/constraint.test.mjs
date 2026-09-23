import assert from "node:assert/strict";
import test from "node:test";

import {
  constraintId,
  createConstraint,
} from "../../../.v8-build/src/v8/domain/constraint.js";

import {
  createConstraintResolution,
} from "../../../.v8-build/src/v8/domain/constraint-resolution.js";

const problemId =
  "problem:injection-molding:draft-angle";

test(
  "V8-27 creates a deterministic constraint identity",
  () => {
    const a =
      createConstraint({
        problemId,
        statement:
          "Use verified knowledge only",
      });

    const b =
      createConstraint({
        problemId,
        statement:
          "Use verified knowledge only",
      });

    assert.equal(
      a.id,
      b.id,
    );

    assert.equal(
      a.fingerprint,
      b.fingerprint,
    );

    assert.equal(
      a.id,
      constraintId(
        problemId,
        "Use verified knowledge only",
      ),
    );
  },
);

test(
  "V8-27 normalizes constraint identity from trimmed statement",
  () => {
    const constraint =
      createConstraint({
        problemId,
        statement:
          "  Use verified knowledge only  ",
      });

    assert.equal(
      constraint.statement,
      "Use verified knowledge only",
    );

    assert.equal(
      constraint.id,
      constraintId(
        problemId,
        "Use verified knowledge only",
      ),
    );
  },
);

test(
  "V8-27 rejects a forged constraint identity",
  () => {
    assert.throws(
      () =>
        createConstraint({
          problemId,
          statement:
            "Use verified knowledge only",
          id:
            "problem:injection-molding:draft-angle:constraint:forged",
        }),
      /V8_CONSTRAINT_ID_MISMATCH/,
    );
  },
);

test(
  "V8-27 requires a proof for SATISFIED",
  () => {
    const constraint =
      createConstraint({
        problemId,
        statement:
          "Use verified knowledge only",
      });

    assert.throws(
      () =>
        createConstraintResolution({
          constraintId:
            constraint.id,
          status:
            "SATISFIED",
          proof: {
            knowledgeIds: [],
            claimIds: [],
          },
          reason:
            "No proof supplied.",
        }),
      /V8_CONSTRAINT_SATISFIED_WITHOUT_PROOF/,
    );
  },
);

test(
  "V8-27 forbids proof on UNKNOWN",
  () => {
    const constraint =
      createConstraint({
        problemId,
        statement:
          "Use verified knowledge only",
      });

    assert.throws(
      () =>
        createConstraintResolution({
          constraintId:
            constraint.id,
          status:
            "UNKNOWN",
          proof: {
            knowledgeIds: [
              "knowledge:verified",
            ],
            claimIds: [],
          },
          reason:
            "Semantic proof is unavailable.",
        }),
      /V8_CONSTRAINT_UNKNOWN_WITH_PROOF/,
    );
  },
);

test(
  "V8-27 creates deterministic satisfied resolution",
  () => {
    const constraint =
      createConstraint({
        problemId,
        statement:
          "Use verified knowledge only",
      });

    const resolution =
      createConstraintResolution({
        constraintId:
          constraint.id,
        status:
          "SATISFIED",
        proof: {
          knowledgeIds: [
            "knowledge:verified",
          ],
          claimIds: [
            "claim:verified",
          ],
        },
        reason:
          "Verified knowledge and claim provide the required proof.",
      });

    assert.equal(
      resolution.status,
      "SATISFIED",
    );

    assert.deepEqual(
      resolution.proof,
      {
        knowledgeIds: [
          "knowledge:verified",
        ],
        claimIds: [
          "claim:verified",
        ],
      },
    );

    assert.equal(
      typeof resolution.fingerprint,
      "string",
    );

    assert.ok(
      resolution.fingerprint.length > 0,
    );
  },
);