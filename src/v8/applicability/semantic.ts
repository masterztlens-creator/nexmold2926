import {
  invariant,
} from "../constitution/invariants.js";

import type {
  ClaimId,
  KnowledgeId,
  ProblemId,
  ScopeId,
} from "../domain/primitives.js";

import type {
  SemanticApplicabilityInput,
  SemanticApplicabilityReason,
  SemanticApplicabilityResult,
  SemanticRelation,
} from "./semantic-types.js";

function hasExactRelation(
  relations: readonly SemanticRelation[],
  predicate: SemanticRelation["predicate"],
  subject: string,
  object: string,
): boolean {
  return relations.some(
    (relation) =>
      relation.predicate === predicate &&
      relation.subject === subject &&
      relation.object === object,
  );
}

function hasConflict(
  relations: readonly SemanticRelation[],
  problemId: ProblemId,
  knowledgeId: KnowledgeId,
  claimIds: readonly ClaimId[],
): boolean {
  return relations.some(
    (relation) => {
      if (
        relation.predicate !==
        "CONFLICTS_WITH"
      ) {
        return false;
      }

      if (
        relation.object !== problemId
      ) {
        return false;
      }

      if (
        relation.subject === knowledgeId
      ) {
        return true;
      }

      return claimIds.includes(
        relation.subject as ClaimId,
      );
    },
  );
}

function uniqueReasons(
  reasons: readonly SemanticApplicabilityReason[],
): SemanticApplicabilityReason[] {
  return [
    ...new Set(reasons),
  ];
}

export function evaluateSemanticApplicability(
  input: SemanticApplicabilityInput,
): SemanticApplicabilityResult {
  const relations = [
    ...input.relations,
  ];

  if (
    hasConflict(
      relations,
      input.problemId,
      input.knowledgeId,
      input.claimIds,
    )
  ) {
    return {
      state: "BLOCKED",
      problemId: input.problemId,
      knowledgeId: input.knowledgeId,
      scopeId: input.scopeId,
      reasons: [
        "SEMANTIC_RELATION_CONFLICT",
      ],
      relations,
    };
  }

  if (relations.length === 0) {
    return {
      state: "UNKNOWN",
      problemId: input.problemId,
      knowledgeId: input.knowledgeId,
      scopeId: input.scopeId,
      reasons: [
        "SEMANTIC_RELATION_MISSING",
      ],
      relations,
    };
  }

  const reasons: SemanticApplicabilityReason[] =
    [];

  const knowledgeRelevant =
    hasExactRelation(
      relations,
      "RELEVANT_TO",
      input.knowledgeId,
      input.problemId,
    );

  if (!knowledgeRelevant) {
    reasons.push(
      "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM",
    );
  }

  const uncoveredClaims =
    input.claimIds.filter(
      (claimId) =>
        !hasExactRelation(
          relations,
          "COVERS",
          claimId,
          input.knowledgeId,
        ),
    );

  if (
    input.claimIds.length === 0 ||
    uncoveredClaims.length > 0
  ) {
    reasons.push(
      "CLAIM_COVERAGE_INSUFFICIENT",
    );
  }

  const incompatibleClaims =
    input.claimIds.filter(
      (claimId) =>
        !hasExactRelation(
          relations,
          "CONDITION_COMPATIBLE",
          claimId,
          input.problemId,
        ),
    );

  if (
    input.claimIds.length === 0 ||
    incompatibleClaims.length > 0
  ) {
    reasons.push(
      "CLAIM_CONDITION_CONFLICT",
    );
  }

  const scopeCompatible =
    hasExactRelation(
      relations,
      "SCOPE_COMPATIBLE",
      input.knowledgeId,
      input.scopeId,
    );

  if (!scopeCompatible) {
    reasons.push(
      "CLAIM_SCOPE_CONFLICT",
    );
  }

  if (reasons.length === 0) {
    return {
      state: "APPLICABLE",
      problemId: input.problemId,
      knowledgeId: input.knowledgeId,
      scopeId: input.scopeId,
      reasons: [],
      relations,
    };
  }

  return {
    state: "UNKNOWN",
    problemId: input.problemId,
    knowledgeId: input.knowledgeId,
    scopeId: input.scopeId,
    reasons: uniqueReasons(reasons),
    relations,
  };
}

export function assertSemanticApplicability(
  input: SemanticApplicabilityInput,
): void {
  const result =
    evaluateSemanticApplicability(input);

  invariant(
    result.state === "APPLICABLE",
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
    result.reasons.join(","),
  );
}