import { invariant } from "../../constitution/invariants.js";
import {
  clamp,
  contentFingerprint,
  normalizeText,
  uniqueStrings,
} from "../shared.js";
import {
  assertIntelligenceCycleCollection,
  assertIntelligenceCycleIntegrity,
  createIntelligenceCycle,
  advanceIntelligenceCycle,
  type CreateIntelligenceCycleInput,
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
  readonly rootCycleId?: string;
  readonly scope?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly decisionIds?: readonly string[];
  readonly experimentIds?: readonly string[];
  readonly learningIds?: readonly string[];
  readonly feedbackIds?: readonly string[];
  readonly confidence?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
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

export interface IntelligenceFoundationEngineOptions {
  readonly strict?: boolean;
  readonly requireReferences?: boolean;
  readonly minimumConfidence?: number;
  readonly rejectTerminalCycleReuse?: boolean;
}

function requireNonEmpty(
  value: string,
  field: string,
): string {
  const normalized = normalizeText(value);

  invariant(
    normalized.length > 0,
    `${field} must not be empty`,
  );

  return normalized;
}

function normalizeConfidence(
  value: number | undefined,
): number {
  const normalized = value ?? 0;

  invariant(
    Number.isFinite(normalized),
    "engine confidence must be finite",
  );

  invariant(
    normalized >= 0 &&
      normalized <= 1,
    "engine confidence must be between 0 and 1",
  );

  return (
    Math.round(
      clamp(normalized, 0, 1) *
        1_000_000,
    ) / 1_000_000
  );
}

function normalizeIds(
  values: readonly string[] | undefined,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) =>
      requireNonEmpty(
        value,
        "foundation reference id",
      ),
    ),
  );
}

function normalizeMetadata(
  metadata:
    | Readonly<Record<string, unknown>>
    | undefined,
): Readonly<Record<string, unknown>> {
  if (!metadata) {
    return {};
  }

  const normalizeValue = (
    value: unknown,
  ): unknown => {
    if (
      value === null ||
      typeof value === "string" ||
      typeof value === "boolean"
    ) {
      return value;
    }

    if (typeof value === "number") {
      invariant(
        Number.isFinite(value),
        "foundation metadata contains invalid number",
      );

      return value;
    }

    if (Array.isArray(value)) {
      return value.map(
        normalizeValue,
      );
    }

    if (typeof value === "object") {
      const record =
        value as Record<
          string,
          unknown
        >;

      const result:
        Record<
          string,
          unknown
        > = {};

      for (
        const key of Object.keys(
          record,
        ).sort()
      ) {
        result[key] =
          normalizeValue(
            record[key],
          );
      }

      return result;
    }

    invariant(
      false,
      "foundation metadata contains unsupported value",
    );
  };

  return normalizeValue(
    metadata,
  ) as Readonly<
    Record<string, unknown>
  >;
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
        (item) => ({
          feedbackId:
            item.feedbackId,
          fingerprint:
            item.fingerprint,
        }),
      ),
  };
}

function stateFingerprint(
  state: IntelligenceFoundationState,
): string {
  return contentFingerprint(
    serializeState(state),
  );
}

function normalizeState(
  input: IntelligenceFoundationInput,
): IntelligenceFoundationState {
  const cycles = [
    ...(input.cycles ?? []),
  ].sort((left, right) =>
    left.cycleId.localeCompare(
      right.cycleId,
    ),
  );

  const signals = [
    ...(input.signals ?? []),
  ].sort((left, right) =>
    left.signalId.localeCompare(
      right.signalId,
    ),
  );

  const metrics = [
    ...(input.metrics ?? []),
  ].sort((left, right) =>
    left.metricId.localeCompare(
      right.metricId,
    ),
  );

  const decisions = [
    ...(input.decisions ?? []),
  ].sort((left, right) =>
    left.decisionId.localeCompare(
      right.decisionId,
    ),
  );

  const experiments = [
    ...(input.experiments ?? []),
  ].sort((left, right) =>
    left.experimentId.localeCompare(
      right.experimentId,
    ),
  );

  const learnings = [
    ...(input.learnings ?? []),
  ].sort((left, right) =>
    left.learningId.localeCompare(
      right.learningId,
    ),
  );

  const feedback = [
    ...(input.feedback ?? []),
  ].sort((left, right) =>
    left.feedbackId.localeCompare(
      right.feedbackId,
    ),
  );

  const provisional: IntelligenceFoundationState =
    {
      cycles,
      signals,
      metrics,
      decisions,
      experiments,
      learnings,
      feedback,
      fingerprint: "",
    };

  return {
    ...provisional,
    fingerprint:
      stateFingerprint(
        provisional,
      ),
  };
}

