import {
  invariant,
} from "../../constitution/invariants.js";
import {
  contentFingerprint,
} from "../../foundation/hash.js";
import {
  assertIntelligenceCycleCollection,
  assertIntelligenceCycleIntegrity,
  advanceIntelligenceCycle,
  createIntelligenceCycle,
} from "./cycle.js";
import {
  assertDecisionCollection,
  assertDecisionIntegrity,
} from "./decision.js";
import {
  assertExperimentCollection,
  assertExperimentIntegrity,
} from "./experiment.js";
import {
  assertFeedbackCollection,
  assertFeedbackIntegrity,
} from "./feedback.js";
import {
  assertLearningCollection,
  assertLearningIntegrity,
} from "./learning.js";
import {
  assertMetricCollection,
  assertMetricIntegrity,
} from "./metric.js";
import {
  assertSignalCollection,
  assertSignalIntegrity,
} from "./signal.js";
import type {
  IntelligenceCycle,
  IntelligenceCycleStage,
  IntelligenceCycleStatus,
  IntelligenceDecision,
  IntelligenceExperiment,
  IntelligenceFeedback,
  IntelligenceLearning,
  IntelligenceMetric,
  IntelligenceSignal,
} from "./types.js";

export interface IntelligenceFoundationState {
  readonly cycles: readonly IntelligenceCycle[];
  readonly signals: readonly IntelligenceSignal[];
  readonly metrics: readonly IntelligenceMetric[];
  readonly decisions: readonly IntelligenceDecision[];
  readonly experiments: readonly IntelligenceExperiment[];
  readonly learnings: readonly IntelligenceLearning[];
  readonly feedback: readonly IntelligenceFeedback[];
  readonly fingerprint: string;
}

export interface IntelligenceFoundationInput {
  readonly cycles?: readonly IntelligenceCycle[];
  readonly signals?: readonly IntelligenceSignal[];
  readonly metrics?: readonly IntelligenceMetric[];
  readonly decisions?: readonly IntelligenceDecision[];
  readonly experiments?: readonly IntelligenceExperiment[];
  readonly learnings?: readonly IntelligenceLearning[];
  readonly feedback?: readonly IntelligenceFeedback[];
}

export interface IntelligenceFoundationRunInput {
  readonly objective: string;
  readonly cycleId: string;
  readonly parentCycleId?: string;
  readonly stage?: IntelligenceCycleStage;
  readonly status?: IntelligenceCycleStatus;
  readonly entityIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly observationIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly analysisIds?: readonly string[];
  readonly decisionIds?: readonly string[];
  readonly experimentIds?: readonly string[];
  readonly outcomeIds?: readonly string[];
  readonly learningIds?: readonly string[];
  readonly feedbackIds?: readonly string[];
  readonly lineage?: IntelligenceCycle["lineage"];
  readonly completedAt?: string;
}

export interface IntelligenceFoundationRunResult {
  readonly cycle: IntelligenceCycle;
  readonly state: IntelligenceFoundationState;
  readonly cycleFingerprint: string;
  readonly stateFingerprint: string;
  readonly accepted: boolean;
  readonly blocked: boolean;
  readonly warnings: readonly string[];
}

export interface IntelligenceFoundationInvariantReport {
  readonly valid: boolean;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly cycleCount: number;
  readonly signalCount: number;
  readonly metricCount: number;
  readonly decisionCount: number;
  readonly experimentCount: number;
  readonly learningCount: number;
  readonly feedbackCount: number;
  readonly fingerprint: string;
}

const TERMINAL_CYCLE_STATUSES:
  readonly IntelligenceCycleStatus[] = [
    "COMPLETED",
    "FAILED",
    "RETIRED",
  ];

function requireNonEmpty(
  value: string,
  field: string,
): string {
  invariant(
    typeof value === "string" &&
      value.trim().length > 0,
    "V8-INTELLIGENCE-FOUNDATION-VALUE-REQUIRED",
    `${field} must be non-empty`,
  );

  return value.trim();
}

