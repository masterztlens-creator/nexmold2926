import {
  clamp,
  type JsonValue,
} from "../shared.js";
import {
  contentFingerprint,
  immutable,
} from "../../constitution/invariants.js";
import type {
  IntelligenceExperiment,
  IntelligenceExperimentMetric,
  IntelligenceExperimentStatus,
  IntelligenceExperimentVariant,
} from "./types.js";

export interface CreateIntelligenceExperimentInput {
  readonly experimentId?: string;
  readonly name: string;
  readonly normalizedName?: string;
  readonly objective: string;
  readonly hypothesis: string;
  readonly status?: IntelligenceExperimentStatus;
  readonly createdAt: string;
  readonly startedAt?: string | null;
  readonly endedAt?: string | null;
  readonly confidence?: number;
  readonly variants: readonly IntelligenceExperimentVariant[];
  readonly metrics?: readonly IntelligenceExperimentMetric[];
  readonly entityIds?: readonly string[];
  readonly decisionIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface ExperimentFilter {
  readonly statuses?: readonly IntelligenceExperimentStatus[];
  readonly names?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly decisionIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly minConfidence?: number;
}

export interface ExperimentSummary {
  readonly count: number;
  readonly running: number;
  readonly completed: number;
  readonly cancelled: number;
  readonly draft: number;
  readonly names: readonly string[];
  readonly averageConfidence: number;
  readonly fingerprint: string;
}

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function normalizeRequiredText(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `Experiment ${field} must not be empty.`,
    );
  }

  return normalized;
}

function normalizeName(value: string): string {
  return normalizeRequiredText(
    value,
    "name",
  );
}

