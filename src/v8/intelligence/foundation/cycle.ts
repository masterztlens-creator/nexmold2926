import { immutable, invariant } from "../../constitution/invariants.js";
import {
  clamp,
  contentFingerprint,
  normalizeText,
  uniqueStrings,
} from "../shared.js";
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

export interface CreateIntelligenceCycleInput {
  readonly cycleId: string;
  readonly parentCycleId?: string;
  readonly rootCycleId?: string;
  readonly objective: string;
  readonly scope?: readonly string[];
  readonly stages?: readonly IntelligenceCycleStage[];
  readonly status?: IntelligenceCycleStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly decisionIds?: readonly string[];
  readonly experimentIds?: readonly string[];
  readonly learningIds?: readonly string[];
  readonly feedbackIds?: readonly string[];
  readonly iteration?: number;
  readonly confidence?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface AdvanceIntelligenceCycleInput {
  readonly cycle: IntelligenceCycle;
  readonly stage: IntelligenceCycleStage;
  readonly status?: IntelligenceCycleStatus;
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly decisionIds?: readonly string[];
  readonly experimentIds?: readonly string[];
  readonly learningIds?: readonly string[];
  readonly feedbackIds?: readonly string[];
  readonly confidence?: number;
  readonly completedAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface CycleFilter {
  readonly status?: IntelligenceCycleStatus;
  readonly stage?: IntelligenceCycleStage;
  readonly parentCycleId?: string;
  readonly rootCycleId?: string;
  readonly minConfidence?: number;
  readonly maxConfidence?: number;
  readonly minIteration?: number;
  readonly maxIteration?: number;
  readonly objectiveContains?: string;
}

export interface CycleGraphNode {
  readonly cycleId: string;
  readonly parentCycleId?: string;
  readonly rootCycleId: string;
  readonly iteration: number;
  readonly status: IntelligenceCycleStatus;
  readonly stage: IntelligenceCycleStage;
}

export interface CycleGraph {
  readonly nodes: readonly CycleGraphNode[];
  readonly roots: readonly string[];
  readonly leaves: readonly string[];
  readonly maxDepth: number;
}

export interface CycleSummary {
  readonly total: number;
  readonly active: number;
  readonly completed: number;
  readonly failed: number;
  readonly blocked: number;
  readonly averageConfidence: number;
  readonly maxIteration: number;
  readonly stages: readonly string[];
  readonly roots: readonly string[];
}

export interface CycleValidationReport {
  readonly valid: boolean;
  readonly cycleId: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly referencedSignalIds: readonly string[];
  readonly referencedMetricIds: readonly string[];
  readonly referencedDecisionIds: readonly string[];
  readonly referencedExperimentIds: readonly string[];
  readonly referencedLearningIds: readonly string[];
  readonly referencedFeedbackIds: readonly string[];
}

const CYCLE_STAGE_ORDER: readonly IntelligenceCycleStage[] = [
  "DISCOVERY",
  "ANALYSIS",
  "STRATEGY",
  "EXPERIMENT",
  "EXECUTION",
  "MEASUREMENT",
  "LEARNING",
  "DECISION",
  "FEEDBACK",
  "COMPLETED",
];

const TERMINAL_STATUSES: readonly IntelligenceCycleStatus[] = [
  "COMPLETED",
  "FAILED",
  "BLOCKED",
];

function requireNonEmpty(value: string, field: string): string {
  const normalized = normalizeText(value);
  invariant(normalized.length > 0, `${field} must not be empty`);
  return normalized;
}

function normalizeTimestamp(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const timestamp = new Date(value);

  invariant(
    Number.isFinite(timestamp.getTime()),
    `${field} must be a valid timestamp`,
  );

  return timestamp.toISOString();
}

function defaultTimestamp(): string {
  return new Date(0).toISOString();
}

function normalizeConfidence(value: number | undefined): number {
  const normalized = value ?? 0;

  invariant(
    Number.isFinite(normalized),
    "cycle confidence must be finite",
  );

  invariant(
    normalized >= 0 && normalized <= 1,
    "cycle confidence must be between 0 and 1",
  );

  return Math.round(clamp(normalized, 0, 1) * 1_000_000) / 1_000_000;
}

function normalizeIteration(value: number | undefined): number {
  const normalized = value ?? 0;

  invariant(
    Number.isFinite(normalized),
    "cycle iteration must be finite",
  );

  invariant(
    Number.isInteger(normalized),
    "cycle iteration must be an integer",
  );

  invariant(
    normalized >= 0,
    "cycle iteration must be non-negative",
  );

  return normalized;
}

function normalizeIds(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) => requireNonEmpty(value, field)),
  );
}

