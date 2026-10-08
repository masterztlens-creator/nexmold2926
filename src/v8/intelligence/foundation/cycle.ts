import { immutable, invariant } from "../../constitution/invariants.js";
import { contentFingerprint } from "../../foundation/hash.js";
import { normalizeText, uniqueStrings } from "../shared.js";
import type {
  IntelligenceCycle,
  IntelligenceCycleStage,
  IntelligenceCycleStatus,
  IntelligenceDecision,
  IntelligenceExperiment,
  IntelligenceFeedback,
  IntelligenceLearning,
  IntelligenceLineageRef,
  IntelligenceMetric,
  IntelligenceObservation,
  IntelligenceOutcome,
  IntelligenceSignal,
} from "./types.js";

export interface CreateIntelligenceCycleInput {
  readonly cycleId: string;
  readonly sequence?: number;
  readonly stage?: IntelligenceCycleStage;
  readonly status?: IntelligenceCycleStatus;
  readonly startedAt?: string;
  readonly completedAt?: string;
  readonly parentCycleId?: string;
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
  readonly lineage?: readonly IntelligenceLineageRef[];
}

export interface AdvanceIntelligenceCycleInput {
  readonly cycle: IntelligenceCycle;
  readonly stage?: IntelligenceCycleStage;
  readonly status?: IntelligenceCycleStatus;
  readonly completedAt?: string;
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
  readonly lineage?: readonly IntelligenceLineageRef[];
}

export interface CycleFilter {
  readonly stage?: IntelligenceCycleStage;
  readonly status?: IntelligenceCycleStatus;
  readonly parentCycleId?: string;
  readonly minSequence?: number;
  readonly maxSequence?: number;
  readonly startedAfter?: string;
  readonly startedBefore?: string;
}

export interface CycleGraphNode {
  readonly cycleId: string;
  readonly parentCycleId?: string;
  readonly sequence: number;
  readonly stage: IntelligenceCycleStage;
  readonly status: IntelligenceCycleStatus;
}

export interface CycleGraph {
  readonly nodes: readonly CycleGraphNode[];
  readonly roots: readonly string[];
  readonly leaves: readonly string[];
  readonly maxDepth: number;
}

export interface CycleSummary {
  readonly total: number;
  readonly initialized: number;
  readonly running: number;
  readonly blocked: number;
  readonly completed: number;
  readonly failed: number;
  readonly retired: number;
  readonly averageSequence: number;
  readonly maxSequence: number;
  readonly stages: readonly IntelligenceCycleStage[];
}

export interface CycleValidationReport {
  readonly valid: boolean;
  readonly cycleId: string;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly referencedEntityIds: readonly string[];
  readonly referencedSignalIds: readonly string[];
  readonly referencedObservationIds: readonly string[];
  readonly referencedMetricIds: readonly string[];
  readonly referencedAnalysisIds: readonly string[];
  readonly referencedDecisionIds: readonly string[];
  readonly referencedExperimentIds: readonly string[];
  readonly referencedOutcomeIds: readonly string[];
  readonly referencedLearningIds: readonly string[];
  readonly referencedFeedbackIds: readonly string[];
}

const CYCLE_STAGE_ORDER: readonly IntelligenceCycleStage[] = [
  "DISCOVER",
  "ANALYZE",
  "VALIDATE",
  "DECIDE",
  "ACT",
  "MEASURE",
  "LEARN",
];

const TERMINAL_STATUSES: readonly IntelligenceCycleStatus[] = [
  "COMPLETED",
  "FAILED",
  "RETIRED",
];

const VALID_STATUSES: readonly IntelligenceCycleStatus[] = [
  "INITIALIZED",
  "RUNNING",
  "BLOCKED",
  "COMPLETED",
  "FAILED",
  "RETIRED",
];

function requireNonEmpty(
  value: string,
  field: string,
): string {
  const normalized = normalizeText(value);

  invariant(
    normalized.length > 0,
    "V8-INTELLIGENCE-CYCLE-EMPTY",
    `${field} must not be empty`,
  );

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
    "V8-INTELLIGENCE-CYCLE-TIMESTAMP",
    `${field} must be a valid timestamp`,
  );

  return timestamp.toISOString();
}

function defaultTimestamp(): string {
  return new Date().toISOString();
}

