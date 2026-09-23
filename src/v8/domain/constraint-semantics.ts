import {
  immutable,
  invariant,
} from "../constitution/invariants.js";

import type {
  SemanticRelation,
} from "../applicability/semantic-types.js";

import type {
  Constraint,
} from "./constraint.js";

export type ConstraintSemanticRequirement =
  | {
      readonly constraintId: Constraint["id"];
      readonly relation: Extract<
        SemanticRelation,
        {
          readonly predicate: "RELEVANT_TO";
        }
      >;
    }
  | {
      readonly constraintId: Constraint["id"];
      readonly relation: Extract<
        SemanticRelation,
        {
          readonly predicate: "COVERS";
        }
      >;
    }
  | {
      readonly constraintId: Constraint["id"];
      readonly relation: Extract<
        SemanticRelation,
        {
          readonly predicate: "CONDITION_COMPATIBLE";
        }
      >;
    }
  | {
      readonly constraintId: Constraint["id"];
      readonly relation: Extract<
        SemanticRelation,
        {
          readonly predicate: "SCOPE_COMPATIBLE";
        }
      >;
    }
  | {
      readonly constraintId: Constraint["id"];
      readonly relation: Extract<
        SemanticRelation,
        {
          readonly predicate: "CONFLICTS_WITH";
        }
      >;
    };

function assertConstraintIdentity(
  constraintId: Constraint["id"],
  relation: SemanticRelation,
): void {
  invariant(
    typeof constraintId === "string" &&
      constraintId.trim().length > 0,
    "V8_CONSTRAINT_SEMANTIC_ID_EMPTY",
    "Constraint semantic requirement requires a constraint id.",
  );

  invariant(
    typeof relation.subject === "string" &&
      relation.subject.trim().length > 0,
    "V8_CONSTRAINT_SEMANTIC_SUBJECT_EMPTY",
    "Constraint semantic requirement requires a relation subject.",
  );

  invariant(
    typeof relation.object === "string" &&
      relation.object.trim().length > 0,
    "V8_CONSTRAINT_SEMANTIC_OBJECT_EMPTY",
    "Constraint semantic requirement requires a relation object.",
  );
}

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

function normalizeRelations(
  relations: readonly SemanticRelation[],
): readonly SemanticRelation[] {
  const unique = new Map<
    string,
    SemanticRelation
  >();

  for (const relation of relations) {
    invariant(
      typeof relation.subject === "string" &&
        relation.subject.trim().length > 0,
      "V8_CONSTRAINT_SEMANTIC_SUBJECT_EMPTY",
      "Constraint semantic requirement requires a relation subject.",
    );

    invariant(
      typeof relation.object === "string" &&
        relation.object.trim().length > 0,
      "V8_CONSTRAINT_SEMANTIC_OBJECT_EMPTY",
      "Constraint semantic requirement requires a relation object.",
    );

    unique.set(
      relationKey(relation),
      relation,
    );
  }

  return immutable(
    [...unique.values()].sort(
      (a, b) =>
        relationKey(a).localeCompare(
          relationKey(b),
        ),
    ),
  );
}

export function createConstraintSemanticRequirements(
  constraintId: Constraint["id"],
  relations: readonly SemanticRelation[],
): readonly ConstraintSemanticRequirement[] {
  invariant(
    relations.length > 0,
    "V8_CONSTRAINT_SEMANTIC_REQUIREMENT_EMPTY",
    "A constraint must declare at least one explicit semantic requirement.",
  );

  const normalized =
    normalizeRelations(
      relations,
    );

  for (const relation of normalized) {
    assertConstraintIdentity(
      constraintId,
      relation,
    );
  }

  return immutable(
    normalized.map(
      (relation) => ({
        constraintId,
        relation,
      }),
    ) as ConstraintSemanticRequirement[],
  );
}

export function hasExactConstraintSemanticRequirement(
  requirements: readonly ConstraintSemanticRequirement[],
  relation: SemanticRelation,
): boolean {
  return requirements.some(
    (requirement) =>
      requirement.relation.subject ===
        relation.subject &&
      requirement.relation.predicate ===
        relation.predicate &&
      requirement.relation.object ===
        relation.object &&
      requirement.relation.source ===
        relation.source,
  );
}

export function hasRequiredConstraintSemanticRelations(
  requirements: readonly ConstraintSemanticRequirement[],
  relations: readonly SemanticRelation[],
): boolean {
  return requirements.every(
    (requirement) =>
      relations.some(
        (relation) =>
          relation.subject ===
            requirement.relation.subject &&
          relation.predicate ===
            requirement.relation.predicate &&
          relation.object ===
            requirement.relation.object &&
          relation.source ===
            requirement.relation.source,
      ),
  );
}