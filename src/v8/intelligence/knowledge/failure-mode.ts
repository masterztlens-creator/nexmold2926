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
  CreateKnowledgeFailureModeInput,
  FailureLikelihood,
  FailureSeverity,
  KnowledgeConfidence,
  KnowledgeFailureMode,
} from "./types.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Failure Mode Model
 *
 * Phase 2.5
 *
 * Responsibilities:
 * - deterministic failure-mode identity;
 * - canonical normalization;
 * - immutable semantic fingerprints;
 * - strict structural integrity verification;
 * - Evidence / Claim lineage preservation;
 * - deterministic lookup, indexing and deduplication;
 * - fail-closed conflict detection.
 *
 * Non-responsibilities:
 * - establishing engineering truth;
 * - inventing unsupported causes or effects;
 * - determining publication eligibility;
 * - bypassing Evidence / Claim verification.
 *
 * Failure-mode records organize engineering knowledge.
 * They do not independently prove that a failure mechanism exists.
 */

const MODEL_VERSION = 1 as const;

const FAILURE_MODE_ID_PREFIX = "failure-mode:v8:";
const FAILURE_MODE_FINGERPRINT_PREFIX = "failure-mode-fp:v8:";

const SEVERITIES = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
  "UNKNOWN",
] as const satisfies readonly FailureSeverity[];

const LIKELIHOODS = [
  "RARE",
  "UNLIKELY",
  "POSSIBLE",
  "LIKELY",
  "ALMOST_CERTAIN",
  "UNKNOWN",
] as const satisfies readonly FailureLikelihood[];

const CONFIDENCE_LEVELS = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
] as const satisfies readonly KnowledgeConfidence[];

export interface FailureModeIdentityInput {
  readonly name: string;
  readonly statement: string;
  readonly causes?: readonly string[];
  readonly effects?: readonly string[];
  readonly detectionSignals?: readonly string[];
  readonly preventionMeasures?: readonly string[];
  readonly severity?: FailureSeverity;
  readonly likelihood?: FailureLikelihood;
  readonly subjectEntityIds?: readonly EntityId[];
  readonly conditionIds?: readonly string[];
}

export interface FailureModeLookupKey {
  readonly failureModeId: string;
  readonly normalizedName: string;
}

export interface FailureModeCollection {
  readonly failureModes: readonly KnowledgeFailureMode[];
  readonly fingerprint: Fingerprint;
}

function normalizeWhitespace(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .replace(/\s+/gu, " ");
}

function normalizeText(value: string, field: string): string {
  return nonEmpty(normalizeWhitespace(value), field);
}

export function normalizeFailureModeName(value: string): string {
  return normalizeText(value, "failureMode.name")
    .toLocaleLowerCase("en-US");
}

export function normalizeFailureModeStatement(value: string): string {
  return normalizeText(value, "failureMode.statement");
}

function normalizeTextList(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  const normalized = (values ?? []).map((value) =>
    normalizeText(value, field),
  );

  return Object.freeze([...sortedUnique(normalized)]);
}

function normalizeEntityIds(
  values: readonly EntityId[] | undefined,
): readonly EntityId[] {
  return Object.freeze([
    ...sortedUnique(
      (values ?? []).map((value) =>
        nonEmpty(String(value), "subjectEntityId"),
      ),
    ),
  ] as EntityId[]);
}

function normalizeEvidenceIds(
  values: readonly EvidenceId[] | undefined,
): readonly EvidenceId[] {
  return Object.freeze([
    ...sortedUnique(
      (values ?? []).map((value) =>
        nonEmpty(String(value), "evidenceId"),
      ),
    ),
  ] as EvidenceId[]);
}

function normalizeClaimIds(
  values: readonly ClaimId[] | undefined,
): readonly ClaimId[] {
  return Object.freeze([
    ...sortedUnique(
      (values ?? []).map((value) =>
        nonEmpty(String(value), "claimId"),
      ),
    ),
  ] as ClaimId[]);
}

