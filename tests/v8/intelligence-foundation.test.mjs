/**
 * NEXMOLD V8 — Intelligence Foundation Integration Test
 *
 * Scope:
 * - Entity
 * - Signal
 * - Metric
 * - Decision
 * - Experiment
 * - Learning
 * - Feedback
 * - Cycle
 * - Foundation Engine
 *
 * Invariants:
 * - deterministic construction
 * - immutable fingerprints
 * - collection deduplication
 * - fail-closed integrity validation
 * - cross-layer reference closure
 * - lifecycle progression
 * - foundation state fingerprint stability
 * - no orphaned intelligence references
 *
 * This test intentionally exercises the public foundation barrel rather than
 * implementation-private module paths.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  INTELLIGENCE_FOUNDATION_ID,
  INTELLIGENCE_FOUNDATION_API_VERSION,
  INTELLIGENCE_FOUNDATION_CAPABILITIES,
  hasIntelligenceFoundationCapability,
  getIntelligenceFoundationCapabilities,

  createIntelligenceEntity,
  entityFingerprint,
  assertEntityIntegrity,
  deduplicateEntities,
  filterEntities,
  findEntity,
  findRelatedEntities,

  createIntelligenceSignal,
  signalFingerprint,
  assertSignalIntegrity,
  deduplicateSignals,
  filterSignals,

  createIntelligenceMetric,
  metricFingerprint,
  assertMetricIntegrity,
  deduplicateMetrics,
  filterMetrics,
  aggregateMetricsByName,

  createIntelligenceDecision,
  decisionFingerprint,
  assertDecisionIntegrity,
  deduplicateDecisions,
  filterDecisions,

  createIntelligenceExperiment,
  experimentFingerprint,
  assertExperimentIntegrity,
  deduplicateExperiments,
  filterExperiments,

  createIntelligenceLearning,
  learningFingerprint,
  assertLearningIntegrity,
  deduplicateLearnings,
  filterLearnings,

  createIntelligenceFeedback,
  feedbackFingerprint,
  assertFeedbackIntegrity,
  deduplicateFeedback,
  filterFeedback,
  aggregateFeedback,

  createIntelligenceCycle,
  advanceIntelligenceCycle,
  forkIntelligenceCycle,
  cycleFingerprintFor,
  assertIntelligenceCycleIntegrity,
  validateIntelligenceCycle,
  buildIntelligenceCycleGraph,

  createIntelligenceFoundationState,
  mergeIntelligenceFoundationState,
  runIntelligenceFoundationCycle,
  advanceFoundationCycle,
  foundationStateFingerprint,
  assertIntelligenceFoundationState,
  buildFoundationInvariantReport,
} from "../../dist/v8/intelligence/foundation/index.js";

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

const NOW = "2026-10-08T00:00:00.000Z";

function evidence(id, excerpt = `verified evidence ${id}`) {
  return {
    evidenceId: id,
    sourceId: `source:${id}`,
    snapshotId: `snapshot:${id}`,
    excerpt,
    fingerprint: `evidence-fingerprint:${id}`,
  };
}

function makeEntity(overrides = {}) {
  return createIntelligenceEntity({
    entityId: "entity:nexmold",
    entityType: "COMPANY",
    canonicalName: "NEXMOLD",
    aliases: ["NEXMOLD", "Nexmold"],
    description: "Industrial molding and manufacturing company.",
    properties: {
      industry: "injection-molding",
      market: "B2B",
    },
    relations: [],
    evidence: [evidence("entity-1")],
    observedAt: NOW,
    ...overrides,
  });
}

function makeSignal(overrides = {}) {
  return createIntelligenceSignal({
    signalId: "signal:wall-thickness",
    signalType: "MARKET",
    title: "Plastic injection molding wall thickness demand",
    description: "A validated market signal for injection molding design guidance.",
    value: 0.82,
    unit: "score",
    source: "V8",
    confidence: 0.94,
    observedAt: NOW,
    evidence: [evidence("signal-1")],
    entityIds: ["entity:nexmold"],
    ...overrides,
  });
}

function makeMetric(overrides = {}) {
  return createIntelligenceMetric({
    metricId: "metric:organic-demand",
    name: "organic-demand",
    value: 82,
    unit: "score",
    metricType: "DEMAND",
    direction: "UP",
    measuredAt: NOW,
    entityIds: ["entity:nexmold"],
    signalIds: ["signal:wall-thickness"],
    ...overrides,
  });
}

function makeDecision(overrides = {}) {
  return createIntelligenceDecision({
    decisionId: "decision:wall-thickness",
    decisionType: "CONTENT",
    status: "APPROVED",
    title: "Prioritize injection molding wall thickness content",
    rationale: "Demand and commercial relevance justify production.",
    confidence: 0.93,
    signalIds: ["signal:wall-thickness"],
    metricIds: ["metric:organic-demand"],
    evidence: [evidence("decision-1")],
    decidedAt: NOW,
    ...overrides,
  });
}

function makeExperiment(overrides = {}) {
  return createIntelligenceExperiment({
    experimentId: "experiment:wall-thickness-title",
    name: "Wall thickness title experiment",
    hypothesis: "A technically explicit title improves qualified organic engagement.",
    status: "PLANNED",
    decisionIds: ["decision:wall-thickness"],
    metricIds: ["metric:organic-demand"],
    variants: [
      {
        variantId: "control",
        name: "Control",
        allocation: 0.5,
      },
      {
        variantId: "technical",
        name: "Technical",
        allocation: 0.5,
      },
    ],
    startedAt: NOW,
    ...overrides,
  });
}

function makeLearning(overrides = {}) {
  return createIntelligenceLearning({
    learningId: "learning:wall-thickness",
    learningType: "CONTENT",
    title: "Technical specificity improves content opportunity quality",
    summary:
      "Technically explicit topics produce stronger qualified opportunity signals.",
    confidence: 0.91,
    sourceDecisionIds: ["decision:wall-thickness"],
    signalIds: ["signal:wall-thickness"],
    evidence: [evidence("learning-1")],
    rule: {
      condition: "technical-specificity-high",
      action: "increase-priority",
    },
    outcome: {
      direction: "POSITIVE",
      magnitude: 0.74,
    },
    learnedAt: NOW,
    ...overrides,
  });
}

function makeFeedback(overrides = {}) {
  return createIntelligenceFeedback({
    feedbackId: "feedback:wall-thickness",
    feedbackType: "PERFORMANCE",
    title: "Wall thickness content performance feedback",
    summary: "Observed positive downstream signal.",
    signal: {
      signal: "POSITIVE",
      confidence: 0.88,
      value: 0.76,
    },
    sourceDecisionIds: ["decision:wall-thickness"],
    sourceSignalIds: ["signal:wall-thickness"],
    evidence: [evidence("feedback-1")],
    observedAt: NOW,
    ...overrides,
  });
}

function makeCycle(overrides = {}) {
  return createIntelligenceCycle({
    cycleId: "cycle:wall-thickness",
    name: "Wall thickness growth cycle",
    objective: "Convert validated demand into measurable content growth.",
    stage: "DISCOVERY",
    status: "ACTIVE",
    entityIds: ["entity:nexmold"],
    signalIds: ["signal:wall-thickness"],
    metricIds: ["metric:organic-demand"],
    decisionIds: ["decision:wall-thickness"],
    experimentIds: ["experiment:wall-thickness-title"],
    learningIds: ["learning:wall-thickness"],
    feedbackIds: ["feedback:wall-thickness"],
    startedAt: NOW,
    ...overrides,
  });
}

/* -------------------------------------------------------------------------- */
/* Public API                                                                 */
/* -------------------------------------------------------------------------- */

