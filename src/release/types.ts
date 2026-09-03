import type { Fingerprint } from "../domain/primitives.js";
import type { Projection } from "../projection/types.js";

export interface ReleaseArtifact {
  readonly id: string;
  readonly projectionId: string;
  readonly projectionFingerprint: Fingerprint;
  readonly fingerprint: Fingerprint;
  readonly manifest: readonly string[];
}

export interface ReleaseInput {
  readonly projection: Projection;
  readonly requiredPaths: readonly string[];
  readonly generatedPaths: readonly string[];
}
