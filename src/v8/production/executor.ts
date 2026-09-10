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

import type {
  ProductionExecutionInput,
  ProductionExecutionResult,
} from "./types.js";

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function executionFingerprint(input: {
  readonly releaseId: string;
  readonly releaseFingerprint: string;
  readonly manifest: readonly string[];
}): string {
  return contentFingerprint({
    releaseId: input.releaseId,
    releaseFingerprint: input.releaseFingerprint,
    manifest: input.manifest,
  });
}

function executionId(fingerprint: string): string {
  return `execution:${fingerprint}`;
}

export function executeProduction(
  input: ProductionExecutionInput,
): Readonly<ProductionExecutionResult> {
  try {
    const boundary = assertProductionBoundary({
      release: input.release,
    });

    const manifest = [...boundary.manifest];

    const fingerprint = executionFingerprint({
      releaseId: boundary.releaseId,
      releaseFingerprint: boundary.fingerprint,
      manifest,
    });

    return immutable({
      passed: true,
      status: "EXECUTED" as const,
      releaseId: boundary.releaseId,
      releaseFingerprint: boundary.fingerprint,
      manifest,
      executionId: executionId(fingerprint),
      executionFingerprint: fingerprint,
      reasons: [] as readonly string[],
    });
  } catch (error) {
    const release = input.release;

    const releaseId =
      typeof release?.id === "string"
        ? release.id
        : "";

    const releaseFingerprint =
      typeof release?.fingerprint === "string"
        ? release.fingerprint
        : "";

    const manifest =
      Array.isArray(release?.manifest)
        ? [...release.manifest]
        : [];

    const fingerprint = executionFingerprint({
      releaseId,
      releaseFingerprint,
      manifest,
    });

    return immutable({
      passed: false,
      status: "BLOCKED" as const,
      releaseId,
      releaseFingerprint,
      manifest,
      executionId: executionId(fingerprint),
      executionFingerprint: fingerprint,
      reasons: [errorMessage(error)],
    });
  }
}

export function assertProductionExecution(
  input: ProductionExecutionInput,
): Readonly<ProductionExecutionResult> {
  const result = executeProduction(input);

  invariant(
    result.passed,
    "V8_PRODUCTION_EXECUTION_BLOCKED",
    `Production execution blocked: ${result.reasons.join("; ")}`,
  );

  return result;
}