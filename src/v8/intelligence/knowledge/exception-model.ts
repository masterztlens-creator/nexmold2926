import { createHash } from "node:crypto";

import {
  canonicalize,
  fingerprint,
  nonEmpty,
  sortedUnique,
  type ClaimId,
  type EntityId,
  type EvidenceId,
  type Fingerprint,
} from "../../domain/primitives.js";

import type {
  CreateKnowledgeExceptionInput,
  KnowledgeConfidence,
  KnowledgeException,
  KnowledgeExceptionType,
} from "./types.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Exception Model
 *
 * Phase 2.5
 *
 * An exception describes a bounded situation in which a normal
 * engineering constraint, rule, or applicability assumption may
 * not hold.
 *
 * This module:
 * - preserves Evidence and Claim lineage;
 * - uses deterministic semantic identity;
 * - creates immutable records;
 * - rejects invalid or conflicting references;
 * - produces reproducible fingerprints;
 * - does not establish engineering truth.
 *
 * Truth authority remains in the Evidence / Claim chain.
 */

const MODEL_VERSION = 1 as const;

const EXCEPTION_ID_PREFIX = "exception:v8:";
const EXCEPTION_FINGERPRINT_PREFIX = "exception-fp:v8:";

const EXCEPTION_TYPES = [
  "MATERIAL",
  "GEOMETRY",
  "PROCESS",
  "EQUIPMENT",
  "ENVIRONMENT",
  "APPLICATION",
  "TEST",
  "SCOPE",
  "CONTEXT",
  "EVIDENCE",
  "OTHER",
] as const satisfies readonly KnowledgeExceptionType[];

const CONFIDENCE_LEVELS = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
] as const satisfies readonly KnowledgeConfidence[];

export interface ExceptionIdentityInput {
  readonly type: KnowledgeExceptionType;
  readonly statement: string;
  readonly subjectEntityIds?: readonly EntityId[];
  readonly conditionIds?: readonly string[];
  readonly overridesConstraintIds?: readonly string[];
}

export interface ExceptionCollection {
  readonly exceptions: readonly KnowledgeException[];
  readonly fingerprint: Fingerprint;
}

function normalizeWhitespace(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function normalizeStatement(value: string): string {
  return normalizeWhitespace(nonEmpty(value, "statement"));
}

function normalizeExceptionType(
  type: KnowledgeExceptionType,
): KnowledgeExceptionType {
  const candidate = String(type).trim();

  if (
    !(EXCEPTION_TYPES as readonly string[]).includes(
      candidate,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_EXCEPTION_TYPE: unsupported exception type "${candidate}".`,
    );
  }

  return candidate as KnowledgeExceptionType;
}

function normalizeConfidence(
  confidence: KnowledgeConfidence,
): KnowledgeConfidence {
  const candidate = String(confidence).trim();

  if (
    !(CONFIDENCE_LEVELS as readonly string[]).includes(
      candidate,
    )
  ) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_EXCEPTION_CONFIDENCE: unsupported confidence "${candidate}".`,
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

  return Object.freeze([...sortedUnique(normalized)]);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

function canonicalIdentityMaterial(
  input: ExceptionIdentityInput,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: MODEL_VERSION,
    type: normalizeExceptionType(input.type),
    statement: normalizeStatement(input.statement),
    subjectEntityIds: normalizeIds(
      input.subjectEntityIds,
      "subjectEntityId",
    ),
    conditionIds: normalizeIds(
      input.conditionIds,
      "conditionId",
    ),
    overridesConstraintIds: normalizeIds(
      input.overridesConstraintIds,
      "overridesConstraintId",
    ),
  });
}

/**
 * Return canonical semantic identity.
 *
 * Evidence, Claim, and confidence are not part of semantic identity:
 * they are provenance and assessment dimensions.
 */
export function exceptionIdentity(
  input: ExceptionIdentityInput,
): string {
  return JSON.stringify(
    canonicalize(canonicalIdentityMaterial(input)),
  );
}

/**
 * Derive a stable exception identifier from canonical semantics.
 */
export function deriveExceptionId(
  input: ExceptionIdentityInput,
): string {
  return `${EXCEPTION_ID_PREFIX}${hashCanonical({
    model: MODEL_VERSION,
    identity: canonicalIdentityMaterial(input),
  })}`;
}

function canonicalExceptionPayload(
  exception: Omit<KnowledgeException, "fingerprint">,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    exceptionId: nonEmpty(
      exception.exceptionId,
      "exceptionId",
    ),
    type: normalizeExceptionType(exception.type),
    statement: normalizeStatement(exception.statement),
    normalizedStatement: normalizeStatement(
      exception.normalizedStatement,
    ),
    subjectEntityIds: normalizeIds(
      exception.subjectEntityIds,
      "subjectEntityId",
    ),
    conditionIds: normalizeIds(
      exception.conditionIds,
      "conditionId",
    ),
    overridesConstraintIds: normalizeIds(
      exception.overridesConstraintIds,
      "overridesConstraintId",
    ),
    evidenceIds: normalizeIds(
      exception.evidenceIds,
      "evidenceId",
    ),
    claimIds: normalizeIds(
      exception.claimIds,
      "claimId",
    ),
    confidence: normalizeConfidence(exception.confidence),
  });
}