function normalizeIds(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  const normalized = (values ?? []).map(
    (value) =>
      requireNonEmpty(
        value,
        field,
      ),
  );

  return Object.freeze(
    [...new Set(normalized)].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
  );
}

function sortById<T>(
  values: readonly T[],
  getId: (value: T) => string,
): readonly T[] {
  return Object.freeze(
    [...values].sort(
      (left, right) =>
        getId(left).localeCompare(
          getId(right),
        ),
    ),
  );
}

function assertUniqueIds(
  values: readonly string[],
  entity: string,
): void {
  const seen = new Set<string>();

  for (const id of values) {
    invariant(
      !seen.has(id),
      "V8-INTELLIGENCE-FOUNDATION-DUPLICATE-ID",
      `duplicate ${entity} id: ${id}`,
    );

    seen.add(id);
  }
}

function serializeState(
  state: IntelligenceFoundationState,
): Record<string, unknown> {
  return {
    cycles: state.cycles.map(
      (cycle) => ({
        cycleId:
          cycle.cycleId,
        fingerprint:
          cycle.fingerprint,
      }),
    ),
    signals: state.signals.map(
      (signal) => ({
        signalId:
          signal.signalId,
        fingerprint:
          signal.fingerprint,
      }),
    ),
    metrics: state.metrics.map(
      (metric) => ({
        metricId:
          metric.metricId,
        fingerprint:
          metric.fingerprint,
      }),
    ),
    decisions: state.decisions.map(
      (decision) => ({
        decisionId:
          decision.decisionId,
        fingerprint:
          decision.fingerprint,
      }),
    ),
    experiments:
      state.experiments.map(
        (experiment) => ({
          experimentId:
            experiment.experimentId,
          fingerprint:
            experiment.fingerprint,
        }),
      ),
    learnings:
      state.learnings.map(
        (learning) => ({
          learningId:
            learning.learningId,
          fingerprint:
            learning.fingerprint,
        }),
      ),
    feedback:
      state.feedback.map(
        (feedback) => ({
          feedbackId:
            feedback.feedbackId,
          fingerprint:
            feedback.fingerprint,
        }),
      ),
  };
}

function calculateStateFingerprint(
  state: IntelligenceFoundationState,
): string {
  return contentFingerprint(
    serializeState(state),
  );
}

function normalizeState(
  input: IntelligenceFoundationInput,
): IntelligenceFoundationState {
  const cycles = sortById(
    input.cycles ?? [],
    (item) => item.cycleId,
  );

  const signals = sortById(
    input.signals ?? [],
    (item) => item.signalId,
  );

  const metrics = sortById(
    input.metrics ?? [],
    (item) => item.metricId,
  );

  const decisions = sortById(
    input.decisions ?? [],
    (item) => item.decisionId,
  );

  const experiments =
    sortById(
      input.experiments ?? [],
      (item) =>
        item.experimentId,
    );

  const learnings =
    sortById(
      input.learnings ?? [],
      (item) =>
        item.learningId,
    );

  const feedback =
    sortById(
      input.feedback ?? [],
      (item) =>
        item.feedbackId,
    );

  const provisional:
    IntelligenceFoundationState = {
    cycles,
    signals,
    metrics,
    decisions,
    experiments,
    learnings,
    feedback,
    fingerprint:
      "" as IntelligenceFoundationState["fingerprint"],
  };

  return Object.freeze({
    ...provisional,
    fingerprint:
      calculateStateFingerprint(
        provisional,
      ),
  });
}

function assertReferenceIds(
  ids: readonly string[],
  available: ReadonlySet<string>,
  ownerType: string,
  ownerId: string,
  referenceType: string,
): void {
  for (const id of ids) {
    invariant(
      available.has(id),
      "V8-INTELLIGENCE-FOUNDATION-ORPHAN-REFERENCE",
      `${ownerType} ${ownerId} references missing ${referenceType} ${id}`,
    );
  }
}

