import assert from "node:assert/strict";
import test from "node:test";

import {
  contentFingerprint,
} from "../../../src/v8/foundation/hash.js";

import {
  authorizeProductionConsumption,
  assertProductionConsumption,
} from "../../../src/v8/production-consumption/index.js";

function createExecution(overrides = {}) {
  const manifest = [
    "dist/index.html",
    "dist/industries/injection-molding/index.html",
  ];

  const releaseId = "release:test-release";
  const projectionId = "projection:test-projection";
  const releaseFingerprint = "a".repeat(64);
  const projectionFingerprint = "b".repeat(64);

  const executionFingerprint = contentFingerprint({
    releaseId,
    projectionId,
    releaseFingerprint,
    projectionFingerprint,
    manifest,
  });

  return {
    schema: "nexmold.v8.production-execution.v1",
    status: "EXECUTED",
    releaseId,
    projectionId,
    releaseFingerprint,
    projectionFingerprint,
    manifest,
    executionId: `execution:${executionFingerprint}`,
    executionFingerprint,
    ...overrides,
  };
}

test("V8-20 Production Consumption PASS", () => {
  const execution = createExecution();

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
});

test("V8-20 blocks non-executed production", () => {
  assert.throws(
    () => authorizeProductionConsumption({
      execution: createExecution({
        status: "BLOCKED",
      }),
    }),
    /V8_CONSUMPTION_EXECUTION_NOT_EXECUTED/,
  );
});

test("V8-20 blocks forged execution fingerprint", () => {
  assert.throws(
    () => authorizeProductionConsumption({
      execution: createExecution({
        executionFingerprint: "c".repeat(64),
      }),
    }),
    /V8_CONSUMPTION_EXECUTION_FINGERPRINT_MISMATCH/,
  );
});

test("V8-20 blocks forged execution id", () => {
  assert.throws(
    () => authorizeProductionConsumption({
      execution: createExecution({
        executionId: "execution:forged",
      }),
    }),
    /V8_CONSUMPTION_EXECUTION_ID_MISMATCH/,
  );
});

test("V8-20 blocks noncanonical manifest", () => {
  const manifest = [
    "dist/index.html",
    "dist/index.html",
  ];

  const executionFingerprint = contentFingerprint({
    releaseId: "release:test-release",
    projectionId: "projection:test-projection",
    releaseFingerprint: "a".repeat(64),
    projectionFingerprint: "b".repeat(64),
    manifest,
  });

  assert.throws(
    () => authorizeProductionConsumption({
      execution: createExecution({
        manifest,
        executionFingerprint,
        executionId: `execution:${executionFingerprint}`,
      }),
    }),
    /V8_CONSUMPTION_MANIFEST_INVALID/,
  );
});

test("V8-20 blocks empty manifest", () => {
  assert.throws(
    () => authorizeProductionConsumption({
      execution: createExecution({
        manifest: [],
      }),
    }),
    /V8_CONSUMPTION_MANIFEST_INVALID/,
  );
});

test("V8-20 blocks invalid execution schema", () => {
  assert.throws(
    () => authorizeProductionConsumption({
      execution: createExecution({
        schema: "forged.schema",
      }),
    }),
    /V8_CONSUMPTION_EXECUTION_SCHEMA_INVALID/,
  );
});

test("V8-20 assertProductionConsumption returns canonical artifact", () => {
  const result = assertProductionConsumption({
    execution: createExecution(),
  });

  assert.equal(
    result.schema,
    "nexmold.v8.production-consumption.v1",
  );

  assert.equal(
    result.consumptionId,
    `consumption:${result.consumptionFingerprint}`,
  );
});

test("V8-20 does not accept Release directly", () => {
  assert.throws(
    () => authorizeProductionConsumption({
      execution: undefined,
    }),
    /V8_CONSUMPTION_EXECUTION_MISSING/,
  );
});