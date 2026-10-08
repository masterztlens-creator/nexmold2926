/**
 * NEXMOLD V8 — Intelligence Foundation Integration Test
 *
 * Purpose:
 * - Load the canonical compiled Intelligence Foundation barrel.
 * - Verify the public API is actually emitted by the V8 compiler.
 * - Exercise the canonical Foundation entity construction path.
 * - Verify deterministic identity / fingerprint behavior.
 * - Verify fail-closed entity integrity validation.
 *
 * Important:
 * - This test must follow the current Foundation contracts.
 * - Do not reference deprecated V7 / early V8 API aliases.
 * - Do not reference speculative fields.
 * - The V8 compiler emits from root "." into ".v8-build".
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
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

  createIntelligenceDecision,
  decisionFingerprint,
  assertDecisionIntegrity,
  deduplicateDecisions,
  filterDecisions,
  summarizeDecisions,
  rankDecisions,
  mergeDecisions,
  assertDecisionCollection,

  createIntelligenceExperiment,
  experimentFingerprint,
  assertExperimentIntegrity,
  deduplicateExperiments,
  filterExperiments,
  summarizeExperiments,
  rankExperiments,
  assertExperimentCollection,

  createIntelligenceLearning,
  learningFingerprint,
  assertLearningIntegrity,
  deduplicateLearnings,
  filterLearnings,
  summarizeLearnings,
  rankLearnings,
  assertLearningCollection,

  createIntelligenceFeedback,
  feedbackFingerprint,
  assertFeedbackIntegrity,
  deduplicateFeedback,
  filterFeedback,
  summarizeFeedback,
  rankFeedback,
  assertFeedbackCollection,

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

  createIntelligenceFoundationState,
  mergeIntelligenceFoundationState,
  runIntelligenceFoundationCycle,
  advanceFoundationCycle,
  foundationStateFingerprint,
  assertIntelligenceFoundationState,
  buildFoundationInvariantReport,
} from "../../.v8-build/src/v8/intelligence/foundation/index.js";

/* -------------------------------------------------------------------------- */
/* Canonical public API                                                      */
/* -------------------------------------------------------------------------- */

test("V8 Intelligence Foundation public barrel is emitted and loadable", async () => {
  const foundation = await import(
    "../../.v8-build/src/v8/intelligence/foundation/index.js"
  );

  const requiredExports = [
    "createEntityIdentity",
    "createEntityRelationship",
    "createIntelligenceEntity",
    "compareEntityIdentity",
    "entityIdentityFingerprint",
    "assertEntityIdentity",
    "findDuplicateEntity",
    "mergeIntelligenceEntities",
    "deduplicateEntities",
    "findEntityById",
    "findEntitiesByType",
    "findEntitiesByName",
    "relatedEntities",
    "assertEntityGraph",
    "entityFingerprint",

    "createIntelligenceSignal",
    "signalFingerprint",
    "assertSignalIntegrity",
    "deduplicateSignals",
    "filterSignals",
    "aggregateSignalsBySubject",
    "summarizeSignals",
    "rankSignals",
    "mergeSignals",
    "assertSignalCollection",

    "createIntelligenceMetric",
    "metricFingerprint",
    "assertMetricIntegrity",
    "deduplicateMetrics",
    "filterMetrics",
    "aggregateMetricsByName",
    "summarizeMetrics",
    "rankMetrics",
    "mergeMetrics",
    "assertMetricCollection",

    "createIntelligenceDecision",
    "decisionFingerprint",
    "assertDecisionIntegrity",
    "deduplicateDecisions",
    "filterDecisions",
    "summarizeDecisions",
    "rankDecisions",
    "mergeDecisions",
    "assertDecisionCollection",

    "createIntelligenceExperiment",
    "experimentFingerprint",
    "assertExperimentIntegrity",
    "deduplicateExperiments",
    "filterExperiments",
    "summarizeExperiments",
    "rankExperiments",
    "assertExperimentCollection",

    "createIntelligenceLearning",
    "learningFingerprint",
    "assertLearningIntegrity",
    "deduplicateLearnings",
    "filterLearnings",
    "summarizeLearnings",
    "rankLearnings",
    "assertLearningCollection",

    "createIntelligenceFeedback",
    "feedbackFingerprint",
    "assertFeedbackIntegrity",
    "deduplicateFeedback",
    "filterFeedback",
    "summarizeFeedback",
    "rankFeedback",
    "assertFeedbackCollection",

    "createIntelligenceCycle",
    "advanceIntelligenceCycle",
    "forkIntelligenceCycle",
    "cycleFingerprintFor",
    "assertIntelligenceCycleIntegrity",
    "validateIntelligenceCycle",
    "filterIntelligenceCycles",
    "deduplicateIntelligenceCycles",
    "buildIntelligenceCycleGraph",
    "summarizeIntelligenceCycles",
    "rankIntelligenceCycles",
    "assertIntelligenceCycleCollection",

    "createIntelligenceFoundationState",
    "mergeIntelligenceFoundationState",
    "runIntelligenceFoundationCycle",
    "advanceFoundationCycle",
    "foundationStateFingerprint",
    "assertIntelligenceFoundationState",
    "buildFoundationInvariantReport",
  ];

  for (const exportName of requiredExports) {
    assert.equal(
      typeof foundation[exportName],
      "function",
      `Missing Foundation export: ${exportName}`,
    );
  }
});

