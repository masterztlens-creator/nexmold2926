
import {
  nonEmpty,
  sortedUnique,
  type ClaimId,
  type EntityId,
  type EvidenceId,
  type KnowledgeId,
} from "../../domain/primitives.js";

import {
  assertEntityIntegrity,
} from "./entity-model.js";

import {
  assertPropertyIntegrity,
} from "./property-model.js";

import {
  assertRelationshipIntegrity,
} from "./relationship-model.js";

import {
  assertConditionIntegrity,
} from "./condition-model.js";

import {
  assertConstraintIntegrity,
} from "./constraint-model.js";

import {
  assertExceptionIntegrity,
} from "./exception-model.js";

import {
  assertFailureModeIntegrity,
} from "./failure-mode.js";

import {
  assertRuleIntegrity,
} from "./rule-model.js";

import {
  foundationKnowledgePayloadShape,
  type IntelligenceKnowledge,
  type KnowledgeIntegrityOptions,
  type KnowledgeValidationIssue,
  type KnowledgeValidationReport,
} from "./types.js";

/**
 * NEXMOLD V8 — Knowledge Validator
 *
 * Phase 2.7
 *
 * Responsibilities:
 * - fail-closed validation of IntelligenceKnowledge;
 * - semantic model integrity verification;
 * - cross-model reference validation;
 * - canonical Evidence / Claim lineage checks;
 * - Foundation KnowledgePayload consistency checks;
 * - conditional and contextual applicability checks;
 * - deterministic validation reports.
 *
 * This module does not create truth, verify source Evidence,
 * approve Claims, authorize publication, or mutate Knowledge.
 */

const VALIDATOR_VERSION = 1 as const;

type IssueSeverity = KnowledgeValidationIssue["severity"];

interface ValidationContext {
  readonly knowledge: IntelligenceKnowledge;
  readonly options: Required<KnowledgeIntegrityOptions>;
  readonly issues: KnowledgeValidationIssue[];
}

const DEFAULT_OPTIONS: Required<KnowledgeIntegrityOptions> =
  Object.freeze({
    requireEvidence: true,
    requireClaims: true,
    requireFoundationPayload: true,
    requireScopeForConditional: true,
    requireContextForContextual: true,
    rejectUnknown: false,
  });

function addIssue(
  context: ValidationContext,
  code: string,
  message: string,
  path: string,
  severity: IssueSeverity = "ERROR",
): void {
  context.issues.push(
    Object.freeze({
      code,
      message,
      path,
      severity,
    }),
  );
}

function safeNonEmpty(
  value: unknown,
  field: string,
): boolean {
  try {
    nonEmpty(String(value), field);
    return true;
  } catch {
    return false;
  }
}

function validateRequiredString(
  context: ValidationContext,
  value: unknown,
  path: string,
): void {
  if (typeof value !== "string" || !safeNonEmpty(value, path)) {
    addIssue(
      context,
      "V8_KNOWLEDGE_REQUIRED_VALUE_MISSING",
      `Required non-empty value is missing at "${path}".`,
      path,
    );
  }
}

function validateUniqueIds(
  context: ValidationContext,
  values: readonly string[],
  path: string,
): void {
  if (!Array.isArray(values)) {
    addIssue(
      context,
      "V8_KNOWLEDGE_INVALID_ID_COLLECTION",
      `Expected an array of identifiers at "${path}".`,
      path,
    );
    return;
  }

  const normalized: string[] = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];

    if (typeof value !== "string" || !safeNonEmpty(value, path)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_INVALID_IDENTIFIER",
        `Identifier at "${path}[${index}]" must be a non-empty string.`,
        `${path}[${index}]`,
      );
      continue;
    }

    normalized.push(value);
  }

  if (sortedUnique(normalized).length !== normalized.length) {
    addIssue(
      context,
      "V8_KNOWLEDGE_DUPLICATE_IDENTIFIER",
      `Duplicate identifiers were found at "${path}".`,
      path,
    );
  }
}