function normalizeSeverity(
  value: FailureSeverity | undefined,
): FailureSeverity {
  const candidate = String(value ?? "UNKNOWN").trim();

  if (!(SEVERITIES as readonly string[]).includes(candidate)) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_FAILURE_SEVERITY: unsupported severity "${candidate}".`,
    );
  }

  return candidate as FailureSeverity;
}

function normalizeLikelihood(
  value: FailureLikelihood | undefined,
): FailureLikelihood {
  const candidate = String(value ?? "UNKNOWN").trim();

  if (!(LIKELIHOODS as readonly string[]).includes(candidate)) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_FAILURE_LIKELIHOOD: unsupported likelihood "${candidate}".`,
    );
  }

  return candidate as FailureLikelihood;
}

function normalizeConfidence(
  value: KnowledgeConfidence | undefined,
): KnowledgeConfidence {
  const candidate = String(value ?? "MEDIUM").trim();

  if (!(CONFIDENCE_LEVELS as readonly string[]).includes(candidate)) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_FAILURE_CONFIDENCE: unsupported confidence "${candidate}".`,
    );
  }

  return candidate as KnowledgeConfidence;
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

function canonicalIdentityMaterial(
  input: FailureModeIdentityInput,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: MODEL_VERSION,
    normalizedName: normalizeFailureModeName(input.name),
    statement: normalizeFailureModeStatement(input.statement),
    causes: normalizeTextList(input.causes, "failureMode.cause"),
    effects: normalizeTextList(input.effects, "failureMode.effect"),
    detectionSignals: normalizeTextList(
      input.detectionSignals,
      "failureMode.detectionSignal",
    ),
    preventionMeasures: normalizeTextList(
      input.preventionMeasures,
      "failureMode.preventionMeasure",
    ),
    severity: normalizeSeverity(input.severity),
    likelihood: normalizeLikelihood(input.likelihood),
    subjectEntityIds: normalizeEntityIds(input.subjectEntityIds),
    conditionIds: normalizeTextList(
      input.conditionIds,
      "failureMode.conditionId",
    ),
  });
}

/**
 * Return canonical semantic identity material.
 *
 * Evidence, Claim and confidence are provenance / assessment dimensions.
 * They are deliberately excluded from semantic identity.
 *
 * Failure characteristics and applicability references are included:
 * changing them creates a different semantic failure-mode record.
 */
export function failureModeIdentity(
  input: FailureModeIdentityInput,
): string {
  return JSON.stringify(
    canonicalize(canonicalIdentityMaterial(input)),
  );
}

/**
 * Derive a deterministic identifier from canonical semantics.
 */
export function deriveFailureModeId(
  input: FailureModeIdentityInput,
): string {
  return `${FAILURE_MODE_ID_PREFIX}${hashCanonical(
    canonicalIdentityMaterial(input),
  )}`;
}

function canonicalFailureModePayload(
  input: Omit<KnowledgeFailureMode, "fingerprint">,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: MODEL_VERSION,
    failureModeId: input.failureModeId,
    name: input.name,
    normalizedName: input.normalizedName,
    statement: input.statement,
    causes: input.causes,
    effects: input.effects,
    detectionSignals: input.detectionSignals,
    preventionMeasures: input.preventionMeasures,
    severity: input.severity,
    likelihood: input.likelihood,
    subjectEntityIds: input.subjectEntityIds,
    conditionIds: input.conditionIds,
    evidenceIds: input.evidenceIds,
    claimIds: input.claimIds,
    confidence: input.confidence,
  });
}

/**
 * Compute the deterministic fingerprint of a failure-mode payload.
 */
export function fingerprintFailureMode(
  input: Omit<KnowledgeFailureMode, "fingerprint">,
): Fingerprint {
  return fingerprint(
    `${FAILURE_MODE_FINGERPRINT_PREFIX}${hashCanonical(
      canonicalFailureModePayload(input),
    )}`,
  );
}

/**
 * Construct a canonical failure-mode record.
 *
 * This factory validates structure and lineage references.
 * It does not establish the truth of the supplied engineering assertion.
 */
export function createKnowledgeFailureMode(
  input: CreateKnowledgeFailureModeInput,
): KnowledgeFailureMode {
  const name = normalizeText(input.name, "failureMode.name");
  const normalizedName = normalizeFailureModeName(name);
  const statement = normalizeFailureModeStatement(input.statement);

  const causes = normalizeTextList(
    input.causes,
    "failureMode.cause",
  );

  const effects = normalizeTextList(
    input.effects,
    "failureMode.effect",
  );

  const detectionSignals = normalizeTextList(
    input.detectionSignals,
    "failureMode.detectionSignal",
  );

  const preventionMeasures = normalizeTextList(
    input.preventionMeasures,
    "failureMode.preventionMeasure",
  );

  const severity = normalizeSeverity(input.severity);
  const likelihood = normalizeLikelihood(input.likelihood);

  const subjectEntityIds = normalizeEntityIds(
    input.subjectEntityIds,
  );

  const conditionIds = normalizeTextList(
    input.conditionIds,
    "failureMode.conditionId",
  );

  const evidenceIds = normalizeEvidenceIds(input.evidenceIds);
  const claimIds = normalizeClaimIds(input.claimIds);
  const confidence = normalizeConfidence(input.confidence);

  const payload: Omit<KnowledgeFailureMode, "fingerprint"> = {
    failureModeId: nonEmpty(
      input.failureModeId,
      "failureModeId",
    ),
    name,
    normalizedName,
    statement,
    causes,
    effects,
    detectionSignals,
    preventionMeasures,
    severity,
    likelihood,
    subjectEntityIds,
    conditionIds,
    evidenceIds,
    claimIds,
    confidence,
  };

  const expectedId = deriveFailureModeId({
    name,
    statement,
    causes,
    effects,
    detectionSignals,
    preventionMeasures,
    severity,
    likelihood,
    subjectEntityIds,
    conditionIds,
  });

  if (payload.failureModeId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_ID_MISMATCH: supplied "${payload.failureModeId}" does not match canonical ID "${expectedId}".`,
    );
  }

  const result: KnowledgeFailureMode = Object.freeze({
    ...payload,
    fingerprint: fingerprintFailureMode(payload),
  });

  assertFailureModeIntegrity(result);

  return result;
}

