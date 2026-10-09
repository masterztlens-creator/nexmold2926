import { createHash } from "node:crypto";

import {
  canonicalize,
  fingerprint,
  nonEmpty,
  sortedUnique,
  type EntityId,
  type Fingerprint,
} from "../../domain/primitives.js";

import {
  normalizeKnowledgeValue,
} from "./property-model.js";

import type {
  CreateKnowledgeConstraintInput,
  KnowledgeConstraint,
  KnowledgeConstraintType,
  KnowledgeValue,
} from "./types.js";

/**
 * NEXMOLD V8 Knowledge Constraint Model
 *
 * A constraint defines a boundary that Knowledge must satisfy.
 *
 * Constraint:
 *   Subject
 *     +
 *   Type
 *     +
 *   Expression / Value
 *     +
 *   Applicability Context
 *
 * Design requirements:
 * - deterministic semantic identity
 * - deterministic fingerprints
 * - fail-closed validation
 * - immutable output
 * - explicit entity/property references
 * - deterministic lookup/indexing
 * - conflict detection
 * - replacement safety
 *
 * Truth is not created here.
 * Evidence / Claim remains the epistemic authority.
 */

const CONSTRAINT_MODEL_VERSION = 1 as const;

const CONSTRAINT_ID_PREFIX =
  "constraint:v8:";

const CONSTRAINT_FINGERPRINT_PREFIX =
  "constraint-fp:v8:";