/**
 * Compute the deterministic fingerprint for an exception.
 */
export function fingerprintException(
  exception: Omit<KnowledgeException, "fingerprint">,
): Fingerprint {
  return fingerprint(
    `${EXCEPTION_FINGERPRINT_PREFIX}${hashCanonical(
      canonicalExceptionPayload(exception),
    )}`,
  );
}

function assertExceptionSubjectPresent(
  exception: Pick<
    KnowledgeException,
    "subjectEntityIds" | "conditionIds"
  >,
): void {
  if (
    exception.subjectEntityIds.length === 0 &&
    exception.conditionIds.length === 0
  ) {
    throw new Error(
      "V8_KNOWLEDGE_EXCEPTION_SCOPE_MISSING: an exception must reference at least one subject entity or condition.",
    );
  }
}

/**
 * Construct a canonical exception.
 *
 * The supplied ID must match the deterministic semantic identity.
 * A caller cannot use this model to assert unsupported truth.
 */
export function createKnowledgeException(
  input: CreateKnowledgeExceptionInput,
): KnowledgeException {
  const type = normalizeExceptionType(input.type);
  const statement = normalizeStatement(input.statement);

  const subjectEntityIds = normalizeIds(
    input.subjectEntityIds,
    "subjectEntityId",
  ) as readonly EntityId[];

  const conditionIds = normalizeIds(
    input.conditionIds,
    "conditionId",
  );

  const overridesConstraintIds = normalizeIds(
    input.overridesConstraintIds,
    "overridesConstraintId",
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

  const payload: Omit<KnowledgeException, "fingerprint"> = {
    exceptionId: nonEmpty(input.exceptionId, "exceptionId"),
    type,
    statement,
    normalizedStatement: statement,
    subjectEntityIds,
    conditionIds,
    overridesConstraintIds,
    evidenceIds,
    claimIds,
    confidence,
  };

  assertExceptionSubjectPresent(payload);

  const expectedId = deriveExceptionId({
    type,
    statement,
    subjectEntityIds,
    conditionIds,
    overridesConstraintIds,
  });

  if (payload.exceptionId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_ID_MISMATCH: supplied "${payload.exceptionId}" does not match canonical ID "${expectedId}".`,
    );
  }

  const result: KnowledgeException = Object.freeze({
    ...payload,
    fingerprint: fingerprintException(payload),
  });

  assertExceptionIntegrity(result);

  return result;
}

/**
 * Preferred factory: derive the exception ID automatically.
 */
export function createException(
  input: Omit<CreateKnowledgeExceptionInput, "exceptionId">,
): KnowledgeException {
  const identity: ExceptionIdentityInput = {
    type: input.type,
    statement: input.statement,
    subjectEntityIds: input.subjectEntityIds,
    conditionIds: input.conditionIds,
    overridesConstraintIds: input.overridesConstraintIds,
  };

  return createKnowledgeException({
    ...input,
    exceptionId: deriveExceptionId(identity),
  });
}

/**
 * Verify the fingerprint without allowing malformed data to escape
 * as an unhandled exception.
 */
export function verifyExceptionFingerprint(
  exception: KnowledgeException,
): boolean {
  try {
    const { fingerprint: _fingerprint, ...payload } = exception;

    return (
      fingerprintException(payload) === exception.fingerprint
    );
  } catch {
    return false;
  }
}

/**
 * Validate canonical identity, normalization, references,
 * and immutable fingerprint integrity.
 */
export function assertExceptionIntegrity(
  exception: KnowledgeException,
): void {
  if (
    exception === null ||
    typeof exception !== "object"
  ) {
    throw new Error(
      "V8_KNOWLEDGE_INVALID_EXCEPTION: exception must be an object.",
    );
  }

  nonEmpty(exception.exceptionId, "exceptionId");
  nonEmpty(exception.statement, "statement");
  nonEmpty(
    exception.normalizedStatement,
    "normalizedStatement",
  );

  normalizeExceptionType(exception.type);
  normalizeConfidence(exception.confidence);

  if (
    exception.normalizedStatement !==
    normalizeStatement(exception.statement)
  ) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_NORMALIZATION_MISMATCH: "${exception.exceptionId}" has a non-canonical statement.`,
    );
  }

  const subjectEntityIds = normalizeIds(
    exception.subjectEntityIds,
    "subjectEntityId",
  );

  const conditionIds = normalizeIds(
    exception.conditionIds,
    "conditionId",
  );

  const overridesConstraintIds = normalizeIds(
    exception.overridesConstraintIds,
    "overridesConstraintId",
  );

  const evidenceIds = normalizeIds(
    exception.evidenceIds,
    "evidenceId",
  );

  const claimIds = normalizeIds(
    exception.claimIds,
    "claimId",
  );

  if (
    subjectEntityIds.length !==
      exception.subjectEntityIds.length ||
    conditionIds.length !== exception.conditionIds.length ||
    overridesConstraintIds.length !==
      exception.overridesConstraintIds.length ||
    evidenceIds.length !== exception.evidenceIds.length ||
    claimIds.length !== exception.claimIds.length
  ) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_DUPLICATE_REFERENCE: "${exception.exceptionId}" contains duplicate or non-canonical references.`,
    );
  }

  assertExceptionSubjectPresent(exception);

  const expectedId = deriveExceptionId({
    type: exception.type,
    statement: exception.statement,
    subjectEntityIds: exception.subjectEntityIds,
    conditionIds: exception.conditionIds,
    overridesConstraintIds: exception.overridesConstraintIds,
  });

  if (exception.exceptionId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_ID_MISMATCH: "${exception.exceptionId}" does not match "${expectedId}".`,
    );
  }

  if (!verifyExceptionFingerprint(exception)) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_FINGERPRINT_MISMATCH: "${exception.exceptionId}" has an invalid fingerprint.`,
    );
  }
}

/**
 * Compare semantic identity while validating both objects.
 */
export function sameExceptionIdentity(
  left: KnowledgeException,
  right: KnowledgeException,
): boolean {
  assertExceptionIntegrity(left);
  assertExceptionIntegrity(right);

  return (
    exceptionIdentity(left) === exceptionIdentity(right)
  );
}

/**
 * Find an exception by deterministic identifier.
 */
export function findException(
  exceptions: readonly KnowledgeException[],
  exceptionId: string,
): KnowledgeException | undefined {
  const id = nonEmpty(exceptionId, "exceptionId");

  for (const exception of exceptions) {
    if (exception.exceptionId === id) {
      assertExceptionIntegrity(exception);
      return exception;
    }
  }

  return undefined;
}

/**
 * Find exceptions classified by type.
 */
export function findExceptionsByType(
  exceptions: readonly KnowledgeException[],
  type: KnowledgeExceptionType,
): readonly KnowledgeException[] {
  const expectedType = normalizeExceptionType(type);

  return Object.freeze(
    exceptions
      .filter((exception) => {
        assertExceptionIntegrity(exception);
        return exception.type === expectedType;
      })
      .sort((left, right) =>
        left.exceptionId.localeCompare(right.exceptionId),
      ),
  );
}

/**
 * Find exceptions affecting an entity.
 */
export function findExceptionsByEntity(
  exceptions: readonly KnowledgeException[],
  entityId: EntityId,
): readonly KnowledgeException[] {
  const id = nonEmpty(String(entityId), "entityId");

  return Object.freeze(
    exceptions
      .filter((exception) => {
        assertExceptionIntegrity(exception);

        return exception.subjectEntityIds.some(
          (candidate) => String(candidate) === id,
        );
      })
      .sort((left, right) =>
        left.exceptionId.localeCompare(right.exceptionId),
      ),
  );
}

/**
 * Find exceptions attached to a condition.
 */
export function findExceptionsByCondition(
  exceptions: readonly KnowledgeException[],
  conditionId: string,
): readonly KnowledgeException[] {
  const id = nonEmpty(conditionId, "conditionId");

  return Object.freeze(
    exceptions
      .filter((exception) => {
        assertExceptionIntegrity(exception);
        return exception.conditionIds.includes(id);
      })
      .sort((left, right) =>
        left.exceptionId.localeCompare(right.exceptionId),
      ),
  );
}

/**
 * Find exceptions that explicitly reference a constraint.
 */
export function findExceptionsOverridingConstraint(
  exceptions: readonly KnowledgeException[],
  constraintId: string,
): readonly KnowledgeException[] {
  const id = nonEmpty(constraintId, "constraintId");

  return Object.freeze(
    exceptions
      .filter((exception) => {
        assertExceptionIntegrity(exception);

        return exception.overridesConstraintIds.includes(id);
      })
      .sort((left, right) =>
        left.exceptionId.localeCompare(right.exceptionId),
      ),
  );
}

/**
 * Build a deterministic index.
 *
 * Conflicting payloads under the same ID fail closed.
 */
export function indexExceptions(
  exceptions: readonly KnowledgeException[],
): ReadonlyMap<string, KnowledgeException> {
  const result = new Map<string, KnowledgeException>();

  for (const exception of exceptions) {
    assertExceptionIntegrity(exception);

    const existing = result.get(exception.exceptionId);

    if (existing === undefined) {
      result.set(exception.exceptionId, exception);
      continue;
    }

    if (existing.fingerprint !== exception.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_EXCEPTION_INDEX_CONFLICT: "${exception.exceptionId}" has conflicting fingerprints.`,
      );
    }
  }

  return result;
}

