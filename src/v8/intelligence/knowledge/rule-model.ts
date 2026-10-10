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
  CreateKnowledgeRuleInput,
  KnowledgeApplicability,
  KnowledgeConfidence,
  KnowledgeRule,
  KnowledgeRuleType,
} from "./types.js";

/**
 * NEXMOLD V8 — Engineering Knowledge Rule Model
 *
 * Phase 2.5
 *
 * Responsibilities:
 * - deterministic semantic identity;
 * - canonical normalization;
 * - immutable rule records;
 * - stable fingerprints;
 * - strict structural integrity checks;
 * - deterministic lookup and indexing;
 * - duplicate detection and semantic conflict detection;
 * - preservation of Evidence and Claim references.
 *
 * This model organizes verified knowledge. It does not establish
 * engineering truth, verify source evidence, or authorize publication.
 * Those responsibilities remain with the upstream Evidence / Claim
 * chain and the unified knowledge validator.
 */

const MODEL_VERSION = 1 as const;

const RULE_ID_PREFIX = "rule:v8:";
const RULE_FINGERPRINT_PREFIX = "rule-fp:v8:";

const RULE_TYPES = [
  "THRESHOLD",
  "RANGE",
  "CONDITIONAL",
  "COMPATIBILITY",
  "PREVENTION",
  "DIAGNOSTIC",
  "SELECTION",
  "PROCESS",
  "DESIGN",
  "VALIDATION",
  "OTHER",
] as const satisfies readonly KnowledgeRuleType[];

const CONFIDENCE_LEVELS = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
] as const satisfies readonly KnowledgeConfidence[];

const APPLICABILITY_LEVELS = [
  "UNIVERSAL",
  "CONDITIONAL",
  "CONTEXTUAL",
  "OUT_OF_SCOPE",
  "UNKNOWN",
] as const satisfies readonly KnowledgeApplicability[];

export interface RuleIdentityInput {
  readonly type: KnowledgeRuleType;
  readonly name: string;
  readonly statement: string;
  readonly conditionIds?: readonly string[];
  readonly constraintIds?: readonly string[];
  readonly exceptionIds?: readonly string[];
  readonly failureModeIds?: readonly string[];
  readonly subjectEntityIds?: readonly EntityId[];
  readonly applicability?: KnowledgeApplicability;
}

export interface RuleLookupKey {
  readonly ruleId: string;
  readonly normalizedName: string;
}

export interface RuleCollection {
  readonly rules: readonly KnowledgeRule[];
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

export function normalizeRuleName(value: string): string {
  return normalizeText(value, "rule.name").toLocaleLowerCase("en-US");
}

export function normalizeRuleStatement(value: string): string {
  return normalizeText(value, "rule.statement");
}

function normalizeRuleType(
  value: KnowledgeRuleType,
): KnowledgeRuleType {
  const candidate = String(value).trim();

  if (!(RULE_TYPES as readonly string[]).includes(candidate)) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_RULE_TYPE: unsupported rule type "${candidate}".`,
    );
  }

  return candidate as KnowledgeRuleType;
}

function normalizeConfidence(
  value: KnowledgeConfidence,
): KnowledgeConfidence {
  const candidate = String(value).trim();

  if (!(CONFIDENCE_LEVELS as readonly string[]).includes(candidate)) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_RULE_CONFIDENCE: unsupported confidence "${candidate}".`,
    );
  }

  return candidate as KnowledgeConfidence;
}

function normalizeApplicability(
  value: KnowledgeApplicability | undefined,
): KnowledgeApplicability {
  const candidate = String(value ?? "UNKNOWN").trim();

  if (
    !(APPLICABILITY_LEVELS as readonly string[]).includes(candidate)
  ) {
    throw new Error(
      `V8_KNOWLEDGE_INVALID_RULE_APPLICABILITY: unsupported applicability "${candidate}".`,
    );
  }

  return candidate as KnowledgeApplicability;
}