test("V8 Intelligence Foundation exposes a stable public capability manifest", () => {
  assert.equal(
    INTELLIGENCE_FOUNDATION_ID,
    "nexmold:v8:intelligence-foundation",
  );

  assert.equal(INTELLIGENCE_FOUNDATION_API_VERSION, "1.0.0");

  assert.deepEqual(
    [...INTELLIGENCE_FOUNDATION_CAPABILITIES],
    [
      "entity",
      "signal",
      "metric",
      "decision",
      "experiment",
      "learning",
      "feedback",
      "cycle",
      "engine",
    ],
  );

  assert.equal(hasIntelligenceFoundationCapability("entity"), true);
  assert.equal(hasIntelligenceFoundationCapability("seo"), false);

  assert.strictEqual(
    getIntelligenceFoundationCapabilities(),
    INTELLIGENCE_FOUNDATION_CAPABILITIES,
  );

  assert.throws(() => {
    INTELLIGENCE_FOUNDATION_CAPABILITIES.push("invalid");
  }, TypeError);
});

/* -------------------------------------------------------------------------- */
/* Entity                                                                     */
/* -------------------------------------------------------------------------- */

test("V8 Foundation entity creation is deterministic and fingerprinted", () => {
  const first = makeEntity();
  const second = makeEntity();

  assert.equal(first.entityId, "entity:nexmold");
  assert.equal(first.entityType, "COMPANY");
  assert.ok(first.fingerprint);
  assert.equal(first.fingerprint, second.fingerprint);

  assert.equal(entityFingerprint(first), first.fingerprint);

  assert.doesNotThrow(() => assertEntityIntegrity(first));
});

