import { createHash } from "node:crypto";

import {
  canonicalize,
  fingerprint,
  nonEmpty,
  sortedUnique,
  type ClaimId,
  type ContextId,
  type EntityId,
  type EvidenceId,
  type Fingerprint,
  type ScopeId,
} from "../../domain/primitives.js";

import type {
  CreateKnowledgeConstraintInput,
  KnowledgeConfidence,
  KnowledgeConstraint,
  KnowledgeConstraintType,
} from "./types.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Constraint Model
 *
 * Phase 2.4
 *
 * Responsibilities:
 * - canonical constraint identity
 * - deterministic identifiers and fingerprints
 * - immutable construction
 * - integrity verification
 * - Evidence / Claim lineage preservation
 * - deterministic indexing and deduplication
 * - conflict detection
 * - safe replacement checks
 *
 * This module does not establish engineering truth.
 * Evidence and Claim remain the authoritative truth lineage.
 */

const MODEL_VERSION = 1 as const;

const ID_PREFIX = "constraint:v8:";
const FINGERPRINT_PREFIX = "constraint-fp:v8:";

const CONSTRAINT_TYPES = [
  "REQUIRED",
  "FORBIDDEN",
  "MINIMUM",
  "MAXIMUM",
  "RANGE",
  "ENUMERATION",
  "COMPATIBILITY",
  "EXCLUSIVITY",
  "DEPENDENCY",
  "SEQUENCE",
  "SCOPE",
  "CONTEXT",
  "EVIDENCE",
  "OTHER",
] as const satisfies readonly KnowledgeConstraintType[];

const CONFIDENCE_LEVELS = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
] as const satisfies readonly KnowledgeConfidence[];

export interface ConstraintIdentityInput {
  readonly type: KnowledgeConstraintType;
  readonly statement: string;
  readonly subjectEntityIds?: readonly EntityId[];
  readonly conditionIds?: readonly string[];
  readonly requiredPropertyIds?: readonly string[];
  readonly forbiddenPropertyIds?: readonly string[];
  readonly scopeId?: ScopeId;
  readonly contextId?: ContextId;
}

export interface ConstraintCollection {
  readonly constraints: readonly KnowledgeConstraint[];
  readonly fingerprint: Fingerprint;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStatement(value: string): string {
  return normalizeWhitespace(nonEmpty(value, "statement"));
}

function normalizeType(
  value: KnowledgeConstraintType,
): KnowledgeConstraintType {
  const candidate = String(value).trim();

  if (
    !(CONSTRAINT_TYPES as readonly string[]).includes(
      candidate,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_CONSTRAINT_TYPE: unsupported type "${candidate}".`,
    );
  }

  return candidate as KnowledgeConstraintType;
}

function normalizeConfidence(
  value: KnowledgeConfidence,
): KnowledgeConfidence {
  const candidate = String(value).trim();

  if (
    !(CONFIDENCE_LEVELS as readonly string[]).includes(
      candidate,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_CONSTRAINT_CONFIDENCE: unsupported confidence "${candidate}".`,
    );
  }

  return candidate as KnowledgeConfidence;
}

function normalizeIds<T extends string>(
  values: readonly T[] | undefined,
  field: string,
): readonly T[] {
  const normalized = (values ?? []).map((value) =>
    nonEmpty(String(value), field),
  ) as T[];

  return Object.freeze(
    [...sortedUnique(normalized)],
  );
}

function normalizeOptionalId<T extends string>(
  value: T | undefined,
  field: string,
): T | undefined {
  if (value === undefined) {
    return undefined;
  }

  return nonEmpty(String(value), field) as T;
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(
      JSON.stringify(canonicalize(value)),
      "utf8",
    )
    .digest("hex");
}

function identityMaterial(
  input: ConstraintIdentityInput,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: MODEL_VERSION,
    type: normalizeType(input.type),
    statement: normalizeStatement(input.statement),
    subjectEntityIds: normalizeIds(
      input.subjectEntityIds,
      "subjectEntityId",
    ),
    conditionIds: normalizeIds(
      input.conditionIds,
      "conditionId",
    ),
    requiredPropertyIds: normalizeIds(
      input.requiredPropertyIds,
      "requiredPropertyId",
    ),
    forbiddenPropertyIds: normalizeIds(
      input.forbiddenPropertyIds,
      "forbiddenPropertyId",
    ),
    scopeId:
      normalizeOptionalId(input.scopeId, "scopeId") ??
      null,
    contextId:
      normalizeOptionalId(input.contextId, "contextId") ??
      null,
  });
}