function assertCrossEntityReferences(
  state: IntelligenceFoundationState,
): void {
  const cycleIds = new Set(
    state.cycles.map(
      (item) => item.cycleId,
    ),
  );

  const signalIds = new Set(
    state.signals.map(
      (item) => item.signalId,
    ),
  );

  const metricIds = new Set(
    state.metrics.map(
      (item) => item.metricId,
    ),
  );

  const decisionIds = new Set(
    state.decisions.map(
      (item) => item.decisionId,
    ),
  );

  const experimentIds = new Set(
    state.experiments.map(
      (item) => item.experimentId,
    ),
  );

  const learningIds = new Set(
    state.learnings.map(
      (item) => item.learningId,
    ),
  );

  const feedbackIds = new Set(
    state.feedback.map(
      (item) => item.feedbackId,
    ),
  );

  for (const cycle of state.cycles) {
    if (
      cycle.parentCycleId !==
      undefined
    ) {
      invariant(
        cycleIds.has(
          cycle.parentCycleId,
        ),
        "V8-INTELLIGENCE-FOUNDATION-ORPHAN-REFERENCE",
        `cycle ${cycle.cycleId} references missing parent cycle ${cycle.parentCycleId}`,
      );
    }

    assertReferenceIds(
      cycle.signalIds,
      signalIds,
      "cycle",
      cycle.cycleId,
      "signal",
    );

    assertReferenceIds(
      cycle.metricIds,
      metricIds,
      "cycle",
      cycle.cycleId,
      "metric",
    );

    assertReferenceIds(
      cycle.decisionIds,
      decisionIds,
      "cycle",
      cycle.cycleId,
      "decision",
    );

    assertReferenceIds(
      cycle.experimentIds,
      experimentIds,
      "cycle",
      cycle.cycleId,
      "experiment",
    );

    assertReferenceIds(
      cycle.learningIds,
      learningIds,
      "cycle",
      cycle.cycleId,
      "learning",
    );

    assertReferenceIds(
      cycle.feedbackIds,
      feedbackIds,
      "cycle",
      cycle.cycleId,
      "feedback",
    );
  }

  for (const metric of state.metrics) {
    assertReferenceIds(
      metric.signalIds,
      signalIds,
      "metric",
      metric.metricId,
      "signal",
    );
  }

  for (const decision of state.decisions) {
    assertReferenceIds(
      decision.signalIds,
      signalIds,
      "decision",
      decision.decisionId,
      "signal",
    );

    assertReferenceIds(
      decision.metricIds,
      metricIds,
      "decision",
      decision.decisionId,
      "metric",
    );
  }

  for (const experiment of state.experiments) {
    assertReferenceIds(
      experiment.signalIds,
      signalIds,
      "experiment",
      experiment.experimentId,
      "signal",
    );

    assertReferenceIds(
      experiment.metricIds,
      metricIds,
      "experiment",
      experiment.experimentId,
      "metric",
    );
  }

  for (const learning of state.learnings) {
    assertReferenceIds(
      learning.sourceSignalIds,
      signalIds,
      "learning",
      learning.learningId,
      "signal",
    );

    assertReferenceIds(
      learning.sourceExperimentIds,
      experimentIds,
      "learning",
      learning.learningId,
      "experiment",
    );

    assertReferenceIds(
      learning.supportingMetricIds,
      metricIds,
      "learning",
      learning.learningId,
      "metric",
    );
  }

  for (const feedback of state.feedback) {
    assertReferenceIds(
      feedback.signalIds,
      signalIds,
      "feedback",
      feedback.feedbackId,
      "signal",
    );

    assertReferenceIds(
      feedback.metricIds,
      metricIds,
      "feedback",
      feedback.feedbackId,
      "metric",
    );
  }
}

