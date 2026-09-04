export interface BuildFingerprint {
  readonly schemaVersion: "1";
  readonly algorithm: "sha256";
  readonly inputs: {
    readonly packageJson: string;
    readonly packageLock: string;
    readonly tsconfig: string;
  };
  readonly fingerprint: string;
}

export function createBuildFingerprint(input: {
  packageJson: string;
  packageLock: string;
  tsconfig: string;
  fingerprint: string;
}): BuildFingerprint {
  return {
    schemaVersion: "1",
    algorithm: "sha256",
    inputs: {
      packageJson: input.packageJson,
      packageLock: input.packageLock,
      tsconfig: input.tsconfig
    },
    fingerprint: input.fingerprint
  };
}