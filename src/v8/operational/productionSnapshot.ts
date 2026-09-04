export interface ProductionSnapshot {
  readonly schemaVersion: "1";
  readonly commitSha: string;
  readonly buildFingerprint: string;
  readonly artifactCount: number;
  readonly generatedAt: string;
}

export function createProductionSnapshot(input: {
  commitSha: string;
  buildFingerprint: string;
  artifactCount: number;
  generatedAt?: string;
}): ProductionSnapshot {
  return {
    schemaVersion: "1",
    commitSha: input.commitSha,
    buildFingerprint: input.buildFingerprint,
    artifactCount: input.artifactCount,
    generatedAt: input.generatedAt ?? new Date().toISOString()
  };
}