/**
 * Produce canonical identity material for a constraint.
 *
 * Evidence, Claim, and confidence are deliberately excluded from
 * identity: they are provenance and assessment dimensions rather
 * than the semantic definition of the constraint.
 */
export function constraintIdentity(
  input: ConstraintIdentityInput,
): string {
  return JSON.stringify(
    canonicalize(identityMaterial(input)),
  );
}

/**
 * Derive the canonical deterministic constraint identifier.
 */
export function deriveConstraintId(
  input: ConstraintIdentityInput,
): string {
  return `${ID_PREFIX}${hashCanonical({
    model: MODEL_VERSION,
    identity: identityMaterial(input),
  })}`;
}

function canonicalConstraintPayload(
  constraint: Omit<KnowledgeConstraint, "fingerprint">,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    constraintId: nonEmpty(
      constraint.constraintId,
      "constraintId",
    ),
    type: normalizeType(constraint.type),
    statement: normalizeStatement(constraint.statement),
    normalizedStatement: normalizeStatement(
      constraint.normalizedStatement,
    ),
    subjectEntityIds: normalizeIds(
      constraint.subjectEntityIds,
      "subjectEntityId",
    ),
    conditionIds: normalizeIds(
      constraint.conditionIds,
      "conditionId",
    ),
    requiredPropertyIds: normalizeIds(
      constraint.requiredPropertyIds,
      "requiredPropertyId",
    ),
    forbiddenPropertyIds: normalizeIds(
      constraint.forbiddenPropertyIds,
      "forbiddenPropertyId",
    ),
    scopeId:
      normalizeOptionalId(constraint.scopeId, "scopeId") ??
      null,
    contextId:
      normalizeOptionalId(
        constraint.contextId,
        "contextId",
      ) ?? null,
    evidenceIds: normalizeIds(
      constraint.evidenceIds,
      "evidenceId",
    ),
    claimIds: normalizeIds(
      constraint.claimIds,
      "claimId",
    ),
    confidence: normalizeConfidence(constraint.confidence),
  });
}

/**
 * Compute a deterministic fingerprint for a constraint.
 */
export function fingerprintConstraint(
  constraint: Omit<KnowledgeConstraint, "fingerprint">,
): Fingerprint {
  return fingerprint(
    `${FINGERPRINT_PREFIX}${hashCanonical(
      canonicalConstraintPayload(constraint),
    )}`,
  );
}

function assertSubjectPresent(
  constraint: Pick<
    KnowledgeConstraint,
    "subjectEntityIds" | "requiredPropertyIds" | "forbiddenPropertyIds"
  >,
): void {
  if (
    constraint.subjectEntityIds.length === 0 &&
    constraint.requiredPropertyIds.length === 0 &&
    constraint.forbiddenPropertyIds.length === 0
  ) {
    throw new Error(
      "V8_KNOWLEDGE_CONSTRAINT_SUBJECT_MISSING: a constraint must reference at least one entity or property.",
    );
  }
}

