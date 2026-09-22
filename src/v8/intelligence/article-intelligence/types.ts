import type { FoundationStore } from "../../foundation/types.js";

export interface ArticleSectionRequest {
  readonly sectionId: string;
  readonly heading: string;
  readonly knowledgeIds: readonly string[];
}

export interface ArticleSectionBinding {
  readonly sectionId: string;
  readonly heading: string;
  readonly knowledgeIds: readonly string[];
  readonly claimIds: readonly string[];
  readonly evidenceIds: readonly string[];
}

export interface ArticlePlan {
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly sections: readonly ArticleSectionBinding[];
}

export interface ArticlePlanInput {
  readonly decisionId: string;
  readonly scopeId: string;
  readonly contextId: string;
  readonly sections: readonly ArticleSectionRequest[];
}

export interface ArticlePlanBuilder {
  plan(input: ArticlePlanInput): ArticlePlan;
}

export type ArticlePlanStore = FoundationStore;