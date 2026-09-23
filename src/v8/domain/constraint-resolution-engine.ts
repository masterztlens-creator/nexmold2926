import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import {
  createConstraintResolution,
  type ConstraintResolution,
} from "./constraint-resolution.js";

import type {
  ConstraintSemanticRequirement,
} from "./constraint-semantics.js";

import type {
  Constraint,
} from "./constraint.js";

import type {
  SemanticRelation,
} from "../applicability/semantic-types.js";

import type {
  ClaimId,
  KnowledgeId,
} from "./primitives.js";

function relationKey(
  relation: SemanticRelation,
): string {
  return [
    relation.subject,
    relation.predicate,
    relation.object,
    relation.source,
  ].join("|");
}

function sameRelation(
  left: SemanticRelation,
  right: SemanticRelation,
): boolean {
  return (
    left.subject === right.subject &&
    left.predicate === right.predicate &&
    left.object === right.object &&
    left.source === right.source
  );
}

function findConflictRelation(
  requirements: readonly ConstraintSemanticRequirement[],
  relations: readonly SemanticRelation[],
): SemanticRelation | undefined {
  return relations.find(
    (relation) =>
      relation.predicate === "CONFLICTS_WITH" &&
      requirements.some(
        (requirement) =>
          sameRelation(
            requirement.relation,
            relation,
          ),
      ),
  );
}

function findMissingRequirements(
  requirements: readonly ConstraintSemanticRequirement[],
  relations: readonly SemanticRelation[],
): readonly ConstraintSemanticRequirement[] {
  return immutable(
    requirements.filter(
      (requirement) =>
        !relations.some(
          (relation) =>
            sameRelation(
              requirement.relation,
              relation,
            ),
        ),
    ),
  );
}

function requirementDescription(
  requirement: ConstraintSemanticRequirement,
): string {
  return [
    requirement.relation.subject,
    requirement.relation.predicate,
    requirement.relation.object,
    requirement.relation.source,
  ].join("|");
}

function collectKnowledgeIds(
  requirements: readonly ConstraintSemanticRequirement[],
): readonly KnowledgeId[] {
  const values: KnowledgeId[] = [];

  for (const requirement of requirements) {
    const subject =
      requirement.relation.subject;

    if (subject.startsWith("knowledge:")) {
      values.push(
        subject as KnowledgeId,
      );
    }
  }

  return immutable(
    [...new Set(values)].sort(),
  );
}

function collectClaimIds(
  requirements: readonly ConstraintSemanticRequirement[],
): readonly ClaimId[] {
  const values: ClaimId[] = [];

  for (const requirement of requirements) {
    const subject =
      requirement.relation.subject;

    if (subject.startsWith("claim:")) {
      values.push(
        subject as ClaimId,
      );
    }
  }

  return immutable(
    [...new Set(values)].sort(),
  );
}

export interface ResolveConstraintSemanticInput {
  readonly constraint: Constraint;
  readonly requirements: readonly ConstraintSemanticRequirement[];
  readonly relations: readonly SemanticRelation[];
}

export function resolveConstraintSemanticRequirements(
  input: ResolveConstraintSemanticInput,
): Readonly<ConstraintResolution> {
  const {
    constraint,
    requirements,
    relations,
  } = input;

  invariant(
    constraint.id.trim().length > 0,
    "V8_CONSTRAINT_RESOLUTION_CONSTRAINT_ID_EMPTY",
    "Constraint resolution requires a constraint id.",
  );

  invariant(
    requirements.length > 0,
    "V8_CONSTRAINT_RESOLUTION_REQUIREMENTS_EMPTY",
    "Constraint resolution requires semantic requirements.",
  );

  invariant(
    requirements.every(
      (requirement) =>
        requirement.constraintId ===
        constraint.id,
    ),
    "V8_CONSTRAINT_RESOLUTION_CONSTRAINT_MISMATCH",
    "Every semantic requirement must belong to the resolved constraint.",
  );

  const conflict =
    findConflictRelation(
      requirements,
      relations,
    );

  if (conflict !== undefined) {
    return createConstraintResolution({
      constraintId: constraint.id,
      status: "UNSATISFIED",
      proof: {
        knowledgeIds: [],
        claimIds: [],
      },
      reason:
        `Semantic conflict: ${relationKey(conflict)}`,
    });
  }

  const missing =
    findMissingRequirements(
      requirements,
      relations,
    );

  if (missing.length > 0) {
    return createConstraintResolution({
      constraintId: constraint.id,
      status: "UNKNOWN",
      proof: {
        knowledgeIds: [],
        claimIds: [],
      },
      reason:
        `Missing semantic requirements: ${missing
          .map(requirementDescription)
          .join(",")}`,
    });
  }

  const knowledgeIds =
    collectKnowledgeIds(
      requirements,
    );

  const claimIds =
    collectClaimIds(
      requirements,
    );

  return createConstraintResolution({
    constraintId: constraint.id,
    status: "SATISFIED",
    proof: {
      knowledgeIds,
      claimIds,
    },
    reason:
      "All declared semantic requirements are satisfied.",
  });
}