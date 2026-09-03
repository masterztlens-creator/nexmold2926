import type { Fingerprint } from "../domain/primitives.js";
import type { Projection } from "../projection/types.js";
import type { ReleaseArtifact } from "../release/types.js";

export interface V8ProductionManifest {
  readonly schema: "nexmold.v8.production-manifest.v1";
  readonly releaseId: ReleaseArtifact["id"];
  readonly projectionId: Projection["id"];
  readonly projectionFingerprint: Fingerprint;
  readonly releaseFingerprint: Fingerprint;
  readonly manifest: readonly string[];
}

export interface V8ProductionInput {
  readonly release: ReleaseArtifact;
  readonly projection: Projection;
  readonly expectedPaths: readonly string[];
}