function validateEvidenceAndClaimLineage(
  context: ValidationContext,
): void {
  const knowledge = context.knowledge;

  validateUniqueIds(
    context,
    knowledge.claimIds as readonly string[],
    "claimIds",
  );

  validateUniqueIds(
    context,
    knowledge.evidenceIds as readonly string[],
    "evidenceIds",
  );

  validateUniqueIds(
    context,
    knowledge.lineage.claimIds as readonly string[],
    "lineage.claimIds",
  );

  validateUniqueIds(
    context,
    knowledge.lineage.evidenceIds as readonly string[],
    "lineage.evidenceIds",
  );

  validateUniqueIds(
    context,
    knowledge.evidenceClosure.claimIds as readonly string[],
    "evidenceClosure.claimIds",
  );

  validateUniqueIds(
    context,
    knowledge.evidenceClosure.evidenceIds as readonly string[],
    "evidenceClosure.evidenceIds",
  );

  if (
    context.options.requireClaims &&
    knowledge.claimIds.length === 0
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_CLAIM_LINEAGE_REQUIRED",
      "At least one Claim identifier is required.",
      "claimIds",
    );
  }

  if (
    context.options.requireEvidence &&
    knowledge.evidenceIds.length === 0
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_EVIDENCE_LINEAGE_REQUIRED",
      "At least one Evidence identifier is required.",
      "evidenceIds",
    );
  }

  if (
    String(knowledge.lineage.knowledgeId) !==
    String(knowledge.knowledgeId)
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_LINEAGE_ID_MISMATCH",
      "Lineage knowledgeId does not match the canonical Knowledge identifier.",
      "lineage.knowledgeId",
    );
  }

  if (
    String(knowledge.evidenceClosure.knowledgeId) !==
    String(knowledge.knowledgeId)
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_EVIDENCE_CLOSURE_ID_MISMATCH",
      "Evidence closure knowledgeId does not match the canonical Knowledge identifier.",
      "evidenceClosure.knowledgeId",
    );
  }

  const claimSets = [
    {
      path: "lineage.claimIds",
      ids: knowledge.lineage.claimIds,
    },
    {
      path: "evidenceClosure.claimIds",
      ids: knowledge.evidenceClosure.claimIds,
    },
  ];

  for (const claimSet of claimSets) {
    const actual = [...claimSet.ids].map(String).sort();
    const canonical = [...knowledge.claimIds].map(String).sort();

    if (
      actual.length !== canonical.length ||
      actual.some((id, index) => id !== canonical[index])
    ) {
      addIssue(
        context,
        "V8_KNOWLEDGE_CLAIM_LINEAGE_MISMATCH",
        `Claim identifiers at "${claimSet.path}" do not match canonical Knowledge lineage.`,
        claimSet.path,
      );
    }
  }

  const evidenceSets = [
    {
      path: "lineage.evidenceIds",
      ids: knowledge.lineage.evidenceIds,
    },
    {
      path: "evidenceClosure.evidenceIds",
      ids: knowledge.evidenceClosure.evidenceIds,
    },
  ];

  for (const evidenceSet of evidenceSets) {
    const actual = [...evidenceSet.ids].map(String).sort();
    const canonical = [...knowledge.evidenceIds].map(String).sort();

    if (
      actual.length !== canonical.length ||
      actual.some((id, index) => id !== canonical[index])
    ) {
      addIssue(
        context,
        "V8_KNOWLEDGE_EVIDENCE_LINEAGE_MISMATCH",
        `Evidence identifiers at "${evidenceSet.path}" do not match canonical Knowledge lineage.`,
        evidenceSet.path,
      );
    }
  }

  const canonicalClaims = new Set(
    knowledge.claimIds.map(String),
  );
  const canonicalEvidence = new Set(
    knowledge.evidenceIds.map(String),
  );

  for (const [index, property] of knowledge.properties.entries()) {
    for (const claimId of property.claimIds) {
      if (!canonicalClaims.has(String(claimId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_PROPERTY_CLAIM_OUTSIDE_LINEAGE",
          `Property references Claim "${claimId}" outside the canonical Knowledge lineage.`,
          `properties[${index}].claimIds`,
        );
      }
    }

    for (const evidenceId of property.evidenceIds) {
      if (!canonicalEvidence.has(String(evidenceId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_PROPERTY_EVIDENCE_OUTSIDE_LINEAGE",
          `Property references Evidence "${evidenceId}" outside the canonical Knowledge lineage.`,
          `properties[${index}].evidenceIds`,
        );
      }
    }
  }

  for (
    const [index, relationship] of
    knowledge.relationships.entries()
  ) {
    for (const claimId of relationship.claimIds) {
      if (!canonicalClaims.has(String(claimId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_RELATIONSHIP_CLAIM_OUTSIDE_LINEAGE",
          `Relationship references Claim "${claimId}" outside the canonical Knowledge lineage.`,
          `relationships[${index}].claimIds`,
        );
      }
    }

    for (const evidenceId of relationship.evidenceIds) {
      if (!canonicalEvidence.has(String(evidenceId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_RELATIONSHIP_EVIDENCE_OUTSIDE_LINEAGE",
          `Relationship references Evidence "${evidenceId}" outside the canonical Knowledge lineage.`,
          `relationships[${index}].evidenceIds`,
        );
      }
    }
  }

  /*
   * Phase 2.7 lineage completion:
   * Every semantic model that carries Claim/Evidence references must
   * remain inside the canonical Knowledge lineage.
   *
   * Out-of-lineage references are ERROR issues. They cannot be
   * downgraded to warnings by the validator options.
   */
  const lineageBearingModels = [
    {
      label: "Constraint",
      path: "constraints",
      records: knowledge.constraints,
    },
    {
      label: "Exception",
      path: "exceptions",
      records: knowledge.exceptions,
    },
    {
      label: "FailureMode",
      path: "failureModes",
      records: knowledge.failureModes,
    },
    {
      label: "Rule",
      path: "rules",
      records: knowledge.rules,
    },
  ] as const;

  for (const model of lineageBearingModels) {
    for (const [index, record] of model.records.entries()) {
      for (const claimId of record.claimIds) {
        if (!canonicalClaims.has(String(claimId))) {
          addIssue(
            context,
            `V8_KNOWLEDGE_${model.label.toUpperCase()}_CLAIM_OUTSIDE_LINEAGE`,
            `${model.label} references Claim "${claimId}" outside the canonical Knowledge lineage.`,
            `${model.path}[${index}].claimIds`,
          );
        }
      }

      for (const evidenceId of record.evidenceIds) {
        if (!canonicalEvidence.has(String(evidenceId))) {
          addIssue(
            context,
            `V8_KNOWLEDGE_${model.label.toUpperCase()}_EVIDENCE_OUTSIDE_LINEAGE`,
            `${model.label} references Evidence "${evidenceId}" outside the canonical Knowledge lineage.`,
            `${model.path}[${index}].evidenceIds`,
          );
        }
      }
    }
  }
}

function validateFoundationPayload(
  context: ValidationContext,
): void {
  const knowledge = context.knowledge;

  if (
    knowledge.foundationPayload === null ||
    typeof knowledge.foundationPayload !== "object"
  ) {
    if (context.options.requireFoundationPayload) {
      addIssue(
        context,
        "V8_KNOWLEDGE_FOUNDATION_PAYLOAD_REQUIRED",
        "Canonical Foundation KnowledgePayload is required.",
        "foundationPayload",
      );
    }

    return;
  }

  try {
    foundationKnowledgePayloadShape(
      knowledge.foundationPayload,
    );
  } catch (error: unknown) {
    addIssue(
      context,
      "V8_KNOWLEDGE_FOUNDATION_PAYLOAD_INVALID",
      error instanceof Error
        ? error.message
        : "Foundation KnowledgePayload failed structural validation.",
      "foundationPayload",
    );
    return;
  }

  const payload = knowledge.foundationPayload as unknown as {
    proposition?: unknown;
  };

  if (
    typeof payload.proposition !== "string" ||
    typeof knowledge.proposition !== "string" ||
    payload.proposition !== knowledge.proposition
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_FOUNDATION_PROPOSITION_MISMATCH",
      "Foundation proposition does not exactly match the canonical Knowledge proposition.",
      "foundationPayload.proposition",
    );
  }
}

function validateApplicability(
  context: ValidationContext,
): void {
  const knowledge = context.knowledge;

  if (
    context.options.requireScopeForConditional &&
    knowledge.applicability === "CONDITIONAL" &&
    knowledge.scopeId === undefined
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_CONDITIONAL_SCOPE_REQUIRED",
      "Conditional Knowledge requires an explicit scope.",
      "scopeId",
    );
  }

  if (
    context.options.requireContextForContextual &&
    knowledge.applicability === "CONTEXTUAL" &&
    knowledge.contextId === undefined
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_CONTEXT_REQUIRED",
      "Contextual Knowledge requires an explicit context.",
      "contextId",
    );
  }

  if (
    context.options.rejectUnknown &&
    (
      knowledge.truthState === "UNKNOWN" ||
      knowledge.truthState === "INSUFFICIENT_EVIDENCE" ||
      knowledge.truthState === "CONFLICTING" ||
      knowledge.truthState === "REJECTED" ||
      knowledge.applicability === "UNKNOWN"
    )
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_UNKNOWN_STATE_REJECTED",
      "Knowledge has an unresolved or non-approvable truth/applicability state.",
      "truthState",
    );
  }
}