function assertPropertySetsDisjoint(
  requiredPropertyIds: readonly string[],
  forbiddenPropertyIds: readonly string[],
): void {
  const forbidden = new Set(forbiddenPropertyIds);

  const conflicts = requiredPropertyIds.filter((id) =>
    forbidden.has(id),
  );

  if (conflicts.length > 0) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_PROPERTY_CONFLICT: properties cannot be both required and forbidden: ${conflicts.join(", ")}.`,
    );
  }
}

/**
 * Construct a canonical constraint using the repository's actual
 * CreateKnowledgeConstraintInput and KnowledgeConstraint contracts.
 *
 * A supplied identifier must match the deterministic identity.
 */
export function createKnowledgeConstraint(
  input: CreateKnowledgeConstraintInput,
): KnowledgeConstraint {
  const type = normalizeType(input.type);
  const statement = normalizeStatement(input.statement);
  const normalizedStatement = statement;

  const subjectEntityIds = normalizeIds(
    input.subjectEntityIds,
    "subjectEntityId",
  ) as readonly EntityId[];

  const conditionIds = normalizeIds(
    input.conditionIds,
    "conditionId",
  );

  const requiredPropertyIds = normalizeIds(
    input.requiredPropertyIds,
    "requiredPropertyId",
  );

  const forbiddenPropertyIds = normalizeIds(
    input.forbiddenPropertyIds,
    "forbiddenPropertyId",
  );

  const scopeId = normalizeOptionalId(
    input.scopeId,
    "scopeId",
  );

  const contextId = normalizeOptionalId(
    input.contextId,
    "contextId",
  );

  const evidenceIds = normalizeIds(
    input.evidenceIds,
    "evidenceId",
  ) as readonly EvidenceId[];

  const claimIds = normalizeIds(
    input.claimIds,
    "claimId",
  ) as readonly ClaimId[];

  const confidence = normalizeConfidence(
    input.confidence ?? "MEDIUM",
  );

  assertSubjectPresent({
    subjectEntityIds,
    requiredPropertyIds,
    forbiddenPropertyIds,
  });

  assertPropertySetsDisjoint(
    requiredPropertyIds,
    forbiddenPropertyIds,
  );

  const identity: ConstraintIdentityInput = {
    type,
    statement,
    subjectEntityIds,
    conditionIds,
    requiredPropertyIds,
    forbiddenPropertyIds,
    scopeId,
    contextId,
  };

  const expectedId = deriveConstraintId(identity);
  const suppliedId = nonEmpty(
    input.constraintId,
    "constraintId",
  );

  if (suppliedId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_ID_MISMATCH: supplied "${suppliedId}" does not match canonical ID "${expectedId}".`,
    );
  }

  const payload: Omit<KnowledgeConstraint, "fingerprint"> = {
    constraintId: expectedId,
    type,
    statement,
    normalizedStatement,
    subjectEntityIds,
    conditionIds,
    requiredPropertyIds,
    forbiddenPropertyIds,
    scopeId,
    contextId,
    evidenceIds,
    claimIds,
    confidence,
  };

  const result: KnowledgeConstraint = Object.freeze({
    ...payload,
    fingerprint: fingerprintConstraint(payload),
  });

  assertConstraintIntegrity(result);

  return result;
}

/**
 * Preferred factory: derive the ID rather than requiring callers
 * to calculate it independently.
 */
export function createConstraint(
  input: Omit<CreateKnowledgeConstraintInput, "constraintId">,
): KnowledgeConstraint {
  const identity: ConstraintIdentityInput = {
    type: input.type,
    statement: input.statement,
    subjectEntityIds: input.subjectEntityIds,
    conditionIds: input.conditionIds,
    requiredPropertyIds: input.requiredPropertyIds,
    forbiddenPropertyIds: input.forbiddenPropertyIds,
    scopeId: input.scopeId,
    contextId: input.contextId,
  };

  return createKnowledgeConstraint({
    ...input,
    constraintId: deriveConstraintId(identity),
  });
}

/**
 * Validate identifier, canonical fields, provenance arrays,
 * semantic invariants, and fingerprint.
 */
