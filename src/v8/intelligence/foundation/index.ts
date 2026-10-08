/**
 * NEXMOLD V8 — Intelligence Foundation Public API
 *
 * Stable public export surface for the Intelligence Foundation layer.
 *
 * Architecture:
 *   Entity
 *      ↓
 *   Signal / Metric
 *      ↓
 *   Decision / Experiment
 *      ↓
 *   Learning / Feedback
 *      ↓
 *   Cycle
 *      ↓
 *   Foundation Engine
 *
 * Design invariants:
 * - The public API is explicit and deterministic.
 * - No implementation-private symbols are exposed accidentally.
 * - No duplicate exports are introduced through wildcard collisions.
 * - Domain modules can depend on this barrel without importing internal files.
 * - The foundation remains independent from SEO/GEO execution layers.
 * - Runtime behavior is delegated to the underlying modules.
 *
 * This file is intentionally dependency-light and contains no orchestration
 * logic. It defines the canonical public boundary of the foundation package.
 */

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

export type {
  IntelligenceFoundationEntityType,
  IntelligenceFoundationLifecycle,
  IntelligenceFoundationStage,
  IntelligenceFoundationStatus,

  IntelligenceEntity,
  IntelligenceEntityType,
  IntelligenceEntityRelation,

  IntelligenceSignal,
  IntelligenceSignalType,
  IntelligenceSignalSeverity,

  IntelligenceMetric,
  IntelligenceMetricType,
  IntelligenceMetricDirection,

  IntelligenceDecision,
  IntelligenceDecisionType,
  IntelligenceDecisionStatus,

  IntelligenceExperiment,
  IntelligenceExperimentStatus,
  IntelligenceExperimentVariant,

  IntelligenceLearning,
  IntelligenceLearningType,

  IntelligenceFeedback,
  IntelligenceFeedbackType,

  IntelligenceCycle,
  IntelligenceCycleStage,
  IntelligenceCycleStatus,

  IntelligenceEvidenceRef,
  IntelligenceEntityRelationInput,
  IntelligenceSignalEvidence,

  IntelligenceFoundationState,
  IntelligenceFoundationSnapshot,
} from "./types.js";

/* -------------------------------------------------------------------------- */
/* Entity                                                                     */
/* -------------------------------------------------------------------------- */

export {
  createIntelligenceEntity,
  entityFingerprint,
  assertEntityIntegrity,
  deduplicateEntities,
  filterEntities,
  mergeEntities,
  findEntity,
  findRelatedEntities,
  buildEntityGraph,
} from "./entity.js";

export type {
  CreateIntelligenceEntityInput,
  EntityFilter,
  EntityGraph,
  EntitySummary,
} from "./entity.js";

/* -------------------------------------------------------------------------- */
/* Signal                                                                     */
/* -------------------------------------------------------------------------- */

export {
  createIntelligenceSignal,
  signalFingerprint,
  assertSignalIntegrity,
  deduplicateSignals,
  filterSignals,
  summarizeSignals,
  rankSignals,
  mergeSignals,
  assertSignalCollection,
} from "./signal.js";

export type {
  CreateIntelligenceSignalInput,
  SignalFilter,
  SignalSummary,
} from "./signal.js";

/* -------------------------------------------------------------------------- */
/* Metric                                                                     */
/* -------------------------------------------------------------------------- */

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

export type {
  CreateIntelligenceMetricInput,
  MetricFilter,
  MetricAggregation,
  MetricSummary,
} from "./metric.js";

/* -------------------------------------------------------------------------- */
/* Decision                                                                   */
/* -------------------------------------------------------------------------- */

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

export type {
  CreateIntelligenceDecisionInput,
  DecisionFilter,
  DecisionSummary,
} from "./decision.js";

/* -------------------------------------------------------------------------- */
/* Experiment                                                                 */
/* -------------------------------------------------------------------------- */

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

export type {
  CreateIntelligenceExperimentInput,
  ExperimentFilter,
  ExperimentSummary,
} from "./experiment.js";

/* -------------------------------------------------------------------------- */
/* Learning                                                                   */
/* -------------------------------------------------------------------------- */

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

export type {
  CreateIntelligenceLearningInput,
  LearningFilter,
  LearningSummary,
} from "./learning.js";

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

export {
  createIntelligenceFeedback,
  feedbackFingerprint,
  assertFeedbackIntegrity,
  deduplicateFeedback,
  filterFeedback,
  aggregateFeedback,
  summarizeFeedback,
  rankFeedback,
  assertFeedbackCollection,
} from "./feedback.js";

export type {
  CreateIntelligenceFeedbackInput,
  FeedbackFilter,
  FeedbackAggregation,
  FeedbackSummary,
} from "./feedback.js";

/* -------------------------------------------------------------------------- */
/* Cycle                                                                      */
/* -------------------------------------------------------------------------- */

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

export type {
  CreateIntelligenceCycleInput,
  AdvanceIntelligenceCycleInput,
  CycleFilter,
  CycleGraphNode,
  CycleGraph,
  CycleSummary,
  CycleValidationReport,
} from "./cycle.js";

/* -------------------------------------------------------------------------- */
/* Foundation Engine                                                          */
/* -------------------------------------------------------------------------- */

export {
  createIntelligenceFoundationState,
  mergeIntelligenceFoundationState,
  runIntelligenceFoundationCycle,
  advanceFoundationCycle,
  foundationStateFingerprint,
  assertIntelligenceFoundationState,
  buildFoundationInvariantReport,
} from "./engine.js";

export type {
  IntelligenceFoundationInput,
  IntelligenceFoundationRunInput,
  IntelligenceFoundationRunResult,
  IntelligenceFoundationInvariantReport,
  IntelligenceFoundationEngineOptions,
} from "./engine.js";

/* -------------------------------------------------------------------------- */
/* Public API metadata                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Canonical package identifier for downstream capability discovery.
 *
 * This is deliberately a constant rather than a mutable configuration object.
 */
export const INTELLIGENCE_FOUNDATION_ID =
  "nexmold:v8:intelligence-foundation" as const;

/**
 * Foundation API generation.
 *
 * Kept independent from the repository/package version so downstream modules
 * can perform capability checks without coupling themselves to npm metadata.
 */
export const INTELLIGENCE_FOUNDATION_API_VERSION = "1.0.0" as const;

/**
 * Canonical foundation capability list.
 *
 * The list is immutable and intentionally contains capability identifiers,
 * rather than implementation file names.
 */
export const INTELLIGENCE_FOUNDATION_CAPABILITIES = Object.freeze([
  "entity",
  "signal",
  "metric",
  "decision",
  "experiment",
  "learning",
  "feedback",
  "cycle",
  "engine",
] as const);

/**
 * Type-level representation of a foundation capability.
 */
export type IntelligenceFoundationCapability =
  (typeof INTELLIGENCE_FOUNDATION_CAPABILITIES)[number];

/**
 * Deterministic capability membership check.
 */
export function hasIntelligenceFoundationCapability(
  capability: string,
): capability is IntelligenceFoundationCapability {
  return (
    typeof capability === "string" &&
    (INTELLIGENCE_FOUNDATION_CAPABILITIES as readonly string[]).includes(
      capability,
    )
  );
}

/**
 * Return the immutable canonical capability manifest.
 *
 * A fresh readonly array is intentionally not created here. Consumers receive
 * the same frozen manifest, preventing accidental divergence between callers.
 */
export function getIntelligenceFoundationCapabilities(): readonly IntelligenceFoundationCapability[] {
  return INTELLIGENCE_FOUNDATION_CAPABILITIES;
}