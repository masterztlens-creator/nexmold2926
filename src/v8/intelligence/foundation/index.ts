/**
 * NEXMOLD V8 Intelligence Foundation
 *
 * Canonical public barrel for the Intelligence Foundation layer.
 *
 * Architectural rules:
 * - Export only contracts and implementations that actually exist.
 * - Do not expose deprecated / speculative aliases.
 * - Do not create a second Truth-layer contract.
 * - Foundation Truth remains authoritative for Evidence / Claim /
 *   Knowledge / Decision.
 * - Intelligence Foundation remains the strategic intelligence layer.
 */

/* -------------------------------------------------------------------------- */
/* Canonical Intelligence contracts                                           */
/* -------------------------------------------------------------------------- */

export type {
  IntelligenceId,
  IntelligenceConfidence,
  IntelligenceLifecycle,
  IntelligenceStatus,
  IntelligenceDirection,
  IntelligencePolarity,

  IntelligenceEntityType,
  EntityRelationshipType,
  IntelligenceEntityAttribute,
  IntelligenceEntityRelationship,
  IntelligenceEntity,

  IntelligenceLineageRef,
  IntelligenceEvidenceRef,
  IntelligenceProvenance,

  IntelligenceSignalType,
  IntelligenceSignalSource,
  IntelligenceSignal,

  IntelligenceObservation,

  IntelligenceMetricType,
  IntelligenceMetric,

  IntelligenceAnalysisType,
  IntelligenceAnalysis,

  IntelligenceDecisionType,
  IntelligenceDecision,

  IntelligenceExperimentStatus,
  IntelligenceExperimentVariant,
  IntelligenceExperiment,

  IntelligenceOutcome,

  IntelligenceLearningType,
  IntelligenceLearningStatus,
  IntelligenceLearning,

  IntelligenceFeedbackType,
  IntelligenceFeedback,

  IntelligenceCycleStage,
  IntelligenceCycleStatus,
  IntelligenceCycle,

  IntelligenceFoundationInput,
  IntelligenceFoundationResult,

  IntelligenceBlock,
  IntelligenceInvariantReport,
  IntelligenceInvariantFailure,

  IntelligenceObject,

  IntelligenceFoundationRecordRef,
  IntelligenceTruthAggregateType,
  IntelligenceTruthReference,
} from "./types.js";

export {
  isIntelligenceEntity,
  isIntelligenceSignal,
  isIntelligenceMetric,
  isIntelligenceDecision,
  isIntelligenceExperiment,
  isIntelligenceLearning,
  isIntelligenceFeedback,
  isIntelligenceCycle,
} from "./types.js";

/* -------------------------------------------------------------------------- */
/* Entity Intelligence                                                        */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceEntityInput,
  CreateEntityRelationshipInput,
  EntityIdentity,
  EntityDeduplicationResult,
  EntityMergeResult,
} from "./entity.js";

export {
  normalizeEntityName,
  createEntityIdentity,
  createEntityRelationship,
  createIntelligenceEntity,
  compareEntityIdentity,
  entityIdentityFingerprint,
  assertEntityIdentity,
  findDuplicateEntity,
  mergeIntelligenceEntities,
  deduplicateEntities,
  findEntityById,
  findEntitiesByType,
  findEntitiesByName,
  relatedEntities,
  assertEntityGraph,
  entityFingerprint,
} from "./entity.js";

/* -------------------------------------------------------------------------- */
/* Signal Intelligence                                                        */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceSignalInput,
  SignalFilter,
  SignalAggregation,
  SignalSummary,
} from "./signal.js";

export {
  normalizeSignalSubject,
  signalConfidenceScore,
  createIntelligenceSignal,
  signalFingerprint,
  assertSignalIntegrity,
  deduplicateSignals,
  filterSignals,
  aggregateSignalsBySubject,
  summarizeSignals,
  rankSignals,
  mergeSignals,
  assertSignalCollection,
} from "./signal.js";

