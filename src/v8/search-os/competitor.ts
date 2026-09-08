import type { CompetitorObservation } from "./contracts.js";

export function rankCompetitorOpportunity(items: readonly CompetitorObservation[]): number {
  if (items.length === 0) return 1;
  const averageGap = items.reduce((sum, item) => {
    const weakness = 1 - ((item.evidenceDensity + item.engineeringDepth + item.uniqueValue) / 3);
    return sum + Math.max(0, Math.min(1, weakness));
  }, 0) / items.length;
  return Number(averageGap.toFixed(4));
}