function normalizeScope(
  values: readonly string[] | undefined,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) =>
      requireNonEmpty(value, "cycle scope"),
    ),
  );
}

function normalizeStages(
  stages: readonly IntelligenceCycleStage[] | undefined,
): readonly IntelligenceCycleStage[] {
  if (!stages || stages.length === 0) {
    return ["DISCOVERY"];
  }

  const normalized = uniqueStrings(
    stages.map((stage) =>
      requireNonEmpty(stage, "cycle stage"),
    ),
  ) as IntelligenceCycleStage[];

  for (const stage of normalized) {
    invariant(
      CYCLE_STAGE_ORDER.includes(stage),
      `unknown intelligence cycle stage: ${stage}`,
    );
  }

  return [...normalized].sort(
    (left, right) =>
      CYCLE_STAGE_ORDER.indexOf(left) -
      CYCLE_STAGE_ORDER.indexOf(right),
  );
}

function normalizeStatus(
  status: IntelligenceCycleStatus | undefined,
): IntelligenceCycleStatus {
  const normalized = status ?? "ACTIVE";

  invariant(
    [
      "PLANNED",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "FAILED",
      "BLOCKED",
    ].includes(normalized),
    `unknown intelligence cycle status: ${normalized}`,
  );

  return normalized;
}

function normalizeMetadata(
  metadata: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  if (!metadata) {
    return {};
  }

  const normalizeValue = (value: unknown): unknown => {
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
        "cycle metadata contains invalid number",
      );
      return value;
    }

    if (Array.isArray(value)) {
      return value.map(normalizeValue);
    }

    if (typeof value === "object") {
      const record = value as Record<string, unknown>;
      const result: Record<string, unknown> = {};

      for (const key of Object.keys(record).sort()) {
        result[key] = normalizeValue(record[key]);
      }

      return result;
    }

    invariant(
      false,
      "cycle metadata contains unsupported value",
    );
  };

  return normalizeValue(metadata) as Readonly<Record<string, unknown>>;
}

function serializeCycleForFingerprint(
  cycle: IntelligenceCycle,
): Record<string, unknown> {
  return {
    cycleId: cycle.cycleId,
    parentCycleId: cycle.parentCycleId,
    rootCycleId: cycle.rootCycleId,
    objective: cycle.objective,
    scope: [...cycle.scope],
    stages: [...cycle.stages],
    status: cycle.status,
    startedAt: cycle.startedAt,
    completedAt: cycle.completedAt,
    signalIds: [...cycle.signalIds],
    metricIds: [...cycle.metricIds],
    decisionIds: [...cycle.decisionIds],
    experimentIds: [...cycle.experimentIds],
    learningIds: [...cycle.learningIds],
    feedbackIds: [...cycle.feedbackIds],
    iteration: cycle.iteration,
    confidence: cycle.confidence,
    metadata: normalizeMetadata(cycle.metadata),
  };
}

function cycleFingerprint(
  cycle: IntelligenceCycle,
): string {
  return contentFingerprint(
    serializeCycleForFingerprint(cycle),
  );
}