/* -------------------------------------------------------------------------- */
/* Entity identity                                                            */
/* -------------------------------------------------------------------------- */

test("V8 Foundation entity identity is deterministic", () => {
  const first = createEntityIdentity(
    "COMPANY",
    "NEXMOLD",
  );

  const second = createEntityIdentity(
    "COMPANY",
    "NEXMOLD",
  );

  assert.equal(
    first.normalizedName,
    "nexmold",
  );

  assert.equal(
    first.identityFingerprint,
    second.identityFingerprint,
  );

  assert.equal(
    compareEntityIdentity(
      {
        type: first.type,
        normalizedName: first.normalizedName,
      },
      {
        type: second.type,
        normalizedName: second.normalizedName,
      },
    ),
    true,
  );

  assert.equal(
    entityIdentityFingerprint(first),
    first.identityFingerprint,
  );
});

/* -------------------------------------------------------------------------- */
/* Entity construction and integrity                                         */
/* -------------------------------------------------------------------------- */

test("V8 Foundation entity construction is deterministic and fail-closed", () => {
  const entity = createIntelligenceEntity({
    entityId: "entity:nexmold",
    type: "COMPANY",
    name: "NEXMOLD",
    aliases: ["Nexmold"],
    confidence: "HIGH",
    lifecycle: "DISCOVERED",
    evidenceRefs: [],
    attributes: [],
    relationships: [],
    createdAt: "2026-10-08T00:00:00.000Z",
    updatedAt: "2026-10-08T00:00:00.000Z",
  });

  assert.equal(
    entity.entityId,
    "entity:nexmold",
  );

  assert.equal(
    entity.normalizedName,
    "nexmold",
  );

  assert.ok(entity.identityFingerprint);

  assert.doesNotThrow(() => {
    assertEntityIdentity(entity);
  });

  assert.doesNotThrow(() => {
    entityFingerprint(entity);
  });

  const duplicate = findDuplicateEntity(
    entity,
    [entity],
  );

  assert.equal(
    duplicate.duplicate,
    true,
  );

  assert.equal(
    duplicate.entityId,
    entity.entityId,
  );
});

test("V8 Foundation entity lookup remains deterministic", () => {
  const company = createIntelligenceEntity({
    entityId: "entity:nexmold",
    type: "COMPANY",
    name: "NEXMOLD",
    confidence: "HIGH",
    evidenceRefs: [],
    attributes: [],
    relationships: [],
  });

  const topic = createIntelligenceEntity({
    entityId: "entity:injection-molding",
    type: "TOPIC",
    name: "Injection Molding",
    confidence: "HIGH",
    evidenceRefs: [],
    attributes: [],
    relationships: [],
  });

  const entities = [
    company,
    topic,
  ];

  assert.equal(
    findEntityById(
      entities,
      "entity:nexmold",
    )?.entityId,
    "entity:nexmold",
  );

  assert.equal(
    findEntitiesByType(
      entities,
      "COMPANY",
    ).length,
    1,
  );

  assert.equal(
    findEntitiesByName(
      entities,
      "nexmold",
    ).length,
    1,
  );

  assert.doesNotThrow(() => {
    assertEntityGraph(entities);
  });
});

