export interface ArtifactRecord {
  readonly path: string;
  readonly size: number;
  readonly sha256: string;
}

export interface ArtifactManifest {
  readonly schemaVersion: "1";
  readonly generatedAt: string;
  readonly artifacts: readonly ArtifactRecord[];
}

export function createArtifactManifest(
  artifacts: readonly ArtifactRecord[],
  generatedAt = new Date().toISOString()
): ArtifactManifest {
  return {
    schemaVersion: "1",
    generatedAt,
    artifacts: [...artifacts]
  };
}