function stageIndex(
  stage: IntelligenceCycleStage,
): number {
  return CYCLE_STAGE_ORDER.indexOf(stage);
}

function currentStage(
  cycle: IntelligenceCycle,
): IntelligenceCycleStage {
  return cycle.stages[
    cycle.stages.length - 1
  ];
}

function isTerminal(
  status: IntelligenceCycleStatus,
): boolean {
  return TERMINAL_STATUSES.includes(status);
}

function validateStageTransition(
  current: IntelligenceCycleStage,
  next: IntelligenceCycleStage,
): void {
  const currentIndex = stageIndex(current);
  const nextIndex = stageIndex(next);

  invariant(
    currentIndex >= 0,
    `unknown current cycle stage: ${current}`,
  );

  invariant(
    nextIndex >= 0,
    `unknown next cycle stage: ${next}`,
  );

  invariant(
    nextIndex >= currentIndex,
    `cycle stage cannot move backwards: ${current} -> ${next}`,
  );
}

function validateTerminalState(
  status: IntelligenceCycleStatus,
  completedAt: string | undefined,
): void {
  if (isTerminal(status)) {
    invariant(
      completedAt !== undefined,
      `terminal cycle status ${status} requires completedAt`,
    );
  }

  if (!isTerminal(status)) {
    invariant(
      completedAt === undefined,
      `non-terminal cycle status ${status} cannot have completedAt`,
    );
  }
}

function validateCycleReferences(
  cycle: IntelligenceCycle,
  signals: readonly IntelligenceSignal[] | undefined,
  metrics: readonly IntelligenceMetric[] | undefined,
  decisions: readonly IntelligenceDecision[] | undefined,
  experiments: readonly IntelligenceExperiment[] | undefined,
  learnings: readonly IntelligenceLearning[] | undefined,
  feedback: readonly IntelligenceFeedback[] | undefined,
): CycleValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const signalIds = new Set(
    (signals ?? []).map((item) => item.signalId),
  );

  const metricIds = new Set(
    (metrics ?? []).map((item) => item.metricId),
  );

  const decisionIds = new Set(
    (decisions ?? []).map((item) => item.decisionId),
  );

  const experimentIds = new Set(
    (experiments ?? []).map((item) => item.experimentId),
  );

  const learningIds = new Set(
    (learnings ?? []).map((item) => item.learningId),
  );

  const feedbackIds = new Set(
    (feedback ?? []).map((item) => item.feedbackId),
  );

  for (const id of cycle.signalIds) {
    if (!signalIds.has(id)) {
      errors.push(`missing signal reference: ${id}`);
    }
  }

  for (const id of cycle.metricIds) {
    if (!metricIds.has(id)) {
      errors.push(`missing metric reference: ${id}`);
    }
  }

  for (const id of cycle.decisionIds) {
    if (!decisionIds.has(id)) {
      errors.push(`missing decision reference: ${id}`);
    }
  }

  for (const id of cycle.experimentIds) {
    if (!experimentIds.has(id)) {
      errors.push(`missing experiment reference: ${id}`);
    }
  }

  for (const id of cycle.learningIds) {
    if (!learningIds.has(id)) {
      errors.push(`missing learning reference: ${id}`);
    }
  }

  for (const id of cycle.feedbackIds) {
    if (!feedbackIds.has(id)) {
      errors.push(`missing feedback reference: ${id}`);
    }
  }

  if (
    cycle.status === "COMPLETED" &&
    cycle.feedbackIds.length === 0 &&
    cycle.learningIds.length === 0
  ) {
    warnings.push(
      "cycle completed without learning or feedback references",
    );
  }

  if (
    cycle.status === "ACTIVE" &&
    cycle.confidence >= 0.9 &&
    cycle.learningIds.length === 0
  ) {
    warnings.push(
      "high-confidence active cycle has no learning references",
    );
  }

  return {
    valid: errors.length === 0,
    cycleId: cycle.cycleId,
    errors,
    warnings,
    referencedSignalIds: cycle.signalIds,
    referencedMetricIds: cycle.metricIds,
    referencedDecisionIds: cycle.decisionIds,
    referencedExperimentIds: cycle.experimentIds,
    referencedLearningIds: cycle.learningIds,
    referencedFeedbackIds: cycle.feedbackIds,
  };
}

