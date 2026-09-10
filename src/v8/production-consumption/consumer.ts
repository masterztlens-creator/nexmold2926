import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import type { Fingerprint } from "../domain/primitives.js";

import type {
  ProductionConsumptionInput,
  V8ProductionConsumptionArtifact,
} from "./types.js";

function canonicalPaths(
  paths: readonly string[],
): string[] {
  return [...new Set(
    paths
      .map((value) => value.trim())
      .filter(Boolean),
  )].sort();
}

function assertExecutionCanonical(
  input: ProductionConsumptionInput,
): void {
  const execution = input.execution;

  invariant(
    execution != null,
    "V8_CONSUMPTION_EXECUTION_MISSING",
    "Production consumption requires a production execution artifact.",
  );

  invariant(
    execution.schema === "nexmold.v8.production-execution.v1",
    "V8_CONSUMPTION_EXECUTION_SCHEMA_INVALID",
    "Production consumption requires a V8 production execution artifact.",
  );

  invariant(
    execution.status === "EXECUTED",
    "V8_CONSUMPTION_EXECUTION_NOT_EXECUTED",
    "Production consumption requires an executed production artifact.",
  );

  invariant(
    execution.releaseId.trim().length > 0 &&
      execution.projectionId.trim().length > 0 &&
      execution.releaseFingerprint.length === 64 &&
      execution.projectionFingerprint.length === 64,
    "V8_CONSUMPTION_EXECUTION_IDENTITY_INVALID",
    "Production execution contains invalid identities.",
  );

  const manifest = canonicalPaths(execution.manifest);

  invariant(
    manifest.length > 0 &&
      manifest.length === execution.manifest.length &&
      manifest.every(
        (value, index) => value === execution.manifest[index],
      ),
    "V8_CONSUMPTION_MANIFEST_INVALID",
    "Production execution manifest is not canonical or is empty.",
  );

  const expectedExecutionFingerprint = contentFingerprint({
    releaseId: execution.releaseId,
    projectionId: execution.projectionId,
    releaseFingerprint: execution.releaseFingerprint,
    projectionFingerprint: execution.projectionFingerprint,
    manifest,
  });

  invariant(
    execution.executionFingerprint === expectedExecutionFingerprint,
    "V8_CONSUMPTION_EXECUTION_FINGERPRINT_MISMATCH",
    "Production execution fingerprint does not match its canonical payload.",
  );

  invariant(
    execution.executionId === `execution:${expectedExecutionFingerprint}`,
    "V8_CONSUMPTION_EXECUTION_ID_MISMATCH",
    "Production execution id does not match its canonical fingerprint.",
  );
}

function consumptionFingerprint(
  input: Pick<
    V8ProductionConsumptionArtifact,
    | "executionId"
    | "releaseId"
    | "projectionId"
    | "releaseFingerprint"
    | "projectionFingerprint"
    | "manifest"
  >,
): Fingerprint {
  return contentFingerprint({
    executionId: input.executionId,
    releaseId: input.releaseId,
    projectionId: input.projectionId,
    releaseFingerprint: input.releaseFingerprint,
    projectionFingerprint: input.projectionFingerprint,
    manifest: input.manifest,
  }) as Fingerprint;
}

export function authorizeProductionConsumption(
  input: ProductionConsumptionInput,
): Readonly<V8ProductionConsumptionArtifact> {
  assertExecutionCanonical(input);

  const execution = input.execution;
  const manifest = canonicalPaths(execution.manifest);

  const fingerprint = consumptionFingerprint({
    executionId: execution.executionId,
    releaseId: execution.releaseId,
    projectionId: execution.projectionId,
    releaseFingerprint: execution.releaseFingerprint,
    projectionFingerprint: execution.projectionFingerprint,
    manifest,
  });

  return immutable({
    schema: "nexmold.v8.production-consumption.v1",
    executionId: execution.executionId,
    releaseId: execution.releaseId,
    projectionId: execution.projectionId,
    releaseFingerprint: execution.releaseFingerprint,
    projectionFingerprint: execution.projectionFingerprint,
    manifest,
    consumptionId: `consumption:${fingerprint}`,
    consumptionFingerprint: fingerprint,
  });
}

export function assertProductionConsumption(
  input: ProductionConsumptionInput,
): Readonly<V8ProductionConsumptionArtifact> {
  return authorizeProductionConsumption(input);
}