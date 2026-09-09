
import type {
  ContentBrief,
  ContentDraft,
  GrowthState,
  KeywordRecord,
  Opportunity,
} from "./shared.js";

export interface GrowthPipelineInput {
  readonly cycleId: string;
  readonly keywords: readonly KeywordRecord[];
  readonly opportunities: readonly Opportunity[];
  readonly briefs?: readonly ContentBrief[];
  readonly drafts?: readonly ContentDraft[];
  readonly publishedSlugs?: readonly string[];
}

export function createGrowthState(input: GrowthPipelineInput): GrowthState {
  return Object.freeze({
    cycleId: input.cycleId,
    keywords: Object.freeze([...input.keywords]),
    opportunities: Object.freeze([...input.opportunities]),
    briefs: Object.freeze([...(input.briefs ?? [])]),
    drafts: Object.freeze([...(input.drafts ?? [])]),
    publishedSlugs: Object.freeze([...(input.publishedSlugs ?? [])]),
    blocked: Object.freeze([]),
  });
}

export function nextGrowthCycle(
  state: GrowthState,
  additions: {
    readonly keywords?: readonly KeywordRecord[];
    readonly opportunities?: readonly Opportunity[];
    readonly briefs?: readonly ContentBrief[];
    readonly drafts?: readonly ContentDraft[];
    readonly publishedSlugs?: readonly string[];
    readonly blocked?: readonly string[];
  },
): GrowthState {
  return Object.freeze({
    cycleId: state.cycleId,
    keywords: Object.freeze([...state.keywords, ...(additions.keywords ?? [])]),
    opportunities: Object.freeze([...state.opportunities, ...(additions.opportunities ?? [])]),
    briefs: Object.freeze([...state.briefs, ...(additions.briefs ?? [])]),
    drafts: Object.freeze([...state.drafts, ...(additions.drafts ?? [])]),
    publishedSlugs: Object.freeze([...state.publishedSlugs, ...(additions.publishedSlugs ?? [])]),
    blocked: Object.freeze([...state.blocked, ...(additions.blocked ?? [])]),
  });
}