/**
 * Preferred factory: derive the deterministic identifier automatically.
 */
export function createFailureMode(
  input: Omit<CreateKnowledgeFailureModeInput, "failureModeId">,
): KnowledgeFailureMode {
  const identity: FailureModeIdentityInput = {
    name: input.name,
    statement: input.statement,
    causes: input.causes,
    effects: input.effects,
    detectionSignals: input.detectionSignals,
    preventionMeasures: input.preventionMeasures,
    severity: input.severity,
    likelihood: input.likelihood,
    subjectEntityIds: input.subjectEntityIds,
    conditionIds: input.conditionIds,
  };

  return createKnowledgeFailureMode({
    ...input,
    failureModeId: deriveFailureModeId(identity),
  });
}

/**
 * Verify a failure-mode fingerprint without leaking malformed-input errors.
 */
export function verifyFailureModeFingerprint(
  failureMode: KnowledgeFailureMode,
): boolean {
  try {
    const { fingerprint: _fingerprint, ...payload } = failureMode;

    return (
      fingerprintFailureMode(payload) === failureMode.fingerprint
    );
  } catch {
    return false;
  }
}

/**
 * Validate canonical identity, normalized values, reference closure,
 * and immutable fingerprint integrity.
 */
export function assertFailureModeIntegrity(
  failureMode: KnowledgeFailureMode,
): void {
  if (
    failureMode === null ||
    typeof failureMode !== "object"
  ) {
    throw new Error(
      "V8_KNOWLEDGE_INVALID_FAILURE_MODE: failure mode must be an object.",
    );
  }

  nonEmpty(failureMode.failureModeId, "failureModeId");
  nonEmpty(failureMode.name, "failureMode.name");
  nonEmpty(failureMode.normalizedName, "failureMode.normalizedName");
  nonEmpty(failureMode.statement, "failureMode.statement");

  const normalizedName = normalizeFailureModeName(failureMode.name);
  const normalizedStatement = normalizeFailureModeStatement(
    failureMode.statement,
  );

  if (failureMode.normalizedName !== normalizedName) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_NAME_MISMATCH: "${failureMode.failureModeId}" has a non-canonical name.`,
    );
  }

  if (failureMode.statement !== normalizedStatement) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_STATEMENT_MISMATCH: "${failureMode.failureModeId}" has a non-canonical statement.`,
    );
  }

  normalizeSeverity(failureMode.severity);
  normalizeLikelihood(failureMode.likelihood);
  normalizeConfidence(failureMode.confidence);

  const causes = normalizeTextList(
    failureMode.causes,
    "failureMode.cause",
  );
  const effects = normalizeTextList(
    failureMode.effects,
    "failureMode.effect",
  );
  const detectionSignals = normalizeTextList(
    failureMode.detectionSignals,
    "failureMode.detectionSignal",
  );
  const preventionMeasures = normalizeTextList(
    failureMode.preventionMeasures,
    "failureMode.preventionMeasure",
  );
  const subjectEntityIds = normalizeEntityIds(
    failureMode.subjectEntityIds,
  );
  const conditionIds = normalizeTextList(
    failureMode.conditionIds,
    "failureMode.conditionId",
  );
  const evidenceIds = normalizeEvidenceIds(
    failureMode.evidenceIds,
  );
  const claimIds = normalizeClaimIds(
    failureMode.claimIds,
  );

  const arraysAreCanonical =
    causes.length === failureMode.causes.length &&
    effects.length === failureMode.effects.length &&
    detectionSignals.length === failureMode.detectionSignals.length &&
    preventionMeasures.length === failureMode.preventionMeasures.length &&
    subjectEntityIds.length === failureMode.subjectEntityIds.length &&
    conditionIds.length === failureMode.conditionIds.length &&
    evidenceIds.length === failureMode.evidenceIds.length &&
    claimIds.length === failureMode.claimIds.length;

  if (!arraysAreCanonical) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_DUPLICATE_REFERENCE: "${failureMode.failureModeId}" contains duplicate or non-canonical array values.`,
    );
  }

  const expectedId = deriveFailureModeId({
    name: failureMode.name,
    statement: failureMode.statement,
    causes: failureMode.causes,
    effects: failureMode.effects,
    detectionSignals: failureMode.detectionSignals,
    preventionMeasures: failureMode.preventionMeasures,
    severity: failureMode.severity,
    likelihood: failureMode.likelihood,
    subjectEntityIds: failureMode.subjectEntityIds,
    conditionIds: failureMode.conditionIds,
  });

  if (failureMode.failureModeId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_ID_MISMATCH: "${failureMode.failureModeId}" does not match "${expectedId}".`,
    );
  }

  if (!verifyFailureModeFingerprint(failureMode)) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_FINGERPRINT_MISMATCH: "${failureMode.failureModeId}" has an invalid fingerprint.`,
    );
  }
}

/**
 * Compare semantic identity after validating both records.
 */
export function sameFailureModeIdentity(
  left: KnowledgeFailureMode,
  right: KnowledgeFailureMode,
): boolean {
  assertFailureModeIntegrity(left);
  assertFailureModeIntegrity(right);

  return failureModeIdentity({
    name: left.name,
    statement: left.statement,
    causes: left.causes,
    effects: left.effects,
    detectionSignals: left.detectionSignals,
    preventionMeasures: left.preventionMeasures,
    severity: left.severity,
    likelihood: left.likelihood,
    subjectEntityIds: left.subjectEntityIds,
    conditionIds: left.conditionIds,
  }) === failureModeIdentity({
    name: right.name,
    statement: right.statement,
    causes: right.causes,
    effects: right.effects,
    detectionSignals: right.detectionSignals,
    preventionMeasures: right.preventionMeasures,
    severity: right.severity,
    likelihood: right.likelihood,
    subjectEntityIds: right.subjectEntityIds,
    conditionIds: right.conditionIds,
  });
}

export function findFailureMode(
  failureModes: readonly KnowledgeFailureMode[],
  failureModeId: string,
): KnowledgeFailureMode | undefined {
  const id = nonEmpty(failureModeId, "failureModeId");

  for (const failureMode of failureModes) {
    if (failureMode.failureModeId === id) {
      assertFailureModeIntegrity(failureMode);
      return failureMode;
    }
  }

  return undefined;
}

export function findFailureModesByEntity(
  failureModes: readonly KnowledgeFailureMode[],
  entityId: EntityId,
): readonly KnowledgeFailureMode[] {
  const id = nonEmpty(String(entityId), "entityId");

  return Object.freeze(
    failureModes
      .filter((failureMode) => {
        assertFailureModeIntegrity(failureMode);

        return failureMode.subjectEntityIds.some(
          (candidate) => String(candidate) === id,
        );
      })
      .sort((left, right) =>
        left.failureModeId.localeCompare(right.failureModeId),
      ),
  );
}

export function findFailureModesByCondition(
  failureModes: readonly KnowledgeFailureMode[],
  conditionId: string,
): readonly KnowledgeFailureMode[] {
  const id = nonEmpty(conditionId, "conditionId");

  return Object.freeze(
    failureModes
      .filter((failureMode) => {
        assertFailureModeIntegrity(failureMode);
        return failureMode.conditionIds.includes(id);
      })
      .sort((left, right) =>
        left.failureModeId.localeCompare(right.failureModeId),
      ),
  );
}

export function findFailureModesBySeverity(
  failureModes: readonly KnowledgeFailureMode[],
  severity: FailureSeverity,
): readonly KnowledgeFailureMode[] {
  const expectedSeverity = normalizeSeverity(severity);

  return Object.freeze(
    failureModes
      .filter((failureMode) => {
        assertFailureModeIntegrity(failureMode);
        return failureMode.severity === expectedSeverity;
      })
      .sort((left, right) =>
        left.failureModeId.localeCompare(right.failureModeId),
      ),
  );
}

/**
 * Build a deterministic index.
 * Conflicting payloads under the same identifier fail closed.
 */
export function indexFailureModes(
  failureModes: readonly KnowledgeFailureMode[],
): ReadonlyMap<string, KnowledgeFailureMode> {
  const result = new Map<string, KnowledgeFailureMode>();

  for (const failureMode of failureModes) {
    assertFailureModeIntegrity(failureMode);

    const existing = result.get(failureMode.failureModeId);

    if (existing === undefined) {
      result.set(failureMode.failureModeId, failureMode);
      continue;
    }

    if (existing.fingerprint !== failureMode.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_FAILURE_MODE_INDEX_CONFLICT: "${failureMode.failureModeId}" has conflicting fingerprints.`,
      );
    }
  }

  return result;
}