export function assertConstraintIntegrity(
  constraint: KnowledgeConstraint,
): void {
  if (
    constraint === null ||
    typeof constraint !== "object"
  ) {
    throw new Error(
      "V8_KNOWLEDGE_INVALID_CONSTRAINT: constraint must be an object.",
    );
  }

  nonEmpty(constraint.constraintId, "constraintId");
  nonEmpty(constraint.statement, "statement");
  nonEmpty(
    constraint.normalizedStatement,
    "normalizedStatement",
  );

  const type = normalizeType(constraint.type);
  normalizeConfidence(constraint.confidence);

  const canonicalStatement = normalizeStatement(
    constraint.statement,
  );

  if (constraint.normalizedStatement !== canonicalStatement) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_NORMALIZATION_MISMATCH: "${constraint.constraintId}" has a non-canonical normalized statement.`,
    );
  }

  const subjectEntityIds = normalizeIds(
    constraint.subjectEntityIds,
    "subjectEntityId",
  );

  const conditionIds = normalizeIds(
    constraint.conditionIds,
    "conditionId",
  );

  const requiredPropertyIds = normalizeIds(
    constraint.requiredPropertyIds,
    "requiredPropertyId",
  );

  const forbiddenPropertyIds = normalizeIds(
    constraint.forbiddenPropertyIds,
    "forbiddenPropertyId",
  );

  const evidenceIds = normalizeIds(
    constraint.evidenceIds,
    "evidenceId",
  );

  const claimIds = normalizeIds(
    constraint.claimIds,
    "claimId",
  );

  if (
    subjectEntityIds.length !==
      constraint.subjectEntityIds.length ||
    conditionIds.length !== constraint.conditionIds.length ||
    requiredPropertyIds.length !==
      constraint.requiredPropertyIds.length ||
    forbiddenPropertyIds.length !==
      constraint.forbiddenPropertyIds.length ||
    evidenceIds.length !== constraint.evidenceIds.length ||
    claimIds.length !== constraint.claimIds.length
  ) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_DUPLICATE_REFERENCE: "${constraint.constraintId}" contains duplicate or non-canonical references.`,
    );
  }

  assertSubjectPresent({
    subjectEntityIds: constraint.subjectEntityIds,
    requiredPropertyIds: constraint.requiredPropertyIds,
    forbiddenPropertyIds: constraint.forbiddenPropertyIds,
  });

  assertPropertySetsDisjoint(
    constraint.requiredPropertyIds,
    constraint.forbiddenPropertyIds,
  );

  const expectedId = deriveConstraintId({
    type,
    statement: constraint.statement,
    subjectEntityIds: constraint.subjectEntityIds,
    conditionIds: constraint.conditionIds,
    requiredPropertyIds: constraint.requiredPropertyIds,
    forbiddenPropertyIds: constraint.forbiddenPropertyIds,
    scopeId: constraint.scopeId,
    contextId: constraint.contextId,
  });

  if (constraint.constraintId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_ID_MISMATCH: "${constraint.constraintId}" does not match "${expectedId}".`,
    );
  }

  const { fingerprint: _fingerprint, ...payload } = constraint;

  const expectedFingerprint = fingerprintConstraint(payload);

  if (constraint.fingerprint !== expectedFingerprint) {
    throw new Error(
      `V8_KNOWLEDGE_CONSTRAINT_FINGERPRINT_MISMATCH: "${constraint.constraintId}" has an invalid fingerprint.`,
    );
  }
}

export function verifyConstraintFingerprint(
  constraint: KnowledgeConstraint,
): boolean {
  try {
    const { fingerprint: _fingerprint, ...payload } = constraint;

    return (
      fingerprintConstraint(payload) === constraint.fingerprint
    );
  } catch {
    return false;
  }
}

export function sameConstraintIdentity(
  left: KnowledgeConstraint,
  right: KnowledgeConstraint,
): boolean {
  return (
    constraintIdentity(left) === constraintIdentity(right)
  );
}

export function findConstraint(
  constraints: readonly KnowledgeConstraint[],
  constraintId: string,
): KnowledgeConstraint | undefined {
  const id = nonEmpty(constraintId, "constraintId");

  for (const constraint of constraints) {
    if (constraint.constraintId === id) {
      assertConstraintIntegrity(constraint);
      return constraint;
    }
  }

  return undefined;
}

export function findConstraintsByType(
  constraints: readonly KnowledgeConstraint[],
  type: KnowledgeConstraintType,
): readonly KnowledgeConstraint[] {
  const expectedType = normalizeType(type);

  return Object.freeze(
    constraints
      .filter((constraint) => {
        assertConstraintIntegrity(constraint);
        return constraint.type === expectedType;
      })
      .sort((left, right) =>
        left.constraintId.localeCompare(right.constraintId),
      ),
  );
}

export function findConstraintsByEntity(
  constraints: readonly KnowledgeConstraint[],
  entityId: EntityId,
): readonly KnowledgeConstraint[] {
  const id = nonEmpty(String(entityId), "entityId");

  return Object.freeze(
    constraints
      .filter((constraint) => {
        assertConstraintIntegrity(constraint);

        return constraint.subjectEntityIds.some(
          (candidate) => String(candidate) === id,
        );
      })
      .sort((left, right) =>
        left.constraintId.localeCompare(right.constraintId),
      ),
  );
}

export function findConstraintsByCondition(
  constraints: readonly KnowledgeConstraint[],
  conditionId: string,
): readonly KnowledgeConstraint[] {
  const id = nonEmpty(conditionId, "conditionId");

  return Object.freeze(
    constraints
      .filter((constraint) => {
        assertConstraintIntegrity(constraint);
        return constraint.conditionIds.includes(id);
      })
      .sort((left, right) =>
        left.constraintId.localeCompare(right.constraintId),
      ),
  );
}

export function findConstraintsByProperty(
  constraints: readonly KnowledgeConstraint[],
  propertyId: string,
): readonly KnowledgeConstraint[] {
  const id = nonEmpty(propertyId, "propertyId");

  return Object.freeze(
    constraints
      .filter((constraint) => {
        assertConstraintIntegrity(constraint);

        return (
          constraint.requiredPropertyIds.includes(id) ||
          constraint.forbiddenPropertyIds.includes(id)
        );
      })
      .sort((left, right) =>
        left.constraintId.localeCompare(right.constraintId),
      ),
  );
}

/**
 * Build a deterministic ID index and reject conflicting records.
 */
export function indexConstraints(
  constraints: readonly KnowledgeConstraint[],
): ReadonlyMap<string, KnowledgeConstraint> {
  const result = new Map<string, KnowledgeConstraint>();

  for (const constraint of constraints) {
    assertConstraintIntegrity(constraint);

    const existing = result.get(constraint.constraintId);

    if (existing === undefined) {
      result.set(constraint.constraintId, constraint);
      continue;
    }

    if (existing.fingerprint !== constraint.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_INDEX_CONFLICT: "${constraint.constraintId}" has conflicting fingerprints.`,
      );
    }
  }

  return result;
}

