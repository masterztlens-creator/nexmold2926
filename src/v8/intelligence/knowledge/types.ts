import type {
  ClaimId,
  EntityId,
  EvidenceId,
  Fingerprint,
  KnowledgeId,
  ScopeId,
  ContextId,
} from "../../domain/primitives.js";

import type {
  KnowledgePayload,
} from "../../foundation/types.js";

/**
 * NEXMOLD V8 — Knowledge Intelligence Type System
 *
 * Phase 2.1
 *
 * Design principles:
 *
 * 1. Knowledge never creates truth.
 *    It organizes and constrains already verified Claim lineage.
 *
 * 2. Knowledge must remain traceable to Foundation KnowledgePayload.
 *
 * 3. UNKNOWN is represented explicitly and must never be silently
 *    converted into a positive engineering assertion.
 *
 * 4. Engineering semantics are modeled structurally:
 *    Entity → Property → Relationship → Condition → Constraint
 *    → Exception → FailureMode → Rule.
 *
 * 5. Every semantic object carries deterministic identity material.
 *
 * 6. No type in this module is allowed to bypass Evidence / Claim /
 *    Foundation lineage.
 *
 * 7. Optional semantic dimensions remain optional at the type level,
 *    but validators in later Phase 2 modules may make them mandatory
 *    for specific knowledge classes.
 */

/* -------------------------------------------------------------------------- */
/* Primitive semantic states                                                   */
/* -------------------------------------------------------------------------- */

export type KnowledgeTruthState =
  | "VERIFIED"
  | "CONDITION_DEPENDENT"
  | "CONFLICTING"
  | "INSUFFICIENT_EVIDENCE"
  | "UNKNOWN"
  | "REJECTED";

export type KnowledgeLifecycle =
  | "PROPOSED"
  | "VALIDATED"
  | "APPROVED"
  | "REQUIRES_REVIEW"
  | "REJECTED"
  | "RETIRED";

export type KnowledgeConfidence =
  | "VERY_LOW"
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "VERY_HIGH";

export type KnowledgeApplicability =
  | "UNIVERSAL"
  | "CONDITIONAL"
  | "CONTEXTUAL"
  | "OUT_OF_SCOPE"
  | "UNKNOWN";

export type KnowledgePolarity =
  | "POSITIVE"
  | "NEGATIVE"
  | "NEUTRAL"
  | "UNKNOWN";

export type KnowledgeValueKind =
  | "TEXT"
  | "NUMBER"
  | "BOOLEAN"
  | "RANGE"
  | "ENUM"
  | "REFERENCE"
  | "MIXED"
  | "UNKNOWN";

/* -------------------------------------------------------------------------- */
/* Engineering semantic categories                                            */
/* -------------------------------------------------------------------------- */

export type KnowledgeEntityType =
  | "INDUSTRY"
  | "MARKET"
  | "COMPANY"
  | "PRODUCT"
  | "PROCESS"
  | "MATERIAL"
  | "MATERIAL_GRADE"
  | "MACHINE"
  | "TOOL"
  | "MOLD"
  | "COMPONENT"
  | "GEOMETRY"
  | "FEATURE"
  | "PARAMETER"
  | "PROPERTY"
  | "TEST_METHOD"
  | "TEST_CONDITION"
  | "APPLICATION"
  | "STANDARD"
  | "REGULATION"
  | "DEFECT"
  | "FAILURE_MODE"
  | "TOPIC"
  | "CONCEPT"
  | "OTHER";

export type KnowledgePropertyType =
  | "DIMENSION"
  | "MASS"
  | "TEMPERATURE"
  | "PRESSURE"
  | "FORCE"
  | "TIME"
  | "SPEED"
  | "RATE"
  | "RATIO"
  | "PERCENTAGE"
  | "STRENGTH"
  | "HARDNESS"
  | "VISCOSITY"
  | "SHRINKAGE"
  | "TOLERANCE"
  | "ROUGHNESS"
  | "COUNT"
  | "BOOLEAN"
  | "TEXT"
  | "ENUM"
  | "OTHER";