export function createIntelligenceCycle(
  input: CreateIntelligenceCycleInput,
): IntelligenceCycle {
  const cycleId = requireNonEmpty(
    input.cycleId,
    "cycleId",
  );

  const parentCycleId =
    input.parentCycleId === undefined
      ? undefined
      : requireNonEmpty(
          input.parentCycleId,
          "parentCycleId",
        );

  const rootCycleId =
    input.rootCycleId === undefined
      ? parentCycleId ?? cycleId
      : requireNonEmpty(
          input.rootCycleId,
          "rootCycleId",
        );

  const objective = requireNonEmpty(
    input.objective,
    "objective",
  );

  const scope = normalizeScope(
    input.scope,
  );

  const stages = normalizeStages(
    input.stages,
  );

  const status = normalizeStatus(
    input.status,
  );

  const startedAt =
    normalizeTimestamp(
      input.startedAt,
      "cycle startedAt",
    ) ?? defaultTimestamp();

  const completedAt =
    normalizeTimestamp(
      input.completedAt,
      "cycle completedAt",
    );

  const signalIds = normalizeIds(
    input.signalIds,
    "signalId",
  );

  const metricIds = normalizeIds(
    input.metricIds,
    "metricId",
  );

  const decisionIds = normalizeIds(
    input.decisionIds,
    "decisionId",
  );

  const experimentIds = normalizeIds(
    input.experimentIds,
    "experimentId",
  );

  const learningIds = normalizeIds(
    input.learningIds,
    "learningId",
  );

  const feedbackIds = normalizeIds(
    input.feedbackIds,
    "feedbackId",
  );

  const iteration = normalizeIteration(
    input.iteration,
  );

  const confidence = normalizeConfidence(
    input.confidence,
  );

  validateTerminalState(
    status,
    completedAt,
  );

  if (parentCycleId === undefined) {
    invariant(
      rootCycleId === cycleId,
      "root cycle must reference itself as rootCycleId",
    );

    invariant(
      iteration === 0,
      "root cycle must start at iteration 0",
    );
  } else {
    invariant(
      rootCycleId !== cycleId,
      "child cycle cannot use itself as rootCycleId",
    );

    invariant(
      iteration > 0,
      "child cycle must have iteration greater than 0",
    );
  }

  const metadata = normalizeMetadata(
    input.metadata,
  );

  const provisional: IntelligenceCycle = {
    cycleId,
    parentCycleId,
    rootCycleId,
    objective,
    scope,
    stages,
    status,
    startedAt,
    completedAt,
    signalIds,
    metricIds,
    decisionIds,
    experimentIds,
    learningIds,
    feedbackIds,
    iteration,
    confidence,
    metadata,
    fingerprint: "",
  };

  const fingerprint = cycleFingerprint(
    provisional,
  );

  const result: IntelligenceCycle = {
    ...provisional,
    fingerprint,
  };

  immutable(result);
  assertIntelligenceCycleIntegrity(result);

  return result;
}

