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
  KnowledgeCondition,
  KnowledgeConditionOperator,
  KnowledgeValue,
  CreateKnowledgeConditionInput,
} from "./types.js";

/**
 * NEXMOLD V8 Knowledge Condition Model
 *
 * Responsibility:
 * - deterministic condition identity
 * - canonical condition normalization
 * - immutable construction
 * - deterministic fingerprinting
 * - fail-closed integrity verification
 * - condition lookup / indexing
 * - deduplication
 * - replacement safety
 * - collection fingerprinting
 *
 * A condition describes the applicability context under which
 * a knowledge proposition may be evaluated.
 *
 * Condition:
 *   Subject Entity
 *        +
 *   Property
 *        +
 *   Operator
 *        +
 *   Expected Value
 *
 * Example:
 *   material.shrinkage <= 1.2 %
 *
 * Truth-bearing claims remain governed by the Evidence / Claim
 * layer. This model only provides the deterministic condition
 * representation required by Knowledge.
 */

const CONDITION_MODEL_VERSION = 1 as const;

const CONDITION_ID_PREFIX = "condition:v8:";
const CONDITION_FINGERPRINT_PREFIX = "condition-fp:v8:";

function normalizeWhitespace(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ");
}

function normalizeIdentifier(value: string): string {
  return normalizeWhitespace(value);
}

function normalizeUnit(value: string | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = normalizeWhitespace(value);

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.toLowerCase();
}

function normalizeStatement(value: string): string {
  return normalizeWhitespace(value);
}

function normalizeOperator(
  operator: KnowledgeConditionOperator,
): KnowledgeConditionOperator {
  const normalized = String(operator).trim();

  switch (normalized) {
    case "EQUALS":
    case "NOT_EQUALS":
    case "GREATER_THAN":
    case "GREATER_THAN_OR_EQUAL":
    case "LESS_THAN":
    case "LESS_THAN_OR_EQUAL":
    case "IN":
    case "NOT_IN":
    case "CONTAINS":
    case "NOT_CONTAINS":
    case "MATCHES":
    case "NOT_MATCHES":
    case "EXISTS":
    case "NOT_EXISTS":
    case "BETWEEN":
    case "OUTSIDE":
      return normalized as KnowledgeConditionOperator;

    default:
      throw new Error(
        `V8_KNOWLEDGE_INVALID_CONDITION_OPERATOR: unsupported condition operator "${operator}".`,
      );
  }
}

function canonicalExpected(
  value: KnowledgeValue,
): KnowledgeValue {
  return normalizeKnowledgeValue(value);
}

function canonicalConditionIdentity(
  input: Pick<
    CreateKnowledgeConditionInput,
    | "subjectEntityId"
    | "propertyId"
    | "operator"
    | "expected"
    | "unit"
  >,
): string {
  return JSON.stringify(
    canonicalize({
      subjectEntityId:
        input.subjectEntityId === undefined
          ? null
          : normalizeIdentifier(String(input.subjectEntityId)),
      propertyId:
        input.propertyId === undefined
          ? null
          : normalizeIdentifier(input.propertyId),
      operator: normalizeOperator(input.operator),
      expected: canonicalExpected(input.expected),
      unit: normalizeUnit(input.unit) ?? null,
    }),
  );
}

function hashCanonicalValue(value: unknown): string {
  return createHash("sha256")
    .update(
      JSON.stringify(canonicalize(value)),
      "utf8",
    )
    .digest("hex");
}

/**
 * Derive a deterministic condition ID from semantic identity.
 *
 * The statement itself is deliberately excluded from identity.
 * Formatting changes to a statement must not create a new semantic
 * condition when the subject/property/operator/value/unit remain
 * identical.
 */
export function deriveConditionId(
  input: Pick<
    CreateKnowledgeConditionInput,
    | "subjectEntityId"
    | "propertyId"
    | "operator"
    | "expected"
    | "unit"
  >,
): string {
  const digest = hashCanonicalValue({
    model: CONDITION_MODEL_VERSION,
    identity: canonicalConditionIdentity(input),
  });

  return `${CONDITION_ID_PREFIX}${digest}`;
}