function normalizeStringIds(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  const normalized = (values ?? []).map((value) =>
    nonEmpty(normalizeWhitespace(value), field),
  );

  return Object.freeze([...sortedUnique(normalized)]);
}

function normalizeEntityIds(
  values: readonly EntityId[] | undefined,
): readonly EntityId[] {
  const normalized = (values ?? []).map((value) =>
    nonEmpty(String(value), "subjectEntityId"),
  );

  return Object.freeze([...sortedUnique(normalized)] as EntityId[]);
}

function normalizeEvidenceIds(
  values: readonly EvidenceId[] | undefined,
): readonly EvidenceId[] {
  const normalized = (values ?? []).map((value) =>
    nonEmpty(String(value), "evidenceId"),
  );

  return Object.freeze([...sortedUnique(normalized)] as EvidenceId[]);
}

function normalizeClaimIds(
  values: readonly ClaimId[] | undefined,
): readonly ClaimId[] {
  const normalized = (values ?? []).map((value) =>
    nonEmpty(String(value), "claimId"),
  );

  return Object.freeze([...sortedUnique(normalized)] as ClaimId[]);
}

function hashCanonical(value: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(value)), "utf8")
    .digest("hex");
}

/**
 * Canonical semantic identity deliberately excludes:
 * - Evidence IDs;
 * - Claim IDs;
 * - confidence.
 *
 * These fields describe provenance and assessment, rather than the
 * underlying rule semantics.
 */
function canonicalRuleIdentity(
  input: RuleIdentityInput,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    version: MODEL_VERSION,
    type: normalizeRuleType(input.type),
    normalizedName: normalizeRuleName(input.name),
    statement: normalizeRuleStatement(input.statement),
    conditionIds: normalizeStringIds(
      input.conditionIds,
      "conditionId",
    ),
    constraintIds: normalizeStringIds(
      input.constraintIds,
      "constraintId",
    ),
    exceptionIds: normalizeStringIds(
      input.exceptionIds,
      "exceptionId",
    ),
    failureModeIds: normalizeStringIds(
      input.failureModeIds,
      "failureModeId",
    ),
    subjectEntityIds: normalizeEntityIds(input.subjectEntityIds),
    applicability: normalizeApplicability(input.applicability),
  });
}

export function ruleIdentity(input: RuleIdentityInput): string {
  return JSON.stringify(canonicalize(canonicalRuleIdentity(input)));
}

/**
 * Derive a stable ID from canonical rule semantics.
 */
export function deriveRuleId(input: RuleIdentityInput): string {
  return `${RULE_ID_PREFIX}${hashCanonical({
    model: MODEL_VERSION,
    identity: canonicalRuleIdentity(input),
  })}`;
}

function canonicalRulePayload(
  rule: Omit<KnowledgeRule, "fingerprint">,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    ruleId: nonEmpty(rule.ruleId, "ruleId"),
    type: normalizeRuleType(rule.type),
    name: normalizeText(rule.name, "rule.name"),
    normalizedName: normalizeRuleName(rule.name),
    statement: normalizeRuleStatement(rule.statement),
    conditionIds: normalizeStringIds(rule.conditionIds, "conditionId"),
    constraintIds: normalizeStringIds(rule.constraintIds, "constraintId"),
    exceptionIds: normalizeStringIds(rule.exceptionIds, "exceptionId"),
    failureModeIds: normalizeStringIds(
      rule.failureModeIds,
      "failureModeId",
    ),
    subjectEntityIds: normalizeEntityIds(rule.subjectEntityIds),
    evidenceIds: normalizeEvidenceIds(rule.evidenceIds),
    claimIds: normalizeClaimIds(rule.claimIds),
    confidence: normalizeConfidence(rule.confidence),
    applicability: normalizeApplicability(rule.applicability),
  });
}

/**
 * Compute the stable fingerprint of a rule's complete canonical payload.
 *
 * Provenance and confidence affect the fingerprint even though they do
 * not affect semantic identity. A provenance change must be detectable.
 */