function validateSemanticModels(
  context: ValidationContext,
): void {
  const knowledge = context.knowledge;

  const entities = new Map<string, number>();
  const properties = new Map<string, number>();
  const conditions = new Map<string, number>();
  const constraints = new Map<string, number>();
  const exceptions = new Map<string, number>();
  const failureModes = new Map<string, number>();
  const rules = new Map<string, number>();

  const run = (
    path: string,
    operation: () => void,
  ): void => {
    try {
      operation();
    } catch (error: unknown) {
      addIssue(
        context,
        "V8_KNOWLEDGE_SEMANTIC_MODEL_INVALID",
        error instanceof Error
          ? error.message
          : "Semantic model integrity validation failed.",
        path,
      );
    }
  };

  for (const [index, entity] of knowledge.entities.entries()) {
    run(`entities[${index}]`, () => assertEntityIntegrity(entity));

    const id = String(entity.entityId);
    const existing = entities.get(id);

    if (existing !== undefined) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_ENTITY_ID",
        `Entity identifier "${id}" occurs more than once.`,
        `entities[${index}].entityId`,
      );
    } else {
      entities.set(id, index);
    }
  }

  for (const [index, property] of knowledge.properties.entries()) {
    run(`properties[${index}]`, () => assertPropertyIntegrity(property));

    const id = property.propertyId;

    if (properties.has(id)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_PROPERTY_ID",
        `Property identifier "${id}" occurs more than once.`,
        `properties[${index}].propertyId`,
      );
    } else {
      properties.set(id, index);
    }

    if (!entities.has(String(property.entityId))) {
      addIssue(
        context,
        "V8_KNOWLEDGE_PROPERTY_ENTITY_MISSING",
        `Property references missing Entity "${property.entityId}".`,
        `properties[${index}].entityId`,
      );
    }
  }

  for (
    const [index, relationship] of
    knowledge.relationships.entries()
  ) {
    run(`relationships[${index}]`, () =>
      assertRelationshipIntegrity(relationship),
    );

    if (!entities.has(String(relationship.fromEntityId))) {
      addIssue(
        context,
        "V8_KNOWLEDGE_RELATIONSHIP_SOURCE_MISSING",
        `Relationship source Entity "${relationship.fromEntityId}" does not exist.`,
        `relationships[${index}].fromEntityId`,
      );
    }

    if (!entities.has(String(relationship.toEntityId))) {
      addIssue(
        context,
        "V8_KNOWLEDGE_RELATIONSHIP_TARGET_MISSING",
        `Relationship target Entity "${relationship.toEntityId}" does not exist.`,
        `relationships[${index}].toEntityId`,
      );
    }

    for (const conditionId of relationship.conditions) {
      if (
        !knowledge.conditions.some(
          (condition) => condition.conditionId === conditionId,
        )
      ) {
        addIssue(
          context,
          "V8_KNOWLEDGE_RELATIONSHIP_CONDITION_MISSING",
          `Relationship references missing Condition "${conditionId}".`,
          `relationships[${index}].conditions`,
        );
      }
    }
  }

  for (const [index, condition] of knowledge.conditions.entries()) {
    run(`conditions[${index}]`, () => assertConditionIntegrity(condition));

    if (
      condition.subjectEntityId !== undefined &&
      !entities.has(String(condition.subjectEntityId))
    ) {
      addIssue(
        context,
        "V8_KNOWLEDGE_CONDITION_ENTITY_MISSING",
        `Condition references missing Entity "${condition.subjectEntityId}".`,
        `conditions[${index}].subjectEntityId`,
      );
    }

    if (
      condition.propertyId !== undefined &&
      !properties.has(condition.propertyId)
    ) {
      addIssue(
        context,
        "V8_KNOWLEDGE_CONDITION_PROPERTY_MISSING",
        `Condition references missing Property "${condition.propertyId}".`,
        `conditions[${index}].propertyId`,
      );
    }

    const id = condition.conditionId;

    if (conditions.has(id)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_CONDITION_ID",
        `Condition identifier "${id}" occurs more than once.`,
        `conditions[${index}].conditionId`,
      );
    } else {
      conditions.set(id, index);
    }
  }

  for (
    const [index, constraint] of
    knowledge.constraints.entries()
  ) {
    run(`constraints[${index}]`, () =>
      assertConstraintIntegrity(constraint),
    );

    for (const entityId of constraint.subjectEntityIds) {
      if (!entities.has(String(entityId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_CONSTRAINT_ENTITY_MISSING",
          `Constraint references missing Entity "${entityId}".`,
          `constraints[${index}].subjectEntityIds`,
        );
      }
    }

    for (const conditionId of constraint.conditionIds) {
      if (!conditions.has(conditionId)) {
        addIssue(
          context,
          "V8_KNOWLEDGE_CONSTRAINT_CONDITION_MISSING",
          `Constraint references missing Condition "${conditionId}".`,
          `constraints[${index}].conditionIds`,
        );
      }
    }

    for (const propertyId of [
      ...constraint.requiredPropertyIds,
      ...constraint.forbiddenPropertyIds,
    ]) {
      if (!properties.has(propertyId)) {
        addIssue(
          context,
          "V8_KNOWLEDGE_CONSTRAINT_PROPERTY_MISSING",
          `Constraint references missing Property "${propertyId}".`,
          `constraints[${index}].requiredPropertyIds`,
        );
      }
    }

    const id = constraint.constraintId;

    if (constraints.has(id)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_CONSTRAINT_ID",
        `Constraint identifier "${id}" occurs more than once.`,
        `constraints[${index}].constraintId`,
      );
    } else {
      constraints.set(id, index);
    }
  }

  for (
    const [index, exception] of
    knowledge.exceptions.entries()
  ) {
    run(`exceptions[${index}]`, () =>
      assertExceptionIntegrity(exception),
    );

    for (const entityId of exception.subjectEntityIds) {
      if (!entities.has(String(entityId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_EXCEPTION_ENTITY_MISSING",
          `Exception references missing Entity "${entityId}".`,
          `exceptions[${index}].subjectEntityIds`,
        );
      }
    }

    for (const conditionId of exception.conditionIds) {
      if (!conditions.has(conditionId)) {
        addIssue(
          context,
          "V8_KNOWLEDGE_EXCEPTION_CONDITION_MISSING",
          `Exception references missing Condition "${conditionId}".`,
          `exceptions[${index}].conditionIds`,
        );
      }
    }

    for (const constraintId of exception.overridesConstraintIds) {
      if (!constraints.has(constraintId)) {
        addIssue(
          context,
          "V8_KNOWLEDGE_EXCEPTION_CONSTRAINT_MISSING",
          `Exception overrides missing Constraint "${constraintId}".`,
          `exceptions[${index}].overridesConstraintIds`,
        );
      }
    }

    const id = exception.exceptionId;

    if (exceptions.has(id)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_EXCEPTION_ID",
        `Exception identifier "${id}" occurs more than once.`,
        `exceptions[${index}].exceptionId`,
      );
    } else {
      exceptions.set(id, index);
    }
  }

  for (
    const [index, failureMode] of
    knowledge.failureModes.entries()
  ) {
    run(`failureModes[${index}]`, () =>
      assertFailureModeIntegrity(failureMode),
    );

    for (const entityId of failureMode.subjectEntityIds) {
      if (!entities.has(String(entityId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_FAILURE_MODE_ENTITY_MISSING",
          `Failure mode references missing Entity "${entityId}".`,
          `failureModes[${index}].subjectEntityIds`,
        );
      }
    }

    for (const conditionId of failureMode.conditionIds) {
      if (!conditions.has(conditionId)) {
        addIssue(
          context,
          "V8_KNOWLEDGE_FAILURE_MODE_CONDITION_MISSING",
          `Failure mode references missing Condition "${conditionId}".`,
          `failureModes[${index}].conditionIds`,
        );
      }
    }

    const id = failureMode.failureModeId;

    if (failureModes.has(id)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_FAILURE_MODE_ID",
        `Failure-mode identifier "${id}" occurs more than once.`,
        `failureModes[${index}].failureModeId`,
      );
    } else {
      failureModes.set(id, index);
    }
  }

  for (const [index, rule] of knowledge.rules.entries()) {
    run(`rules[${index}]`, () => assertRuleIntegrity(rule));

    const references: readonly [
      readonly string[],
      ReadonlyMap<string, number>,
      string,
    ][] = [
      [rule.conditionIds, conditions, "condition"],
      [rule.constraintIds, constraints, "constraint"],
      [rule.exceptionIds, exceptions, "exception"],
      [rule.failureModeIds, failureModes, "failure mode"],
    ];

    for (const [ids, registry, label] of references) {
      for (const id of ids) {
        if (!registry.has(id)) {
          addIssue(
            context,
            "V8_KNOWLEDGE_RULE_REFERENCE_MISSING",
            `Rule references missing ${label} "${id}".`,
            `rules[${index}]`,
          );
        }
      }
    }

    for (const entityId of rule.subjectEntityIds) {
      if (!entities.has(String(entityId))) {
        addIssue(
          context,
          "V8_KNOWLEDGE_RULE_ENTITY_MISSING",
          `Rule references missing Entity "${entityId}".`,
          `rules[${index}].subjectEntityIds`,
        );
      }
    }

    const id = rule.ruleId;

    if (rules.has(id)) {
      addIssue(
        context,
        "V8_KNOWLEDGE_DUPLICATE_RULE_ID",
        `Rule identifier "${id}" occurs more than once.`,
        `rules[${index}].ruleId`,
      );
    } else {
      rules.set(id, index);
    }
  }
}