export function advanceIntelligenceCycle(
  input: AdvanceIntelligenceCycleInput,
): IntelligenceCycle {
  assertIntelligenceCycleIntegrity(
    input.cycle,
  );

  const current = currentStage(
    input.cycle,
  );

  validateStageTransition(
    current,
    input.stage,
  );

  const status =
    input.status ??
    input.cycle.status;

  const completedAt =
    input.completedAt !== undefined
      ? normalizeTimestamp(
          input.completedAt,
          "cycle completedAt",
        )
      : isTerminal(status)
        ? new Date().toISOString()
        : undefined;

  validateTerminalState(
    status,
    completedAt,
  );

  const nextStages =
    input.stage === current
      ? input.cycle.stages
      : [
          ...input.cycle.stages,
          input.stage,
        ];

  const nextSignalIds = normalizeIds(
    [
      ...input.cycle.signalIds,
      ...(input.signalIds ?? []),
    ],
    "signalId",
  );

  const nextMetricIds = normalizeIds(
    [
      ...input.cycle.metricIds,
      ...(input.metricIds ?? []),
    ],
    "metricId",
  );

  const nextDecisionIds = normalizeIds(
    [
      ...input.cycle.decisionIds,
      ...(input.decisionIds ?? []),
    ],
    "decisionId",
  );

  const nextExperimentIds = normalizeIds(
    [
      ...input.cycle.experimentIds,
      ...(input.experimentIds ?? []),
    ],
    "experimentId",
  );

  const nextLearningIds = normalizeIds(
    [
      ...input.cycle.learningIds,
      ...(input.learningIds ?? []),
    ],
    "learningId",
  );

  const nextFeedbackIds = normalizeIds(
    [
      ...input.cycle.feedbackIds,
      ...(input.feedbackIds ?? []),
    ],
    "feedbackId",
  );

  const nextConfidence =
    input.confidence === undefined
      ? input.cycle.confidence
      : normalizeConfidence(
          input.confidence,
        );

  const metadata = normalizeMetadata({
    ...input.cycle.metadata,
    ...input.metadata,
  });

  const provisional: IntelligenceCycle = {
    ...input.cycle,
    stages: nextStages,
    status,
    completedAt,
    signalIds: nextSignalIds,
    metricIds: nextMetricIds,
    decisionIds: nextDecisionIds,
    experimentIds: nextExperimentIds,
    learningIds: nextLearningIds,
    feedbackIds: nextFeedbackIds,
    confidence: nextConfidence,
    metadata,
    fingerprint: "",
  };

  const fingerprint = cycleFingerprint(
    provisional,
  );

  const result: IntelligenceCycle = {
    ...provisional,
    fingerprint,
  };

  immutable(result);
  assertIntelligenceCycleIntegrity(result);

  return result;
}

export function forkIntelligenceCycle(
  parent: IntelligenceCycle,
  input: Omit<
    CreateIntelligenceCycleInput,
    "parentCycleId" | "rootCycleId" | "iteration"
  >,
): IntelligenceCycle {
  assertIntelligenceCycleIntegrity(
    parent,
  );

  return createIntelligenceCycle({
    ...input,
    parentCycleId: parent.cycleId,
    rootCycleId: parent.rootCycleId,
    iteration: parent.iteration + 1,
  });
}

export function cycleFingerprintFor(
  cycle: IntelligenceCycle,
): string {
  return cycleFingerprint(cycle);
}