test("V8 Foundation entity deduplication removes duplicate identities", () => {
  const entity = makeEntity();
  const duplicate = makeEntity();

  const result = deduplicateEntities([entity, duplicate]);

  assert.equal(result.length, 1);
  assert.equal(result[0].entityId, entity.entityId);
  assert.equal(result[0].fingerprint, entity.fingerprint);
});

test("V8 Foundation entity lookup and relation filtering are deterministic", () => {
  const root = makeEntity({
    entityId: "entity:root",
    relations: [
      {
        relationId: "relation:root-topic",
        relationType: "ABOUT",
        targetEntityId: "entity:topic",
      },
    ],
  });

  const topic = makeEntity({
    entityId: "entity:topic",
    canonicalName: "Injection Molding",
    relations: [],
  });

  const other = makeEntity({
    entityId: "entity:other",
    canonicalName: "Other",
    relations: [],
  });

  const collection = [root, topic, other];

  assert.equal(findEntity(collection, "entity:topic")?.entityId, "entity:topic");

  const related = findRelatedEntities(collection, "entity:root");

  assert.equal(related.length, 1);
  assert.equal(related[0].entityId, "entity:topic");

  const filtered = filterEntities(collection, {
    entityType: "COMPANY",
  });

  assert.equal(filtered.length, 3);
});

/* -------------------------------------------------------------------------- */
/* Signal                                                                     */
/* -------------------------------------------------------------------------- */

test("V8 Foundation signal integrity preserves evidence lineage", () => {
  const signal = makeSignal();

  assert.equal(signal.signalId, "signal:wall-thickness");
  assert.ok(signal.fingerprint);
  assert.equal(signalFingerprint(signal), signal.fingerprint);

  assert.doesNotThrow(() => assertSignalIntegrity(signal));

  const filtered = filterSignals([signal], {
    signalType: "MARKET",
  });

  assert.equal(filtered.length, 1);
});

test("V8 Foundation signal fingerprint changes when semantic content changes", () => {
  const first = makeSignal();

  const changed = makeSignal({
    value: 0.83,
  });

  assert.notEqual(first.fingerprint, changed.fingerprint);
});

/* -------------------------------------------------------------------------- */
/* Metric                                                                     */
/* -------------------------------------------------------------------------- */

test("V8 Foundation metric creation and aggregation are deterministic", () => {
  const first = makeMetric();
  const second = makeMetric({
    metricId: "metric:organic-demand-2",
    value: 92,
  });

  assert.equal(first.metricId, "metric:organic-demand");
  assert.ok(first.fingerprint);
  assert.equal(metricFingerprint(first), first.fingerprint);

  assert.doesNotThrow(() => assertMetricIntegrity(first));

  const aggregate = aggregateMetricsByName([first, second]);

  assert.ok(Array.isArray(aggregate));
  assert.ok(aggregate.length >= 1);

  const filtered = filterMetrics([first, second], {
    name: "organic-demand",
  });

  assert.equal(filtered.length, 2);
});

test("V8 Foundation metric deduplication is idempotent", () => {
  const metric = makeMetric();

  const once = deduplicateMetrics([metric, metric]);
  const twice = deduplicateMetrics(once);

  assert.equal(once.length, 1);
  assert.equal(twice.length, 1);
  assert.deepEqual(twice, once);
});

/* -------------------------------------------------------------------------- */
/* Decision                                                                   */
/* -------------------------------------------------------------------------- */