function validateTopLevel(
  context: ValidationContext,
): void {
  const knowledge = context.knowledge;

  validateRequiredString(
    context,
    knowledge.knowledgeId,
    "knowledgeId",
  );

  validateRequiredString(
    context,
    knowledge.proposition,
    "proposition",
  );

  validateRequiredString(
    context,
    knowledge.fingerprint,
    "fingerprint",
  );

  validateRequiredString(
    context,
    knowledge.lineage.fingerprint,
    "lineage.fingerprint",
  );

  validateRequiredString(
    context,
    knowledge.evidenceClosure.fingerprint,
    "evidenceClosure.fingerprint",
  );

  if (
    !Array.isArray(knowledge.entities) ||
    !Array.isArray(knowledge.properties) ||
    !Array.isArray(knowledge.relationships) ||
    !Array.isArray(knowledge.conditions) ||
    !Array.isArray(knowledge.constraints) ||
    !Array.isArray(knowledge.exceptions) ||
    !Array.isArray(knowledge.failureModes) ||
    !Array.isArray(knowledge.rules)
  ) {
    addIssue(
      context,
      "V8_KNOWLEDGE_INVALID_COLLECTIONS",
      "All semantic model collections must be arrays.",
      "knowledge",
    );
  }
}

/**
 * Validate one canonical IntelligenceKnowledge record.
 *
 * The validator reports structural and lineage defects. It does not
 * independently establish truth or replace upstream Evidence/Claim
 * verification.
 */
