import type {
  ClaimId,
  KnowledgeId,
  ProblemId,
  ScopeId,
} from "../domain/primitives.js";

export type SemanticApplicabilityState =
  | "APPLICABLE"
  | "BLOCKED"
  | "UNKNOWN";

export type SemanticApplicabilityReason =
  | "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM"
  | "CLAIM_COVERAGE_INSUFFICIENT"
  | "CLAIM_CONDITION_CONFLICT"
  | "CLAIM_SCOPE_CONFLICT"
  | "SEMANTIC_RELATION_MISSING"
  | "SEMANTIC_RELATION_CONFLICT";

export interface SemanticRelation {
  readonly subject:
    | ProblemId
    | KnowledgeId
    | ClaimId;

  readonly predicate:
    | "RELEVANT_TO"
    | "COVERS"
    | "CONDITION_COMPATIBLE"
    | "SCOPE_COMPATIBLE"
    | "CONFLICTS_WITH";

  readonly object:
    | ProblemId
    | KnowledgeId
    | ClaimId
    | ScopeId;

  readonly source:
    | "EXPLICIT"
    | "VERIFIED_DERIVATION";
}

export interface SemanticApplicabilityInput {
  readonly problemId: ProblemId;
  readonly knowledgeId: KnowledgeId;
  readonly scopeId: ScopeId;

  readonly relations: readonly SemanticRelation[];
}

export interface SemanticApplicabilityResult {
  readonly state: SemanticApplicabilityState;

  readonly problemId: ProblemId;
  readonly knowledgeId: KnowledgeId;
  readonly scopeId: ScopeId;

  readonly reasons:
    readonly SemanticApplicabilityReason[];

  readonly relations:
    readonly SemanticRelation[];
}