/**
 * Build the canonical semantic identity of a condition.
 */
export function conditionIdentity(
  condition: Pick<
    KnowledgeCondition,
    | "subjectEntityId"
    | "propertyId"
    | "operator"
    | "expected"
    | "unit"
  >,
): string {
  return canonicalConditionIdentity(condition);
}

/**
 * Build a deterministic fingerprint for a condition.
 */
export function fingerprintCondition(
  condition: KnowledgeCondition,
): Fingerprint {
  const canonical = canonicalize({
    conditionId: condition.conditionId,
    subjectEntityId:
      condition.subjectEntityId === undefined
        ? null
        : String(condition.subjectEntityId),
    propertyId:
      condition.propertyId === undefined
        ? null
        : condition.propertyId,
    operator: normalizeOperator(condition.operator),
    expected: canonicalExpected(condition.expected),
    unit: normalizeUnit(condition.unit) ?? null,
    statement: normalizeStatement(condition.statement),
    normalizedStatement: normalizeStatement(
      condition.normalizedStatement,
    ),
  });

  const digest = createHash("sha256")
    .update(
      JSON.stringify(canonical),
      "utf8",
    )
    .digest("hex");

  return fingerprint(
    `${CONDITION_FINGERPRINT_PREFIX}${digest}`,
  );
}

/**
 * Normalize a condition statement without changing its semantics.
 */
export function normalizeConditionStatement(
  statement: string,
): string {
  return normalizeStatement(nonEmpty(statement, "statement"));
}

/**
 * Construct a KnowledgeCondition.
 *
 * Fail-closed:
 * - empty statements are rejected
 * - invalid operators are rejected
 * - empty IDs are rejected
 * - supplied condition IDs must match deterministic identity
 */
