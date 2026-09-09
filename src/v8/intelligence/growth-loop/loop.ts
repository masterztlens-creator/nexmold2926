
import { rankOpportunities, type Opportunity, type GrowthState } from "../shared.js";
import { nextGrowthCycle } from "./pipeline.js";
export interface GrowthLoopDecision { readonly nextOpportunities: readonly Opportunity[]; readonly publishCandidates: readonly string[]; readonly blocked: readonly string[]; }
export function runGrowthLoop(state: GrowthState): GrowthLoopDecision {
  const ranked=rankOpportunities(state.opportunities).filter(o=>!state.publishedSlugs.includes(o.keyword.normalized));
  const publishCandidates=ranked.filter(o=>o.score>=.65).slice(0,20).map(o=>o.keyword.normalized);
  const blocked=ranked.filter(o=>o.score<.4).map(o=>o.keyword.normalized);
  return Object.freeze({nextOpportunities:Object.freeze(ranked),publishCandidates:Object.freeze(publishCandidates),blocked:Object.freeze(blocked)});
}
export function advanceGrowthLoop(state: GrowthState, decision: GrowthLoopDecision): GrowthState {
  return nextGrowthCycle(state,{publishedSlugs:decision.publishCandidates,blocked:decision.blocked});
}