/**
 * Deduplicate exceptions and return them in stable ID order.
 */
export function deduplicateExceptions(
  exceptions: readonly KnowledgeException[],
): readonly KnowledgeException[] {
  return Object.freeze(
    [...indexExceptions(exceptions).values()].sort(
      (left, right) =>
        left.exceptionId.localeCompare(right.exceptionId),
    ),
  );
}

/**
 * Reject duplicate semantic identities that map to different IDs
 * or payload fingerprints.
 */
export function assertNoExceptionConflicts(
  exceptions: readonly KnowledgeException[],
): void {
  const identities = new Map<string, KnowledgeException>();

  for (const exception of exceptions) {
    assertExceptionIntegrity(exception);

    const identity = exceptionIdentity(exception);
    const previous = identities.get(identity);

    if (previous === undefined) {
      identities.set(identity, exception);
      continue;
    }

    if (previous.exceptionId !== exception.exceptionId) {
      throw new Error(
        `V8_KNOWLEDGE_EXCEPTION_ID_CONFLICT: semantic identity maps to "${previous.exceptionId}" and "${exception.exceptionId}".`,
      );
    }

    if (previous.fingerprint !== exception.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_EXCEPTION_FINGERPRINT_CONFLICT: "${exception.exceptionId}" has conflicting payloads.`,
      );
    }
  }
}

/**
 * Compute a deterministic fingerprint for an exception collection.
 */
export function fingerprintExceptions(
  exceptions: readonly KnowledgeException[],
): Fingerprint {
  const canonical = deduplicateExceptions(exceptions).map(
    (exception) => ({
      exceptionId: exception.exceptionId,
      fingerprint: String(exception.fingerprint),
    }),
  );

  return fingerprint(
    `${EXCEPTION_FINGERPRINT_PREFIX}collection:${hashCanonical(canonical)}`,
  );
}

/**
 * Build a validated, immutable exception collection.
 */
export function buildExceptionCollection(
  exceptions: readonly KnowledgeException[],
): ExceptionCollection {
  const canonicalExceptions = deduplicateExceptions(exceptions);

  assertNoExceptionConflicts(canonicalExceptions);

  return Object.freeze({
    exceptions: canonicalExceptions,
    fingerprint: fingerprintExceptions(canonicalExceptions),
  });
}

/**
 * Replacement must preserve the deterministic exception identity.
 */
export function assertExceptionReplacementSafe(
  current: KnowledgeException,
  replacement: KnowledgeException,
): void {
  assertExceptionIntegrity(current);
  assertExceptionIntegrity(replacement);

  if (current.exceptionId !== replacement.exceptionId) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_REPLACEMENT_ID_CHANGE: replacement changes ID from "${current.exceptionId}" to "${replacement.exceptionId}".`,
    );
  }

  if (!sameExceptionIdentity(current, replacement)) {
    throw new Error(
      `V8_KNOWLEDGE_EXCEPTION_REPLACEMENT_IDENTITY_CHANGE: "${current.exceptionId}" changes semantic identity.`,
    );
  }
}