export function assertIntelligenceCycleIntegrity(
  cycle: IntelligenceCycle,
): void {
  invariant(
    typeof cycle === "object" &&
      cycle !== null,
    "cycle must be an object",
  );

  invariant(
    normalizeText(cycle.cycleId).length > 0,
    "cycleId must not be empty",
  );

  invariant(
    normalizeText(cycle.rootCycleId).length > 0,
    "rootCycleId must not be empty",
  );

  invariant(
    normalizeText(cycle.objective).length > 0,
    `cycle objective must not be empty: ${cycle.cycleId}`,
  );

  invariant(
    cycle.stages.length > 0,
    `cycle must contain at least one stage: ${cycle.cycleId}`,
  );

  for (let index = 0; index < cycle.stages.length; index += 1) {
    const stage = cycle.stages[index];

    invariant(
      CYCLE_STAGE_ORDER.includes(stage),
      `unknown cycle stage: ${stage}`,
    );

    if (index > 0) {
      invariant(
        stageIndex(stage) >
          stageIndex(cycle.stages[index - 1]),
        `cycle stages must be strictly ordered: ${cycle.cycleId}`,
      );
    }
  }

  invariant(
    Number.isInteger(cycle.iteration) &&
      cycle.iteration >= 0,
    `cycle iteration must be non-negative integer: ${cycle.cycleId}`,
  );

  invariant(
    Number.isFinite(cycle.confidence) &&
      cycle.confidence >= 0 &&
      cycle.confidence <= 1,
    `cycle confidence must be between 0 and 1: ${cycle.cycleId}`,
  );

  invariant(
    cycle.signalIds.length ===
      new Set(cycle.signalIds).size,
    `cycle signalIds must be unique: ${cycle.cycleId}`,
  );

  invariant(
    cycle.metricIds.length ===
      new Set(cycle.metricIds).size,
    `cycle metricIds must be unique: ${cycle.cycleId}`,
  );

  invariant(
    cycle.decisionIds.length ===
      new Set(cycle.decisionIds).size,
    `cycle decisionIds must be unique: ${cycle.cycleId}`,
  );

  invariant(
    cycle.experimentIds.length ===
      new Set(cycle.experimentIds).size,
    `cycle experimentIds must be unique: ${cycle.cycleId}`,
  );

  invariant(
    cycle.learningIds.length ===
      new Set(cycle.learningIds).size,
    `cycle learningIds must be unique: ${cycle.cycleId}`,
  );

  invariant(
    cycle.feedbackIds.length ===
      new Set(cycle.feedbackIds).size,
    `cycle feedbackIds must be unique: ${cycle.cycleId}`,
  );

  if (cycle.parentCycleId === undefined) {
    invariant(
      cycle.rootCycleId === cycle.cycleId,
      `root cycle must self-reference: ${cycle.cycleId}`,
    );

    invariant(
      cycle.iteration === 0,
      `root cycle iteration must be 0: ${cycle.cycleId}`,
    );
  } else {
    invariant(
      cycle.parentCycleId !== cycle.cycleId,
      `cycle cannot be its own parent: ${cycle.cycleId}`,
    );

    invariant(
      cycle.iteration > 0,
      `child cycle iteration must be > 0: ${cycle.cycleId}`,
    );
  }

  validateTerminalState(
    cycle.status,
    cycle.completedAt,
  );

  invariant(
    cycle.fingerprint === cycleFingerprint(cycle),
    `cycle fingerprint mismatch: ${cycle.cycleId}`,
  );
}

export function validateIntelligenceCycle(
  cycle: IntelligenceCycle,
  signals?: readonly IntelligenceSignal[],
  metrics?: readonly IntelligenceMetric[],
  decisions?: readonly IntelligenceDecision[],
  experiments?: readonly IntelligenceExperiment[],
  learnings?: readonly IntelligenceLearning[],
  feedback?: readonly IntelligenceFeedback[],
): CycleValidationReport {
  assertIntelligenceCycleIntegrity(
    cycle,
  );

  return validateCycleReferences(
    cycle,
    signals,
    metrics,
    decisions,
    experiments,
    learnings,
    feedback,
  );
}

export function filterIntelligenceCycles(
  cycles: readonly IntelligenceCycle[],
  filter: CycleFilter = {},
): readonly IntelligenceCycle[] {
  return cycles.filter((cycle) => {
    assertIntelligenceCycleIntegrity(
      cycle,
    );

    if (
      filter.status !== undefined &&
      cycle.status !== filter.status
    ) {
      return false;
    }

    if (
      filter.stage !== undefined &&
      !cycle.stages.includes(filter.stage)
    ) {
      return false;
    }

    if (
      filter.parentCycleId !== undefined &&
      cycle.parentCycleId !==
        filter.parentCycleId
    ) {
      return false;
    }

    if (
      filter.rootCycleId !== undefined &&
      cycle.rootCycleId !==
        filter.rootCycleId
    ) {
      return false;
    }

    if (
      filter.minConfidence !== undefined &&
      cycle.confidence <
        filter.minConfidence
    ) {
      return false;
    }

    if (
      filter.maxConfidence !== undefined &&
      cycle.confidence >
        filter.maxConfidence
    ) {
      return false;
    }

    if (
      filter.minIteration !== undefined &&
      cycle.iteration <
        filter.minIteration
    ) {
      return false;
    }

    if (
      filter.maxIteration !== undefined &&
      cycle.iteration >
        filter.maxIteration
    ) {
      return false;
    }

    if (
      filter.objectiveContains !== undefined &&
      !normalizeText(
        cycle.objective,
      ).includes(
        normalizeText(
          filter.objectiveContains,
        ),
      )
    ) {
      return false;
    }

    return true;
  });
}

