import { immutable, invariant } from "../constitution/invariants.js";
import { assertReleaseReady } from "../release/gate.js";
import type {
  ProductionBoundaryInput,
  ProductionBoundaryResult,
} from "./types.js";
function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
export function checkProductionBoundary(
  input: ProductionBoundaryInput,
): Readonly<ProductionBoundaryResult> {
  try {
    assertReleaseReady(input.release);
    return immutable({
      passed: true,
      status: "READY" as const,
      releaseId: input.release.id,
      fingerprint: input.release.fingerprint,
      manifest: [...input.release.manifest],
      reasons: [] as readonly string[],
    });
  } catch (error) {
    return immutable({
      passed: false,
      status: "BLOCKED" as const,
      releaseId: input.release.id,
      fingerprint: input.release.fingerprint,
      manifest: [...input.release.manifest],
      reasons: [errorMessage(error)],
    });
  }
}
export function assertProductionBoundary(
  input: ProductionBoundaryInput,
): Readonly<ProductionBoundaryResult> {
  const result = checkProductionBoundary(input);
  invariant(
    result.passed,
    "V8_PRODUCTION_BOUNDARY_BLOCKED",
    `Production boundary blocked: ${result.reasons.join("; ")}`,
  );
  return result;
}