function assertUniqueIds(
  values: readonly string[],
  entity: string,
): void {
  const seen =
    new Set<string>();

  for (const value of values) {
    invariant(
      !seen.has(value),
      `duplicate ${entity} id: ${value}`,
    );

    seen.add(value);
  }
}

function assertCrossEntityReferences(
  state: IntelligenceFoundationState,
): void {
  const cycleIds =
    new Set(
      state.cycles.map(
        (item) =>
          item.cycleId,
      ),
    );

  const signalIds =
    new Set(
      state.signals.map(
        (item) =>
          item.signalId,
      ),
    );

  const metricIds =
    new Set(
      state.metrics.map(
        (item) =>
          item.metricId,
      ),
    );

  const decisionIds =
    new Set(
      state.decisions.map(
        (item) =>
          item.decisionId,
      ),
    );

  const experimentIds =
    new Set(
      state.experiments.map(
        (item) =>
          item.experimentId,
      ),
    );

  const learningIds =
    new Set(
      state.learnings.map(
        (item) =>
          item.learningId,
      ),
    );

  const feedbackIds =
    new Set(
      state.feedback.map(
        (item) =>
          item.feedbackId,
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
        `cycle ${cycle.cycleId} references missing parent cycle ${cycle.parentCycleId}`,
      );
    }

    for (const id of cycle.signalIds) {
      invariant(
        signalIds.has(id),
        `cycle ${cycle.cycleId} references missing signal ${id}`,
      );
    }

    for (const id of cycle.metricIds) {
      invariant(
        metricIds.has(id),
        `cycle ${cycle.cycleId} references missing metric ${id}`,
      );
    }

    for (const id of cycle.decisionIds) {
      invariant(
        decisionIds.has(id),
        `cycle ${cycle.cycleId} references missing decision ${id}`,
      );
    }

    for (const id of cycle.experimentIds) {
      invariant(
        experimentIds.has(id),
        `cycle ${cycle.cycleId} references missing experiment ${id}`,
      );
    }

    for (const id of cycle.learningIds) {
      invariant(
        learningIds.has(id),
        `cycle ${cycle.cycleId} references missing learning ${id}`,
      );
    }

    for (const id of cycle.feedbackIds) {
      invariant(
        feedbackIds.has(id),
        `cycle ${cycle.cycleId} references missing feedback ${id}`,
      );
    }
  }

  for (const decision of state.decisions) {
    for (const id of decision.signalIds) {
      invariant(
        signalIds.has(id),
        `decision ${decision.decisionId} references missing signal ${id}`,
      );
    }

    for (const id of decision.metricIds) {
      invariant(
        metricIds.has(id),
        `decision ${decision.decisionId} references missing metric ${id}`,
      );
    }
  }

  for (const experiment of state.experiments) {
    for (const id of experiment.metricIds) {
      invariant(
        metricIds.has(id),
        `experiment ${experiment.experimentId} references missing metric ${id}`,
      );
    }

    for (const id of experiment.decisionIds) {
      invariant(
        decisionIds.has(id),
        `experiment ${experiment.experimentId} references missing decision ${id}`,
      );
    }
  }

  for (const learning of state.learnings) {
    for (const id of learning.sourceDecisionIds) {
      invariant(
        decisionIds.has(id),
        `learning ${learning.learningId} references missing decision ${id}`,
      );
    }

    for (const id of learning.signalIds) {
      invariant(
        signalIds.has(id),
        `learning ${learning.learningId} references missing signal ${id}`,
      );
    }
  }

  for (const item of state.feedback) {
    for (const id of item.sourceDecisionIds) {
      invariant(
        decisionIds.has(id),
        `feedback ${item.feedbackId} references missing decision ${id}`,
      );
    }

    for (const id of item.sourceSignalIds) {
      invariant(
        signalIds.has(id),
        `feedback ${item.feedbackId} references missing signal ${id}`,
      );
    }
  }
}