export type KnowledgeRelationshipType =
  | "IS_A"
  | "PART_OF"
  | "HAS_PART"
  | "HAS_PROPERTY"
  | "APPLIES_TO"
  | "DEPENDS_ON"
  | "AFFECTS"
  | "CAUSES"
  | "PREVENTS"
  | "REQUIRES"
  | "CONSTRAINS"
  | "CONDITIONED_BY"
  | "MEASURED_BY"
  | "TESTED_BY"
  | "COMPATIBLE_WITH"
  | "INCOMPATIBLE_WITH"
  | "ALTERNATIVE_TO"
  | "ASSOCIATED_WITH"
  | "PRODUCES"
  | "USED_IN"
  | "RESULTS_IN"
  | "MITIGATES"
  | "INDICATES"
  | "CONTRADICTS"
  | "SUPPORTS"
  | "OTHER";

export type KnowledgeConditionOperator =
  | "EQ"
  | "NEQ"
  | "GT"
  | "GTE"
  | "LT"
  | "LTE"
  | "IN"
  | "NOT_IN"
  | "BETWEEN"
  | "CONTAINS"
  | "NOT_CONTAINS"
  | "MATCHES"
  | "EXISTS"
  | "NOT_EXISTS";

export type KnowledgeConstraintType =
  | "REQUIRED"
  | "FORBIDDEN"
  | "MINIMUM"
  | "MAXIMUM"
  | "RANGE"
  | "ENUMERATION"
  | "COMPATIBILITY"
  | "EXCLUSIVITY"
  | "DEPENDENCY"
  | "SEQUENCE"
  | "SCOPE"
  | "CONTEXT"
  | "EVIDENCE"
  | "OTHER";

export type KnowledgeExceptionType =
  | "MATERIAL"
  | "GEOMETRY"
  | "PROCESS"
  | "EQUIPMENT"
  | "ENVIRONMENT"
  | "APPLICATION"
  | "TEST"
  | "SCOPE"
  | "CONTEXT"
  | "EVIDENCE"
  | "OTHER";

export type KnowledgeRuleType =
  | "THRESHOLD"
  | "RANGE"
  | "CONDITIONAL"
  | "COMPATIBILITY"
  | "PREVENTION"
  | "DIAGNOSTIC"
  | "SELECTION"
  | "PROCESS"
  | "DESIGN"
  | "VALIDATION"
  | "OTHER";

/* -------------------------------------------------------------------------- */
/* Semantic value                                                              */
/* -------------------------------------------------------------------------- */

export interface KnowledgeRangeValue {
  readonly kind: "RANGE";
  readonly minimum?: number;
  readonly maximum?: number;
  readonly inclusiveMinimum?: boolean;
  readonly inclusiveMaximum?: boolean;
  readonly unit?: string;
}

export interface KnowledgeScalarValue {
  readonly kind:
    | "TEXT"
    | "NUMBER"
    | "BOOLEAN"
    | "ENUM"
    | "REFERENCE";

  readonly value: string | number | boolean;
  readonly unit?: string;
  readonly normalizedValue?: string;
}

export type KnowledgeValue =
  | KnowledgeScalarValue
  | KnowledgeRangeValue;