export function createKnowledgeCondition(
  input: CreateKnowledgeConditionInput,
): KnowledgeCondition {
  const statement = normalizeConditionStatement(
    input.statement,
  );

  const operator = normalizeOperator(
    input.operator,
  );

  const expected = canonicalExpected(
    input.expected,
  );

  const subjectEntityId =
    input.subjectEntityId === undefined
      ? undefined
      : (nonEmpty(
          String(input.subjectEntityId),
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
      "V8_KNOWLEDGE_CONDITION_SUBJECT_MISSING: condition must reference a subjectEntityId or propertyId.",
    );
  }

  const unit = normalizeUnit(input.unit);

  const identityInput = {
    subjectEntityId,
    propertyId,
    operator,
    expected,
    unit,
  } satisfies Pick<
    CreateKnowledgeConditionInput,
    | "subjectEntityId"
    | "propertyId"
    | "operator"
    | "expected"
    | "unit"
  >;

  const derivedConditionId =
    deriveConditionId(identityInput);

  const suppliedConditionId = nonEmpty(
    input.conditionId,
    "conditionId",
  );

  if (
    suppliedConditionId !== derivedConditionId
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONDITION_ID_MISMATCH: supplied conditionId "${suppliedConditionId}" does not match deterministic identity "${derivedConditionId}".`,
    );
  }

  const normalizedStatement =
    normalizeConditionStatement(statement);

  const condition = {
    conditionId: derivedConditionId,
    subjectEntityId,
    propertyId,
    operator,
    expected,
    unit,
    statement,
    normalizedStatement,
    fingerprint: "" as Fingerprint,
  } satisfies Omit<
    KnowledgeCondition,
    "fingerprint"
  > & {
    fingerprint: Fingerprint;
  };

  const complete: KnowledgeCondition = {
    ...condition,
    fingerprint: fingerprintCondition(
      condition as KnowledgeCondition,
    ),
  };

  return Object.freeze(complete);
}

/**
 * Convenience factory that derives the deterministic condition ID.
 */
export function createCondition(
  input: Omit<
    CreateKnowledgeConditionInput,
    "conditionId"
  >,
): KnowledgeCondition {
  const conditionId = deriveConditionId({
    subjectEntityId: input.subjectEntityId,
    propertyId: input.propertyId,
    operator: input.operator,
    expected: input.expected,
    unit: input.unit,
  });

  return createKnowledgeCondition({
    ...input,
    conditionId,
  });
}

/**
 * Verify that a condition fingerprint is canonical.
 */
export function verifyConditionFingerprint(
  condition: KnowledgeCondition,
): boolean {
  try {
    const expected =
      fingerprintCondition(condition);

    return (
      String(expected) ===
      String(condition.fingerprint)
    );
  } catch {
    return false;
  }
}

/**
 * Assert complete semantic integrity.
 */
export function assertConditionIntegrity(
  condition: KnowledgeCondition,
): void {
  if (
    !condition ||
    typeof condition !== "object"
  ) {
    throw new Error(
      "V8_KNOWLEDGE_INVALID_CONDITION: condition must be an object.",
    );
  }

  nonEmpty(
    condition.conditionId,
    "conditionId",
  );

  nonEmpty(
    condition.statement,
    "statement",
  );

  nonEmpty(
    condition.normalizedStatement,
    "normalizedStatement",
  );

  normalizeOperator(
    condition.operator,
  );

  canonicalExpected(
    condition.expected,
  );

  if (
    condition.subjectEntityId === undefined &&
    condition.propertyId === undefined
  ) {
    throw new Error(
      "V8_KNOWLEDGE_CONDITION_SUBJECT_MISSING: condition must reference a subjectEntityId or propertyId.",
    );
  }

  if (
    condition.subjectEntityId !== undefined
  ) {
    nonEmpty(
      String(condition.subjectEntityId),
      "subjectEntityId",
    );
  }

  if (
    condition.propertyId !== undefined
  ) {
    nonEmpty(
      condition.propertyId,
      "propertyId",
    );
  }

  const expectedId =
    deriveConditionId({
      subjectEntityId:
        condition.subjectEntityId,
      propertyId: condition.propertyId,
      operator: condition.operator,
      expected: condition.expected,
      unit: condition.unit,
    });

  if (
    expectedId !== condition.conditionId
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONDITION_ID_MISMATCH: expected "${expectedId}" but received "${condition.conditionId}".`,
    );
  }

  if (
    !verifyConditionFingerprint(
      condition,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONDITION_FINGERPRINT_MISMATCH: condition "${condition.conditionId}" has an invalid fingerprint.`,
    );
  }
}

/**
 * Determine whether two conditions have identical semantic identity.
 */
export function sameConditionIdentity(
  left: Pick<
    KnowledgeCondition,
    | "subjectEntityId"
    | "propertyId"
    | "operator"
    | "expected"
    | "unit"
  >,
  right: Pick<
    KnowledgeCondition,
    | "subjectEntityId"
    | "propertyId"
    | "operator"
    | "expected"
    | "unit"
  >,
): boolean {
  return (
    conditionIdentity(left) ===
    conditionIdentity(right)
  );
}

/**
 * Find a condition by deterministic condition ID.
 */
export function findCondition(
  conditions: readonly KnowledgeCondition[],
  conditionId: string,
): KnowledgeCondition | null {
  const id = nonEmpty(
    conditionId,
    "conditionId",
  );

  return (
    conditions.find(
      (condition) =>
        condition.conditionId === id,
    ) ?? null
  );
}

/**
 * Find all conditions attached to a property.
 */
export function findConditionsByProperty(
  conditions: readonly KnowledgeCondition[],
  propertyId: string,
): readonly KnowledgeCondition[] {
  const id = nonEmpty(
    propertyId,
    "propertyId",
  );

  return conditions.filter(
    (condition) =>
      condition.propertyId === id,
  );
}

/**
 * Find all conditions attached to an entity.
 */
export function findConditionsByEntity(
  conditions: readonly KnowledgeCondition[],
  entityId: EntityId,
): readonly KnowledgeCondition[] {
  const id = nonEmpty(
    String(entityId),
    "entityId",
  );

  return conditions.filter(
    (condition) =>
      condition.subjectEntityId !==
        undefined &&
      String(condition.subjectEntityId) === id,
  );
}

/**
 * Find all conditions using a specific operator.
 */
export function findConditionsByOperator(
  conditions: readonly KnowledgeCondition[],
  operator: KnowledgeConditionOperator,
): readonly KnowledgeCondition[] {
  const normalized =
    normalizeOperator(operator);

  return conditions.filter(
    (condition) =>
      condition.operator === normalized,
  );
}

/**
 * Build a deterministic condition index.
 */
export function indexConditions(
  conditions: readonly KnowledgeCondition[],
): ReadonlyMap<
  string,
  KnowledgeCondition
> {
  const map = new Map<
    string,
    KnowledgeCondition
  >();

  for (const condition of conditions) {
    assertConditionIntegrity(condition);

    if (
      map.has(condition.conditionId)
    ) {
      const existing = map.get(
        condition.conditionId,
      )!;

      if (
        !sameConditionIdentity(
          existing,
          condition,
        )
      ) {
        throw new Error(
          `V8_KNOWLEDGE_CONDITION_INDEX_CONFLICT: condition ID "${condition.conditionId}" maps to multiple semantic identities.`,
        );
      }

      if (
        existing.fingerprint !==
        condition.fingerprint
      ) {
        throw new Error(
          `V8_KNOWLEDGE_CONDITION_INDEX_FINGERPRINT_CONFLICT: condition ID "${condition.conditionId}" has conflicting fingerprints.`,
        );
      }

      continue;
    }

    map.set(
      condition.conditionId,
      condition,
    );
  }

  return map;
}

/**
 * Deduplicate conditions while preserving deterministic
 * semantic identity.
 */
export function deduplicateConditions(
  conditions: readonly KnowledgeCondition[],
): readonly KnowledgeCondition[] {
  const map =
    indexConditions(conditions);

  return [...map.values()].sort(
    (left, right) =>
      left.conditionId.localeCompare(
        right.conditionId,
      ),
  );
}

/**
 * Verify that no semantic duplicate has conflicting payload.
 */
export function assertNoConditionConflicts(
  conditions: readonly KnowledgeCondition[],
): void {
  const byIdentity = new Map<
    string,
    KnowledgeCondition
  >();

  for (const condition of conditions) {
    assertConditionIntegrity(condition);

    const identity =
      conditionIdentity(condition);

    const previous =
      byIdentity.get(identity);

    if (
      previous === undefined
    ) {
      byIdentity.set(
        identity,
        condition,
      );
      continue;
    }

    if (
      previous.conditionId !==
      condition.conditionId
    ) {
      throw new Error(
        `V8_KNOWLEDGE_CONDITION_ID_CONFLICT: semantic identity maps to multiple condition IDs "${previous.conditionId}" and "${condition.conditionId}".`,
      );
    }

    if (
      previous.fingerprint !==
      condition.fingerprint
    ) {
      throw new Error(
        `V8_KNOWLEDGE_CONDITION_FINGERPRINT_CONFLICT: semantic identity "${identity}" maps to conflicting fingerprints.`,
      );
    }
  }
}

/**
 * Build a deterministic fingerprint for an entire condition collection.
 */
export function fingerprintConditions(
  conditions: readonly KnowledgeCondition[],
): Fingerprint {
  const canonicalConditions =
    deduplicateConditions(
      conditions,
    ).map((condition) => ({
      conditionId:
        condition.conditionId,
      subjectEntityId:
        condition.subjectEntityId ===
        undefined
          ? null
          : String(
              condition.subjectEntityId,
            ),
      propertyId:
        condition.propertyId ??
        null,
      operator:
        condition.operator,
      expected:
        canonicalExpected(
          condition.expected,
        ),
      unit:
        normalizeUnit(
          condition.unit,
        ) ?? null,
      statement:
        normalizeStatement(
          condition.statement,
        ),
      normalizedStatement:
        normalizeStatement(
          condition.normalizedStatement,
        ),
      fingerprint:
        String(condition.fingerprint),
    }));

  return fingerprint(
    `${CONDITION_FINGERPRINT_PREFIX}collection:${hashCanonicalValue(
      canonicalConditions,
    )}`,
  );
}

/**
 * Assert that replacing one condition with another does not
 * silently alter semantic identity.
 */
export function assertConditionReplacementSafe(
  current: KnowledgeCondition,
  replacement: KnowledgeCondition,
): void {
  assertConditionIntegrity(current);
  assertConditionIntegrity(replacement);

  if (
    current.conditionId !==
    replacement.conditionId
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONDITION_REPLACEMENT_ID_CHANGE: condition replacement changes ID from "${current.conditionId}" to "${replacement.conditionId}".`,
    );
  }

  if (
    !sameConditionIdentity(
      current,
      replacement,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONDITION_REPLACEMENT_IDENTITY_CHANGE: condition "${current.conditionId}" semantic identity changed.`,
    );
  }
}

/**
 * Return a stable immutable snapshot.
 */
export function snapshotCondition(
  condition: KnowledgeCondition,
): KnowledgeCondition {
  assertConditionIntegrity(condition);

  const snapshot: KnowledgeCondition = {
    conditionId:
      condition.conditionId,
    subjectEntityId:
      condition.subjectEntityId,
    propertyId:
      condition.propertyId,
    operator:
      condition.operator,
    expected:
      condition.expected,
    unit:
      condition.unit,
    statement:
      condition.statement,
    normalizedStatement:
      condition.normalizedStatement,
    fingerprint:
      condition.fingerprint,
  };

  return Object.freeze(snapshot);
}

/**
 * Clone a condition into a detached immutable object.
 */
export function cloneCondition(
  condition: KnowledgeCondition,
): KnowledgeCondition {
  assertConditionIntegrity(condition);

  const clone = JSON.parse(
    JSON.stringify(condition),
  ) as KnowledgeCondition;

  return Object.freeze(clone);
}

/**
 * Deterministically compare two conditions.
 */
export function compareConditions(
  left: KnowledgeCondition,
  right: KnowledgeCondition,
): number {
  return left.conditionId.localeCompare(
    right.conditionId,
  );
}

/**
 * Deterministically sort conditions.
 */
export function sortConditions(
  conditions: readonly KnowledgeCondition[],
): readonly KnowledgeCondition[] {
  return [...conditions].sort(
    compareConditions,
  );
}

/**
 * Verify an entire condition collection.
 */
export function verifyConditionCollection(
  conditions: readonly KnowledgeCondition[],
): void {
  assertNoConditionConflicts(conditions);

  for (const condition of conditions) {
    assertConditionIntegrity(condition);
  }
}

/**
 * Return all unique entity IDs referenced by conditions.
 */
export function collectConditionEntityIds(
  conditions: readonly KnowledgeCondition[],
): readonly EntityId[] {
  return sortedUnique(
    conditions
      .map((condition) =>
        condition.subjectEntityId ===
        undefined
          ? ""
          : String(
              condition.subjectEntityId,
            ),
      )
      .filter(
        (value) => value.length > 0,
      ),
  ) as readonly EntityId[];
}

/**
 * Return all unique property IDs referenced by conditions.
 */
export function collectConditionPropertyIds(
  conditions: readonly KnowledgeCondition[],
): readonly string[] {
  return sortedUnique(
    conditions
      .map(
        (condition) =>
          condition.propertyId ?? "",
      )
      .filter(
        (value) => value.length > 0,
      ),
  );
}

/**
 * Model defaults and explicit invariants.
 */
export const CONDITION_MODEL_DEFAULTS = Object.freeze(
  {
    modelVersion:
      CONDITION_MODEL_VERSION,
    idPrefix:
      CONDITION_ID_PREFIX,
    fingerprintPrefix:
      CONDITION_FINGERPRINT_PREFIX,
    requireSubjectOrProperty:
      true,
    deterministicIdentity:
      true,
    immutableOutput:
      true,
    failClosed:
      true,
  },
);