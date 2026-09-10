import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

import {
  fingerprint,
} from "../domain/primitives.js";

import {
  assertProductionBoundary,
} from "../production-boundary/index.js";

import type {
  Fingerprint,
} from "../domain/primitives.js";

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
}): Fingerprint {
  return fingerprint(
    contentFingerprint({
      releaseId: input.releaseId,
      releaseFingerprint: input.releaseFingerprint,
      manifest: input.manifest,
    }),
  );
}

function executionId(
  value: Fingerprint,
): string {
  return `execution:${value}`;
}

export function executeProduction(
  input: ProductionExecutionInput,
): Readonly<ProductionExecutionResult> {
  try {
    const boundary = assertProductionBoundary({
      release: input.release,
    });

    const manifest = [...boundary.manifest];

    const executionFingerprintValue = executionFingerprint({
      releaseId: boundary.releaseId,
      releaseFingerprint: boundary.fingerprint,
      manifest,
    });

    const releaseFingerprint = fingerprint(
      boundary.fingerprint,
    );

    return immutable({
      passed: true,
      status: "EXECUTED" as const,
      releaseId: boundary.releaseId,
      releaseFingerprint,
      manifest,
      executionId: executionId(executionFingerprintValue),
      executionFingerprint: executionFingerprintValue,
      reasons: [] as readonly string[],
    });
  } catch (error) {
    const release = input.release;

    const releaseId =
      typeof release?.id === "string"
        ? release.id
        : "";

    const releaseFingerprint =
      typeof release?.fingerprint === "string" &&
      release.fingerprint.length > 0
        ? fingerprint(release.fingerprint)
        : fingerprint("0".repeat(64));

    const manifest =
      Array.isArray(release?.manifest)
        ? [...release.manifest]
        : [];

    const executionFingerprintValue = executionFingerprint({
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
      executionId: executionId(executionFingerprintValue),
      executionFingerprint: executionFingerprintValue,
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