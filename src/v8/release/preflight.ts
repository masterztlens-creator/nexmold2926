import { immutable, invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "../foundation/hash.js";
import type { ReleaseArtifact, ReleaseInput } from "./types.js";

export function releasePreflight(i: ReleaseInput): Readonly<ReleaseArtifact> {
  const required = [...new Set(i.requiredPaths.map((x) => x.trim()).filter(Boolean))].sort();
  const generated = [...new Set(i.generatedPaths.map((x) => x.trim()).filter(Boolean))].sort();

  invariant(
    required.every((x) => generated.includes(x)),
    "V8_RELEASE_MISSING_ARTIFACT",
    "Release manifest is missing required projection artifacts.",
  );

  invariant(
    generated.every((x) => required.includes(x)),
    "V8_RELEASE_UNEXPECTED_ARTIFACT",
    "Release manifest contains unexpected artifacts.",
  );

  const fingerprint = contentFingerprint({
    projectionId: i.projection.id,
    projectionFingerprint: i.projection.fingerprint,
    manifest: generated,
  });

  return immutable({
    id: `release:${fingerprint}`,
    projectionId: i.projection.id,
    projectionFingerprint: i.projection.fingerprint,
    fingerprint,
    manifest: generated,
  });
}