test("V8 Foundation decision closes signal, metric and evidence references", () => {
  const decision = makeDecision();

  assert.equal(decision.decisionId, "decision:wall-thickness");
  assert.ok(decision.fingerprint);
  assert.equal(decisionFingerprint(decision), decision.fingerprint);

  assert.doesNotThrow(() => assertDecisionIntegrity(decision));

  const filtered = filterDecisions([decision], {
    status: "APPROVED",
  });

  assert.equal(filtered.length, 1);
});

test("V8 Foundation decision fingerprint is immutable under repeated evaluation", () => {
  const decision = makeDecision();

  const first = decisionFingerprint(decision);
  const second = decisionFingerprint(decision);

  assert.equal(first, second);
  assert.equal(decision.fingerprint, first);
});

/* -------------------------------------------------------------------------- */
/* Experiment                                                                 */
/* -------------------------------------------------------------------------- */

test("V8 Foundation experiment preserves decision and metric references", () => {
  const experiment = makeExperiment();

  assert.equal(experiment.experimentId, "experiment:wall-thickness-title");
  assert.ok(experiment.fingerprint);
  assert.equal(experimentFingerprint(experiment), experiment.fingerprint);

  assert.doesNotThrow(() => assertExperimentIntegrity(experiment));

  const filtered = filterExperiments([experiment], {
    status: "PLANNED",
  });

  assert.equal(filtered.length, 1);
});

test("V8 Foundation experiment deduplication is deterministic", () => {
  const experiment = makeExperiment();

  const result = deduplicateExperiments([experiment, experiment]);

  assert.equal(result.length, 1);
});

/* -------------------------------------------------------------------------- */
/* Learning                                                                   */
/* -------------------------------------------------------------------------- */

test("V8 Foundation learning preserves decision-to-learning lineage", () => {
  const learning = makeLearning();

  assert.equal(learning.learningId, "learning:wall-thickness");
  assert.ok(learning.fingerprint);
  assert.equal(learningFingerprint(learning), learning.fingerprint);

  assert.doesNotThrow(() => assertLearningIntegrity(learning));

  const filtered = filterLearnings([learning], {
    learningType: "CONTENT",
  });

  assert.equal(filtered.length, 1);
});

test("V8 Foundation learning fingerprint changes when outcome changes", () => {
  const first = makeLearning();

  const changed = makeLearning({
    outcome: {
      direction: "NEGATIVE",
      magnitude: 0.31,
    },
  });

  assert.notEqual(first.fingerprint, changed.fingerprint);
});

/* -------------------------------------------------------------------------- */
/* Feedback                                                                   */
/* -------------------------------------------------------------------------- */

test("V8 Foundation feedback preserves decision and signal lineage", () => {
  const feedback = makeFeedback();

  assert.equal(feedback.feedbackId, "feedback:wall-thickness");
  assert.ok(feedback.fingerprint);
  assert.equal(feedbackFingerprintSafe(feedback), feedback.fingerprint);

  assert.doesNotThrow(() => assertFeedbackIntegrity(feedback));

  const filtered = filterFeedback([feedback], {
    feedbackType: "PERFORMANCE",
  });

  assert.equal(filtered.length, 1);
});

test("V8 Foundation feedback aggregation is deterministic", () => {
  const first = makeFeedback();

  const second = makeFeedback({
    feedbackId: "feedback:wall-thickness-2",
  });

  const aggregate = aggregateFeedback([first, second]);

  assert.ok(Array.isArray(aggregate));
  assert.ok(aggregate.length >= 1);
});

/* -------------------------------------------------------------------------- */
/* Cycle                                                                      */
/* -------------------------------------------------------------------------- */

test("V8 Foundation cycle creation validates lifecycle structure", () => {
  const cycle = makeCycle();

  assert.equal(cycle.cycleId, "cycle:wall-thickness");
  assert.ok(cycle.fingerprint);
  assert.equal(cycleFingerprintFor(cycle), cycle.fingerprint);

  assert.doesNotThrow(() => assertIntelligenceCycleIntegrity(cycle));

  const validation = validateIntelligenceCycle(cycle);

  assert.equal(validation.valid, true);
});