export interface KnowledgeValueRef {
  readonly valueId: string;
  readonly value: KnowledgeValue;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Entity                                                                      */
/* -------------------------------------------------------------------------- */

export interface KnowledgeEntity {
  readonly entityId: EntityId;
  readonly type: KnowledgeEntityType;
  readonly name: string;
  readonly normalizedName: string;
  readonly aliases: readonly string[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Property                                                                    */
/* -------------------------------------------------------------------------- */

export interface KnowledgeProperty {
  readonly propertyId: string;
  readonly entityId: EntityId;
  readonly type: KnowledgePropertyType;
  readonly name: string;
  readonly normalizedName: string;
  readonly value?: KnowledgeValue;
  readonly unit?: string;
  readonly confidence: KnowledgeConfidence;
  readonly truthState: KnowledgeTruthState;
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Relationship                                                                */
/* -------------------------------------------------------------------------- */

export interface KnowledgeRelationship {
  readonly relationshipId: string;
  readonly fromEntityId: EntityId;
  readonly toEntityId: EntityId;
  readonly type: KnowledgeRelationshipType;
  readonly polarity: KnowledgePolarity;
  readonly confidence: KnowledgeConfidence;
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly conditions: readonly string[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Condition                                                                   */
/* -------------------------------------------------------------------------- */

export interface KnowledgeCondition {
  readonly conditionId: string;
  readonly subjectEntityId?: EntityId;
  readonly propertyId?: string;
  readonly operator: KnowledgeConditionOperator;
  readonly expected: KnowledgeValue;
  readonly unit?: string;
  readonly statement: string;
  readonly normalizedStatement: string;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Constraint                                                                  */
/* -------------------------------------------------------------------------- */

export interface KnowledgeConstraint {
  readonly constraintId: string;
  readonly type: KnowledgeConstraintType;
  readonly statement: string;
  readonly normalizedStatement: string;
  readonly subjectEntityIds: readonly EntityId[];
  readonly conditionIds: readonly string[];
  readonly requiredPropertyIds: readonly string[];
  readonly forbiddenPropertyIds: readonly string[];
  readonly scopeId?: ScopeId;
  readonly contextId?: ContextId;
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly confidence: KnowledgeConfidence;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Exception                                                                   */
/* -------------------------------------------------------------------------- */

export interface KnowledgeException {
  readonly exceptionId: string;
  readonly type: KnowledgeExceptionType;
  readonly statement: string;
  readonly normalizedStatement: string;
  readonly subjectEntityIds: readonly EntityId[];
  readonly conditionIds: readonly string[];
  readonly overridesConstraintIds: readonly string[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly confidence: KnowledgeConfidence;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Failure mode                                                                */
/* -------------------------------------------------------------------------- */

export type FailureSeverity =
  | "LOW"
  | "MEDIUM"
  | "HIGH"
  | "CRITICAL"
  | "UNKNOWN";

export type FailureLikelihood =
  | "RARE"
  | "UNLIKELY"
  | "POSSIBLE"
  | "LIKELY"
  | "ALMOST_CERTAIN"
  | "UNKNOWN";

export interface KnowledgeFailureMode {
  readonly failureModeId: string;
  readonly name: string;
  readonly normalizedName: string;
  readonly statement: string;
  readonly causes: readonly string[];
  readonly effects: readonly string[];
  readonly detectionSignals: readonly string[];
  readonly preventionMeasures: readonly string[];
  readonly severity: FailureSeverity;
  readonly likelihood: FailureLikelihood;
  readonly subjectEntityIds: readonly EntityId[];
  readonly conditionIds: readonly string[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly confidence: KnowledgeConfidence;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Rule                                                                        */
/* -------------------------------------------------------------------------- */

export interface KnowledgeRule {
  readonly ruleId: string;
  readonly type: KnowledgeRuleType;
  readonly name: string;
  readonly normalizedName: string;
  readonly statement: string;
  readonly conditionIds: readonly string[];
  readonly constraintIds: readonly string[];
  readonly exceptionIds: readonly string[];
  readonly failureModeIds: readonly string[];
  readonly subjectEntityIds: readonly EntityId[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly confidence: KnowledgeConfidence;
  readonly applicability: KnowledgeApplicability;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Knowledge graph                                                             */
/* -------------------------------------------------------------------------- */

export interface KnowledgeGraphNode {
  readonly nodeId: string;
  readonly nodeType:
    | "ENTITY"
    | "PROPERTY"
    | "RELATIONSHIP"
    | "CONDITION"
    | "CONSTRAINT"
    | "EXCEPTION"
    | "FAILURE_MODE"
    | "RULE"
    | "KNOWLEDGE";
  readonly fingerprint: Fingerprint;
}

export interface KnowledgeGraphEdge {
  readonly edgeId: string;
  readonly fromNodeId: string;
  readonly toNodeId: string;
  readonly relationship:
    | KnowledgeRelationshipType
    | "HAS_PROPERTY"
    | "HAS_CONDITION"
    | "HAS_CONSTRAINT"
    | "HAS_EXCEPTION"
    | "HAS_FAILURE_MODE"
    | "HAS_RULE"
    | "SUPPORTED_BY"
    | "DERIVED_FROM"
    | "SCOPED_BY"
    | "CONTEXTUALIZED_BY";
  readonly fingerprint: Fingerprint;
}

export interface KnowledgeGraph {
  readonly graphId: string;
  readonly nodes: readonly KnowledgeGraphNode[];
  readonly edges: readonly KnowledgeGraphEdge[];
  readonly knowledgeIds: readonly KnowledgeId[];
  readonly claimIds: readonly ClaimId[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Knowledge source closure                                                    */
/* -------------------------------------------------------------------------- */

export interface KnowledgeEvidenceClosure {
  readonly evidenceIds: readonly EvidenceId[];
  readonly claimIds: readonly ClaimId[];
  readonly knowledgeId: KnowledgeId;
  readonly fingerprint: Fingerprint;
}

export interface KnowledgeLineage {
  readonly knowledgeId: KnowledgeId;
  readonly claimIds: readonly ClaimId[];
  readonly evidenceIds: readonly EvidenceId[];
  readonly scopeId?: ScopeId;
  readonly contextId?: ContextId;
  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Canonical Knowledge Intelligence object                                    */
/* -------------------------------------------------------------------------- */

export interface IntelligenceKnowledge {
  readonly knowledgeId: KnowledgeId;

  /**
   * Canonical Foundation proposition.
   *
   * This must remain semantically compatible with KnowledgePayload.proposition.
   */
  readonly proposition: string;

  /**
   * Canonical Foundation Claim lineage.
   */
  readonly claimIds: readonly ClaimId[];

  /**
   * Direct evidence closure is explicit here even though Foundation
   * KnowledgePayload reaches Evidence through Claim.
   *
   * This is a derived index, not an alternate source of truth.
   */
  readonly evidenceIds: readonly EvidenceId[];

  readonly scopeId?: ScopeId;
  readonly contextId?: ContextId;

  readonly conditions: readonly KnowledgeCondition[];
  readonly constraints: readonly KnowledgeConstraint[];
  readonly exceptions: readonly KnowledgeException[];
  readonly failureModes: readonly KnowledgeFailureMode[];
  readonly rules: readonly KnowledgeRule[];

  readonly entities: readonly KnowledgeEntity[];
  readonly properties: readonly KnowledgeProperty[];
  readonly relationships: readonly KnowledgeRelationship[];

  readonly truthState: KnowledgeTruthState;
  readonly lifecycle: KnowledgeLifecycle;
  readonly confidence: KnowledgeConfidence;
  readonly applicability: KnowledgeApplicability;

  readonly polarity: KnowledgePolarity;

  /**
   * Foundation-compatible semantic payload.
   *
   * This is intentionally retained so downstream validators can verify
   * that Intelligence Knowledge never diverges from the canonical
   * Foundation Knowledge representation.
   */
  readonly foundationPayload: KnowledgePayload;

  readonly lineage: KnowledgeLineage;
  readonly evidenceClosure: KnowledgeEvidenceClosure;

  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Input contracts                                                             */
/* -------------------------------------------------------------------------- */

export interface CreateKnowledgeEntityInput {
  readonly entityId: EntityId;
  readonly type: KnowledgeEntityType;
  readonly name: string;
  readonly aliases?: readonly string[];
}

export interface CreateKnowledgePropertyInput {
  readonly propertyId: string;
  readonly entityId: EntityId;
  readonly type: KnowledgePropertyType;
  readonly name: string;
  readonly value?: KnowledgeValue;
  readonly unit?: string;
  readonly confidence?: KnowledgeConfidence;
  readonly truthState?: KnowledgeTruthState;
  readonly evidenceIds?: readonly EvidenceId[];
  readonly claimIds?: readonly ClaimId[];
}

export interface CreateKnowledgeRelationshipInput {
  readonly relationshipId: string;
  readonly fromEntityId: EntityId;
  readonly toEntityId: EntityId;
  readonly type: KnowledgeRelationshipType;
  readonly polarity?: KnowledgePolarity;
  readonly confidence?: KnowledgeConfidence;
  readonly evidenceIds?: readonly EvidenceId[];
  readonly claimIds?: readonly ClaimId[];
  readonly conditions?: readonly string[];
}

export interface CreateKnowledgeConditionInput {
  readonly conditionId: string;
  readonly subjectEntityId?: EntityId;
  readonly propertyId?: string;
  readonly operator: KnowledgeConditionOperator;
  readonly expected: KnowledgeValue;
  readonly unit?: string;
  readonly statement: string;
}

export interface CreateKnowledgeConstraintInput {
  readonly constraintId: string;
  readonly type: KnowledgeConstraintType;
  readonly statement: string;
  readonly subjectEntityIds?: readonly EntityId[];
  readonly conditionIds?: readonly string[];
  readonly requiredPropertyIds?: readonly string[];
  readonly forbiddenPropertyIds?: readonly string[];
  readonly scopeId?: ScopeId;
  readonly contextId?: ContextId;
  readonly evidenceIds?: readonly EvidenceId[];
  readonly claimIds?: readonly ClaimId[];
  readonly confidence?: KnowledgeConfidence;
}

export interface CreateKnowledgeExceptionInput {
  readonly exceptionId: string;
  readonly type: KnowledgeExceptionType;
  readonly statement: string;
  readonly subjectEntityIds?: readonly EntityId[];
  readonly conditionIds?: readonly string[];
  readonly overridesConstraintIds?: readonly string[];
  readonly evidenceIds?: readonly EvidenceId[];
  readonly claimIds?: readonly ClaimId[];
  readonly confidence?: KnowledgeConfidence;
}

export interface CreateKnowledgeFailureModeInput {
  readonly failureModeId: string;
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
  readonly evidenceIds?: readonly EvidenceId[];
  readonly claimIds?: readonly ClaimId[];
  readonly confidence?: KnowledgeConfidence;
}

export interface CreateKnowledgeRuleInput {
  readonly ruleId: string;
  readonly type: KnowledgeRuleType;
  readonly name: string;
  readonly statement: string;
  readonly conditionIds?: readonly string[];
  readonly constraintIds?: readonly string[];
  readonly exceptionIds?: readonly string[];
  readonly failureModeIds?: readonly string[];
  readonly subjectEntityIds?: readonly EntityId[];
  readonly evidenceIds?: readonly EvidenceId[];
  readonly claimIds?: readonly ClaimId[];
  readonly confidence?: KnowledgeConfidence;
  readonly applicability?: KnowledgeApplicability;
}

export interface CreateIntelligenceKnowledgeInput {
  readonly knowledgeId: KnowledgeId;
  readonly proposition: string;
  readonly claimIds: readonly ClaimId[];
  readonly evidenceIds: readonly EvidenceId[];

  readonly scopeId?: ScopeId;
  readonly contextId?: ContextId;

  readonly conditions?: readonly CreateKnowledgeConditionInput[];
  readonly constraints?: readonly CreateKnowledgeConstraintInput[];
  readonly exceptions?: readonly CreateKnowledgeExceptionInput[];
  readonly failureModes?: readonly CreateKnowledgeFailureModeInput[];
  readonly rules?: readonly CreateKnowledgeRuleInput[];

  readonly entities?: readonly CreateKnowledgeEntityInput[];
  readonly properties?: readonly CreateKnowledgePropertyInput[];
  readonly relationships?: readonly CreateKnowledgeRelationshipInput[];

  readonly truthState?: KnowledgeTruthState;
  readonly lifecycle?: KnowledgeLifecycle;
  readonly confidence?: KnowledgeConfidence;
  readonly applicability?: KnowledgeApplicability;
  readonly polarity?: KnowledgePolarity;

  readonly foundationPayload: KnowledgePayload;
}

/* -------------------------------------------------------------------------- */
/* Validation contracts                                                        */
/* -------------------------------------------------------------------------- */

export interface KnowledgeValidationIssue {
  readonly code: string;
  readonly message: string;
  readonly path: string;
  readonly severity: "ERROR" | "WARNING";
}

export interface KnowledgeValidationReport {
  readonly valid: boolean;
  readonly issues: readonly KnowledgeValidationIssue[];
  readonly knowledgeId: KnowledgeId;
  readonly fingerprint: Fingerprint;
}

export interface KnowledgeIntegrityOptions {
  readonly requireEvidence?: boolean;
  readonly requireClaims?: boolean;
  readonly requireFoundationPayload?: boolean;
  readonly requireScopeForConditional?: boolean;
  readonly requireContextForContextual?: boolean;
  readonly rejectUnknown?: boolean;
}

/* -------------------------------------------------------------------------- */
/* Collection / graph contracts                                                */
/* -------------------------------------------------------------------------- */

export interface KnowledgeFilter {
  readonly knowledgeIds?: readonly KnowledgeId[];
  readonly claimIds?: readonly ClaimId[];
  readonly evidenceIds?: readonly EvidenceId[];
  readonly truthStates?: readonly KnowledgeTruthState[];
  readonly lifecycles?: readonly KnowledgeLifecycle[];
  readonly applicability?: readonly KnowledgeApplicability[];
  readonly confidence?: readonly KnowledgeConfidence[];
  readonly entityIds?: readonly EntityId[];
  readonly scopeIds?: readonly ScopeId[];
  readonly contextIds?: readonly ContextId[];
}

export interface KnowledgeSummary {
  readonly total: number;
  readonly verified: number;
  readonly conditional: number;
  readonly conflicting: number;
  readonly insufficientEvidence: number;
  readonly unknown: number;
  readonly rejected: number;
  readonly approved: number;
  readonly requiresReview: number;
  readonly retired: number;
}

export interface KnowledgeRanking {
  readonly knowledgeId: KnowledgeId;
  readonly score: number;
  readonly evidenceCount: number;
  readonly claimCount: number;
  readonly confidence: KnowledgeConfidence;
  readonly applicability: KnowledgeApplicability;
}

/* -------------------------------------------------------------------------- */
/* Phase 2 invariants                                                          */
/* -------------------------------------------------------------------------- */

export interface KnowledgeInvariant {
  readonly code:
    | "EVIDENCE_REQUIRED"
    | "CLAIM_REQUIRED"
    | "CLAIM_EVIDENCE_CLOSURE"
    | "FOUNDATION_PAYLOAD_MATCH"
    | "SCOPE_REQUIRED"
    | "CONTEXT_REQUIRED"
    | "CONDITION_REQUIRED"
    | "CONSTRAINT_REQUIRED"
    | "EXCEPTION_REQUIRED"
    | "NO_UNKNOWN_APPROVAL"
    | "NO_CONFLICTED_APPROVAL"
    | "DETERMINISTIC_IDENTITY"
    | "IMMUTABLE_FINGERPRINT";

  readonly description: string;
}

/**
 * The canonical Phase 2.1 invariant set.
 *
 * These are declarations only.
 * Enforcement belongs to validator.ts.
 */
export const KNOWLEDGE_INVARIANTS: readonly KnowledgeInvariant[] = [
  {
    code: "EVIDENCE_REQUIRED",
    description:
      "Knowledge must retain a non-empty evidence closure.",
  },
  {
    code: "CLAIM_REQUIRED",
    description:
      "Knowledge must retain a non-empty Claim lineage.",
  },
  {
    code: "CLAIM_EVIDENCE_CLOSURE",
    description:
      "Every Knowledge Claim must remain connected to the declared Evidence closure.",
  },
  {
    code: "FOUNDATION_PAYLOAD_MATCH",
    description:
      "Intelligence Knowledge must remain compatible with canonical Foundation KnowledgePayload.",
  },
  {
    code: "SCOPE_REQUIRED",
    description:
      "Conditional or scoped Knowledge must retain its applicable Scope.",
  },
  {
    code: "CONTEXT_REQUIRED",
    description:
      "Contextual Knowledge must retain its applicable Context.",
  },
  {
    code: "CONDITION_REQUIRED",
    description:
      "Conditional Knowledge must explicitly preserve its conditions.",
  },
  {
    code: "CONSTRAINT_REQUIRED",
    description:
      "Constraint-dependent Knowledge must explicitly preserve its constraints.",
  },
  {
    code: "EXCEPTION_REQUIRED",
    description:
      "Knowledge that overrides a general constraint must explicitly preserve its exception.",
  },
  {
    code: "NO_UNKNOWN_APPROVAL",
    description:
      "UNKNOWN Knowledge cannot enter APPROVED lifecycle.",
  },
  {
    code: "NO_CONFLICTED_APPROVAL",
    description:
      "Conflicting Knowledge cannot enter APPROVED lifecycle.",
  },
  {
    code: "DETERMINISTIC_IDENTITY",
    description:
      "Equivalent semantic Knowledge must produce identical identity material.",
  },
  {
    code: "IMMUTABLE_FINGERPRINT",
    description:
      "Any canonical semantic mutation must change the Knowledge fingerprint.",
  },
] as const;

/* -------------------------------------------------------------------------- */
/* Type-level object union                                                     */
/* -------------------------------------------------------------------------- */

export type KnowledgeSemanticObject =
  | KnowledgeEntity
  | KnowledgeProperty
  | KnowledgeRelationship
  | KnowledgeCondition
  | KnowledgeConstraint
  | KnowledgeException
  | KnowledgeFailureMode
  | KnowledgeRule
  | IntelligenceKnowledge;

/* -------------------------------------------------------------------------- */
/* Type guards                                                                 */
/* -------------------------------------------------------------------------- */

export function isKnowledgeEntity(
  value: KnowledgeSemanticObject,
): value is KnowledgeEntity {
  return (
    "entityId" in value &&
    "normalizedName" in value &&
    "type" in value &&
    !("knowledgeId" in value)
  );
}

export function isKnowledgeProperty(
  value: KnowledgeSemanticObject,
): value is KnowledgeProperty {
  return (
    "propertyId" in value &&
    "entityId" in value &&
    "propertyId" !== undefined
  );
}

export function isKnowledgeRelationship(
  value: KnowledgeSemanticObject,
): value is KnowledgeRelationship {
  return (
    "relationshipId" in value &&
    "fromEntityId" in value &&
    "toEntityId" in value
  );
}

export function isKnowledgeCondition(
  value: KnowledgeSemanticObject,
): value is KnowledgeCondition {
  return (
    "conditionId" in value &&
    "operator" in value &&
    "expected" in value
  );
}

export function isKnowledgeConstraint(
  value: KnowledgeSemanticObject,
): value is KnowledgeConstraint {
  return (
    "constraintId" in value &&
    "requiredPropertyIds" in value &&
    "forbiddenPropertyIds" in value
  );
}

export function isKnowledgeException(
  value: KnowledgeSemanticObject,
): value is KnowledgeException {
  return (
    "exceptionId" in value &&
    "overridesConstraintIds" in value
  );
}

export function isKnowledgeFailureMode(
  value: KnowledgeSemanticObject,
): value is KnowledgeFailureMode {
  return (
    "failureModeId" in value &&
    "detectionSignals" in value &&
    "preventionMeasures" in value
  );
}

export function isKnowledgeRule(
  value: KnowledgeSemanticObject,
): value is KnowledgeRule {
  return (
    "ruleId" in value &&
    "constraintIds" in value &&
    "exceptionIds" in value
  );
}

export function isIntelligenceKnowledge(
  value: KnowledgeSemanticObject,
): value is IntelligenceKnowledge {
  return (
    "knowledgeId" in value &&
    "proposition" in value &&
    "foundationPayload" in value &&
    "evidenceClosure" in value
  );
}

/* -------------------------------------------------------------------------- */
/* Stable semantic defaults                                                    */
/* -------------------------------------------------------------------------- */

export const DEFAULT_KNOWLEDGE_CONFIDENCE:
  KnowledgeConfidence = "MEDIUM";

export const DEFAULT_KNOWLEDGE_TRUTH_STATE:
  KnowledgeTruthState = "UNKNOWN";

export const DEFAULT_KNOWLEDGE_LIFECYCLE:
  KnowledgeLifecycle = "PROPOSED";

export const DEFAULT_KNOWLEDGE_APPLICABILITY:
  KnowledgeApplicability = "UNKNOWN";

export const DEFAULT_KNOWLEDGE_POLARITY:
  KnowledgePolarity = "UNKNOWN";

/* -------------------------------------------------------------------------- */
/* Compile-time contract helpers                                              */
/* -------------------------------------------------------------------------- */

/**
 * Ensures a Foundation KnowledgePayload can be consumed without changing
 * its canonical field contract.
 */
export function foundationKnowledgePayloadShape(
  payload: KnowledgePayload,
): KnowledgePayload {
  return payload;
}

/**
 * Explicitly separates semantic intelligence identifiers from arbitrary
 * strings at the API boundary.
 */
export interface KnowledgeIdentity {
  readonly knowledgeId: KnowledgeId;
  readonly fingerprint: Fingerprint;
}

/**
 * Phase 2 Knowledge object version.
 *
 * This is intentionally independent from FoundationRecord.version.
 * Foundation persistence remains the authoritative versioning mechanism.
 */
export const KNOWLEDGE_INTELLIGENCE_VERSION = 1 as const;