/* -------------------------------------------------------------------------- */
/* Relationship construction                                                   */
/* -------------------------------------------------------------------------- */

test("V8 Foundation relationship construction preserves canonical identifiers", () => {
  const relationship = createEntityRelationship({
    relationshipId: "relationship:nexmold-topic",
    fromEntityId: "entity:nexmold",
    toEntityId: "entity:injection-molding",
    type: "ABOUT",
    confidence: "HIGH",
    evidenceRefs: [],
  });

  assert.equal(
    relationship.relationshipId,
    "relationship:nexmold-topic",
  );

  assert.equal(
    relationship.fromEntityId,
    "entity:nexmold",
  );

  assert.equal(
    relationship.toEntityId,
    "entity:injection-molding",
  );

  assert.equal(
    relationship.type,
    "ABOUT",
  );
});

/* -------------------------------------------------------------------------- */
/* Entity deduplication                                                       */
/* -------------------------------------------------------------------------- */

test("V8 Foundation entity deduplication is idempotent", () => {
  const first = createIntelligenceEntity({
    entityId: "entity:nexmold",
    type: "COMPANY",
    name: "NEXMOLD",
    confidence: "HIGH",
    evidenceRefs: [],
    attributes: [],
    relationships: [],
  });

  const second = createIntelligenceEntity({
    entityId: "entity:nexmold-copy",
    type: "COMPANY",
    name: "NEXMOLD",
    confidence: "MEDIUM",
    evidenceRefs: [],
    attributes: [],
    relationships: [],
  });

  const once = deduplicateEntities([
    first,
    second,
  ]);

  const twice = deduplicateEntities(
    once,
  );

  assert.equal(
    once.length,
    1,
  );

  assert.equal(
    twice.length,
    1,
  );

  assert.equal(
    twice[0].identityFingerprint,
    once[0].identityFingerprint,
  );
});

/* -------------------------------------------------------------------------- */
/* Foundation state smoke validation                                          */
/* -------------------------------------------------------------------------- */

test("V8 Foundation state can be created from the canonical input contract", () => {
  const state = createIntelligenceFoundationState({});

  assert.ok(state);
  assert.ok(state.fingerprint);

  assert.doesNotThrow(() => {
    assertIntelligenceFoundationState(state);
  });

  assert.equal(
    foundationStateFingerprint(state),
    state.fingerprint,
  );

  const report =
    buildFoundationInvariantReport(
      state,
    );

  assert.equal(
    report.valid,
    true,
  );
});

test("V8 Foundation empty state is deterministic", () => {
  const first =
    createIntelligenceFoundationState({});

  const second =
    createIntelligenceFoundationState({});

  assert.equal(
    first.fingerprint,
    second.fingerprint,
  );

  assert.equal(
    foundationStateFingerprint(first),
    foundationStateFingerprint(second),
  );
});

test("V8 Foundation empty state merge is deterministic", () => {
  const first =
    createIntelligenceFoundationState({});

  const second =
    createIntelligenceFoundationState({});

  const merged =
    mergeIntelligenceFoundationState(
      first,
      second,
    );

  assert.ok(merged.fingerprint);

  assert.doesNotThrow(() => {
    assertIntelligenceFoundationState(
      merged,
    );
  });
});

/* -------------------------------------------------------------------------- */
/* Fail-closed mutation test                                                  */
/* -------------------------------------------------------------------------- */

test("V8 Foundation rejects mutated entity identity", () => {
  const entity =
    createIntelligenceEntity({
      entityId: "entity:nexmold",
      type: "COMPANY",
      name: "NEXMOLD",
      confidence: "HIGH",
      evidenceRefs: [],
      attributes: [],
      relationships: [],
    });

  const mutated = {
    ...entity,
    normalizedName: "mutated",
  };

  assert.throws(
    () => {
      assertEntityIdentity(
        mutated,
      );
    },
    /fingerprint|normalizedName|mismatch|invalid/i,
  );
});