function normalizeNormalizedName(
  value: string,
): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function normalizeIsoTimestamp(
  value: string,
  field: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(
      `Experiment ${field} must not be empty.`,
    );
  }

  const timestamp = Date.parse(trimmed);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Invalid experiment ${field} timestamp: ${value}`,
    );
  }

  return new Date(timestamp).toISOString();
}

function normalizeOptionalTimestamp(
  value: string | null | undefined,
  field: string,
): string | null {
  if (value === undefined || value === null) {
    return null;
  }

  return normalizeIsoTimestamp(
    value,
    field,
  );
}

function normalizeScore(
  value: number | undefined,
): number {
  return clamp(value ?? 0, 0, 1);
}

function normalizeFiniteNumber(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `Experiment ${field} must be a finite number.`,
    );
  }

  return value;
}

function normalizeStringArray(
  values: readonly string[] | undefined,
): readonly string[] {
  return Object.freeze(
    [
      ...new Set(
        (values ?? [])
          .map(normalizeIdentifier)
          .filter(Boolean),
      ),
    ].sort(),
  );
}

function normalizeMetadata(
  metadata:
    | Readonly<Record<string, JsonValue>>
    | null
    | undefined,
): Readonly<Record<string, JsonValue>> | null {
  if (!metadata) {
    return null;
  }

  const result: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(
    metadata,
  ).sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    result[key] = value;
  }

  return Object.freeze(result);
}

function normalizeVariant(
  variant: IntelligenceExperimentVariant,
): IntelligenceExperimentVariant {
  const variantId = normalizeRequiredText(
    variant.variantId,
    "variantId",
  );

  const name = normalizeRequiredText(
    variant.name,
    "variant name",
  );

  const description = normalizeRequiredText(
    variant.description,
    "variant description",
  );

  const allocation = clamp(
    normalizeFiniteNumber(
      variant.allocation,
      "variant allocation",
    ),
    0,
    1,
  );

  const targetValue =
    variant.targetValue === null ||
    variant.targetValue === undefined
      ? null
      : normalizeFiniteNumber(
          variant.targetValue,
          "variant targetValue",
        );

  const metadata =
    normalizeMetadata(variant.metadata);

  return immutable({
    variantId,
    name,
    description,
    allocation,
    targetValue,
    metadata,
  });
}

function normalizeVariants(
  variants: readonly IntelligenceExperimentVariant[],
): readonly IntelligenceExperimentVariant[] {
  if (variants.length === 0) {
    throw new Error(
      "Experiment must contain at least one variant.",
    );
  }

  const normalized = variants
    .map(normalizeVariant)
    .sort((left, right) =>
      left.variantId.localeCompare(
        right.variantId,
      ),
    );

  const ids = new Set<string>();
  let allocationTotal = 0;

  for (const variant of normalized) {
    if (ids.has(variant.variantId)) {
      throw new Error(
        `Duplicate experiment variant ID: ${variant.variantId}`,
      );
    }

    ids.add(variant.variantId);
    allocationTotal += variant.allocation;
  }

  if (
    allocationTotal <= 0 ||
    allocationTotal > 1.000001
  ) {
    throw new Error(
      `Experiment variant allocation must total between 0 and 1; received ${allocationTotal}.`,
    );
  }

  return Object.freeze(normalized);
}

function normalizeMetric(
  metric: IntelligenceExperimentMetric,
): IntelligenceExperimentMetric {
  const metricId = normalizeRequiredText(
    metric.metricId,
    "metricId",
  );

  const name = normalizeRequiredText(
    metric.name,
    "metric name",
  );

  const normalizedName =
    normalizeNormalizedName(
      metric.normalizedName || name,
    );

  if (!normalizedName) {
    throw new Error(
      `Experiment metric ${metricId} normalizedName must not be empty.`,
    );
  }

  const baseline =
    metric.baseline === null ||
    metric.baseline === undefined
      ? null
      : normalizeFiniteNumber(
          metric.baseline,
          "metric baseline",
        );

  const target =
    metric.target === null ||
    metric.target === undefined
      ? null
      : normalizeFiniteNumber(
          metric.target,
          "metric target",
        );

  const observed =
    metric.observed === null ||
    metric.observed === undefined
      ? null
      : normalizeFiniteNumber(
          metric.observed,
          "metric observed",
        );

  const improvement =
    metric.improvement === null ||
    metric.improvement === undefined
      ? null
      : normalizeFiniteNumber(
          metric.improvement,
          "metric improvement",
        );

  const confidence = normalizeScore(
    metric.confidence,
  );

  const unit =
    metric.unit === null ||
    metric.unit === undefined
      ? null
      : normalizeIdentifier(metric.unit) ||
        null;

  return immutable({
    metricId,
    name,
    normalizedName,
    baseline,
    target,
    observed,
    improvement,
    confidence,
    unit,
  });
}

function normalizeMetrics(
  metrics:
    | readonly IntelligenceExperimentMetric[]
    | undefined,
): readonly IntelligenceExperimentMetric[] {
  if (!metrics || metrics.length === 0) {
    return Object.freeze([]);
  }

  const normalized = metrics
    .map(normalizeMetric)
    .sort((left, right) =>
      left.metricId.localeCompare(
        right.metricId,
      ),
    );

  const ids = new Set<string>();

  for (const metric of normalized) {
    if (ids.has(metric.metricId)) {
      throw new Error(
        `Duplicate experiment metric ID: ${metric.metricId}`,
      );
    }

    ids.add(metric.metricId);
  }

  return Object.freeze(normalized);
}

function serializeVariant(
  variant: IntelligenceExperimentVariant,
): JsonValue {
  return {
    variantId: variant.variantId,
    name: variant.name,
    description: variant.description,
    allocation: variant.allocation,
    targetValue: variant.targetValue,
    metadata: variant.metadata,
  };
}

function serializeMetric(
  metric: IntelligenceExperimentMetric,
): JsonValue {
  return {
    metricId: metric.metricId,
    name: metric.name,
    normalizedName: metric.normalizedName,
    baseline: metric.baseline,
    target: metric.target,
    observed: metric.observed,
    improvement: metric.improvement,
    confidence: metric.confidence,
    unit: metric.unit,
  };
}

function serializeExperimentForFingerprint(
  experiment: IntelligenceExperiment,
): JsonValue {
  return {
    experimentId: experiment.experimentId,
    name: experiment.name,
    normalizedName:
      experiment.normalizedName,
    objective: experiment.objective,
    hypothesis: experiment.hypothesis,
    status: experiment.status,
    createdAt: experiment.createdAt,
    startedAt: experiment.startedAt,
    endedAt: experiment.endedAt,
    confidence: experiment.confidence,
    variants: experiment.variants.map(
      serializeVariant,
    ),
    metrics: experiment.metrics.map(
      serializeMetric,
    ),
    entityIds: [...experiment.entityIds],
    decisionIds: [...experiment.decisionIds],
    signalIds: [...experiment.signalIds],
    metadata: experiment.metadata,
  };
}

export function createIntelligenceExperiment(
  input: CreateIntelligenceExperimentInput,
): IntelligenceExperiment {
  const name = normalizeName(input.name);

  const normalizedName =
    input.normalizedName !== undefined
      ? normalizeNormalizedName(
          input.normalizedName,
        )
      : normalizeNormalizedName(name);

  if (!normalizedName) {
    throw new Error(
      "Experiment normalizedName must not be empty.",
    );
  }

  const objective =
    normalizeRequiredText(
      input.objective,
      "objective",
    );

  const hypothesis =
    normalizeRequiredText(
      input.hypothesis,
      "hypothesis",
    );

  const createdAt = normalizeIsoTimestamp(
    input.createdAt,
    "createdAt",
  );

  const startedAt =
    normalizeOptionalTimestamp(
      input.startedAt,
      "startedAt",
    );

  const endedAt =
    normalizeOptionalTimestamp(
      input.endedAt,
      "endedAt",
    );

  if (
    startedAt !== null &&
    endedAt !== null &&
    startedAt > endedAt
  ) {
    throw new Error(
      "Experiment startedAt must not be later than endedAt.",
    );
  }

  if (
    startedAt !== null &&
    startedAt < createdAt
  ) {
    throw new Error(
      "Experiment startedAt must not precede createdAt.",
    );
  }

  const confidence = normalizeScore(
    input.confidence,
  );

  const variants = normalizeVariants(
    input.variants,
  );

  const metrics = normalizeMetrics(
    input.metrics,
  );

  const entityIds = normalizeStringArray(
    input.entityIds,
  );

  const decisionIds = normalizeStringArray(
    input.decisionIds,
  );

  const signalIds = normalizeStringArray(
    input.signalIds,
  );

  const metadata = normalizeMetadata(
    input.metadata,
  );

  const status =
    input.status ?? "DRAFT";

  const experimentId =
    normalizeIdentifier(
      input.experimentId ?? "",
    ) ||
    `experiment:v8:${contentFingerprint({
      name,
      normalizedName,
      objective,
      hypothesis,
      createdAt,
    })}`;

  const fingerprint =
    contentFingerprint(
      serializeExperimentForFingerprint({
        experimentId,
        name,
        normalizedName,
        objective,
        hypothesis,
        status,
        createdAt,
        startedAt,
        endedAt,
        confidence,
        variants,
        metrics,
        entityIds,
        decisionIds,
        signalIds,
        metadata,
        fingerprint: "",
      }),
    );

  return immutable({
    experimentId,
    name,
    normalizedName,
    objective,
    hypothesis,
    status,
    createdAt,
    startedAt,
    endedAt,
    confidence,
    variants,
    metrics,
    entityIds,
    decisionIds,
    signalIds,
    metadata,
    fingerprint,
  });
}

export function experimentFingerprint(
  experiment: IntelligenceExperiment,
): string {
  return contentFingerprint(
    serializeExperimentForFingerprint(
      experiment,
    ),
  );
}

export function assertExperimentIntegrity(
  experiment: IntelligenceExperiment,
): void {
  if (!experiment.experimentId.trim()) {
    throw new Error(
      "Experiment experimentId must not be empty.",
    );
  }

  if (!experiment.name.trim()) {
    throw new Error(
      "Experiment name must not be empty.",
    );
  }

  if (!experiment.normalizedName.trim()) {
    throw new Error(
      "Experiment normalizedName must not be empty.",
    );
  }

  if (!experiment.objective.trim()) {
    throw new Error(
      "Experiment objective must not be empty.",
    );
  }

  if (!experiment.hypothesis.trim()) {
    throw new Error(
      "Experiment hypothesis must not be empty.",
    );
  }

  if (
    !Number.isFinite(
      experiment.confidence,
    ) ||
    experiment.confidence < 0 ||
    experiment.confidence > 1
  ) {
    throw new Error(
      "Experiment confidence must be between 0 and 1.",
    );
  }

  if (
    experiment.startedAt !== null &&
    experiment.endedAt !== null &&
    experiment.startedAt >
      experiment.endedAt
  ) {
    throw new Error(
      `Experiment ${experiment.experimentId} has an invalid time range.`,
    );
  }

  if (
    experiment.startedAt !== null &&
    experiment.startedAt <
      experiment.createdAt
  ) {
    throw new Error(
      `Experiment ${experiment.experimentId} started before it was created.`,
    );
  }

  normalizeVariants(
    experiment.variants,
  );

  normalizeMetrics(
    experiment.metrics,
  );

  const calculated =
    experimentFingerprint(experiment);

  if (
    calculated !== experiment.fingerprint
  ) {
    throw new Error(
      `Experiment fingerprint mismatch for ${experiment.experimentId}.`,
    );
  }
}

export function deduplicateExperiments(
  experiments: readonly IntelligenceExperiment[],
): readonly IntelligenceExperiment[] {
  const byFingerprint = new Map<
    string,
    IntelligenceExperiment
  >();

  for (const experiment of experiments) {
    assertExperimentIntegrity(experiment);

    const existing = byFingerprint.get(
      experiment.fingerprint,
    );

    if (!existing) {
      byFingerprint.set(
        experiment.fingerprint,
        experiment,
      );
      continue;
    }

    if (
      experiment.confidence >
        existing.confidence ||
      (
        experiment.confidence ===
          existing.confidence &&
        experiment.createdAt >
          existing.createdAt
      )
    ) {
      byFingerprint.set(
        experiment.fingerprint,
        experiment,
      );
    }
  }

  return Object.freeze(
    [...byFingerprint.values()].sort(
      (left, right) => {
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
          right.createdAt !==
          left.createdAt
        ) {
          return right.createdAt.localeCompare(
            left.createdAt,
          );
        }

        return left.experimentId.localeCompare(
          right.experimentId,
        );
      },
    ),
  );
}

export function filterExperiments(
  experiments: readonly IntelligenceExperiment[],
  filter: ExperimentFilter,
): readonly IntelligenceExperiment[] {
  const statusSet = filter.statuses
    ? new Set(filter.statuses)
    : null;

  const nameSet = filter.names
    ? new Set(
        filter.names.map(
          normalizeNormalizedName,
        ),
      )
    : null;

  const entitySet = filter.entityIds
    ? new Set(filter.entityIds)
    : null;

  const decisionSet = filter.decisionIds
    ? new Set(filter.decisionIds)
    : null;

  const signalSet = filter.signalIds
    ? new Set(filter.signalIds)
    : null;

  return Object.freeze(
    experiments.filter((experiment) => {
      if (
        statusSet &&
        !statusSet.has(
          experiment.status,
        )
      ) {
        return false;
      }

      if (
        nameSet &&
        !nameSet.has(
          experiment.normalizedName,
        )
      ) {
        return false;
      }

      if (
        filter.minConfidence !==
          undefined &&
        experiment.confidence <
          clamp(
            filter.minConfidence,
            0,
            1,
          )
      ) {
        return false;
      }

      if (entitySet) {
        if (
          !experiment.entityIds.some(
            (id) => entitySet.has(id),
          )
        ) {
          return false;
        }
      }

      if (decisionSet) {
        if (
          !experiment.decisionIds.some(
            (id) => decisionSet.has(id),
          )
        ) {
          return false;
        }
      }

      if (signalSet) {
        if (
          !experiment.signalIds.some(
            (id) => signalSet.has(id),
          )
        ) {
          return false;
        }
      }

      return true;
    }),
  );
}

export function summarizeExperiments(
  experiments: readonly IntelligenceExperiment[],
): ExperimentSummary {
  const normalized =
    deduplicateExperiments(
      experiments,
    );

  const running = normalized.filter(
    (experiment) =>
      experiment.status === "RUNNING",
  ).length;

  const completed = normalized.filter(
    (experiment) =>
      experiment.status === "COMPLETED",
  ).length;

  const cancelled = normalized.filter(
    (experiment) =>
      experiment.status === "CANCELLED",
  ).length;

  const draft = normalized.filter(
    (experiment) =>
      experiment.status === "DRAFT",
  ).length;

  const names = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (experiment) =>
            experiment.normalizedName,
        ),
      ),
    ].sort(),
  );

  const averageConfidence =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, experiment) =>
            sum + experiment.confidence,
          0,
        ) / normalized.length;

  const fingerprint =
    contentFingerprint({
      count: normalized.length,
      running,
      completed,
      cancelled,
      draft,
      names,
      averageConfidence,
    });

  return {
    count: normalized.length,
    running,
    completed,
    cancelled,
    draft,
    names,
    averageConfidence,
    fingerprint,
  };
}

export function rankExperiments(
  experiments: readonly IntelligenceExperiment[],
): readonly IntelligenceExperiment[] {
  return Object.freeze(
    [...deduplicateExperiments(experiments)].sort(
      (left, right) => {
        const leftScore =
          left.confidence *
          (
            left.metrics.length > 0
              ? Math.max(
                  ...left.metrics.map(
                    (metric) =>
                      metric.confidence,
                  ),
                )
              : 0
          );

        const rightScore =
          right.confidence *
          (
            right.metrics.length > 0
              ? Math.max(
                  ...right.metrics.map(
                    (metric) =>
                      metric.confidence,
                  ),
                )
              : 0
          );

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        return left.experimentId.localeCompare(
          right.experimentId,
        );
      },
    ),
  );
}

export function assertExperimentCollection(
  experiments: readonly IntelligenceExperiment[],
): void {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const experiment of experiments) {
    assertExperimentIntegrity(
      experiment,
    );

    if (
      ids.has(experiment.experimentId)
    ) {
      throw new Error(
        `Duplicate intelligence experiment ID: ${experiment.experimentId}`,
      );
    }

    if (
      fingerprints.has(
        experiment.fingerprint,
      )
    ) {
      throw new Error(
        `Duplicate intelligence experiment fingerprint: ${experiment.fingerprint}`,
      );
    }

    ids.add(experiment.experimentId);
    fingerprints.add(
      experiment.fingerprint,
    );
  }
}