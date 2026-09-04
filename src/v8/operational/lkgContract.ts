export interface LkgContract {
  readonly schemaVersion: "1";
  readonly tag: string;
  readonly commitSha: string;
  readonly packageName: string;
  readonly typescriptVersion: string;
  readonly nodeEngine: string;
}

export const V8_LKG_CONTRACT: LkgContract = {
  schemaVersion: "1",
  tag: "v8-lkg",
  commitSha: "d0ae7038c90f4a79c228eaa2ba0ac6a98752fb0a",
  packageName: "nexmold-v8-full",
  typescriptVersion: "6.0.3",
  nodeEngine: ">=22.12.0"
};

export function matchesLkgContract(input: {
  packageName: string;
  typescriptVersion: string;
  nodeEngine: string;
}): boolean {
  return (
    input.packageName === V8_LKG_CONTRACT.packageName &&
    input.typescriptVersion === V8_LKG_CONTRACT.typescriptVersion &&
    input.nodeEngine === V8_LKG_CONTRACT.nodeEngine
  );
}