/**
 * Return a detached immutable snapshot.
 */
export function cloneException(
  exception: KnowledgeException,
): KnowledgeException {
  assertExceptionIntegrity(exception);

  return Object.freeze({
    ...exception,
    subjectEntityIds: Object.freeze([
      ...exception.subjectEntityIds,
    ]),
    conditionIds: Object.freeze([
      ...exception.conditionIds,
    ]),
    overridesConstraintIds: Object.freeze([
      ...exception.overridesConstraintIds,
    ]),
    evidenceIds: Object.freeze([
      ...exception.evidenceIds,
    ]),
    claimIds: Object.freeze([
      ...exception.claimIds,
    ]),
  });
}

/**
 * Collect the canonical entity closure of an exception set.
 */
export function collectExceptionEntityIds(
  exceptions: readonly KnowledgeException[],
): readonly EntityId[] {
  return Object.freeze(
    [
      ...sortedUnique(
        exceptions.flatMap((exception) => {
          assertExceptionIntegrity(exception);
          return exception.subjectEntityIds;
        }),
      ),
    ] as EntityId[],
  );
}

/**
 * Collect the canonical Evidence closure.
 */
export function collectExceptionEvidenceIds(
  exceptions: readonly KnowledgeException[],
): readonly EvidenceId[] {
  return Object.freeze(
    [
      ...sortedUnique(
        exceptions.flatMap((exception) => {
          assertExceptionIntegrity(exception);
          return exception.evidenceIds;
        }),
      ),
    ] as EvidenceId[],
  );
}

/**
 * Collect the canonical Claim closure.
 */
export function collectExceptionClaimIds(
  exceptions: readonly KnowledgeException[],
): readonly ClaimId[] {
  return Object.freeze(
    [
      ...sortedUnique(
        exceptions.flatMap((exception) => {
          assertExceptionIntegrity(exception);
          return exception.claimIds;
        }),
      ),
    ] as ClaimId[],
  );
}

export const EXCEPTION_MODEL_DEFAULTS = Object.freeze({
  modelVersion: MODEL_VERSION,
  idPrefix: EXCEPTION_ID_PREFIX,
  fingerprintPrefix: EXCEPTION_FINGERPRINT_PREFIX,
  deterministicIdentity: true,
  immutableOutput: true,
  failClosed: true,
  preserveEvidenceLineage: true,
  preserveClaimLineage: true,
});