function normalizeSequence(
  value: number | undefined,
): number {
  const sequence = value ?? 0;

  invariant(
    Number.isInteger(sequence),
    "V8-INTELLIGENCE-CYCLE-SEQUENCE",
    "cycle sequence must be an integer",
  );

  invariant(
    sequence >= 0,
    "V8-INTELLIGENCE-CYCLE-SEQUENCE",
    "cycle sequence must be non-negative",
  );

  return sequence;
}

function normalizeStage(
  value: IntelligenceCycleStage | undefined,
): IntelligenceCycleStage {
  const stage = value ?? "DISCOVER";

  invariant(
    CYCLE_STAGE_ORDER.includes(stage),
    "V8-INTELLIGENCE-CYCLE-STAGE",
    `unknown intelligence cycle stage: ${stage}`,
  );

  return stage;
}

function normalizeStatus(
  value: IntelligenceCycleStatus | undefined,
): IntelligenceCycleStatus {
  const status = value ?? "INITIALIZED";

  invariant(
    VALID_STATUSES.includes(status),
    "V8-INTELLIGENCE-CYCLE-STATUS",
    `unknown intelligence cycle status: ${status}`,
  );

  return status;
}

function normalizeIds(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) =>
      requireNonEmpty(value, field),
    ),
  );
}

function normalizeLineage(
  lineage: readonly IntelligenceLineageRef[] | undefined,
): readonly IntelligenceLineageRef[] {
  if (!lineage || lineage.length === 0) {
    return [];
  }

  const normalized = lineage.map((item) => {
    invariant(
      typeof item === "object" &&
        item !== null,
      "V8-INTELLIGENCE-CYCLE-LINEAGE",
      "cycle lineage reference must be an object",
    );

    const aggregateId = requireNonEmpty(
      item.aggregateId,
      "lineage aggregateId",
    );

    invariant(
      Number.isInteger(item.version) &&
        item.version >= 0,
      "V8-INTELLIGENCE-CYCLE-LINEAGE",
      `lineage version must be a non-negative integer: ${aggregateId}`,
    );

    return {
      aggregateType: item.aggregateType,
      aggregateId,
      version: item.version,
      fingerprint: item.fingerprint,
    } satisfies IntelligenceLineageRef;
  });

  const keys = normalized.map(
    (item) =>
      `${item.aggregateType}:${item.aggregateId}:${item.version}:${item.fingerprint}`,
  );

  const unique = new Map<
    string,
    IntelligenceLineageRef
  >();

  for (let index = 0; index < normalized.length; index += 1) {
    unique.set(keys[index], normalized[index]);
  }

  return [...unique.values()].sort(
    (left, right) => {
      const aggregateTypeCompare =
        left.aggregateType.localeCompare(
          right.aggregateType,
        );

      if (aggregateTypeCompare !== 0) {
        return aggregateTypeCompare;
      }

      const aggregateIdCompare =
        left.aggregateId.localeCompare(
          right.aggregateId,
        );

      if (aggregateIdCompare !== 0) {
        return aggregateIdCompare;
      }

      return left.version - right.version;
    },
  );
}

function stageIndex(
  stage: IntelligenceCycleStage,
): number {
  return CYCLE_STAGE_ORDER.indexOf(stage);
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
    "V8-INTELLIGENCE-CYCLE-STAGE",
    `unknown current cycle stage: ${current}`,
  );

  invariant(
    nextIndex >= 0,
    "V8-INTELLIGENCE-CYCLE-STAGE",
    `unknown next cycle stage: ${next}`,
  );

  invariant(
    nextIndex >= currentIndex,
    "V8-INTELLIGENCE-CYCLE-TRANSITION",
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
      "V8-INTELLIGENCE-CYCLE-TERMINAL",
      `terminal cycle status ${status} requires completedAt`,
    );
  } else {
    invariant(
      completedAt === undefined,
      "V8-INTELLIGENCE-CYCLE-TERMINAL",
      `non-terminal cycle status ${status} cannot have completedAt`,
    );
  }
}