export function assertIntelligenceFoundationState(
  state: IntelligenceFoundationState,
  options: IntelligenceFoundationEngineOptions = {},
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

  for (const item of state.feedback) {
    assertFeedbackIntegrity(
      item,
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
      stateFingerprint(state),
    "foundation state fingerprint mismatch",
  );

  if (
    options.minimumConfidence !==
    undefined
  ) {
    invariant(
      Number.isFinite(
        options.minimumConfidence,
      ),
      "minimumConfidence must be finite",
    );

    invariant(
      options.minimumConfidence >=
        0 &&
        options.minimumConfidence <=
          1,
      "minimumConfidence must be between 0 and 1",
    );
  }
}

export function createIntelligenceFoundationState(
  input: IntelligenceFoundationInput = {},
  options: IntelligenceFoundationEngineOptions = {},
): IntelligenceFoundationState {
  const state =
    normalizeState(input);

  assertIntelligenceFoundationState(
    state,
    options,
  );

  return state;
}

export function mergeIntelligenceFoundationState(
  left: IntelligenceFoundationState,
  right: IntelligenceFoundationState,
  options: IntelligenceFoundationEngineOptions = {},
): IntelligenceFoundationState {
  assertIntelligenceFoundationState(
    left,
    options,
  );

  assertIntelligenceFoundationState(
    right,
    options,
  );

  const cycles = mergeById(
    left.cycles,
    right.cycles,
    (item) =>
      item.cycleId,
    "cycle",
  );

  const signals = mergeById(
    left.signals,
    right.signals,
    (item) =>
      item.signalId,
    "signal",
  );

  const metrics = mergeById(
    left.metrics,
    right.metrics,
    (item) =>
      item.metricId,
    "metric",
  );

  const decisions = mergeById(
    left.decisions,
    right.decisions,
    (item) =>
      item.decisionId,
    "decision",
  );

  const experiments =
    mergeById(
      left.experiments,
      right.experiments,
      (item) =>
        item.experimentId,
      "experiment",
    );

  const learnings =
    mergeById(
      left.learnings,
      right.learnings,
      (item) =>
        item.learningId,
      "learning",
    );

  const feedback =
    mergeById(
      left.feedback,
      right.feedback,
      (item) =>
        item.feedbackId,
      "feedback",
    );

  return createIntelligenceFoundationState(
    {
      cycles,
      signals,
      metrics,
      decisions,
      experiments,
      learnings,
      feedback,
    },
    options,
  );
}

function mergeById<T>(
  left: readonly T[],
  right: readonly T[],
  getId: (value: T) => string,
  entity: string,
): readonly T[] {
  const map =
    new Map<string, T>();

  for (const item of left) {
    map.set(
      getId(item),
      item,
    );
  }

  for (const item of right) {
    const id = getId(item);
    const existing =
      map.get(id);

    if (!existing) {
      map.set(id, item);
      continue;
    }

    invariant(
      JSON.stringify(
        existing,
      ) ===
        JSON.stringify(item),
      `conflicting ${entity} definitions for id ${id}`,
    );
  }

  return [...map.values()];
}

export function runIntelligenceFoundationCycle(
  input: IntelligenceFoundationRunInput,
  existing: IntelligenceFoundationInput = {},
  options: IntelligenceFoundationEngineOptions = {},
): IntelligenceFoundationRunResult {
  const strict =
    options.strict ?? true;

  const requireReferences =
    options.requireReferences ??
    true;

  const minimumConfidence =
    options.minimumConfidence ??
    0;

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

  const metadata =
    normalizeMetadata(
      input.metadata,
    );

  const baseState =
    createIntelligenceFoundationState(
      existing,
      options,
    );

  const existingCycle =
    baseState.cycles.find(
      (cycle) =>
        cycle.cycleId ===
        cycleId,
    );

  if (
    existingCycle &&
    (options.rejectTerminalCycleReuse ??
      true)
  ) {
    invariant(
      ![
        "COMPLETED",
        "FAILED",
        "BLOCKED",
      ].includes(
        existingCycle.status,
      ),
      `terminal cycle cannot be reused: ${cycleId}`,
    );
  }

  const signalIds =
    normalizeIds(
      input.signalIds,
    );

  const metricIds =
    normalizeIds(
      input.metricIds,
    );

  const decisionIds =
    normalizeIds(
      input.decisionIds,
    );

  const experimentIds =
    normalizeIds(
      input.experimentIds,
    );

  const learningIds =
    normalizeIds(
      input.learningIds,
    );

  const feedbackIds =
    normalizeIds(
      input.feedbackIds,
    );

  if (requireReferences) {
    for (const id of signalIds) {
      invariant(
        baseState.signals.some(
          (item) =>
            item.signalId === id,
        ),
        `run references missing signal: ${id}`,
      );
    }

    for (const id of metricIds) {
      invariant(
        baseState.metrics.some(
          (item) =>
            item.metricId === id,
        ),
        `run references missing metric: ${id}`,
      );
    }

    for (const id of decisionIds) {
      invariant(
        baseState.decisions.some(
          (item) =>
            item.decisionId === id,
        ),
        `run references missing decision: ${id}`,
      );
    }

    for (const id of experimentIds) {
      invariant(
        baseState.experiments.some(
          (item) =>
            item.experimentId ===
            id,
        ),
        `run references missing experiment: ${id}`,
      );
    }

    for (const id of learningIds) {
      invariant(
        baseState.learnings.some(
          (item) =>
            item.learningId ===
            id,
        ),
        `run references missing learning: ${id}`,
      );
    }

    for (const id of feedbackIds) {
      invariant(
        baseState.feedback.some(
          (item) =>
            item.feedbackId ===
            id,
        ),
        `run references missing feedback: ${id}`,
      );
    }
  }

  const confidence =
    normalizeConfidence(
      input.confidence,
    );

  if (strict) {
    invariant(
      confidence >=
        minimumConfidence,
      `cycle confidence ${confidence} is below required minimum ${minimumConfidence}`,
    );
  }

  const cycleInput:
    CreateIntelligenceCycleInput =
      {
        cycleId,
        parentCycleId:
          input.parentCycleId,
        rootCycleId:
          input.rootCycleId,
        objective,
        scope:
          input.scope,
        status:
          existingCycle?.status ??
          "ACTIVE",
        signalIds,
        metricIds,
        decisionIds,
        experimentIds,
        learningIds,
        feedbackIds,
        confidence,
        metadata: {
          ...metadata,
          engine:
            "v8-intelligence-foundation",
        },
      };

  const cycle =
    existingCycle
      ? advanceIntelligenceCycle({
          cycle: existingCycle,
          stage: "MEASUREMENT",
          signalIds,
          metricIds,
          decisionIds,
          experimentIds,
          learningIds,
          feedbackIds,
          confidence,
          metadata,
        })
      : createIntelligenceCycle(
          cycleInput,
        );

  const nextCycles =
    existingCycle
      ? baseState.cycles.map(
          (item) =>
            item.cycleId ===
            cycle.cycleId
              ? cycle
              : item,
        )
      : [
          ...baseState.cycles,
          cycle,
        ];

  const state =
    createIntelligenceFoundationState(
      {
        cycles: nextCycles,
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
      },
      options,
    );

  const warnings: string[] = [];

  if (
    cycle.confidence <
    0.5
  ) {
    warnings.push(
      "cycle confidence is below 0.5",
    );
  }

  if (
    cycle.decisionIds.length ===
      0 &&
    cycle.experimentIds.length ===
      0
  ) {
    warnings.push(
      "cycle contains no decision or experiment reference",
    );
  }

  if (
    cycle.learningIds.length ===
      0 &&
    cycle.feedbackIds.length ===
      0
  ) {
    warnings.push(
      "cycle contains no learning or feedback reference",
    );
  }

  const accepted =
    strict
      ? warnings.length === 0
      : true;

  const blocked =
    strict &&
    cycle.confidence <
      minimumConfidence;

  return {
    cycle,
    state,
    cycleFingerprint:
      cycle.fingerprint,
    stateFingerprint:
      state.fingerprint,
    accepted:
      accepted && !blocked,
    blocked,
    warnings,
  };
}

export function advanceFoundationCycle(
  cycle: IntelligenceCycle,
  stage:
    | IntelligenceCycle["stages"][number],
  references: {
    readonly signalIds?: readonly string[];
    readonly metricIds?: readonly string[];
    readonly decisionIds?: readonly string[];
    readonly experimentIds?: readonly string[];
    readonly learningIds?: readonly string[];
    readonly feedbackIds?: readonly string[];
    readonly confidence?: number;
    readonly status?: IntelligenceCycle["status"];
    readonly completedAt?: string;
    readonly metadata?: Readonly<Record<string, unknown>>;
  } = {},
): IntelligenceCycle {
  assertIntelligenceCycleIntegrity(
    cycle,
  );

  return advanceIntelligenceCycle({
    cycle,
    stage,
    status:
      references.status,
    signalIds:
      references.signalIds,
    metricIds:
      references.metricIds,
    decisionIds:
      references.decisionIds,
    experimentIds:
      references.experimentIds,
    learningIds:
      references.learningIds,
    feedbackIds:
      references.feedbackIds,
    confidence:
      references.confidence,
    completedAt:
      references.completedAt,
    metadata:
      references.metadata,
  });
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

  if (
    state.cycles.length ===
    0
  ) {
    warnings.push(
      "foundation contains no intelligence cycles",
    );
  }

  if (
    state.signals.length ===
    0
  ) {
    warnings.push(
      "foundation contains no signals",
    );
  }

  if (
    state.decisions.length ===
    0
  ) {
    warnings.push(
      "foundation contains no decisions",
    );
  }

  if (
    state.feedback.length ===
      0 &&
    state.learnings.length ===
      0
  ) {
    warnings.push(
      "foundation contains no feedback or learning records",
    );
  }

  return {
    valid:
      errors.length === 0,
    errors,
    warnings,
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
    fingerprint:
      state.fingerprint,
  };
}