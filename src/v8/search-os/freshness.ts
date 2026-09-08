export interface FreshnessPolicy {
  maxAgeDays: number;
  reviewOnSourceChange: boolean;
}

export interface FreshnessState {
  observedAt: string;
  sourceChangedAt?: string;
  stale: boolean;
  reason?: string;
}

export function evaluateFreshness(state: Omit<FreshnessState, "stale" | "reason">, policy: FreshnessPolicy, now = new Date()): Readonly<FreshnessState> {
  const observed = new Date(state.observedAt);
  const ageDays = (now.getTime() - observed.getTime()) / 86400000;
  const sourceChanged = state.sourceChangedAt ? new Date(state.sourceChangedAt).getTime() > observed.getTime() : false;
  const stale = !Number.isFinite(observed.getTime()) || ageDays > policy.maxAgeDays || (policy.reviewOnSourceChange && sourceChanged);
  const reason = !Number.isFinite(observed.getTime()) ? "Observed timestamp is invalid." : sourceChanged && policy.reviewOnSourceChange ? "Source changed after observation." : ageDays > policy.maxAgeDays ? "Observation exceeded freshness policy." : undefined;
  return Object.freeze({ ...state, stale, reason });
}
