export interface OperationalInvariantResult {
  readonly invariant: string;
  readonly passed: boolean;
  readonly detail: string;
}

export function evaluateOperationalInvariants(input: {
  packageName: string;
  typescriptVersion: string;
  lockfileVersion: number;
  nodeEngine: string;
  forbiddenDependencyCount: number;
}): OperationalInvariantResult[] {
  return [
    {
      invariant: "PACKAGE_NAME",
      passed: input.packageName === "nexmold-v8-full",
      detail: input.packageName
    },
    {
      invariant: "TYPESCRIPT_VERSION",
      passed: input.typescriptVersion === "6.0.3",
      detail: input.typescriptVersion
    },
    {
      invariant: "LOCKFILE_VERSION",
      passed: input.lockfileVersion === 3,
      detail: String(input.lockfileVersion)
    },
    {
      invariant: "NODE_ENGINE",
      passed: input.nodeEngine === ">=22.12.0",
      detail: input.nodeEngine
    },
    {
      invariant: "FORBIDDEN_DEPENDENCIES",
      passed: input.forbiddenDependencyCount === 0,
      detail: String(input.forbiddenDependencyCount)
    }
  ];
}