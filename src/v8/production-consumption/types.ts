import type { Fingerprint } from "../domain/primitives.js";
import type { V8ProductionExecution } from "../production/types.js";

export interface ProductionConsumptionInput {
  readonly execution: V8ProductionExecution;
}

export interface V8ProductionConsumptionArtifact {
  readonly schema: "nexmold.v8.production-consumption.v1";
  readonly executionId: V8ProductionExecution["executionId"];
  readonly releaseId: V8ProductionExecution["releaseId"];
  readonly projectionId: V8ProductionExecution["projectionId"];
  readonly releaseFingerprint: Fingerprint;
  readonly projectionFingerprint: Fingerprint;
  readonly manifest: readonly string[];
  readonly consumptionId: string;
  readonly consumptionFingerprint: Fingerprint;
}

export type ProductionConsumptionStatus =
  | "AUTHORIZED"
  | "BLOCKED";