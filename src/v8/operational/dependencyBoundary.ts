export interface DependencyBoundary {
  readonly allowed: readonly string[];
  readonly forbidden: readonly string[];
}

export const V8_DEPENDENCY_BOUNDARY: DependencyBoundary = {
  allowed: [
    "src/v8/constitution",
    "src/v8/domain",
    "src/v8/foundation",
    "src/v8/governance",
    "src/v8/semantic",
    "src/v8/evidence",
    "src/v8/eligibility",
    "src/v8/publication",
    "src/v8/projection",
    "src/v8/release",
    "src/v8/production",
    "src/v8/operational"
  ],
  forbidden: [
    "src/regional",
    "src/v7",
    "v714",
    "v715"
  ]
};

export function isForbiddenDependency(reference: string): boolean {
  return V8_DEPENDENCY_BOUNDARY.forbidden.some((token) =>
    reference.includes(token)
  );
}