function serializeCycleForFingerprint(
  cycle: IntelligenceCycle,
): Record<string, unknown> {
  return {
    cycleId: cycle.cycleId,
    sequence: cycle.sequence,
    stage: cycle.stage,
    status: cycle.status,
    startedAt: cycle.startedAt,
    completedAt: cycle.completedAt,
    parentCycleId: cycle.parentCycleId,
    entityIds: [...cycle.entityIds],
    signalIds: [...cycle.signalIds],
    observationIds: [...cycle.observationIds],
    metricIds: [...cycle.metricIds],
    analysisIds: [...cycle.analysisIds],
    decisionIds: [...cycle.decisionIds],
    experimentIds: [...cycle.experimentIds],
    outcomeIds: [...cycle.outcomeIds],
    learningIds: [...cycle.learningIds],
    feedbackIds: [...cycle.feedbackIds],
    lineage: cycle.lineage.map((item) => ({
      aggregateType: item.aggregateType,
      aggregateId: item.aggregateId,
      version: item.version,
      fingerprint: item.fingerprint,
    })),
  };
}

function cycleFingerprint(
  cycle: IntelligenceCycle,
): IntelligenceCycle["fingerprint"] {
  return contentFingerprint(
    serializeCycleForFingerprint(cycle),
  );
}

function normalizeCycleForCreation(
  input: CreateIntelligenceCycleInput,
): IntelligenceCycle {
  const cycleId = requireNonEmpty(
    input.cycleId,
    "cycleId",
  );

  const sequence = normalizeSequence(
    input.sequence,
  );

  const stage = normalizeStage(
    input.stage,
  );

  const status = normalizeStatus(
    input.status,
  );

  const startedAt =
    normalizeTimestamp(
      input.startedAt,
      "cycle startedAt",
    ) ?? defaultTimestamp();

  const completedAt = normalizeTimestamp(
    input.completedAt,
    "cycle completedAt",
  );

  const parentCycleId =
    input.parentCycleId === undefined
      ? undefined
      : requireNonEmpty(
          input.parentCycleId,
          "parentCycleId",
        );

  const result: IntelligenceCycle = {
    cycleId,
    sequence,
    stage,
    status,
    startedAt,
    completedAt,
    parentCycleId,
    entityIds: normalizeIds(
      input.entityIds,
      "entityId",
    ),
    signalIds: normalizeIds(
      input.signalIds,
      "signalId",
    ),
    observationIds: normalizeIds(
      input.observationIds,
      "observationId",
    ),
    metricIds: normalizeIds(
      input.metricIds,
      "metricId",
    ),
    analysisIds: normalizeIds(
      input.analysisIds,
      "analysisId",
    ),
    decisionIds: normalizeIds(
      input.decisionIds,
      "decisionId",
    ),
    experimentIds: normalizeIds(
      input.experimentIds,
      "experimentId",
    ),
    outcomeIds: normalizeIds(
      input.outcomeIds,
      "outcomeId",
    ),
    learningIds: normalizeIds(
      input.learningIds,
      "learningId",
    ),
    feedbackIds: normalizeIds(
      input.feedbackIds,
      "feedbackId",
    ),
    lineage: normalizeLineage(
      input.lineage,
    ),
    fingerprint: "" as IntelligenceCycle["fingerprint"],
  };

  validateTerminalState(
    result.status,
    result.completedAt,
  );

  return result;
}