export function deduplicateIntelligenceCycles(
  cycles: readonly IntelligenceCycle[],
): readonly IntelligenceCycle[] {
  const byFingerprint = new Map<
    string,
    IntelligenceCycle
  >();

  for (const cycle of cycles) {
    assertIntelligenceCycleIntegrity(
      cycle,
    );

    const existing =
      byFingerprint.get(
        cycle.fingerprint,
      );

    if (!existing) {
      byFingerprint.set(
        cycle.fingerprint,
        cycle,
      );
      continue;
    }

    if (
      cycle.confidence >
      existing.confidence
    ) {
      byFingerprint.set(
        cycle.fingerprint,
        cycle,
      );
      continue;
    }

    if (
      cycle.confidence ===
        existing.confidence &&
      cycle.startedAt <
        existing.startedAt
    ) {
      byFingerprint.set(
        cycle.fingerprint,
        cycle,
      );
    }
  }

  return [...byFingerprint.values()].sort(
    (left, right) => {
      if (
        left.iteration !==
        right.iteration
      ) {
        return (
          left.iteration -
          right.iteration
        );
      }

      if (
        left.startedAt !==
        right.startedAt
      ) {
        return left.startedAt.localeCompare(
          right.startedAt,
        );
      }

      return left.cycleId.localeCompare(
        right.cycleId,
      );
    },
  );
}

export function buildIntelligenceCycleGraph(
  cycles: readonly IntelligenceCycle[],
): CycleGraph {
  const normalized =
    deduplicateIntelligenceCycles(
      cycles,
    );

  const byId = new Map<
    string,
    IntelligenceCycle
  >();

  for (const cycle of normalized) {
    invariant(
      !byId.has(cycle.cycleId),
      `duplicate cycleId: ${cycle.cycleId}`,
    );

    byId.set(
      cycle.cycleId,
      cycle,
    );
  }

  const nodes: CycleGraphNode[] =
    normalized.map((cycle) => ({
      cycleId: cycle.cycleId,
      parentCycleId:
        cycle.parentCycleId,
      rootCycleId:
        cycle.rootCycleId,
      iteration:
        cycle.iteration,
      status:
        cycle.status,
      stage:
        currentStage(cycle),
    }));

  const roots = normalized
    .filter(
      (cycle) =>
        cycle.parentCycleId ===
        undefined,
    )
    .map(
      (cycle) =>
        cycle.cycleId,
    )
    .sort();

  const leaves = normalized
    .filter(
      (cycle) =>
        !normalized.some(
          (candidate) =>
            candidate.parentCycleId ===
            cycle.cycleId,
        ),
    )
    .map(
      (cycle) =>
        cycle.cycleId,
    )
    .sort();

  let maxDepth = 0;

  for (const cycle of normalized) {
    let depth = 0;
    let cursor:
      | IntelligenceCycle
      | undefined = cycle;

    const visited = new Set<string>();

    while (
      cursor?.parentCycleId !==
      undefined
    ) {
      invariant(
        !visited.has(
          cursor.cycleId,
        ),
        `cycle graph contains parent loop: ${cursor.cycleId}`,
      );

      visited.add(
        cursor.cycleId,
      );

      const parent =
        byId.get(
          cursor.parentCycleId,
        );

      invariant(
        parent !== undefined,
        `missing parent cycle: ${cursor.parentCycleId}`,
      );

      depth += 1;
      cursor = parent;
    }

    maxDepth = Math.max(
      maxDepth,
      depth,
    );
  }

  return {
    nodes,
    roots,
    leaves,
    maxDepth,
  };
}

