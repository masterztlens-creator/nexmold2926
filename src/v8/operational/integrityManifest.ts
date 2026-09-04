export interface IntegrityRecord {
  readonly path: string;
  readonly sha256: string;
}

export interface IntegrityManifest {
  readonly schemaVersion: "1";
  readonly algorithm: "sha256";
  readonly files: readonly IntegrityRecord[];
}

export function createIntegrityManifest(
  files: readonly IntegrityRecord[]
): IntegrityManifest {
  return {
    schemaVersion: "1",
    algorithm: "sha256",
    files: [...files]
  };
}