export function createIntelligenceCycle(
  input: CreateIntelligenceCycleInput,
): IntelligenceCycle {
  const provisional =
    normalizeCycleForCreation(input);

  const fingerprint =
    cycleFingerprint(provisional);

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

  const current = input.cycle.stage;

  const nextStage =
    input.stage ?? current;

  validateStageTransition(
    current,
    nextStage,
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

  const next: IntelligenceCycle = {
    ...input.cycle,
    sequence:
      nextStage === current
        ? input.cycle.sequence
        : input.cycle.sequence + 1,
    stage: nextStage,
    status,
    completedAt,
    entityIds: normalizeIds(
      [
        ...input.cycle.entityIds,
        ...(input.entityIds ?? []),
      ],
      "entityId",
    ),
    signalIds: normalizeIds(
      [
        ...input.cycle.signalIds,
        ...(input.signalIds ?? []),
      ],
      "signalId",
    ),
    observationIds: normalizeIds(
      [
        ...input.cycle.observationIds,
        ...(input.observationIds ?? []),
      ],
      "observationId",
    ),
    metricIds: normalizeIds(
      [
        ...input.cycle.metricIds,
        ...(input.metricIds ?? []),
      ],
      "metricId",
    ),
    analysisIds: normalizeIds(
      [
        ...input.cycle.analysisIds,
        ...(input.analysisIds ?? []),
      ],
      "analysisId",
    ),
    decisionIds: normalizeIds(
      [
        ...input.cycle.decisionIds,
        ...(input.decisionIds ?? []),
      ],
      "decisionId",
    ),
    experimentIds: normalizeIds(
      [
        ...input.cycle.experimentIds,
        ...(input.experimentIds ?? []),
      ],
      "experimentId",
    ),
    outcomeIds: normalizeIds(
      [
        ...input.cycle.outcomeIds,
        ...(input.outcomeIds ?? []),
      ],
      "outcomeId",
    ),
    learningIds: normalizeIds(
      [
        ...input.cycle.learningIds,
        ...(input.learningIds ?? []),
      ],
      "learningId",
    ),
    feedbackIds: normalizeIds(
      [
        ...input.cycle.feedbackIds,
        ...(input.feedbackIds ?? []),
      ],
      "feedbackId",
    ),
    lineage: normalizeLineage([
      ...input.cycle.lineage,
      ...(input.lineage ?? []),
    ]),
    fingerprint:
      "" as IntelligenceCycle["fingerprint"],
  };

  const fingerprint =
    cycleFingerprint(next);

  const result: IntelligenceCycle = {
    ...next,
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
    "cycleId" | "parentCycleId" | "sequence"
  > & {
    readonly cycleId: string;
  },
): IntelligenceCycle {
  assertIntelligenceCycleIntegrity(
    parent,
  );

  return createIntelligenceCycle({
    ...input,
    parentCycleId: parent.cycleId,
    sequence: parent.sequence + 1,
  });
}

export function cycleFingerprintFor(
  cycle: IntelligenceCycle,
): IntelligenceCycle["fingerprint"] {
  return cycleFingerprint(cycle);
}

export function assertIntelligenceCycleIntegrity(
  cycle: IntelligenceCycle,
): void {
  invariant(
    typeof cycle === "object" &&
      cycle !== null,
    "V8-INTELLIGENCE-CYCLE-OBJECT",
    "cycle must be a non-null object",
  );

  invariant(
    normalizeText(cycle.cycleId).length > 0,
    "V8-INTELLIGENCE-CYCLE-ID",
    "cycleId must not be empty",
  );

  invariant(
    Number.isInteger(cycle.sequence) &&
      cycle.sequence >= 0,
    "V8-INTELLIGENCE-CYCLE-SEQUENCE",
    `cycle sequence must be a non-negative integer: ${cycle.cycleId}`,
  );

  invariant(
    CYCLE_STAGE_ORDER.includes(cycle.stage),
    "V8-INTELLIGENCE-CYCLE-STAGE",
    `unknown cycle stage: ${cycle.stage}`,
  );

  invariant(
    VALID_STATUSES.includes(cycle.status),
    "V8-INTELLIGENCE-CYCLE-STATUS",
    `unknown cycle status: ${cycle.status}`,
  );

  const startedAt = new Date(
    cycle.startedAt,
  );

  invariant(
    Number.isFinite(startedAt.getTime()),
    "V8-INTELLIGENCE-CYCLE-TIMESTAMP",
    `invalid cycle startedAt: ${cycle.cycleId}`,
  );

  if (cycle.completedAt !== undefined) {
    const completedAt = new Date(
      cycle.completedAt,
    );

    invariant(
      Number.isFinite(completedAt.getTime()),
      "V8-INTELLIGENCE-CYCLE-TIMESTAMP",
      `invalid cycle completedAt: ${cycle.cycleId}`,
    );
  }

  if (cycle.parentCycleId !== undefined) {
    invariant(
      cycle.parentCycleId !== cycle.cycleId,
      "V8-INTELLIGENCE-CYCLE-PARENT",
      `cycle cannot be its own parent: ${cycle.cycleId}`,
    );

    invariant(
      cycle.sequence > 0,
      "V8-INTELLIGENCE-CYCLE-PARENT",
      `child cycle must have sequence > 0: ${cycle.cycleId}`,
    );
  } else {
    invariant(
      cycle.sequence === 0,
      "V8-INTELLIGENCE-CYCLE-ROOT",
      `root cycle must have sequence 0: ${cycle.cycleId}`,
    );
  }

  validateTerminalState(
    cycle.status,
    cycle.completedAt,
  );

  const collections: readonly [
    string,
    readonly string[],
  ][] = [
    ["entityIds", cycle.entityIds],
    ["signalIds", cycle.signalIds],
    ["observationIds", cycle.observationIds],
    ["metricIds", cycle.metricIds],
    ["analysisIds", cycle.analysisIds],
    ["decisionIds", cycle.decisionIds],
    ["experimentIds", cycle.experimentIds],
    ["outcomeIds", cycle.outcomeIds],
    ["learningIds", cycle.learningIds],
    ["feedbackIds", cycle.feedbackIds],
  ];

  for (const [field, values] of collections) {
    invariant(
      values.length ===
        new Set(values).size,
      "V8-INTELLIGENCE-CYCLE-DUPLICATE-REFERENCE",
      `${field} must contain unique references: ${cycle.cycleId}`,
    );
  }

  invariant(
    cycle.fingerprint ===
      cycleFingerprint(cycle),
    "V8-INTELLIGENCE-CYCLE-FINGERPRINT",
    `cycle fingerprint mismatch: ${cycle.cycleId}`,
  );
}

export function validateIntelligenceCycle(
  cycle: IntelligenceCycle,
  signals?: readonly IntelligenceSignal[],
  observations?: readonly IntelligenceObservation[],
  metrics?: readonly IntelligenceMetric[],
  decisions?: readonly IntelligenceDecision[],
  experiments?: readonly IntelligenceExperiment[],
  outcomes?: readonly IntelligenceOutcome[],
  learnings?: readonly IntelligenceLearning[],
  feedback?: readonly IntelligenceFeedback[],
): CycleValidationReport {
  assertIntelligenceCycleIntegrity(
    cycle,
  );

  const errors: string[] = [];
  const warnings: string[] = [];

  const check = (
    field: string,
    referencedIds: readonly string[],
    availableIds: ReadonlySet<string>,
  ): void => {
    for (const id of referencedIds) {
      if (!availableIds.has(id)) {
        errors.push(
          `missing ${field} reference: ${id}`,
        );
      }
    }
  };

  check(
    "signal",
    cycle.signalIds,
    new Set(
      (signals ?? []).map(
        (item) => item.signalId,
      ),
    ),
  );

  check(
    "observation",
    cycle.observationIds,
    new Set(
      (observations ?? []).map(
        (item) => item.observationId,
      ),
    ),
  );

  check(
    "metric",
    cycle.metricIds,
    new Set(
      (metrics ?? []).map(
        (item) => item.metricId,
      ),
    ),
  );

  check(
    "decision",
    cycle.decisionIds,
    new Set(
      (decisions ?? []).map(
        (item) => item.decisionId,
      ),
    ),
  );

  check(
    "experiment",
    cycle.experimentIds,
    new Set(
      (experiments ?? []).map(
        (item) => item.experimentId,
      ),
    ),
  );

  check(
    "outcome",
    cycle.outcomeIds,
    new Set(
      (outcomes ?? []).map(
        (item) => item.outcomeId,
      ),
    ),
  );

  check(
    "learning",
    cycle.learningIds,
    new Set(
      (learnings ?? []).map(
        (item) => item.learningId,
      ),
    ),
  );

  check(
    "feedback",
    cycle.feedbackIds,
    new Set(
      (feedback ?? []).map(
        (item) => item.feedbackId,
      ),
    ),
  );

  if (
    cycle.status === "COMPLETED" &&
    cycle.learningIds.length === 0 &&
    cycle.feedbackIds.length === 0
  ) {
    warnings.push(
      "completed cycle has no learning or feedback reference",
    );
  }

  if (
    cycle.stage === "LEARN" &&
    cycle.learningIds.length === 0
  ) {
    warnings.push(
      "LEARN stage has no learning reference",
    );
  }

  return {
    valid: errors.length === 0,
    cycleId: cycle.cycleId,
    errors,
    warnings,
    referencedEntityIds: cycle.entityIds,
    referencedSignalIds: cycle.signalIds,
    referencedObservationIds:
      cycle.observationIds,
    referencedMetricIds: cycle.metricIds,
    referencedAnalysisIds:
      cycle.analysisIds,
    referencedDecisionIds:
      cycle.decisionIds,
    referencedExperimentIds:
      cycle.experimentIds,
    referencedOutcomeIds:
      cycle.outcomeIds,
    referencedLearningIds:
      cycle.learningIds,
    referencedFeedbackIds:
      cycle.feedbackIds,
  };
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
      filter.stage !== undefined &&
      cycle.stage !== filter.stage
    ) {
      return false;
    }

    if (
      filter.status !== undefined &&
      cycle.status !== filter.status
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
      filter.minSequence !== undefined &&
      cycle.sequence < filter.minSequence
    ) {
      return false;
    }

    if (
      filter.maxSequence !== undefined &&
      cycle.sequence > filter.maxSequence
    ) {
      return false;
    }

    if (
      filter.startedAfter !== undefined &&
      cycle.startedAt <=
        filter.startedAfter
    ) {
      return false;
    }

    if (
      filter.startedBefore !== undefined &&
      cycle.startedAt >=
        filter.startedBefore
    ) {
      return false;
    }

    return true;
  });
}