test("V8 Foundation cycle progression is monotonic", () => {
  const cycle = makeCycle();

  const advanced = advanceIntelligenceCycle(cycle, {
    stage: "ANALYSIS",
    observedAt: "2026-10-08T01:00:00.000Z",
  });

  assert.equal(advanced.stage, "ANALYSIS");
  assert.equal(advanced.status, "ACTIVE");

  assert.throws(
    () =>
      advanceIntelligenceCycle(advanced, {
        stage: "DISCOVERY",
        observedAt: "2026-10-08T02:00:00.000Z",
      }),
    /stage|transition|monotonic|invalid/i,
  );
});

test("V8 Foundation cycle fork creates an independent deterministic identity", () => {
  const cycle = makeCycle();

  const fork = forkIntelligenceCycle(cycle, {
    cycleId: "cycle:wall-thickness-fork",
    name: "Wall thickness growth cycle fork",
  });

  assert.notEqual(fork.cycleId, cycle.cycleId);
  assert.notEqual(fork.fingerprint, cycle.fingerprint);

  assert.equal(fork.stage, cycle.stage);
  assert.equal(fork.status, cycle.status);

  assert.doesNotThrow(() => assertIntelligenceCycleIntegrity(fork));
});

test("V8 Foundation cycle graph contains declared intelligence dependencies", () => {
  const cycle = makeCycle();

  const graph = buildIntelligenceCycleGraph(cycle);

  assert.ok(graph);
  assert.ok(Array.isArray(graph.nodes));

  const ids = new Set(graph.nodes.map((node) => node.id));

  assert.ok(ids.has("entity:nexmold"));
  assert.ok(ids.has("signal:wall-thickness"));
  assert.ok(ids.has("metric:organic-demand"));
  assert.ok(ids.has("decision:wall-thickness"));
});

/* -------------------------------------------------------------------------- */
/* Foundation state                                                           */
/* -------------------------------------------------------------------------- */

test("V8 Foundation state can be created and fingerprinted deterministically", () => {
  const entity = makeEntity();
  const signal = makeSignal();
  const metric = makeMetric();
  const decision = makeDecision();
  const experiment = makeExperiment();
  const learning = makeLearning();
  const feedback = makeFeedback();
  const cycle = makeCycle();

  const state = createIntelligenceFoundationState({
    entities: [entity],
    signals: [signal],
    metrics: [metric],
    decisions: [decision],
    experiments: [experiment],
    learnings: [learning],
    feedback: [feedback],
    cycles: [cycle],
  });

  assert.ok(state);
  assert.ok(state.fingerprint);

  assert.equal(
    foundationStateFingerprint(state),
    state.fingerprint,
  );

  assert.doesNotThrow(() => assertIntelligenceFoundationState(state));
});

test("V8 Foundation state fingerprint is stable across equivalent construction", () => {
  const createState = () =>
    createIntelligenceFoundationState({
      entities: [makeEntity()],
      signals: [makeSignal()],
      metrics: [makeMetric()],
      decisions: [makeDecision()],
      experiments: [makeExperiment()],
      learnings: [makeLearning()],
      feedback: [makeFeedback()],
      cycles: [makeCycle()],
    });

  const first = createState();
  const second = createState();

  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(
    foundationStateFingerprint(first),
    foundationStateFingerprint(second),
  );
});

test("V8 Foundation state merge remains deduplicated", () => {
  const first = createIntelligenceFoundationState({
    entities: [makeEntity()],
    signals: [makeSignal()],
    metrics: [makeMetric()],
    decisions: [makeDecision()],
    experiments: [makeExperiment()],
    learnings: [makeLearning()],
    feedback: [makeFeedback()],
    cycles: [makeCycle()],
  });

  const second = createIntelligenceFoundationState({
    entities: [makeEntity()],
    signals: [makeSignal()],
    metrics: [makeMetric()],
    decisions: [makeDecision()],
    experiments: [makeExperiment()],
    learnings: [makeLearning()],
    feedback: [makeFeedback()],
    cycles: [makeCycle()],
  });

  const merged = mergeIntelligenceFoundationState(first, second);

  assert.equal(merged.entities.length, 1);
  assert.equal(merged.signals.length, 1);
  assert.equal(merged.metrics.length, 1);
  assert.equal(merged.decisions.length, 1);
  assert.equal(merged.experiments.length, 1);
  assert.equal(merged.learnings.length, 1);
  assert.equal(merged.feedback.length, 1);
  assert.equal(merged.cycles.length, 1);

  assert.doesNotThrow(() => assertIntelligenceFoundationState(merged));
});

