import type { ExistingAsset } from "./dedup.js";

export function cannibalizationRisk(query: string, existing: readonly ExistingAsset[]): number {
  const normalized = query.toLowerCase().replace(/\s+/g, " ").trim();
  if (!normalized) return 1;
  const tokens = new Set(normalized.split(" ").filter((x) => x.length > 2));
  let best = 0;
  for (const asset of existing) {
    const other = new Set(asset.title.toLowerCase().split(/\s+/).filter((x) => x.length > 2));
    const union = new Set([...tokens, ...other]);
    const intersection = [...tokens].filter((x) => other.has(x)).length;
    best = Math.max(best, union.size ? intersection / union.size : 0);
  }
  return Number(best.toFixed(4));
}
