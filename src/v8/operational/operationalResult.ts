export interface OperationalResult {
  readonly gate: "V8_OPERATIONAL";
  readonly passed: boolean;
  readonly invariants: readonly {
    readonly invariant: string;
    readonly passed: boolean;
    readonly detail: string;
  }[];
}

export function createOperationalResult(
  invariants: readonly {
    readonly invariant: string;
    readonly passed: boolean;
    readonly detail: string;
  }[]
): OperationalResult {
  return {
    gate: "V8_OPERATIONAL",
    passed: invariants.every((item) => item.passed),
    invariants: [...invariants]
  };
}