export function assertIntelligenceFoundationState(
  state: IntelligenceFoundationState,
): void {
  assertUniqueIds(
    state.cycles.map(
      (item) => item.cycleId,
    ),
    "cycle",
  );

  assertUniqueIds(
    state.signals.map(
      (item) => item.signalId,
    ),
    "signal",
  );

  assertUniqueIds(
    state.metrics.map(
      (item) => item.metricId,
    ),
    "metric",
  );

  assertUniqueIds(
    state.decisions.map(
      (item) => item.decisionId,
    ),
    "decision",
  );

  assertUniqueIds(
    state.experiments.map(
      (item) =>
        item.experimentId,
    ),
    "experiment",
  );

  assertUniqueIds(
    state.learnings.map(
      (item) =>
        item.learningId,
    ),
    "learning",
  );

  assertUniqueIds(
    state.feedback.map(
      (item) =>
        item.feedbackId,
    ),
    "feedback",
  );

  for (const cycle of state.cycles) {
    assertIntelligenceCycleIntegrity(
      cycle,
    );
  }

  for (const signal of state.signals) {
    assertSignalIntegrity(
      signal,
    );
  }

  for (const metric of state.metrics) {
    assertMetricIntegrity(
      metric,
    );
  }

  for (const decision of state.decisions) {
    assertDecisionIntegrity(
      decision,
    );
  }

  for (const experiment of state.experiments) {
    assertExperimentIntegrity(
      experiment,
    );
  }

  for (const learning of state.learnings) {
    assertLearningIntegrity(
      learning,
    );
  }

  for (const feedback of state.feedback) {
    assertFeedbackIntegrity(
      feedback,
    );
  }

  assertIntelligenceCycleCollection(
    state.cycles,
  );

  assertSignalCollection(
    state.signals,
  );

  assertMetricCollection(
    state.metrics,
  );

  assertDecisionCollection(
    state.decisions,
  );

  assertExperimentCollection(
    state.experiments,
  );

  assertLearningCollection(
    state.learnings,
  );

  assertFeedbackCollection(
    state.feedback,
  );

  assertCrossEntityReferences(
    state,
  );

  invariant(
    state.fingerprint ===
      calculateStateFingerprint(
        state,
      ),
    "V8-INTELLIGENCE-FOUNDATION-FINGERPRINT",
    "foundation state fingerprint mismatch",
  );
}

export function createIntelligenceFoundationState(
  input: IntelligenceFoundationInput = {},
): IntelligenceFoundationState {
  const state =
    normalizeState(input);

  assertIntelligenceFoundationState(
    state,
  );

  return state;
}

function mergeById<T>(
  left: readonly T[],
  right: readonly T[],
  getId: (value: T) => string,
  entity: string,
): readonly T[] {
  const merged =
    new Map<string, T>();

  for (const item of left) {
    merged.set(
      getId(item),
      item,
    );
  }

  for (const item of right) {
    const id = getId(item);
    const existing =
      merged.get(id);

    if (
      existing ===
      undefined
    ) {
      merged.set(
        id,
        item,
      );
      continue;
    }

    invariant(
      JSON.stringify(
        existing,
      ) ===
        JSON.stringify(
          item,
        ),
      "V8-INTELLIGENCE-FOUNDATION-CONFLICT",
      `conflicting ${entity} definitions for id ${id}`,
    );
  }

  return Object.freeze(
    [...merged.values()],
  );
}

