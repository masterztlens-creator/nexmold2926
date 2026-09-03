import { immutable, invariant } from "../constitution/invariants.js";
import { assertReleaseReady } from "../release/gate.js";
import type { V8ProductionInput, V8ProductionManifest } from "./types.js";

function canonicalPaths(paths: readonly string[]): string[] {
  return [...new Set(paths.map((value) => value.trim()).filter(Boolean))].sort();
}

export function createProductionManifest(
  input: V8ProductionInput,
): Readonly<V8ProductionManifest> {
  invariant(input.release.projectionId === input.projection.id,
    "V8_PRODUCTION_PROJECTION_ID_MISMATCH",
    "Release and projection identities must match.");
  invariant(input.release.projectionFingerprint === input.projection.fingerprint,
    "V8_PRODUCTION_PROJECTION_FINGERPRINT_MISMATCH",
    "Release must reference the exact projection fingerprint.");
  invariant(input.release.manifest.length > 0,
    "V8_PRODUCTION_EMPTY_MANIFEST",
    "Production release manifest cannot be empty.");

  const expected = canonicalPaths(input.expectedPaths);
  const actual = canonicalPaths(input.release.manifest);
  invariant(expected.length === actual.length && expected.every((value, index) => value === actual[index]),
    "V8_PRODUCTION_MANIFEST_MISMATCH",
    "Production release manifest does not match expected generated paths.");

  assertReleaseReady(input.release);
  return immutable({
    schema: "nexmold.v8.production-manifest.v1",
    releaseId: input.release.id,
    projectionId: input.projection.id,
    projectionFingerprint: input.projection.fingerprint,
    releaseFingerprint: input.release.fingerprint,
    manifest: actual,
  });
}

export function assertProductionManifest(
  manifest: V8ProductionManifest,
): Readonly<{ passed: true; releaseId: string }> {
  invariant(manifest.schema === "nexmold.v8.production-manifest.v1",
    "V8_PRODUCTION_SCHEMA_INVALID", "Unsupported V8 production manifest schema.");
  invariant(manifest.releaseId.trim().length > 0 && manifest.projectionId.trim().length > 0 &&
    manifest.projectionFingerprint.length === 64 && manifest.releaseFingerprint.length === 64,
    "V8_PRODUCTION_IDENTITY_INVALID", "Production manifest contains invalid canonical identities.");

  const paths = canonicalPaths(manifest.manifest);
  invariant(paths.length === manifest.manifest.length && paths.every((value, index) => value === manifest.manifest[index]),
    "V8_PRODUCTION_MANIFEST_NOT_CANONICAL", "Production manifest paths are not canonical.");
  return immutable({ passed: true, releaseId: manifest.releaseId });
}
