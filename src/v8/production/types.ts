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

export interface ProductionExecutionInput {
  readonly release: ReleaseArtifact;
}

export type ProductionExecutionStatus =
  | "EXECUTED"
  | "BLOCKED";

export interface ProductionExecutionResult {
  readonly passed: boolean;
  readonly status: ProductionExecutionStatus;
  readonly releaseId: string;
  readonly releaseFingerprint: Fingerprint;
  readonly manifest: readonly string[];
  readonly executionId: string;
  readonly executionFingerprint: Fingerprint;
  readonly reasons: readonly string[];
}

export type V8ProductionExecutionStatus =
  | "EXECUTED"
  | "BLOCKED";

export interface V8ProductionExecution {
  readonly schema: "nexmold.v8.production-execution.v1";
  readonly status: V8ProductionExecutionStatus;
  readonly releaseId: ReleaseArtifact["id"];
  readonly projectionId: Projection["id"];
  readonly releaseFingerprint: Fingerprint;
  readonly projectionFingerprint: Fingerprint;
  readonly manifest: readonly string[];
  readonly executionId: string;
  readonly executionFingerprint: Fingerprint;
}