export function mergeIntelligenceFoundationState(
  left: IntelligenceFoundationState,
  right: IntelligenceFoundationState,
): IntelligenceFoundationState {
  assertIntelligenceFoundationState(
    left,
  );

  assertIntelligenceFoundationState(
    right,
  );

  return createIntelligenceFoundationState({
    cycles: mergeById(
      left.cycles,
      right.cycles,
      (item) =>
        item.cycleId,
      "cycle",
    ),
    signals: mergeById(
      left.signals,
      right.signals,
      (item) =>
        item.signalId,
      "signal",
    ),
    metrics: mergeById(
      left.metrics,
      right.metrics,
      (item) =>
        item.metricId,
      "metric",
    ),
    decisions: mergeById(
      left.decisions,
      right.decisions,
      (item) =>
        item.decisionId,
      "decision",
    ),
    experiments: mergeById(
      left.experiments,
      right.experiments,
      (item) =>
        item.experimentId,
      "experiment",
    ),
    learnings: mergeById(
      left.learnings,
      right.learnings,
      (item) =>
        item.learningId,
      "learning",
    ),
    feedback: mergeById(
      left.feedback,
      right.feedback,
      (item) =>
        item.feedbackId,
      "feedback",
    ),
  });
}

export function runIntelligenceFoundationCycle(
  input: IntelligenceFoundationRunInput,
  existing: IntelligenceFoundationInput = {},
): IntelligenceFoundationRunResult {
  const objective =
    requireNonEmpty(
      input.objective,
      "objective",
    );

  const cycleId =
    requireNonEmpty(
      input.cycleId,
      "cycleId",
    );

  const baseState =
    createIntelligenceFoundationState(
      existing,
    );

  const signalIds =
    normalizeIds(
      input.signalIds,
      "signalId",
    );

  const observationIds =
    normalizeIds(
      input.observationIds,
      "observationId",
    );

  const metricIds =
    normalizeIds(
      input.metricIds,
      "metricId",
    );

  const analysisIds =
    normalizeIds(
      input.analysisIds,
      "analysisId",
    );

  const decisionIds =
    normalizeIds(
      input.decisionIds,
      "decisionId",
    );

  const experimentIds =
    normalizeIds(
      input.experimentIds,
      "experimentId",
    );

  const outcomeIds =
    normalizeIds(
      input.outcomeIds,
      "outcomeId",
    );

  const learningIds =
    normalizeIds(
      input.learningIds,
      "learningId",
    );

  const feedbackIds =
    normalizeIds(
      input.feedbackIds,
      "feedbackId",
    );

  const entityIds =
    normalizeIds(
      input.entityIds,
      "entityId",
    );

  const existingCycle =
    baseState.cycles.find(
      (cycle) =>
        cycle.cycleId ===
        cycleId,
    );

  let cycle: IntelligenceCycle;

  if (
    existingCycle ===
    undefined
  ) {
    const sequence =
      input.parentCycleId ===
      undefined
        ? 0
        : 1;

    cycle =
      createIntelligenceCycle({
        cycleId,
        sequence,
        stage:
          input.stage ??
          "DISCOVER",
        status:
          input.status ??
          "INITIALIZED",
        parentCycleId:
          input.parentCycleId,
        entityIds,
        signalIds,
        observationIds,
        metricIds,
        analysisIds,
        decisionIds,
        experimentIds,
        outcomeIds,
        learningIds,
        feedbackIds,
        lineage:
          input.lineage,
        completedAt:
          input.completedAt,
      });
  } else {
    invariant(
      !TERMINAL_CYCLE_STATUSES.includes(
        existingCycle.status,
      ),
      "V8-INTELLIGENCE-FOUNDATION-TERMINAL-CYCLE",
      `terminal cycle cannot be reused: ${cycleId}`,
    );

    cycle =
      advanceIntelligenceCycle({
        cycle:
          existingCycle,
        stage:
          input.stage,
        status:
          input.status,
        completedAt:
          input.completedAt,
        entityIds,
        signalIds,
        observationIds,
        metricIds,
        analysisIds,
        decisionIds,
        experimentIds,
        outcomeIds,
        learningIds,
        feedbackIds,
        lineage:
          input.lineage,
      });
  }

  const warnings = [
    `cycle objective: ${objective}`,
  ];

  const nextStateInput:
    IntelligenceFoundationInput = {
    cycles: [
      ...baseState.cycles.filter(
        (item) =>
          item.cycleId !==
          cycle.cycleId,
      ),
      cycle,
    ],
    signals:
      baseState.signals,
    metrics:
      baseState.metrics,
    decisions:
      baseState.decisions,
    experiments:
      baseState.experiments,
    learnings:
      baseState.learnings,
    feedback:
      baseState.feedback,
  };

  const state =
    createIntelligenceFoundationState(
      nextStateInput,
    );

  const blocked =
    cycle.status ===
    "BLOCKED";

  const accepted =
    !blocked &&
    cycle.status !==
      "FAILED";

  return {
    cycle,
    state,
    cycleFingerprint:
      cycle.fingerprint,
    stateFingerprint:
      state.fingerprint,
    accepted,
    blocked,
    warnings:
      Object.freeze(
        warnings,
      ),
  };
}

