export interface SearchPerformanceObservation {
  assetId: string;
  observedAt: string;
  impressions: number;
  clicks: number;
  conversions: number;
  aiCitations?: number;
}

export interface FeedbackSignal {
  assetId: string;
  ctr: number;
  conversionRate: number;
  aiCitationRate: number;
  action: "KEEP" | "REFRESH" | "REVIEW";
}

export function evaluateFeedback(input: SearchPerformanceObservation): Readonly<FeedbackSignal> {
  const ctr = input.impressions > 0 ? input.clicks / input.impressions : 0;
  const conversionRate = input.clicks > 0 ? input.conversions / input.clicks : 0;
  const aiCitationRate = input.impressions > 0 ? (input.aiCitations ?? 0) / input.impressions : 0;
  const action = input.impressions < 100 ? "KEEP" : conversionRate === 0 && ctr < 0.01 ? "REVIEW" : ctr < 0.02 ? "REFRESH" : "KEEP";
  return Object.freeze({ assetId: input.assetId, ctr, conversionRate, aiCitationRate, action });
}