/**
 * Deduplicate records and return them in deterministic identifier order.
 */
export function deduplicateFailureModes(
  failureModes: readonly KnowledgeFailureMode[],
): readonly KnowledgeFailureMode[] {
  const indexed = indexFailureModes(failureModes);

  return Object.freeze(
    [...indexed.values()].sort((left, right) =>
      left.failureModeId.localeCompare(right.failureModeId),
    ),
  );
}

/**
 * Reject semantically conflicting failure-mode records.
 */
export function assertNoFailureModeConflicts(
  failureModes: readonly KnowledgeFailureMode[],
): void {
  const identities = new Map<string, KnowledgeFailureMode>();

  for (const failureMode of failureModes) {
    assertFailureModeIntegrity(failureMode);

    const identity = failureModeIdentity({
      name: failureMode.name,
      statement: failureMode.statement,
      causes: failureMode.causes,
      effects: failureMode.effects,
      detectionSignals: failureMode.detectionSignals,
      preventionMeasures: failureMode.preventionMeasures,
      severity: failureMode.severity,
      likelihood: failureMode.likelihood,
      subjectEntityIds: failureMode.subjectEntityIds,
      conditionIds: failureMode.conditionIds,
    });

    const previous = identities.get(identity);

    if (previous === undefined) {
      identities.set(identity, failureMode);
      continue;
    }

    if (previous.failureModeId !== failureMode.failureModeId) {
      throw new Error(
        `V8_KNOWLEDGE_FAILURE_MODE_ID_CONFLICT: semantic identity maps to "${previous.failureModeId}" and "${failureMode.failureModeId}".`,
      );
    }

    if (previous.fingerprint !== failureMode.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_FAILURE_MODE_FINGERPRINT_CONFLICT: "${failureMode.failureModeId}" has inconsistent payloads.`,
      );
    }
  }
}

export function fingerprintFailureModes(
  failureModes: readonly KnowledgeFailureMode[],
): Fingerprint {
  const canonical = deduplicateFailureModes(failureModes).map(
    (failureMode) => ({
      failureModeId: failureMode.failureModeId,
      fingerprint: String(failureMode.fingerprint),
    }),
  );

  return fingerprint(
    `${FAILURE_MODE_FINGERPRINT_PREFIX}collection:${hashCanonical(canonical)}`,
  );
}

export function buildFailureModeCollection(
  failureModes: readonly KnowledgeFailureMode[],
): FailureModeCollection {
  const canonicalFailureModes = deduplicateFailureModes(failureModes);

  assertNoFailureModeConflicts(canonicalFailureModes);

  return Object.freeze({
    failureModes: canonicalFailureModes,
    fingerprint: fingerprintFailureModes(canonicalFailureModes),
  });
}

/**
 * Replacement must preserve deterministic semantic identity.
 */
export function assertFailureModeReplacementSafe(
  current: KnowledgeFailureMode,
  replacement: KnowledgeFailureMode,
): void {
  assertFailureModeIntegrity(current);
  assertFailureModeIntegrity(replacement);

  if (current.failureModeId !== replacement.failureModeId) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_REPLACEMENT_ID_CHANGE: replacement changes ID from "${current.failureModeId}" to "${replacement.failureModeId}".`,
    );
  }

  if (!sameFailureModeIdentity(current, replacement)) {
    throw new Error(
      `V8_KNOWLEDGE_FAILURE_MODE_REPLACEMENT_IDENTITY_CHANGE: "${current.failureModeId}" changes semantic identity.`,
    );
  }
}