export function summarizeIntelligenceCycles(
  cycles: readonly IntelligenceCycle[],
): CycleSummary {
  const normalized =
    deduplicateIntelligenceCycles(
      cycles,
    );

  if (normalized.length === 0) {
    return {
      total: 0,
      active: 0,
      completed: 0,
      failed: 0,
      blocked: 0,
      averageConfidence: 0,
      maxIteration: 0,
      stages: [],
      roots: [],
    };
  }

  const averageConfidence =
    normalized.reduce(
      (total, cycle) =>
        total + cycle.confidence,
      0,
    ) / normalized.length;

  return {
    total: normalized.length,
    active: normalized.filter(
      (cycle) =>
        cycle.status === "ACTIVE",
    ).length,
    completed: normalized.filter(
      (cycle) =>
        cycle.status ===
        "COMPLETED",
    ).length,
    failed: normalized.filter(
      (cycle) =>
        cycle.status === "FAILED",
    ).length,
    blocked: normalized.filter(
      (cycle) =>
        cycle.status ===
        "BLOCKED",
    ).length,
    averageConfidence:
      Math.round(
        averageConfidence *
          1_000_000,
      ) / 1_000_000,
    maxIteration: Math.max(
      ...normalized.map(
        (cycle) =>
          cycle.iteration,
      ),
    ),
    stages: uniqueStrings(
      normalized.flatMap(
        (cycle) =>
          cycle.stages,
      ),
    ),
    roots: uniqueStrings(
      normalized
        .filter(
          (cycle) =>
            cycle.parentCycleId ===
            undefined,
        )
        .map(
          (cycle) =>
            cycle.cycleId,
        ),
    ),
  };
}

export function rankIntelligenceCycles(
  cycles: readonly IntelligenceCycle[],
): readonly IntelligenceCycle[] {
  return [
    ...deduplicateIntelligenceCycles(
      cycles,
    ),
  ].sort((left, right) => {
    const leftTerminal = isTerminal(
      left.status,
    )
      ? 0
      : 1;

    const rightTerminal = isTerminal(
      right.status,
    )
      ? 0
      : 1;

    if (
      rightTerminal !==
      leftTerminal
    ) {
      return (
        rightTerminal -
        leftTerminal
      );
    }

    if (
      right.confidence !==
      left.confidence
    ) {
      return (
        right.confidence -
        left.confidence
      );
    }

    if (
      right.iteration !==
      left.iteration
    ) {
      return (
        right.iteration -
        left.iteration
      );
    }

    if (
      left.startedAt !==
      right.startedAt
    ) {
      return left.startedAt.localeCompare(
        right.startedAt,
      );
    }

    return left.cycleId.localeCompare(
      right.cycleId,
    );
  });
}

export function assertIntelligenceCycleCollection(
  cycles: readonly IntelligenceCycle[],
): void {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const cycle of cycles) {
    assertIntelligenceCycleIntegrity(
      cycle,
    );

    invariant(
      !ids.has(cycle.cycleId),
      `duplicate cycleId: ${cycle.cycleId}`,
    );

    invariant(
      !fingerprints.has(
        cycle.fingerprint,
      ),
      `duplicate cycle fingerprint: ${cycle.cycleId}`,
    );

    ids.add(cycle.cycleId);
    fingerprints.add(
      cycle.fingerprint,
    );
  }

  if (cycles.length > 0) {
    buildIntelligenceCycleGraph(
      cycles,
    );
  }
}