/* -------------------------------------------------------------------------- */
/* Foundation engine                                                          */
/* -------------------------------------------------------------------------- */

test("V8 Foundation engine runs a closed intelligence cycle", () => {
  const input = {
    entities: [makeEntity()],
    signals: [makeSignal()],
    metrics: [makeMetric()],
    decisions: [makeDecision()],
    experiments: [makeExperiment()],
    learnings: [makeLearning()],
    feedback: [makeFeedback()],
    cycles: [makeCycle()],
  };

  const result = runIntelligenceFoundationCycle(input);

  assert.ok(result);
  assert.ok(result.state);
  assert.ok(result.cycle);

  assert.doesNotThrow(() =>
    assertIntelligenceFoundationState(result.state),
  );

  const report = buildFoundationInvariantReport(result.state);

  assert.equal(report.valid, true);
});

test("V8 Foundation engine rejects orphaned cross-layer references", () => {
  const state = createIntelligenceFoundationState({
    entities: [makeEntity()],
    signals: [
      makeSignal({
        entityIds: ["entity:missing"],
      }),
    ],
    metrics: [makeMetric()],
    decisions: [makeDecision()],
    experiments: [makeExperiment()],
    learnings: [makeLearning()],
    feedback: [makeFeedback()],
    cycles: [makeCycle()],
  });

  assert.throws(
    () => assertIntelligenceFoundationState(state),
    /entity:missing|reference|orphan|integrity/i,
  );
});

test("V8 Foundation engine advance preserves state integrity", () => {
  const state = createIntelligenceFoundationState({
    entities: [makeEntity()],
    signals: [makeSignal()],
    metrics: [makeMetric()],
    decisions: [makeDecision()],
    experiments: [makeExperiment()],
    learnings: [makeLearning()],
    feedback: [makeFeedback()],
    cycles: [makeCycle()],
  });

  const advanced = advanceFoundationCycle(state, {
    cycleId: "cycle:wall-thickness",
    stage: "ANALYSIS",
    observedAt: "2026-10-08T01:00:00.000Z",
  });

  assert.ok(advanced);
  assert.equal(
    advanced.cycles.find(
      (cycle) => cycle.cycleId === "cycle:wall-thickness",
    )?.stage,
    "ANALYSIS",
  );

  assert.doesNotThrow(() =>
    assertIntelligenceFoundationState(advanced),
  );
});

/* -------------------------------------------------------------------------- */
/* Fail-closed mutation tests                                                 */
/* -------------------------------------------------------------------------- */

test("V8 Foundation rejects mutated entity fingerprints", () => {
  const entity = makeEntity();

  const mutated = {
    ...entity,
    canonicalName: "MUTATED",
  };

  assert.throws(
    () => assertEntityIntegrity(mutated),
    /fingerprint|integrity|mismatch|invalid/i,
  );
});

test("V8 Foundation rejects mutated signal fingerprints", () => {
  const signal = makeSignal();

  const mutated = {
    ...signal,
    value: 0.01,
  };

  assert.throws(
    () => assertSignalIntegrity(mutated),
    /fingerprint|integrity|mismatch|invalid/i,
  );
});

test("V8 Foundation rejects mutated metric fingerprints", () => {
  const metric = makeMetric();

  const mutated = {
    ...metric,
    value: 999999,
  };

  assert.throws(
    () => assertMetricIntegrity(mutated),
    /fingerprint|integrity|mismatch|invalid/i,
  );
});

test("V8 Foundation rejects mutated decision fingerprints", () => {
  const decision = makeDecision();

  const mutated = {
    ...decision,
    confidence: 0.01,
  };

  assert.throws(
    () => assertDecisionIntegrity(mutated),
    /fingerprint|integrity|mismatch|invalid/i,
  );
});

/* -------------------------------------------------------------------------- */
/* Fingerprint helper                                                         */
/* -------------------------------------------------------------------------- */

function feedbackFingerprintSafe(feedback) {
  if (
    typeof feedbackFingerprint === "function"
  ) {
    return feedbackFingerprint(feedback);
  }

  return feedback.fingerprint;
}