export function validateKnowledge(
  knowledge: IntelligenceKnowledge,
  options: KnowledgeIntegrityOptions = {},
): KnowledgeValidationReport {
  const issues: KnowledgeValidationIssue[] = [];

  const context: ValidationContext = {
    knowledge,
    options: {
      ...DEFAULT_OPTIONS,
      ...options,
    },
    issues,
  };

  try {
    if (
      knowledge === null ||
      typeof knowledge !== "object"
    ) {
      const invalid = Object.freeze([
        Object.freeze({
          code: "V8_KNOWLEDGE_INVALID_INPUT",
          message: "Knowledge must be a non-null object.",
          path: "knowledge",
          severity: "ERROR" as const,
        }),
      ]);

      return Object.freeze({
        valid: false,
        issues: invalid,
        knowledgeId: "" as KnowledgeId,
        fingerprint: "" as IntelligenceKnowledge["fingerprint"],
      });
    }

    validateTopLevel(context);
    validateSemanticModels(context);
    validateEvidenceAndClaimLineage(context);
    validateFoundationPayload(context);
    validateApplicability(context);
  } catch (error: unknown) {
    addIssue(
      context,
      "V8_KNOWLEDGE_VALIDATOR_FAIL_CLOSED",
      error instanceof Error
        ? error.message
        : "Unexpected validator failure.",
      "knowledge",
    );
  }

  const orderedIssues = Object.freeze(
    [...issues].sort((left, right) =>
      left.path.localeCompare(right.path) ||
      left.code.localeCompare(right.code) ||
      left.message.localeCompare(right.message),
    ),
  );

  return Object.freeze({
    valid: orderedIssues.every(
      (issue) => issue.severity !== "ERROR",
    ),
    issues: orderedIssues,
    knowledgeId: knowledge.knowledgeId,
    fingerprint: knowledge.fingerprint,
  });
}

