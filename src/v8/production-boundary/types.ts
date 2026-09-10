import type { ReleaseArtifact } from "../release/types.js";
export interface ProductionBoundaryInput {
  readonly release: ReleaseArtifact;
}
export type ProductionBoundaryStatus =
  | "READY"
  | "BLOCKED";
export interface ProductionBoundaryResult {
  readonly passed: boolean;
  readonly status: ProductionBoundaryStatus;
  readonly releaseId: string;
  readonly fingerprint: string;
  readonly manifest: readonly string[];
  readonly reasons: readonly string[];
}
