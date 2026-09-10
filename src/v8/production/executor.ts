import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import {
  assertProductionBoundary,
} from "../production-boundary/index.js";

import {
  createProductionManifest,
} from "./adapter.js";

import type {
  V8ProductionExecution,
  V8ProductionInput,
} from "./types.js";

function executionFingerprint(
  input: Pick<
    V8ProductionExecution,
    | "releaseId"
    | "projectionId"
    | "releaseFingerprint"
    | "projectionFingerprint"
    | "manifest"
  >,
): V8ProductionExecution["executionFingerprint"] {
  return contentFingerprint({
    releaseId: input.releaseId,
    projectionId: input.projectionId,
    releaseFingerprint: input.releaseFingerprint,
    projectionFingerprint: input.projectionFingerprint,
    manifest: input.manifest,
  }) as V8ProductionExecution["executionFingerprint"];
}

function executionId(
  value: V8ProductionExecution["executionFingerprint"],
): string {
  return `execution:${value}`;
}

export function executeProduction(
  input: V8ProductionInput,
): Readonly<V8ProductionExecution> {
  assertProductionBoundary({
    release: input.release,
  });

  const productionManifest = createProductionManifest(input);

  const executionFingerprintValue = executionFingerprint({
    releaseId: productionManifest.releaseId,
    projectionId: productionManifest.projectionId,
    releaseFingerprint: productionManifest.releaseFingerprint,
    projectionFingerprint: productionManifest.projectionFingerprint,
    manifest: productionManifest.manifest,
  });

  return immutable({
    schema: "nexmold.v8.production-execution.v1",
    status: "EXECUTED" as const,
    releaseId: productionManifest.releaseId,
    projectionId: productionManifest.projectionId,
    releaseFingerprint: productionManifest.releaseFingerprint,
    projectionFingerprint: productionManifest.projectionFingerprint,
    manifest: productionManifest.manifest,
    executionId: executionId(executionFingerprintValue),
    executionFingerprint: executionFingerprintValue,
  });
}

export function assertProductionExecution(
  input: V8ProductionInput,
): Readonly<V8ProductionExecution> {
  const result = executeProduction(input);

  invariant(
    result.status === "EXECUTED",
    "V8_PRODUCTION_EXECUTION_BLOCKED",
    "Production execution is not ready.",
  );

  return result;
}