/* -------------------------------------------------------------------------- */
/* Metric Intelligence                                                        */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceMetricInput,
  MetricFilter,
  MetricAggregation,
  MetricSummary,
} from "./metric.js";

export {
  createIntelligenceMetric,
  metricFingerprint,
  assertMetricIntegrity,
  deduplicateMetrics,
  filterMetrics,
  aggregateMetricsByName,
  summarizeMetrics,
  rankMetrics,
  mergeMetrics,
  assertMetricCollection,
} from "./metric.js";

/* -------------------------------------------------------------------------- */
/* Decision Intelligence                                                      */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceDecisionInput,
  DecisionFilter,
  DecisionSummary,
} from "./decision.js";

export {
  createIntelligenceDecision,
  decisionFingerprint,
  assertDecisionIntegrity,
  deduplicateDecisions,
  filterDecisions,
  summarizeDecisions,
  rankDecisions,
  mergeDecisions,
  assertDecisionCollection,
} from "./decision.js";

/* -------------------------------------------------------------------------- */
/* Experiment Intelligence                                                    */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceExperimentInput,
  ExperimentFilter,
  ExperimentSummary,
} from "./experiment.js";

export {
  createIntelligenceExperiment,
  experimentFingerprint,
  assertExperimentIntegrity,
  deduplicateExperiments,
  filterExperiments,
  summarizeExperiments,
  rankExperiments,
  assertExperimentCollection,
} from "./experiment.js";

/* -------------------------------------------------------------------------- */
/* Learning Intelligence                                                      */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceLearningInput,
  LearningFilter,
  LearningSummary,
} from "./learning.js";

export {
  createIntelligenceLearning,
  learningFingerprint,
  assertLearningIntegrity,
  deduplicateLearnings,
  filterLearnings,
  summarizeLearnings,
  rankLearnings,
  assertLearningCollection,
} from "./learning.js";

/* -------------------------------------------------------------------------- */
/* Feedback Intelligence                                                      */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceFeedbackInput,
  FeedbackFilter,
  FeedbackSummary,
} from "./feedback.js";

export {
  createIntelligenceFeedback,
  feedbackFingerprint,
  assertFeedbackIntegrity,
  deduplicateFeedback,
  filterFeedback,
  summarizeFeedback,
  rankFeedback,
  assertFeedbackCollection,
} from "./feedback.js";

/* -------------------------------------------------------------------------- */
/* Intelligence Cycle                                                         */
/* -------------------------------------------------------------------------- */

export type {
  CreateIntelligenceCycleInput,
  AdvanceIntelligenceCycleInput,
  CycleFilter,
  CycleGraphNode,
  CycleGraph,
  CycleSummary,
  CycleValidationReport,
} from "./cycle.js";

export {
  createIntelligenceCycle,
  advanceIntelligenceCycle,
  forkIntelligenceCycle,
  cycleFingerprintFor,
  assertIntelligenceCycleIntegrity,
  validateIntelligenceCycle,
  filterIntelligenceCycles,
  deduplicateIntelligenceCycles,
  buildIntelligenceCycleGraph,
  summarizeIntelligenceCycles,
  rankIntelligenceCycles,
  assertIntelligenceCycleCollection,
} from "./cycle.js";

/* -------------------------------------------------------------------------- */
/* Foundation Engine                                                          */
/* -------------------------------------------------------------------------- */

/**
 * The engine owns its runtime state / execution result contracts.
 *
 * IntelligenceFoundationInput is intentionally exported from types.ts as
 * the canonical public input contract. The engine-local input contract is
 * exposed under an explicit name to avoid a duplicate barrel export.
 */

export type {
  IntelligenceFoundationState,
  IntelligenceFoundationRunInput,
  IntelligenceFoundationRunResult,
  IntelligenceFoundationInvariantReport,
} from "./engine.js";

export {
  assertIntelligenceFoundationState,
  createIntelligenceFoundationState,
  mergeIntelligenceFoundationState,
  runIntelligenceFoundationCycle,
  advanceFoundationCycle,
  foundationStateFingerprint,
  buildFoundationInvariantReport,
} from "./engine.js";