export function deduplicateIntelligenceCycles(
  cycles: readonly IntelligenceCycle[],
): readonly IntelligenceCycle[] {
  const byFingerprint =
    new Map<
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
      cycle.sequence >
      existing.sequence
    ) {
      byFingerprint.set(
        cycle.fingerprint,
        cycle,
      );
      continue;
    }

    if (
      cycle.sequence ===
        existing.sequence &&
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
        left.sequence !==
        right.sequence
      ) {
        return (
          left.sequence -
          right.sequence
        );
      }

      const stageCompare =
        stageIndex(left.stage) -
        stageIndex(right.stage);

      if (stageCompare !== 0) {
        return stageCompare;
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
      "V8-INTELLIGENCE-CYCLE-DUPLICATE-ID",
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
      sequence: cycle.sequence,
      stage: cycle.stage,
      status: cycle.status,
    }));

  const roots = normalized
    .filter(
      (cycle) =>
        cycle.parentCycleId ===
        undefined,
    )
    .map(
      (cycle) => cycle.cycleId,
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
      (cycle) => cycle.cycleId,
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
        !visited.has(cursor.cycleId),
        "V8-INTELLIGENCE-CYCLE-GRAPH",
        `cycle graph contains parent loop: ${cursor.cycleId}`,
      );

      visited.add(cursor.cycleId);

      const parent =
        byId.get(
          cursor.parentCycleId,
        );

      invariant(
        parent !== undefined,
        "V8-INTELLIGENCE-CYCLE-GRAPH",
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
      initialized: 0,
      running: 0,
      blocked: 0,
      completed: 0,
      failed: 0,
      retired: 0,
      averageSequence: 0,
      maxSequence: 0,
      stages: [],
    };
  }

  const averageSequence =
    normalized.reduce(
      (sum, cycle) =>
        sum + cycle.sequence,
      0,
    ) / normalized.length;

  return {
    total: normalized.length,
    initialized: normalized.filter(
      (cycle) =>
        cycle.status ===
        "INITIALIZED",
    ).length,
    running: normalized.filter(
      (cycle) =>
        cycle.status === "RUNNING",
    ).length,
    blocked: normalized.filter(
      (cycle) =>
        cycle.status === "BLOCKED",
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
    retired: normalized.filter(
      (cycle) =>
        cycle.status === "RETIRED",
    ).length,
    averageSequence:
      Math.round(
        averageSequence * 1_000_000,
      ) / 1_000_000,
    maxSequence: Math.max(
      ...normalized.map(
        (cycle) => cycle.sequence,
      ),
    ),
    stages: [
      ...new Set(
        normalized.map(
          (cycle) => cycle.stage,
        ),
      ),
    ].sort(
      (left, right) =>
        stageIndex(left) -
        stageIndex(right),
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
    if (
      right.sequence !==
      left.sequence
    ) {
      return (
        right.sequence -
        left.sequence
      );
    }

    const stageCompare =
      stageIndex(right.stage) -
      stageIndex(left.stage);

    if (stageCompare !== 0) {
      return stageCompare;
    }

    const statusCompare =
      Number(
        isTerminal(left.status),
      ) -
      Number(
        isTerminal(right.status),
      );

    if (statusCompare !== 0) {
      return statusCompare;
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
      "V8-INTELLIGENCE-CYCLE-DUPLICATE-ID",
      `duplicate cycleId: ${cycle.cycleId}`,
    );

    invariant(
      !fingerprints.has(
        cycle.fingerprint,
      ),
      "V8-INTELLIGENCE-CYCLE-DUPLICATE-FINGERPRINT",
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