export function fingerprintRule(
  rule: Omit<KnowledgeRule, "fingerprint">,
): Fingerprint {
  return fingerprint(
    `${RULE_FINGERPRINT_PREFIX}${hashCanonical(
      canonicalRulePayload(rule),
    )}`,
  );
}

/**
 * Create a rule when the caller supplies its canonical deterministic ID.
 * Prefer createRule() when the ID should be derived automatically.
 */
export function createKnowledgeRule(
  input: CreateKnowledgeRuleInput,
): KnowledgeRule {
  const type = normalizeRuleType(input.type);
  const name = normalizeText(input.name, "rule.name");
  const normalizedName = normalizeRuleName(name);
  const statement = normalizeRuleStatement(input.statement);

  const conditionIds = normalizeStringIds(
    input.conditionIds,
    "conditionId",
  );
  const constraintIds = normalizeStringIds(
    input.constraintIds,
    "constraintId",
  );
  const exceptionIds = normalizeStringIds(
    input.exceptionIds,
    "exceptionId",
  );
  const failureModeIds = normalizeStringIds(
    input.failureModeIds,
    "failureModeId",
  );
  const subjectEntityIds = normalizeEntityIds(input.subjectEntityIds);
  const evidenceIds = normalizeEvidenceIds(input.evidenceIds);
  const claimIds = normalizeClaimIds(input.claimIds);
  const confidence = normalizeConfidence(input.confidence ?? "MEDIUM");
  const applicability = normalizeApplicability(input.applicability);

  const payload: Omit<KnowledgeRule, "fingerprint"> = {
    ruleId: nonEmpty(input.ruleId, "ruleId"),
    type,
    name,
    normalizedName,
    statement,
    conditionIds,
    constraintIds,
    exceptionIds,
    failureModeIds,
    subjectEntityIds,
    evidenceIds,
    claimIds,
    confidence,
    applicability,
  };

  const expectedId = deriveRuleId({
    type,
    name,
    statement,
    conditionIds,
    constraintIds,
    exceptionIds,
    failureModeIds,
    subjectEntityIds,
    applicability,
  });

  if (payload.ruleId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_ID_MISMATCH: supplied "${payload.ruleId}" does not match canonical ID "${expectedId}".`,
    );
  }

  const result: KnowledgeRule = Object.freeze({
    ...payload,
    fingerprint: fingerprintRule(payload),
  });

  assertRuleIntegrity(result);

  return result;
}

/**
 * Preferred factory: derive the deterministic ID automatically.
 */
export function createRule(
  input: Omit<CreateKnowledgeRuleInput, "ruleId">,
): KnowledgeRule {
  const identity: RuleIdentityInput = {
    type: input.type,
    name: input.name,
    statement: input.statement,
    conditionIds: input.conditionIds,
    constraintIds: input.constraintIds,
    exceptionIds: input.exceptionIds,
    failureModeIds: input.failureModeIds,
    subjectEntityIds: input.subjectEntityIds,
    applicability: input.applicability,
  };

  return createKnowledgeRule({
    ...input,
    ruleId: deriveRuleId(identity),
  });
}

/**
 * Verify the fingerprint without allowing malformed data to escape
 * as an unhandled exception.
 */
export function verifyRuleFingerprint(rule: KnowledgeRule): boolean {
  try {
    const { fingerprint: _fingerprint, ...payload } = rule;
    return fingerprintRule(payload) === rule.fingerprint;
  } catch {
    return false;
  }
}

/**
 * Validate normalized fields, canonical identity, unique references,
 * supported enum values, and fingerprint integrity.
 */
export function assertRuleIntegrity(rule: KnowledgeRule): void {
  if (rule === null || typeof rule !== "object") {
    throw new Error(
      "V8_KNOWLEDGE_INVALID_RULE: rule must be an object.",
    );
  }

  nonEmpty(rule.ruleId, "ruleId");
  nonEmpty(rule.name, "rule.name");
  nonEmpty(rule.normalizedName, "rule.normalizedName");
  nonEmpty(rule.statement, "rule.statement");

  normalizeRuleType(rule.type);
  normalizeConfidence(rule.confidence);
  normalizeApplicability(rule.applicability);

  if (rule.normalizedName !== normalizeRuleName(rule.name)) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_NAME_MISMATCH: "${rule.ruleId}" has a non-canonical name.`,
    );
  }

  if (rule.statement !== normalizeRuleStatement(rule.statement)) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_STATEMENT_MISMATCH: "${rule.ruleId}" has a non-canonical statement.`,
    );
  }

  const conditionIds = normalizeStringIds(
    rule.conditionIds,
    "conditionId",
  );
  const constraintIds = normalizeStringIds(
    rule.constraintIds,
    "constraintId",
  );
  const exceptionIds = normalizeStringIds(
    rule.exceptionIds,
    "exceptionId",
  );
  const failureModeIds = normalizeStringIds(
    rule.failureModeIds,
    "failureModeId",
  );
  const subjectEntityIds = normalizeEntityIds(rule.subjectEntityIds);
  const evidenceIds = normalizeEvidenceIds(rule.evidenceIds);
  const claimIds = normalizeClaimIds(rule.claimIds);

  if (
    conditionIds.length !== rule.conditionIds.length ||
    constraintIds.length !== rule.constraintIds.length ||
    exceptionIds.length !== rule.exceptionIds.length ||
    failureModeIds.length !== rule.failureModeIds.length ||
    subjectEntityIds.length !== rule.subjectEntityIds.length ||
    evidenceIds.length !== rule.evidenceIds.length ||
    claimIds.length !== rule.claimIds.length
  ) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_DUPLICATE_REFERENCE: "${rule.ruleId}" contains duplicate or non-canonical references.`,
    );
  }

  const expectedId = deriveRuleId({
    type: rule.type,
    name: rule.name,
    statement: rule.statement,
    conditionIds: rule.conditionIds,
    constraintIds: rule.constraintIds,
    exceptionIds: rule.exceptionIds,
    failureModeIds: rule.failureModeIds,
    subjectEntityIds: rule.subjectEntityIds,
    applicability: rule.applicability,
  });

  if (rule.ruleId !== expectedId) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_ID_MISMATCH: "${rule.ruleId}" does not match "${expectedId}".`,
    );
  }

  if (!verifyRuleFingerprint(rule)) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_FINGERPRINT_MISMATCH: "${rule.ruleId}" has an invalid fingerprint.`,
    );
  }
}

