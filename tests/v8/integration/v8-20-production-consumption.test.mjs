import assert from "node:assert/strict";
import test from "node:test";

import {
  authorizeProductionConsumption,
  assertProductionConsumption,
} from "../../../.v8-build/src/v8/production-consumption/index.js";

import {
  executeProduction,
} from "../../../.v8-build/src/v8/production/index.js";

import {
  project,
} from "../../../.v8-build/src/v8/projection/index.js";

import {
  releasePreflight,
} from "../../../.v8-build/src/v8/release/index.js";

const publication = Object.freeze({
  id: "publication:v8-20-production-consumption",
  subjectId: "v8-20-production-consumption-subject",
  title: "V8-20 Production Consumption Boundary",
  body: "Production consumption boundary test.",
  contentFingerprint: "a".repeat(64),
  lineage: [],
  eligibilityRecordId: "eligibility:v8-20-production-consumption",
  policyId: "policy:v8-20-production-consumption",
  policyFingerprint: "b".repeat(64),
});

const projection = project({
  artifact: publication,
  route: "/v8-20-production-consumption/",
});

const requiredPaths = [
  "index.html",
  "v8-20-production-consumption/index.html",
];

function makeRelease(
  required = requiredPaths,
  generated = requiredPaths,
) {
  return releasePreflight({
    projection,
    requiredPaths: required,
    generatedPaths: generated,
  });
}

function makeExecution() {
  const release = makeRelease();

  return executeProduction({
    release,
    projection,
    expectedPaths: requiredPaths,
  });
}

test(
  "V8-20 Production Consumption PASS",
  () => {
    const execution = makeExecution();

    const first = authorizeProductionConsumption({
      execution,
    });

    const second = authorizeProductionConsumption({
      execution,
    });

    assert.equal(
      first.schema,
      "nexmold.v8.production-consumption.v1",
    );

    assert.equal(
      first.executionId,
      execution.executionId,
    );

    assert.equal(
      first.releaseId,
      execution.releaseId,
    );

    assert.equal(
      first.projectionId,
      execution.projectionId,
    );

    assert.deepEqual(
      first.manifest,
      execution.manifest,
    );

    assert.equal(
      first.consumptionId,
      second.consumptionId,
    );

    assert.equal(
      first.consumptionFingerprint,
      second.consumptionFingerprint,
    );
  },
);

test(
  "V8-20 consumes the real V8-19 production execution",
  () => {
    const execution = makeExecution();

    assert.equal(
      execution.schema,
      "nexmold.v8.production-execution.v1",
    );

    assert.equal(
      execution.status,
      "EXECUTED",
    );

    const consumption = authorizeProductionConsumption({
      execution,
    });

    assert.equal(
      consumption.executionId,
      execution.executionId,
    );

    assert.equal(
      consumption.releaseId,
      execution.releaseId,
    );

    assert.equal(
      consumption.projectionId,
      execution.projectionId,
    );

    assert.deepEqual(
      consumption.manifest,
      execution.manifest,
    );
  },
);

test(
  "V8-20 consumption is deterministic",
  () => {
    const firstExecution = makeExecution();
    const secondExecution = makeExecution();

    const first = authorizeProductionConsumption({
      execution: firstExecution,
    });

    const second = authorizeProductionConsumption({
      execution: secondExecution,
    });

    assert.deepEqual(
      first,
      second,
    );
  },
);

test(
  "V8-20 blocks non-executed production",
  () => {
    const execution = makeExecution();

    const forgedExecution = Object.freeze({
      ...execution,
      status: "BLOCKED",
    });

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: forgedExecution,
        }),
      /V8_CONSUMPTION_EXECUTION_NOT_EXECUTED/,
    );
  },
);

test(
  "V8-20 blocks forged execution fingerprint",
  () => {
    const execution = makeExecution();

    const forgedExecution = Object.freeze({
      ...execution,
      executionFingerprint: "c".repeat(64),
    });

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: forgedExecution,
        }),
      /V8_CONSUMPTION_EXECUTION_FINGERPRINT_MISMATCH/,
    );
  },
);

test(
  "V8-20 blocks forged execution id",
  () => {
    const execution = makeExecution();

    const forgedExecution = Object.freeze({
      ...execution,
      executionId: "execution:forged",
    });

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: forgedExecution,
        }),
      /V8_CONSUMPTION_EXECUTION_ID_MISMATCH/,
    );
  },
);

test(
  "V8-20 blocks noncanonical manifest",
  () => {
    const execution = makeExecution();

    const forgedExecution = Object.freeze({
      ...execution,
      manifest: [
        execution.manifest[1],
        execution.manifest[0],
      ],
    });

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: forgedExecution,
        }),
      /V8_CONSUMPTION_EXECUTION_FINGERPRINT_MISMATCH|V8_CONSUMPTION_MANIFEST_INVALID/,
    );
  },
);

test(
  "V8-20 blocks empty manifest",
  () => {
    const execution = makeExecution();

    const forgedExecution = Object.freeze({
      ...execution,
      manifest: [],
    });

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: forgedExecution,
        }),
      /V8_CONSUMPTION_MANIFEST_INVALID|V8_CONSUMPTION_EXECUTION_FINGERPRINT_MISMATCH/,
    );
  },
);

test(
  "V8-20 blocks invalid execution schema",
  () => {
    const execution = makeExecution();

    const forgedExecution = Object.freeze({
      ...execution,
      schema: "forged.schema",
    });

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: forgedExecution,
        }),
      /V8_CONSUMPTION_EXECUTION_SCHEMA_INVALID/,
    );
  },
);

test(
  "V8-20 assertProductionConsumption returns canonical artifact",
  () => {
    const execution = makeExecution();

    const result = assertProductionConsumption({
      execution,
    });

    assert.equal(
      result.schema,
      "nexmold.v8.production-consumption.v1",
    );

    assert.equal(
      result.consumptionId,
      `consumption:${result.consumptionFingerprint}`,
    );

    assert.equal(
      result.executionId,
      execution.executionId,
    );
  },
);

test(
  "V8-20 does not accept Release directly",
  () => {
    const release = makeRelease();

    assert.throws(
      () =>
        authorizeProductionConsumption({
          execution: release,
        }),
      /V8_CONSUMPTION_EXECUTION_SCHEMA_INVALID|V8_CONSUMPTION_EXECUTION_NOT_EXECUTED|V8_CONSUMPTION_EXECUTION_IDENTITY_INVALID/,
    );
  },
);

test(
  "V8-20 does not expose direct Release or Projection input",
  () => {
    const execution = makeExecution();

    const consumption = authorizeProductionConsumption({
      execution,
    });

    assert.equal(
      "release" in consumption,
      false,
    );

    assert.equal(
      "projection" in consumption,
      false,
    );

    assert.equal(
      "decision" in consumption,
      false,
    );

    assert.equal(
      "knowledge" in consumption,
      false,
    );

    assert.equal(
      "content" in consumption,
      false,
    );
  },
);

