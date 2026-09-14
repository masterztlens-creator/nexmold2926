import {
  invariant,
} from "../constitution/invariants.js";

import type {
  SemanticApplicabilityInput,
  SemanticApplicabilityResult,
  SemanticRelation,
} from "./semantic-types.js";

function hasRelation(
  relations: readonly SemanticRelation[],
  predicate: SemanticRelation["predicate"],
): boolean {
  return relations.some(
    (relation) =>
      relation.predicate === predicate,
  );
}

function hasConflict(
  relations: readonly SemanticRelation[],
): boolean {
  return relations.some(
    (relation) =>
      relation.predicate ===
      "CONFLICTS_WITH",
  );
}

export function evaluateSemanticApplicability(
  input: SemanticApplicabilityInput,
): SemanticApplicabilityResult {
  invariant(
    input.relations.length > 0,
    "V8_SEMANTIC_APPLICABILITY_RELATIONS_MISSING",
    "Semantic applicability requires explicit semantic relations.",
  );

  const relations = [
    ...input.relations,
  ];

  if (hasConflict(relations)) {
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

  const relevant = hasRelation(
    relations,
    "RELEVANT_TO",
  );

  const covered = hasRelation(
    relations,
    "COVERS",
  );

  const conditionCompatible =
    hasRelation(
      relations,
      "CONDITION_COMPATIBLE",
    );

  const scopeCompatible =
    hasRelation(
      relations,
      "SCOPE_COMPATIBLE",
    );

  if (
    relevant &&
    covered &&
    conditionCompatible &&
    scopeCompatible
  ) {
    return {
      state: "APPLICABLE",
      problemId: input.problemId,
      knowledgeId: input.knowledgeId,
      scopeId: input.scopeId,
      reasons: [],
      relations,
    };
  }

  const reasons: SemanticApplicabilityResult["reasons"] =
    [];

  if (!relevant) {
    reasons.push(
      "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM",
    );
  }

  if (!covered) {
    reasons.push(
      "CLAIM_COVERAGE_INSUFFICIENT",
    );
  }

  if (!conditionCompatible) {
    reasons.push(
      "CLAIM_CONDITION_CONFLICT",
    );
  }

  if (!scopeCompatible) {
    reasons.push(
      "CLAIM_SCOPE_CONFLICT",
    );
  }

  return {
    state: "UNKNOWN",
    problemId: input.problemId,
    knowledgeId: input.knowledgeId,
    scopeId: input.scopeId,
    reasons,
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