export function deduplicateConstraints(
  constraints: readonly KnowledgeConstraint[],
): readonly KnowledgeConstraint[] {
  return Object.freeze(
    [...indexConstraints(constraints).values()].sort(
      (left, right) =>
        left.constraintId.localeCompare(right.constraintId),
    ),
  );
}

export function assertNoConstraintConflicts(
  constraints: readonly KnowledgeConstraint[],
): void {
  const byIdentity = new Map<string, KnowledgeConstraint>();

  for (const constraint of constraints) {
    assertConstraintIntegrity(constraint);

    const identity = constraintIdentity(constraint);
    const previous = byIdentity.get(identity);

    if (previous === undefined) {
      byIdentity.set(identity, constraint);
      continue;
    }

    if (previous.constraintId !== constraint.constraintId) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_ID_CONFLICT: one semantic identity maps to "${previous.constraintId}" and "${constraint.constraintId}".`,
      );
    }

    if (previous.fingerprint !== constraint.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_CONSTRAINT_FINGERPRINT_CONFLICT: "${constraint.constraintId}" has inconsistent payloads.`,
      );
    }
  }
}

export function fingerprintConstraints(
  constraints: readonly KnowledgeConstraint[],
): Fingerprint {
  const canonical = deduplicateConstraints(constraints).map(
    (constraint) => ({
      constraintId: constraint.constraintId,
      fingerprint: String(constraint.fingerprint),
    }),
  );

  return fingerprint(
    `${FINGERPRINT_PREFIX}collection:${hashCanonical(canonical)}`,
  );
}