export function advanceFoundationCycle(
  cycle: IntelligenceCycle,
  input: Omit<
    IntelligenceFoundationRunInput,
    "objective" | "cycleId"
  > & {
    readonly objective?: string;
  },
): IntelligenceCycle {
  assertIntelligenceCycleIntegrity(
    cycle,
  );

  const next =
    advanceIntelligenceCycle({
      cycle,
      stage:
        input.stage,
      status:
        input.status,
      completedAt:
        input.completedAt,
      entityIds:
        normalizeIds(
          input.entityIds,
          "entityId",
        ),
      signalIds:
        normalizeIds(
          input.signalIds,
          "signalId",
        ),
      observationIds:
        normalizeIds(
          input.observationIds,
          "observationId",
        ),
      metricIds:
        normalizeIds(
          input.metricIds,
          "metricId",
        ),
      analysisIds:
        normalizeIds(
          input.analysisIds,
          "analysisId",
        ),
      decisionIds:
        normalizeIds(
          input.decisionIds,
          "decisionId",
        ),
      experimentIds:
        normalizeIds(
          input.experimentIds,
          "experimentId",
        ),
      outcomeIds:
        normalizeIds(
          input.outcomeIds,
          "outcomeId",
        ),
      learningIds:
        normalizeIds(
          input.learningIds,
          "learningId",
        ),
      feedbackIds:
        normalizeIds(
          input.feedbackIds,
          "feedbackId",
        ),
      lineage:
        input.lineage,
    });

  assertIntelligenceCycleIntegrity(
    next,
  );

  return next;
}

export function foundationStateFingerprint(
  state: IntelligenceFoundationState,
): string {
  assertIntelligenceFoundationState(
    state,
  );

  return state.fingerprint;
}

export function buildFoundationInvariantReport(
  state: IntelligenceFoundationState,
): IntelligenceFoundationInvariantReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    assertIntelligenceFoundationState(
      state,
    );
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  for (const cycle of state.cycles) {
    if (
      cycle.status ===
      "BLOCKED"
    ) {
      warnings.push(
        `cycle ${cycle.cycleId} is BLOCKED`,
      );
    }

    if (
      cycle.status ===
      "FAILED"
    ) {
      warnings.push(
        `cycle ${cycle.cycleId} is FAILED`,
      );
    }
  }

  const reportPayload = {
    valid:
      errors.length === 0,
    errors:
      Object.freeze(
        [...errors],
      ),
    warnings:
      Object.freeze(
        [...warnings],
      ),
    cycleCount:
      state.cycles.length,
    signalCount:
      state.signals.length,
    metricCount:
      state.metrics.length,
    decisionCount:
      state.decisions.length,
    experimentCount:
      state.experiments.length,
    learningCount:
      state.learnings.length,
    feedbackCount:
      state.feedback.length,
  };

  return {
    ...reportPayload,
    fingerprint:
      contentFingerprint(
        reportPayload,
      ),
  };
}