/**
 * Compare semantic identity after validating both records.
 */
export function sameRuleIdentity(
  left: KnowledgeRule,
  right: KnowledgeRule,
): boolean {
  assertRuleIntegrity(left);
  assertRuleIntegrity(right);

  return (
    ruleIdentity({
      type: left.type,
      name: left.name,
      statement: left.statement,
      conditionIds: left.conditionIds,
      constraintIds: left.constraintIds,
      exceptionIds: left.exceptionIds,
      failureModeIds: left.failureModeIds,
      subjectEntityIds: left.subjectEntityIds,
      applicability: left.applicability,
    }) ===
    ruleIdentity({
      type: right.type,
      name: right.name,
      statement: right.statement,
      conditionIds: right.conditionIds,
      constraintIds: right.constraintIds,
      exceptionIds: right.exceptionIds,
      failureModeIds: right.failureModeIds,
      subjectEntityIds: right.subjectEntityIds,
      applicability: right.applicability,
    })
  );
}

/**
 * Find a rule by deterministic ID.
 */
export function findRule(
  rules: readonly KnowledgeRule[],
  ruleId: string,
): KnowledgeRule | undefined {
  const id = nonEmpty(ruleId, "ruleId");

  for (const rule of rules) {
    if (rule.ruleId === id) {
      assertRuleIntegrity(rule);
      return rule;
    }
  }

  return undefined;
}