/**
 * Return a detached immutable snapshot.
 */
export function cloneFailureMode(
  failureMode: KnowledgeFailureMode,
): KnowledgeFailureMode {
  assertFailureModeIntegrity(failureMode);

  return Object.freeze({
    ...failureMode,
    causes: Object.freeze([...failureMode.causes]),
    effects: Object.freeze([...failureMode.effects]),
    detectionSignals: Object.freeze([...failureMode.detectionSignals]),
    preventionMeasures: Object.freeze([...failureMode.preventionMeasures]),
    subjectEntityIds: Object.freeze([...failureMode.subjectEntityIds]),
    conditionIds: Object.freeze([...failureMode.conditionIds]),
    evidenceIds: Object.freeze([...failureMode.evidenceIds]),
    claimIds: Object.freeze([...failureMode.claimIds]),
  });
}

export function collectFailureModeEntityIds(
  failureModes: readonly KnowledgeFailureMode[],
): readonly EntityId[] {
  return Object.freeze([
    ...sortedUnique(
      failureModes.flatMap((failureMode) => {
        assertFailureModeIntegrity(failureMode);
        return failureMode.subjectEntityIds;
      }),
    ),
  ] as EntityId[]);
}

export function collectFailureModeEvidenceIds(
  failureModes: readonly KnowledgeFailureMode[],
): readonly EvidenceId[] {
  return Object.freeze([
    ...sortedUnique(
      failureModes.flatMap((failureMode) => {
        assertFailureModeIntegrity(failureMode);
        return failureMode.evidenceIds;
      }),
    ),
  ] as EvidenceId[]);
}

export function collectFailureModeClaimIds(
  failureModes: readonly KnowledgeFailureMode[],
): readonly ClaimId[] {
  return Object.freeze([
    ...sortedUnique(
      failureModes.flatMap((failureMode) => {
        assertFailureModeIntegrity(failureMode);
        return failureMode.claimIds;
      }),
    ),
  ] as ClaimId[]);
}

export const FAILURE_MODE_MODEL_DEFAULTS = Object.freeze({
  modelVersion: MODEL_VERSION,
  idPrefix: FAILURE_MODE_ID_PREFIX,
  fingerprintPrefix: FAILURE_MODE_FINGERPRINT_PREFIX,
  deterministicIdentity: true,
  immutableOutput: true,
  failClosed: true,
  preservesEvidenceLineage: true,
  preservesClaimLineage: true,
});