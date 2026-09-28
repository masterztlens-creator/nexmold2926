export interface FreshnessPolicy { readonly maxAgeMs: number; readonly reviewAfterMs: number; }
export interface FreshnessRecord { readonly id: string; readonly observedAt: string; readonly now: string; readonly ageMs: number; readonly status: "FRESH" | "REVIEW" | "STALE" | "UNKNOWN"; }
export function assessFreshness(id: string, observedAt: string, now: string, policy: FreshnessPolicy): FreshnessRecord {
  const t = Date.parse(observedAt), n = Date.parse(now); if (!Number.isFinite(t) || !Number.isFinite(n) || n < t) return Object.freeze({ id, observedAt, now, ageMs: 0, status: "UNKNOWN" });
  const ageMs = n - t; const status = ageMs <= policy.reviewAfterMs ? "FRESH" : ageMs <= policy.maxAgeMs ? "REVIEW" : "STALE"; return Object.freeze({ id, observedAt, now, ageMs, status });
}
