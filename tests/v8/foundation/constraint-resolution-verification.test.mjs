import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

import {
  createConstraint,
} from "../../../.v8-build/src/v8/domain/constraint.js";

import {
  createConstraintResolution,
} from "../../../.v8-build/src/v8/domain/constraint-resolution.js";

import {
  recordConstraintResolutionVerification,
  hasPassingConstraintResolutionVerification,
  getConstraintResolutionVerification,
  assertPassingConstraintResolutionVerification,
} from "../../../.v8-build/src/v8/foundation/constraint-resolution-verification.js";

const verifier = Object.freeze({
  id: "v8-27-constraint-resolution-verifier",
  role: "VERIFIER",
});

function createFixture() {
  const problemId =
    "problem:v8-27-phase-6a";

  const constraint =
    createConstraint({
      problemId,
      statement:
        "Material must be PA66.",
    });

  const resolution =
    createConstraintResolution({
      constraintId:
        constraint.id,
      status:
        "SATISFIED",
      proof: {
        knowledgeIds: [
          "knowledge:pa66",
        ],
        claimIds: [
          "claim:pa66-material",
        ],
      },
      reason:
        "All declared semantic requirements are satisfied.",
    });

  return {
    constraint,
    resolution,
  };
}

test(
  "V8-27 persists SATISFIED constraint resolution as PASS verification",
  () => {
    const store =
      new InMemoryFoundationStore();

    const {
      resolution,
    } = createFixture();

    const record =
      recordConstraintResolutionVerification(
        store,
        {
          resolution,
          checks: [
            "semantic requirements satisfied",
            "constraint resolution fingerprint verified",
          ],
          verifier,
        },
      );

    assert.equal(
      record.aggregateType,
      "VERIFICATION",
    );

    assert.equal(
      record.state,
      "VERIFIED",
    );

    assert.equal(
      record.payload.targetType,
      "CONSTRAINT_RESOLUTION",
    );

    assert.equal(
      record.payload.targetId,
      resolution.fingerprint,
    );

    assert.equal(
      record.payload.decision,
      "PASS",
    );

    assert.equal(
      hasPassingConstraintResolutionVerification(
        store,
        resolution,
      ),
      true,
    );

    assert.doesNotThrow(
      () =>
        assertPassingConstraintResolutionVerification(
          store,
          resolution,
        ),
    );

    store.verifyChain();
  },
);

test(
  "V8-27 persists UNSATISFIED constraint resolution as FAIL verification",
  () => {
    const store =
      new InMemoryFoundationStore();

    const {
      constraint,
    } = createFixture();

    const resolution =
      createConstraintResolution({
        constraintId:
          constraint.id,
        status:
          "UNSATISFIED",
        proof: {
          knowledgeIds: [],
          claimIds: [],
        },
        reason:
          "A semantic conflict was detected.",
      });

    const record =
      recordConstraintResolutionVerification(
        store,
        {
          resolution,
          checks: [
            "semantic conflict detected",
          ],
          verifier,
        },
      );

    assert.equal(
      record.state,
      "REJECTED",
    );

    assert.equal(
      record.payload.decision,
      "FAIL",
    );

    assert.equal(
      hasPassingConstraintResolutionVerification(
        store,
        resolution,
      ),
      false,
    );

    assert.throws(
      () =>
        assertPassingConstraintResolutionVerification(
          store,
          resolution,
        ),
      /V8_CONSTRAINT_RESOLUTION_VERIFICATION_REQUIRED/,
    );

    store.verifyChain();
  },
);

test(
  "V8-27 persists UNKNOWN constraint resolution as REQUIRES_REVIEW",
  () => {
    const store =
      new InMemoryFoundationStore();

    const {
      constraint,
    } = createFixture();

    const resolution =
      createConstraintResolution({
        constraintId:
          constraint.id,
        status:
          "UNKNOWN",
        proof: {
          knowledgeIds: [],
          claimIds: [],
        },
        reason:
          "A required semantic relation is missing.",
      });

    const record =
      recordConstraintResolutionVerification(
        store,
        {
          resolution,
          checks: [
            "missing semantic relation recorded",
          ],
          verifier,
        },
      );

    assert.equal(
      record.state,
      "REQUIRES_REVIEW",
    );

    assert.equal(
      record.payload.decision,
      "REQUIRES_REVIEW",
    );

    assert.equal(
      hasPassingConstraintResolutionVerification(
        store,
        resolution,
      ),
      false,
    );

    store.verifyChain();
  },
);

test(
  "V8-27 binds verification target to the exact resolution fingerprint",
  () => {
    const store =
      new InMemoryFoundationStore();

    const {
      constraint,
    } = createFixture();

    const resolutionA =
      createConstraintResolution({
        constraintId:
          constraint.id,
        status:
          "SATISFIED",
        proof: {
          knowledgeIds: [
            "knowledge:pa66",
          ],
          claimIds: [
            "claim:pa66-material",
          ],
        },
        reason:
          "All declared semantic requirements are satisfied.",
      });

    const resolutionB =
      createConstraintResolution({
        constraintId:
          constraint.id,
        status:
          "SATISFIED",
        proof: {
          knowledgeIds: [
            "knowledge:pa66",
          ],
          claimIds: [
            "claim:pa66-material",
          ],
        },
        reason:
          "Different verified reason.",
      });

    assert.notEqual(
      resolutionA.fingerprint,
      resolutionB.fingerprint,
    );

    recordConstraintResolutionVerification(
      store,
      {
        resolution:
          resolutionA,
        checks: [
          "exact resolution fingerprint verified",
        ],
        verifier,
      },
    );

    assert.equal(
      hasPassingConstraintResolutionVerification(
        store,
        resolutionA,
      ),
      true,
    );

    assert.equal(
      hasPassingConstraintResolutionVerification(
        store,
        resolutionB,
      ),
      false,
    );

    store.verifyChain();
  },
);

test(
  "V8-27 rejects a forged constraint resolution fingerprint",
  () => {
    const store =
      new InMemoryFoundationStore();

    const {
      resolution,
    } = createFixture();

    const forged = {
      ...resolution,
      fingerprint:
        "forged-resolution-fingerprint",
    };

    assert.throws(
      () =>
        recordConstraintResolutionVerification(
          store,
          {
            resolution: forged,
            checks: [
              "forged resolution attempt",
            ],
            verifier,
          },
        ),
      /V8_CONSTRAINT_RESOLUTION_FINGERPRINT_MISMATCH/,
    );

    assert.equal(
      store.auditTrail().length,
      0,
    );

    store.verifyChain();
  },
);

test(
  "V8-27 returns the persisted verification for an exact resolution",
  () => {
    const store =
      new InMemoryFoundationStore();

    const {
      resolution,
    } = createFixture();

    const created =
      recordConstraintResolutionVerification(
        store,
        {
          resolution,
          checks: [
            "exact persisted verification lookup",
          ],
          verifier,
        },
      );

    const found =
      getConstraintResolutionVerification(
        store,
        resolution,
      );

    assert.ok(found);

    assert.equal(
      found.recordId,
      created.recordId,
    );

    assert.equal(
      found.payload.targetId,
      resolution.fingerprint,
    );

    store.verifyChain();
  },
);

console.log(
  "V8-27 Phase 6A Constraint Resolution Verification PASS",
);