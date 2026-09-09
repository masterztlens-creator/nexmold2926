
import { clamp, type KeywordRecord, type Opportunity } from "../shared.js";
export interface OpportunitySignals { readonly demand: number; readonly relevance: number; readonly competition: number; readonly authorityGap: number; readonly conversionPotential: number; }
export function scoreOpportunity(keyword: KeywordRecord, s: OpportunitySignals): Opportunity {
  const score = clamp(0.27*s.demand + 0.27*s.relevance + 0.16*(1-s.competition) + 0.15*s.authorityGap + 0.15*s.conversionPotential);
  const reasons = [s.demand >= .7 ? "high-demand" : "demand-gap", s.relevance >= .8 ? "high-relevance" : "relevance-review", s.competition <= .4 ? "competitive-opening" : "competitive-pressure"];
  return Object.freeze({ keyword, score, ...s, reasons: Object.freeze(reasons) });
}
export function rankOpportunities(items: readonly Opportunity[]): readonly Opportunity[] { return Object.freeze([...items].sort((a,b)=>b.score-a.score)); }