/**
 * Throw when Knowledge fails integrity validation.
 *
 * Suitable for pipelines that must stop immediately on invalid
 * Knowledge rather than continuing with a report.
 */
export function assertKnowledgeValid(
  knowledge: IntelligenceKnowledge,
  options: KnowledgeIntegrityOptions = {},
): KnowledgeValidationReport {
  const report = validateKnowledge(knowledge, options);

  if (!report.valid) {
    const details = report.issues
      .filter((issue) => issue.severity === "ERROR")
      .map(
        (issue) =>
          `${issue.code} at ${issue.path}: ${issue.message}`,
      )
      .join("\n");

    throw new Error(
      `V8_KNOWLEDGE_VALIDATION_FAILED: ${String(report.knowledgeId)}\n${details}`,
    );
  }

  return report;
}

/**
 * Boolean convenience API.
 *
 * Exceptions and malformed inputs are treated as invalid.
 */
export function isKnowledgeValid(
  knowledge: IntelligenceKnowledge,
  options: KnowledgeIntegrityOptions = {},
): boolean {
  try {
    return validateKnowledge(knowledge, options).valid;
  } catch {
    return false;
  }
}

/**
 * Validate multiple Knowledge records without silently discarding
 * individual failures.
 */
export interface KnowledgeBatchValidationReport {
  readonly valid: boolean;
  readonly total: number;
  readonly validCount: number;
  readonly invalidCount: number;
  readonly reports: readonly KnowledgeValidationReport[];
}

export function validateKnowledgeBatch(
  knowledgeRecords: readonly IntelligenceKnowledge[],
  options: KnowledgeIntegrityOptions = {},
): KnowledgeBatchValidationReport {
  const reports = Object.freeze(
    knowledgeRecords.map((knowledge) =>
      validateKnowledge(knowledge, options),
    ),
  );

  const validCount = reports.filter(
    (report) => report.valid,
  ).length;

  return Object.freeze({
    valid: validCount === reports.length,
    total: reports.length,
    validCount,
    invalidCount: reports.length - validCount,
    reports,
  });
}

/**
 * Exposes the validator contract for diagnostics and test assertions.
 */
export const KNOWLEDGE_VALIDATOR_CONTRACT = Object.freeze({
  version: VALIDATOR_VERSION,
  failClosed: true,
  immutableReports: true,
  deterministicIssueOrdering: true,
  validatesSemanticModels: true,
  validatesCrossReferences: true,
  validatesEvidenceLineage: true,
  validatesClaimLineage: true,
  validatesFoundationProposition: true,
  establishesEngineeringTruth: false,
  authorizesPublication: false,
});
