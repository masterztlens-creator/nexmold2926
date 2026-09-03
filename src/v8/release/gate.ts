import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import type { ReleaseArtifact } from "./types.js";

export function assertReleaseReady(r: ReleaseArtifact) {
  invariant(r.manifest.length > 0, "V8_RELEASE_EMPTY_MANIFEST", "Release manifest cannot be empty.");
  const manifest = [...new Set(r.manifest.map((x) => x.trim()).filter(Boolean))].sort();

  invariant(
    manifest.length === r.manifest.length &&
      manifest.every((x, i) => x === r.manifest[i]),
    "V8_RELEASE_MANIFEST_NOT_CANONICAL",
    "Release manifest is not canonical.",
  );

  invariant(
    r.projectionId.trim().length > 0,
    "V8_RELEASE_PROJECTION_REQUIRED",
    "Release must reference a projection.",
  );

  invariant(
    r.projectionFingerprint.length === 64,
    "V8_RELEASE_PROJECTION_FINGERPRINT_INVALID",
    "Projection fingerprint must be SHA-256.",
  );

  const expected = contentFingerprint({
    projectionId: r.projectionId,
    projectionFingerprint: r.projectionFingerprint,
    manifest: r.manifest,
  });

  invariant(
    r.fingerprint === expected,
    "V8_RELEASE_FINGERPRINT_MISMATCH",
    "Release fingerprint does not match canonical payload.",
  );

  invariant(
    r.id === `release:${expected}`,
    "V8_RELEASE_ID_MISMATCH",
    "Release id does not match canonical fingerprint.",
  );

  return immutable({ passed: true, releaseId: r.id });
}