function normalizeWhitespace(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIdentifier(
  value: string,
): string {
  return normalizeWhitespace(value);
}

function normalizeExpression(
  value: string,
): string {
  return normalizeWhitespace(
    nonEmpty(value, "expression"),
  );
}

function normalizeConstraintType(
  type: KnowledgeConstraintType,
): KnowledgeConstraintType {
  const normalized = String(type).trim();

  switch (normalized) {
    case "REQUIRED":
    case "PROHIBITED":
    case "RANGE":
    case "MINIMUM":
    case "MAXIMUM":
    case "EXACT":
    case "ENUMERATION":
    case "DEPENDENCY":
    case "MUTUAL_EXCLUSION":
    case "PRECONDITION":
    case "POSTCONDITION":
    case "RESOURCE":
    case "CAPABILITY":
    case "SCOPE":
    case "SAFETY":
      return normalized as KnowledgeConstraintType;

    default:
      throw new Error(
        `V8_KNOWLEDGE_INVALID_CONSTRAINT_TYPE: unsupported constraint type "${type}".`,
      );
  }
}

function normalizeUnit(
  value: string | undefined,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized =
    normalizeWhitespace(value);

  return normalized.length > 0
    ? normalized.toLowerCase()
    : undefined;
}

function canonicalValue(
  value: KnowledgeValue | undefined,
): KnowledgeValue | null {
  if (value === undefined) {
    return null;
  }

  return normalizeKnowledgeValue(value);
}

function hashCanonicalValue(
  value: unknown,
): string {
  return createHash("sha256")
    .update(
      JSON.stringify(
        canonicalize(value),
      ),
      "utf8",
    )
    .digest("hex");
}

/**
 * Build the semantic identity of a constraint.
 *
 * Human-readable descriptions are deliberately excluded.
 * A wording change must not silently create a new constraint.
 */
export function constraintIdentity(
  input: Pick<
    CreateKnowledgeConstraintInput,
    | "subjectEntityId"
    | "propertyId"
    | "type"
    | "value"
    | "unit"
    | "expression"
  >,
): string {
  return JSON.stringify(
    canonicalize({
      subjectEntityId:
        input.subjectEntityId === undefined
          ? null
          : normalizeIdentifier(
              String(
                input.subjectEntityId,
              ),
            ),
      propertyId:
        input.propertyId === undefined
          ? null
          : normalizeIdentifier(
              input.propertyId,
            ),
      type: normalizeConstraintType(
        input.type,
      ),
      value: canonicalValue(
        input.value,
      ),
      unit:
        normalizeUnit(input.unit) ??
        null,
      expression:
        normalizeExpression(
          input.expression,
        ),
    }),
  );
}

/**
 * Derive a deterministic constraint ID.
 */
export function deriveConstraintId(
  input: Pick<
    CreateKnowledgeConstraintInput,
    | "subjectEntityId"
    | "propertyId"
    | "type"
    | "value"
    | "unit"
    | "expression"
  >,
): string {
  const digest =
    hashCanonicalValue({
      model:
        CONSTRAINT_MODEL_VERSION,
      identity:
        constraintIdentity(input),
    });

  return `${CONSTRAINT_ID_PREFIX}${digest}`;
}

/**
 * Create a deterministic constraint fingerprint.
 */
export function fingerprintConstraint(
  constraint: KnowledgeConstraint,
): Fingerprint {
  const canonical = canonicalize({
    constraintId:
      constraint.constraintId,
    subjectEntityId:
      constraint.subjectEntityId ===
      undefined
        ? null
        : String(
            constraint.subjectEntityId,
          ),
    propertyId:
      constraint.propertyId ??
      null,
    type:
      normalizeConstraintType(
        constraint.type,
      ),
    value:
      canonicalValue(
        constraint.value,
      ),
    unit:
      normalizeUnit(
        constraint.unit,
      ) ?? null,
    expression:
      normalizeExpression(
        constraint.expression,
      ),
  });

  const digest =
    createHash("sha256")
      .update(
        JSON.stringify(canonical),
        "utf8",
      )
      .digest("hex");

  return fingerprint(
    `${CONSTRAINT_FINGERPRINT_PREFIX}${digest}`,
  );
}

/**
 * Construct a KnowledgeConstraint.
 *
 * Fail-closed rules:
 * - a constraint must have an entity or property subject
 * - type must be recognized
 * - expression must be non-empty
 * - supplied ID must equal deterministic ID
 */
export function createKnowledgeConstraint(
  input: CreateKnowledgeConstraintInput,
): KnowledgeConstraint {
  const type =
    normalizeConstraintType(
      input.type,
    );

  const expression =
    normalizeExpression(
      input.expression,
    );

  const subjectEntityId =
    input.subjectEntityId ===
    undefined
      ? undefined
      : (nonEmpty(
          String(
            input.subjectEntityId,
          ),
          "subjectEntityId",
        ) as EntityId);

  const propertyId =
    input.propertyId === undefined
      ? undefined
      : nonEmpty(
          input.propertyId,
          "propertyId",
        );

  if (
    subjectEntityId === undefined &&
    propertyId === undefined
  ) {
    throw new Error(
      "V8_KNOWLEDGE_CONSTRAINT_SUBJECT_MISSING: constraint must reference a subjectEntityId or propertyId.",
    );
  }

  const value =
    canonicalValue(input.value);

  const unit =
    normalizeUnit(input.unit);

  const identityInput = {
    subjectEntityId,
    propertyId,
    type,
    value:
      value === null
        ? undefined
        : value,
    unit,
    expression,
  } satisfies Pick<
    CreateKnowledgeConstraintInput,
    | "subjectEntityId"
    | "propertyId"
    | "type"
    | "value"
    | "unit"
    | "expression"
  >;

  const derivedConstraintId =
    deriveConstraintId(
      identityInput,
    );

  const suppliedConstraintId =
    nonEmpty(
      input.constraintId,
      "constraintId",
    );

  if (
    suppliedConstraintId !==
    derivedConstraintId
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_ID_MISMATCH: supplied constraintId "${suppliedConstraintId}" does not match deterministic identity "${derivedConstraintId}".`,
    );
  }

  const draft = {
    constraintId:
      derivedConstraintId,
    subjectEntityId,
    propertyId,
    type,
    value:
      value === null
        ? undefined
        : value,
    unit,
    expression,
    fingerprint:
      "" as Fingerprint,
  } satisfies Omit<
    KnowledgeConstraint,
    "fingerprint"
  > & {
    fingerprint: Fingerprint;
  };

  const complete: KnowledgeConstraint = {
    ...draft,
    fingerprint:
      fingerprintConstraint(
        draft as KnowledgeConstraint,
      ),
  };

  return Object.freeze(
    complete,
  );
}

/**
 * Convenience factory that derives the ID.
 */
export function createConstraint(
  input: Omit<
    CreateKnowledgeConstraintInput,
    "constraintId"
  >,
): KnowledgeConstraint {
  const constraintId =
    deriveConstraintId({
      subjectEntityId:
        input.subjectEntityId,
      propertyId:
        input.propertyId,
      type:
        input.type,
      value:
        input.value,
      unit:
        input.unit,
      expression:
        input.expression,
    });

  return createKnowledgeConstraint({
    ...input,
    constraintId,
  });
}

/**
 * Verify the canonical fingerprint.
 */
export function verifyConstraintFingerprint(
  constraint: KnowledgeConstraint,
): boolean {
  try {
    return (
      String(
        fingerprintConstraint(
          constraint,
        ),
      ) ===
      String(
        constraint.fingerprint,
      )
    );
  } catch {
    return false;
  }
}

/**
 * Assert complete constraint integrity.
 */
export function assertConstraintIntegrity(
  constraint: KnowledgeConstraint,
): void {
  if (
    !constraint ||
    typeof constraint !==
      "object"
  ) {
    throw new Error(
      "V8_KNOWLEDGE_INVALID_CONSTRAINT: constraint must be an object.",
    );
  }

  nonEmpty(
    constraint.constraintId,
    "constraintId",
  );

  normalizeConstraintType(
    constraint.type,
  );

  normalizeExpression(
    constraint.expression,
  );

  if (
    constraint.subjectEntityId ===
      undefined &&
    constraint.propertyId ===
      undefined
  ) {
    throw new Error(
      "V8_KNOWLEDGE_CONSTRAINT_SUBJECT_MISSING: constraint must reference a subjectEntityId or propertyId.",
    );
  }

  if (
    constraint.subjectEntityId !==
    undefined
  ) {
    nonEmpty(
      String(
        constraint.subjectEntityId,
      ),
      "subjectEntityId",
    );
  }

  if (
    constraint.propertyId !==
    undefined
  ) {
    nonEmpty(
      constraint.propertyId,
      "propertyId",
    );
  }

  if (
    constraint.value !==
    undefined
  ) {
    canonicalValue(
      constraint.value,
    );
  }

  const expectedId =
    deriveConstraintId({
      subjectEntityId:
        constraint.subjectEntityId,
      propertyId:
        constraint.propertyId,
      type:
        constraint.type,
      value:
        constraint.value,
      unit:
        constraint.unit,
      expression:
        constraint.expression,
    });

  if (
    expectedId !==
    constraint.constraintId
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_ID_MISMATCH: expected "${expectedId}" but received "${constraint.constraintId}".`,
    );
  }

  if (
    !verifyConstraintFingerprint(
      constraint,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_FINGERPRINT_MISMATCH: constraint "${constraint.constraintId}" has an invalid fingerprint.`,
    );
  }
}

/**
 * Determine semantic identity equality.
 */
export function sameConstraintIdentity(
  left: Pick<
    KnowledgeConstraint,
    | "subjectEntityId"
    | "propertyId"
    | "type"
    | "value"
    | "unit"
    | "expression"
  >,
  right: Pick<
    KnowledgeConstraint,
    | "subjectEntityId"
    | "propertyId"
    | "type"
    | "value"
    | "unit"
    | "expression"
  >,
): boolean {
  return (
    constraintIdentity(
      left,
    ) ===
    constraintIdentity(
      right,
    )
  );
}

/**
 * Find a constraint by deterministic ID.
 */
export function findConstraint(
  constraints:
    readonly KnowledgeConstraint[],
  constraintId: string,
): KnowledgeConstraint | null {
  const id = nonEmpty(
    constraintId,
    "constraintId",
  );

  return (
    constraints.find(
      (constraint) =>
        constraint.constraintId ===
        id,
    ) ?? null
  );
}

/**
 * Find constraints by property.
 */
export function findConstraintsByProperty(
  constraints:
    readonly KnowledgeConstraint[],
  propertyId: string,
): readonly KnowledgeConstraint[] {
  const id = nonEmpty(
    propertyId,
    "propertyId",
  );

  return constraints.filter(
    (constraint) =>
      constraint.propertyId === id,
  );
}

/**
 * Find constraints by entity.
 */
export function findConstraintsByEntity(
  constraints:
    readonly KnowledgeConstraint[],
  entityId: EntityId,
): readonly KnowledgeConstraint[] {
  const id = nonEmpty(
    String(entityId),
    "entityId",
  );

  return constraints.filter(
    (constraint) =>
      constraint.subjectEntityId !==
        undefined &&
      String(
        constraint.subjectEntityId,
      ) === id,
  );
}

/**
 * Find constraints by type.
 */
export function findConstraintsByType(
  constraints:
    readonly KnowledgeConstraint[],
  type: KnowledgeConstraintType,
): readonly KnowledgeConstraint[] {
  const normalized =
    normalizeConstraintType(
      type,
    );

  return constraints.filter(
    (constraint) =>
      constraint.type ===
      normalized,
  );
}

/**
 * Build a deterministic constraint index.
 */
export function indexConstraints(
  constraints:
    readonly KnowledgeConstraint[],
): ReadonlyMap<
  string,
  KnowledgeConstraint
> {
  const map = new Map<
    string,
    KnowledgeConstraint
  >();

  for (const constraint of constraints) {
    assertConstraintIntegrity(
      constraint,
    );

    const existing =
      map.get(
        constraint.constraintId,
      );

    if (
      existing === undefined
    ) {
      map.set(
        constraint.constraintId,
        constraint,
      );
      continue;
    }

    if (
      !sameConstraintIdentity(
        existing,
        constraint,
      )
    ) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_INDEX_CONFLICT: constraint ID "${constraint.constraintId}" maps to multiple semantic identities.`,
      );
    }

    if (
      existing.fingerprint !==
      constraint.fingerprint
    ) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_INDEX_FINGERPRINT_CONFLICT: constraint ID "${constraint.constraintId}" has conflicting fingerprints.`,
      );
    }
  }

  return map;
}

/**
 * Deduplicate constraints deterministically.
 */
export function deduplicateConstraints(
  constraints:
    readonly KnowledgeConstraint[],
): readonly KnowledgeConstraint[] {
  const map =
    indexConstraints(
      constraints,
    );

  return [
    ...map.values(),
  ].sort(
    (left, right) =>
      left.constraintId.localeCompare(
        right.constraintId,
      ),
  );
}

/**
 * Detect semantic conflicts.
 */
export function assertNoConstraintConflicts(
  constraints:
    readonly KnowledgeConstraint[],
): void {
  const byIdentity =
    new Map<
      string,
      KnowledgeConstraint
    >();

  for (const constraint of constraints) {
    assertConstraintIntegrity(
      constraint,
    );

    const identity =
      constraintIdentity(
        constraint,
      );

    const previous =
      byIdentity.get(identity);

    if (
      previous === undefined
    ) {
      byIdentity.set(
        identity,
        constraint,
      );
      continue;
    }

    if (
      previous.constraintId !==
      constraint.constraintId
    ) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_ID_CONFLICT: semantic identity maps to multiple constraint IDs "${previous.constraintId}" and "${constraint.constraintId}".`,
      );
    }

    if (
      previous.fingerprint !==
      constraint.fingerprint
    ) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_FINGERPRINT_CONFLICT: semantic identity maps to conflicting fingerprints.`,
      );
    }
  }
}

/**
 * Fingerprint an entire constraint collection.
 */
export function fingerprintConstraints(
  constraints:
    readonly KnowledgeConstraint[],
): Fingerprint {
  const canonicalConstraints =
    deduplicateConstraints(
      constraints,
    ).map(
      (constraint) => ({
        constraintId:
          constraint.constraintId,
        subjectEntityId:
          constraint.subjectEntityId ===
          undefined
            ? null
            : String(
                constraint.subjectEntityId,
              ),
        propertyId:
          constraint.propertyId ??
          null,
        type:
          constraint.type,
        value:
          canonicalValue(
            constraint.value,
          ),
        unit:
          normalizeUnit(
            constraint.unit,
          ) ?? null,
        expression:
          normalizeExpression(
            constraint.expression,
          ),
        fingerprint:
          String(
            constraint.fingerprint,
          ),
      }),
    );

  const digest =
    hashCanonicalValue(
      canonicalConstraints,
    );

  return fingerprint(
    `${CONSTRAINT_FINGERPRINT_PREFIX}collection:${digest}`,
  );
}

/**
 * Ensure a replacement cannot silently change semantic identity.
 */
export function assertConstraintReplacementSafe(
  current: KnowledgeConstraint,
  replacement: KnowledgeConstraint,
): void {
  assertConstraintIntegrity(
    current,
  );

  assertConstraintIntegrity(
    replacement,
  );

  if (
    current.constraintId !==
    replacement.constraintId
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_REPLACEMENT_ID_CHANGE: constraint replacement changes ID from "${current.constraintId}" to "${replacement.constraintId}".`,
    );
  }

  if (
    !sameConstraintIdentity(
      current,
      replacement,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_REPLACEMENT_IDENTITY_CHANGE: constraint "${current.constraintId}" semantic identity changed.`,
    );
  }
}

/**
 * Return an immutable canonical snapshot.
 */
export function snapshotConstraint(
  constraint: KnowledgeConstraint,
): KnowledgeConstraint {
  assertConstraintIntegrity(
    constraint,
  );

  return Object.freeze({
    constraintId:
      constraint.constraintId,
    subjectEntityId:
      constraint.subjectEntityId,
    propertyId:
      constraint.propertyId,
    type:
      constraint.type,
    value:
      constraint.value,
    unit:
      constraint.unit,
    expression:
      constraint.expression,
    fingerprint:
      constraint.fingerprint,
  });
}

/**
 * Clone a constraint into a detached immutable object.
 */
export function cloneConstraint(
  constraint: KnowledgeConstraint,
): KnowledgeConstraint {
  assertConstraintIntegrity(
    constraint,
  );

  const clone =
    JSON.parse(
      JSON.stringify(
        constraint,
      ),
    ) as KnowledgeConstraint;

  return Object.freeze(
    clone,
  );
}

/**
 * Deterministic comparison.
 */
export function compareConstraints(
  left: KnowledgeConstraint,
  right: KnowledgeConstraint,
): number {
  return left.constraintId.localeCompare(
    right.constraintId,
  );
}

/**
 * Deterministically sort constraints.
 */
export function sortConstraints(
  constraints:
    readonly KnowledgeConstraint[],
): readonly KnowledgeConstraint[] {
  return [
    ...constraints,
  ].sort(
    compareConstraints,
  );
}

/**
 * Verify an entire constraint collection.
 */
export function verifyConstraintCollection(
  constraints:
    readonly KnowledgeConstraint[],
): void {
  assertNoConstraintConflicts(
    constraints,
  );

  for (const constraint of constraints) {
    assertConstraintIntegrity(
      constraint,
    );
  }
}

/**
 * Collect unique referenced entity IDs.
 */
export function collectConstraintEntityIds(
  constraints:
    readonly KnowledgeConstraint[],
): readonly EntityId[] {
  return sortedUnique(
    constraints
      .map(
        (constraint) =>
          constraint.subjectEntityId ===
          undefined
            ? ""
            : String(
                constraint.subjectEntityId,
              ),
      )
      .filter(
        (value) =>
          value.length > 0,
      ),
  ) as readonly EntityId[];
}

/**
 * Collect unique referenced property IDs.
 */
export function collectConstraintPropertyIds(
  constraints:
    readonly KnowledgeConstraint[],
): readonly string[] {
  return sortedUnique(
    constraints
      .map(
        (constraint) =>
          constraint.propertyId ??
          "",
      )
      .filter(
        (value) =>
          value.length > 0,
      ),
  );
}

/**
 * Model defaults and explicit invariants.
 */
export const CONSTRAINT_MODEL_DEFAULTS =
  Object.freeze({
    modelVersion:
      CONSTRAINT_MODEL_VERSION,
    idPrefix:
      CONSTRAINT_ID_PREFIX,
    fingerprintPrefix:
      CONSTRAINT_FINGERPRINT_PREFIX,
    requireSubjectOrProperty:
      true,
    deterministicIdentity:
      true,
    immutableOutput:
      true,
    failClosed:
      true,
  });