export function buildConstraintCollection(
  constraints: readonly KnowledgeConstraint[],
): ConstraintCollection {
  const canonicalConstraints = deduplicateConstraints(constraints);

  assertNoConstraintConflicts(canonicalConstraints);

  return Object.freeze({
    constraints: canonicalConstraints,
    fingerprint: fingerprintConstraints(canonicalConstraints),
  });
}

export function assertConstraintReplacementSafe(
  previous: KnowledgeConstraint,
  replacement: KnowledgeConstraint,
): void {
  assertConstraintIntegrity(previous);
  assertConstraintIntegrity(replacement);

  if (previous.constraintId !== replacement.constraintId) {
    throw new Error(
      "V8_KNOWLEDGE_CONSTRAINT_REPLACEMENT_ID_CHANGE: constraint ID cannot change during replacement.",
    );
  }

  if (!sameConstraintIdentity(previous, replacement)) {
    throw new Error(
      "V8_KNOWLEDGE_CONSTRAINT_REPLACEMENT_IDENTITY_CHANGE: semantic identity cannot change during replacement.",
    );
  }
}

export function cloneConstraint(
  constraint: KnowledgeConstraint,
): KnowledgeConstraint {
  assertConstraintIntegrity(constraint);

  return Object.freeze({
    ...constraint,
    subjectEntityIds: Object.freeze([
      ...constraint.subjectEntityIds,
    ]),
    conditionIds: Object.freeze([
      ...constraint.conditionIds,
    ]),
    requiredPropertyIds: Object.freeze([
      ...constraint.requiredPropertyIds,
    ]),
    forbiddenPropertyIds: Object.freeze([
      ...constraint.forbiddenPropertyIds,
    ]),
    evidenceIds: Object.freeze([
      ...constraint.evidenceIds,
    ]),
    claimIds: Object.freeze([
      ...constraint.claimIds,
    ]),
  });
}

export function collectConstraintEntityIds(
  constraints: readonly KnowledgeConstraint[],
): readonly EntityId[] {
  return Object.freeze(
    [...sortedUnique(
      constraints.flatMap((constraint) => {
        assertConstraintIntegrity(constraint);
        return constraint.subjectEntityIds;
      }),
    )] as EntityId[],
  );
}

export function collectConstraintEvidenceIds(
  constraints: readonly KnowledgeConstraint[],
): readonly EvidenceId[] {
  return Object.freeze(
    [...sortedUnique(
      constraints.flatMap((constraint) => {
        assertConstraintIntegrity(constraint);
        return constraint.evidenceIds;
      }),
    )] as EvidenceId[],
  );
}

export function collectConstraintClaimIds(
  constraints: readonly KnowledgeConstraint[],
): readonly ClaimId[] {
  return Object.freeze(
    [...sortedUnique(
      constraints.flatMap((constraint) => {
        assertConstraintIntegrity(constraint);
        return constraint.claimIds;
      }),
    )] as ClaimId[],
  );
}

export const CONSTRAINT_MODEL_DEFAULTS = Object.freeze({
  version: MODEL_VERSION,
  idPrefix: ID_PREFIX,
  fingerprintPrefix: FINGERPRINT_PREFIX,
  deterministicIdentity: true,
  immutableOutput: true,
  failClosed: true,
  preserveEvidenceLineage: true,
  preserveClaimLineage: true,
});