export function findRulesByType(
  rules: readonly KnowledgeRule[],
  type: KnowledgeRuleType,
): readonly KnowledgeRule[] {
  const expectedType = normalizeRuleType(type);

  return Object.freeze(
    rules
      .filter((rule) => {
        assertRuleIntegrity(rule);
        return rule.type === expectedType;
      })
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
}

export function findRulesByEntity(
  rules: readonly KnowledgeRule[],
  entityId: EntityId,
): readonly KnowledgeRule[] {
  const id = nonEmpty(String(entityId), "entityId");

  return Object.freeze(
    rules
      .filter((rule) => {
        assertRuleIntegrity(rule);
        return rule.subjectEntityIds.some(
          (candidate) => String(candidate) === id,
        );
      })
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
}

export function findRulesByCondition(
  rules: readonly KnowledgeRule[],
  conditionId: string,
): readonly KnowledgeRule[] {
  const id = nonEmpty(conditionId, "conditionId");

  return Object.freeze(
    rules
      .filter((rule) => {
        assertRuleIntegrity(rule);
        return rule.conditionIds.includes(id);
      })
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
}

export function findRulesByConstraint(
  rules: readonly KnowledgeRule[],
  constraintId: string,
): readonly KnowledgeRule[] {
  const id = nonEmpty(constraintId, "constraintId");

  return Object.freeze(
    rules
      .filter((rule) => {
        assertRuleIntegrity(rule);
        return rule.constraintIds.includes(id);
      })
      .sort((left, right) => left.ruleId.localeCompare(right.ruleId)),
  );
}

/**
 * Build a deterministic index.
 * The same ID with different fingerprints is a hard conflict.
 */
export function indexRules(
  rules: readonly KnowledgeRule[],
): ReadonlyMap<string, KnowledgeRule> {
  const result = new Map<string, KnowledgeRule>();

  for (const rule of rules) {
    assertRuleIntegrity(rule);

    const existing = result.get(rule.ruleId);

    if (existing === undefined) {
      result.set(rule.ruleId, rule);
      continue;
    }

    if (existing.fingerprint !== rule.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_RULE_INDEX_CONFLICT: "${rule.ruleId}" has conflicting fingerprints.`,
      );
    }
  }

  return result;
}

/**
 * Deduplicate identical records and return canonical ID order.
 */
export function deduplicateRules(
  rules: readonly KnowledgeRule[],
): readonly KnowledgeRule[] {
  const indexed = indexRules(rules);

  return Object.freeze(
    [...indexed.values()].sort((left, right) =>
      left.ruleId.localeCompare(right.ruleId),
    ),
  );
}

/**
 * Reject different rule IDs representing the same semantic identity.
 */
export function assertNoRuleConflicts(
  rules: readonly KnowledgeRule[],
): void {
  const identities = new Map<string, KnowledgeRule>();

  for (const rule of rules) {
    assertRuleIntegrity(rule);

    const identity = ruleIdentity({
      type: rule.type,
      name: rule.name,
      statement: rule.statement,
      conditionIds: rule.conditionIds,
      constraintIds: rule.constraintIds,
      exceptionIds: rule.exceptionIds,
      failureModeIds: rule.failureModeIds,
      subjectEntityIds: rule.subjectEntityIds,
      applicability: rule.applicability,
    });

    const previous = identities.get(identity);

    if (previous === undefined) {
      identities.set(identity, rule);
      continue;
    }

    if (previous.ruleId !== rule.ruleId) {
      throw new Error(
        `V8_KNOWLEDGE_RULE_ID_CONFLICT: semantic identity maps to "${previous.ruleId}" and "${rule.ruleId}".`,
      );
    }

    if (previous.fingerprint !== rule.fingerprint) {
      throw new Error(
        `V8_KNOWLEDGE_RULE_FINGERPRINT_CONFLICT: "${rule.ruleId}" has inconsistent payloads.`,
      );
    }
  }
}

/**
 * Compute a deterministic collection fingerprint.
 */
export function fingerprintRules(
  rules: readonly KnowledgeRule[],
): Fingerprint {
  const canonicalRules = deduplicateRules(rules).map((rule) => ({
    ruleId: rule.ruleId,
    fingerprint: String(rule.fingerprint),
  }));

  return fingerprint(
    `${RULE_FINGERPRINT_PREFIX}collection:${hashCanonical(canonicalRules)}`,
  );
}

/**
 * Build a validated, immutable collection.
 */
export function buildRuleCollection(
  rules: readonly KnowledgeRule[],
): RuleCollection {
  const canonicalRules = deduplicateRules(rules);

  assertNoRuleConflicts(canonicalRules);

  return Object.freeze({
    rules: canonicalRules,
    fingerprint: fingerprintRules(canonicalRules),
  });
}

/**
 * A replacement may update provenance or confidence, but may not
 * silently change the deterministic rule identity.
 */
export function assertRuleReplacementSafe(
  current: KnowledgeRule,
  replacement: KnowledgeRule,
): void {
  assertRuleIntegrity(current);
  assertRuleIntegrity(replacement);

  if (current.ruleId !== replacement.ruleId) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_REPLACEMENT_ID_CHANGE: replacement changes ID from "${current.ruleId}" to "${replacement.ruleId}".`,
    );
  }

  if (!sameRuleIdentity(current, replacement)) {
    throw new Error(
      `V8_KNOWLEDGE_RULE_REPLACEMENT_IDENTITY_CHANGE: "${current.ruleId}" changes semantic identity.`,
    );
  }
}

/**
 * Return a detached immutable snapshot.
 */
export function cloneRule(rule: KnowledgeRule): KnowledgeRule {
  assertRuleIntegrity(rule);

  return Object.freeze({
    ...rule,
    conditionIds: Object.freeze([...rule.conditionIds]),
    constraintIds: Object.freeze([...rule.constraintIds]),
    exceptionIds: Object.freeze([...rule.exceptionIds]),
    failureModeIds: Object.freeze([...rule.failureModeIds]),
    subjectEntityIds: Object.freeze([...rule.subjectEntityIds]),
    evidenceIds: Object.freeze([...rule.evidenceIds]),
    claimIds: Object.freeze([...rule.claimIds]),
  });
}

export function collectRuleEntityIds(
  rules: readonly KnowledgeRule[],
): readonly EntityId[] {
  return Object.freeze([
    ...sortedUnique(
      rules.flatMap((rule) => {
        assertRuleIntegrity(rule);
        return rule.subjectEntityIds;
      }),
    ),
  ] as EntityId[]);
}

export function collectRuleEvidenceIds(
  rules: readonly KnowledgeRule[],
): readonly EvidenceId[] {
  return Object.freeze([
    ...sortedUnique(
      rules.flatMap((rule) => {
        assertRuleIntegrity(rule);
        return rule.evidenceIds;
      }),
    ),
  ] as EvidenceId[]);
}

export function collectRuleClaimIds(
  rules: readonly KnowledgeRule[],
): readonly ClaimId[] {
  return Object.freeze([
    ...sortedUnique(
      rules.flatMap((rule) => {
        assertRuleIntegrity(rule);
        return rule.claimIds;
      }),
    ),
  ] as ClaimId[]);
}

export const RULE_MODEL_DEFAULTS = Object.freeze({
  modelVersion: MODEL_VERSION,
  idPrefix: RULE_ID_PREFIX,
  fingerprintPrefix: RULE_FINGERPRINT_PREFIX,
  deterministicIdentity: true,
  immutableOutput: true,
  failClosed: true,
  preservesEvidenceLineage: true,
  preservesClaimLineage: true,
});