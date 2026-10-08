import {
  clamp,
  type JsonValue,
} from "../shared.js";
import {
  contentFingerprint,
  immutable,
} from "../../constitution/invariants.js";
import type {
  IntelligenceMetric,
  IntelligenceMetricAggregation,
  IntelligenceMetricDirection,
  IntelligenceMetricSource,
  IntelligenceMetricType,
} from "./types.js";

export interface CreateIntelligenceMetricInput {
  readonly metricId?: string;
  readonly type: IntelligenceMetricType;
  readonly source: IntelligenceMetricSource;
  readonly name: string;
  readonly normalizedName?: string;
  readonly observedAt: string;
  readonly value: number;
  readonly unit?: string | null;
  readonly direction?: IntelligenceMetricDirection;
  readonly confidence?: number;
  readonly entityIds?: readonly string[];
  readonly marketIds?: readonly string[];
  readonly industryIds?: readonly string[];
  readonly dimensions?: Readonly<Record<string, JsonValue>> | null;
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
}

export interface MetricFilter {
  readonly types?: readonly IntelligenceMetricType[];
  readonly sources?: readonly IntelligenceMetricSource[];
  readonly names?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly marketIds?: readonly string[];
  readonly industryIds?: readonly string[];
  readonly minConfidence?: number;
  readonly minValue?: number;
  readonly maxValue?: number;
  readonly observedAfter?: string;
  readonly observedBefore?: string;
}

export interface MetricAggregation {
  readonly name: string;
  readonly normalizedName: string;
  readonly count: number;
  readonly totalValue: number;
  readonly averageValue: number;
  readonly minimumValue: number;
  readonly maximumValue: number;
  readonly weightedValue: number;
  readonly averageConfidence: number;
  readonly latestObservedAt: string;
  readonly metricIds: readonly string[];
}

export interface MetricSummary {
  readonly count: number;
  readonly names: readonly string[];
  readonly types: readonly IntelligenceMetricType[];
  readonly sources: readonly IntelligenceMetricSource[];
  readonly totalValue: number;
  readonly averageValue: number;
  readonly averageConfidence: number;
  readonly latestObservedAt: string | null;
  readonly earliestObservedAt: string | null;
  readonly fingerprint: string;
}

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function normalizeName(value: string): string {
  return value.trim();
}

function normalizeNormalizedName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeIsoTimestamp(value: string): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error("Metric observedAt must not be empty.");
  }

  const timestamp = Date.parse(trimmed);

  if (!Number.isFinite(timestamp)) {
    throw new Error(`Invalid metric observedAt timestamp: ${value}`);
  }

  return new Date(timestamp).toISOString();
}

function normalizeFiniteNumber(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(`Metric ${field} must be a finite number.`);
  }

  return value;
}

function normalizeConfidence(value: number | undefined): number {
  return clamp(value ?? 0, 0, 1);
}

function normalizeStringArray(
  values: readonly string[] | undefined,
): readonly string[] {
  const result = [
    ...new Set(
      (values ?? [])
        .map(normalizeIdentifier)
        .filter(Boolean),
    ),
  ].sort();

  return Object.freeze(result);
}

function normalizeJsonRecord(
  value: Readonly<Record<string, JsonValue>> | null | undefined,
): Readonly<Record<string, JsonValue>> | null {
  if (!value) {
    return null;
  }

  const result: Record<string, JsonValue> = {};

  for (const [key, entry] of Object.entries(value).sort(
    ([left], [right]) => left.localeCompare(right),
  )) {
    result[key] = entry;
  }

  return Object.freeze(result);
}

function defaultDirection(
  value: number,
): IntelligenceMetricDirection {
  if (value > 0) {
    return "UP";
  }

  if (value < 0) {
    return "DOWN";
  }

  return "FLAT";
}

function serializeMetricForFingerprint(
  metric: IntelligenceMetric,
): JsonValue {
  return {
    metricId: metric.metricId,
    type: metric.type,
    source: metric.source,
    name: metric.name,
    normalizedName: metric.normalizedName,
    observedAt: metric.observedAt,
    value: metric.value,
    unit: metric.unit,
    direction: metric.direction,
    confidence: metric.confidence,
    entityIds: [...metric.entityIds],
    marketIds: [...metric.marketIds],
    industryIds: [...metric.industryIds],
    dimensions: metric.dimensions,
    metadata: metric.metadata,
  };
}

export function createIntelligenceMetric(
  input: CreateIntelligenceMetricInput,
): IntelligenceMetric {
  const name = normalizeName(input.name);

  if (!name) {
    throw new Error("Metric name must not be empty.");
  }

  const normalizedName =
    input.normalizedName !== undefined
      ? normalizeNormalizedName(input.normalizedName)
      : normalizeNormalizedName(name);

  if (!normalizedName) {
    throw new Error("Metric normalizedName must not be empty.");
  }

  const observedAt = normalizeIsoTimestamp(input.observedAt);
  const value = normalizeFiniteNumber(input.value, "value");
  const confidence = normalizeConfidence(input.confidence);

  const unit =
    input.unit === undefined || input.unit === null
      ? null
      : normalizeIdentifier(input.unit) || null;

  const direction =
    input.direction ?? defaultDirection(value);

  const entityIds = normalizeStringArray(input.entityIds);
  const marketIds = normalizeStringArray(input.marketIds);
  const industryIds = normalizeStringArray(input.industryIds);
  const dimensions = normalizeJsonRecord(input.dimensions);
  const metadata = normalizeJsonRecord(input.metadata);

  const metricId =
    normalizeIdentifier(input.metricId ?? "") ||
    `metric:v8:${contentFingerprint({
      type: input.type,
      source: input.source,
      name,
      normalizedName,
      observedAt,
      value,
      unit,
      confidence,
      direction,
      entityIds: [...entityIds],
      marketIds: [...marketIds],
      industryIds: [...industryIds],
      dimensions,
    })}`;

  const fingerprint = contentFingerprint({
    metricId,
    type: input.type,
    source: input.source,
    name,
    normalizedName,
    observedAt,
    value,
    unit,
    direction,
    confidence,
    entityIds: [...entityIds],
    marketIds: [...marketIds],
    industryIds: [...industryIds],
    dimensions,
    metadata,
  });

  return immutable({
    metricId,
    type: input.type,
    source: input.source,
    name,
    normalizedName,
    observedAt,
    value,
    unit,
    direction,
    confidence,
    entityIds,
    marketIds,
    industryIds,
    dimensions,
    metadata,
    fingerprint,
  });
}

export function metricFingerprint(
  metric: IntelligenceMetric,
): string {
  return contentFingerprint(
    serializeMetricForFingerprint(metric),
  );
}

export function assertMetricIntegrity(
  metric: IntelligenceMetric,
): void {
  if (!metric.metricId.trim()) {
    throw new Error("Metric metricId must not be empty.");
  }

  if (!metric.name.trim()) {
    throw new Error("Metric name must not be empty.");
  }

  if (!metric.normalizedName.trim()) {
    throw new Error(
      "Metric normalizedName must not be empty.",
    );
  }

  if (!metric.observedAt.trim()) {
    throw new Error(
      "Metric observedAt must not be empty.",
    );
  }

  if (!Number.isFinite(metric.value)) {
    throw new Error("Metric value must be finite.");
  }

  if (
    !Number.isFinite(metric.confidence) ||
    metric.confidence < 0 ||
    metric.confidence > 1
  ) {
    throw new Error(
      "Metric confidence must be between 0 and 1.",
    );
  }

  const calculated = metricFingerprint(metric);

  if (calculated !== metric.fingerprint) {
    throw new Error(
      `Metric fingerprint mismatch for ${metric.metricId}.`,
    );
  }
}

export function deduplicateMetrics(
  metrics: readonly IntelligenceMetric[],
): readonly IntelligenceMetric[] {
  const byFingerprint = new Map<
    string,
    IntelligenceMetric
  >();

  for (const metric of metrics) {
    assertMetricIntegrity(metric);

    const existing = byFingerprint.get(
      metric.fingerprint,
    );

    if (!existing) {
      byFingerprint.set(
        metric.fingerprint,
        metric,
      );
      continue;
    }

    if (
      metric.confidence > existing.confidence ||
      (
        metric.confidence === existing.confidence &&
        metric.observedAt >
          existing.observedAt
      )
    ) {
      byFingerprint.set(
        metric.fingerprint,
        metric,
      );
    }
  }

  return Object.freeze(
    [...byFingerprint.values()].sort((left, right) => {
      if (left.observedAt !== right.observedAt) {
        return left.observedAt.localeCompare(
          right.observedAt,
        );
      }

      return left.metricId.localeCompare(
        right.metricId,
      );
    }),
  );
}

export function filterMetrics(
  metrics: readonly IntelligenceMetric[],
  filter: MetricFilter,
): readonly IntelligenceMetric[] {
  const typeSet = filter.types
    ? new Set(filter.types)
    : null;

  const sourceSet = filter.sources
    ? new Set(filter.sources)
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

  const marketSet = filter.marketIds
    ? new Set(filter.marketIds)
    : null;

  const industrySet = filter.industryIds
    ? new Set(filter.industryIds)
    : null;

  const observedAfter =
    filter.observedAfter !== undefined
      ? normalizeIsoTimestamp(
          filter.observedAfter,
        )
      : null;

  const observedBefore =
    filter.observedBefore !== undefined
      ? normalizeIsoTimestamp(
          filter.observedBefore,
        )
      : null;

  return Object.freeze(
    metrics.filter((metric) => {
      if (
        typeSet &&
        !typeSet.has(metric.type)
      ) {
        return false;
      }

      if (
        sourceSet &&
        !sourceSet.has(metric.source)
      ) {
        return false;
      }

      if (
        nameSet &&
        !nameSet.has(metric.normalizedName)
      ) {
        return false;
      }

      if (
        filter.minConfidence !== undefined &&
        metric.confidence <
          clamp(filter.minConfidence, 0, 1)
      ) {
        return false;
      }

      if (
        filter.minValue !== undefined &&
        metric.value < filter.minValue
      ) {
        return false;
      }

      if (
        filter.maxValue !== undefined &&
        metric.value > filter.maxValue
      ) {
        return false;
      }

      if (
        observedAfter &&
        metric.observedAt <= observedAfter
      ) {
        return false;
      }

      if (
        observedBefore &&
        metric.observedAt >= observedBefore
      ) {
        return false;
      }

      if (entitySet) {
        if (
          !metric.entityIds.some((id) =>
            entitySet.has(id),
          )
        ) {
          return false;
        }
      }

      if (marketSet) {
        if (
          !metric.marketIds.some((id) =>
            marketSet.has(id),
          )
        ) {
          return false;
        }
      }

      if (industrySet) {
        if (
          !metric.industryIds.some((id) =>
            industrySet.has(id),
          )
        ) {
          return false;
        }
      }

      return true;
    }),
  );
}

export function aggregateMetricsByName(
  metrics: readonly IntelligenceMetric[],
): readonly MetricAggregation[] {
  const groups = new Map<
    string,
    IntelligenceMetric[]
  >();

  for (const metric of metrics) {
    const existing = groups.get(
      metric.normalizedName,
    );

    if (existing) {
      existing.push(metric);
    } else {
      groups.set(metric.normalizedName, [
        metric,
      ]);
    }
  }

  const result: MetricAggregation[] = [];

  for (const [
    normalizedName,
    group,
  ] of groups.entries()) {
    if (group.length === 0) {
      continue;
    }

    const values = group.map(
      (metric) => metric.value,
    );

    const totalValue = values.reduce(
      (sum, value) => sum + value,
      0,
    );

    const averageValue =
      totalValue / group.length;

    const minimumValue = Math.min(...values);
    const maximumValue = Math.max(...values);

    const confidenceTotal = group.reduce(
      (sum, metric) =>
        sum + metric.confidence,
      0,
    );

    const averageConfidence =
      confidenceTotal / group.length;

    const weightedDenominator = group.reduce(
      (sum, metric) =>
        sum + Math.max(metric.confidence, 0.01),
      0,
    );

    const weightedValue =
      group.reduce(
        (sum, metric) =>
          sum +
          metric.value *
            Math.max(metric.confidence, 0.01),
        0,
      ) / weightedDenominator;

    const latestObservedAt = [...group]
      .sort((left, right) =>
        right.observedAt.localeCompare(
          left.observedAt,
        ),
      )[0]?.observedAt ?? "";

    result.push({
      name:
        group[0]?.name ??
        normalizedName,
      normalizedName,
      count: group.length,
      totalValue,
      averageValue,
      minimumValue,
      maximumValue,
      weightedValue,
      averageConfidence,
      latestObservedAt,
      metricIds: Object.freeze(
        group
          .map((metric) => metric.metricId)
          .sort(),
      ),
    });
  }

  return Object.freeze(
    result.sort((left, right) => {
      if (
        right.weightedValue !==
        left.weightedValue
      ) {
        return (
          right.weightedValue -
          left.weightedValue
        );
      }

      return left.normalizedName.localeCompare(
        right.normalizedName,
      );
    }),
  );
}

export function summarizeMetrics(
  metrics: readonly IntelligenceMetric[],
): MetricSummary {
  const normalized = deduplicateMetrics(metrics);

  const names = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (metric) =>
            metric.normalizedName,
        ),
      ),
    ].sort(),
  );

  const types = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (metric) => metric.type,
        ),
      ),
    ].sort(),
  );

  const sources = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (metric) => metric.source,
        ),
      ),
    ].sort(),
  );

  const totalValue = normalized.reduce(
    (sum, metric) =>
      sum + metric.value,
    0,
  );

  const averageValue =
    normalized.length === 0
      ? 0
      : totalValue / normalized.length;

  const averageConfidence =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, metric) =>
            sum + metric.confidence,
          0,
        ) / normalized.length;

  const orderedByTime = [
    ...normalized,
  ].sort((left, right) =>
    left.observedAt.localeCompare(
      right.observedAt,
    ),
  );

  const latestObservedAt =
    orderedByTime.at(-1)?.observedAt ??
    null;

  const earliestObservedAt =
    orderedByTime[0]?.observedAt ??
    null;

  const fingerprint = contentFingerprint({
    count: normalized.length,
    names,
    types,
    sources,
    totalValue,
    averageValue,
    averageConfidence,
    latestObservedAt,
    earliestObservedAt,
  });

  return {
    count: normalized.length,
    names,
    types,
    sources,
    totalValue,
    averageValue,
    averageConfidence,
    latestObservedAt,
    earliestObservedAt,
    fingerprint,
  };
}

export function rankMetrics(
  metrics: readonly IntelligenceMetric[],
): readonly IntelligenceMetric[] {
  return Object.freeze(
    [...deduplicateMetrics(metrics)].sort(
      (left, right) => {
        const leftScore =
          Math.abs(left.value) *
          left.confidence;

        const rightScore =
          Math.abs(right.value) *
          right.confidence;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        if (
          right.observedAt !==
          left.observedAt
        ) {
          return right.observedAt.localeCompare(
            left.observedAt,
          );
        }

        return left.metricId.localeCompare(
          right.metricId,
        );
      },
    ),
  );
}

export function mergeMetrics(
  primary: IntelligenceMetric,
  secondary: IntelligenceMetric,
): IntelligenceMetric {
  assertMetricIntegrity(primary);
  assertMetricIntegrity(secondary);

  if (
    primary.normalizedName !==
    secondary.normalizedName
  ) {
    throw new Error(
      "Cannot merge metrics with different names.",
    );
  }

  if (primary.type !== secondary.type) {
    throw new Error(
      "Cannot merge metrics with different types.",
    );
  }

  if (primary.source !== secondary.source) {
    throw new Error(
      "Cannot merge metrics with different sources.",
    );
  }

  const latest =
    primary.observedAt >= secondary.observedAt
      ? primary
      : secondary;

  const confidence = Math.max(
    primary.confidence,
    secondary.confidence,
  );

  const entityIds = Object.freeze(
    [
      ...new Set([
        ...primary.entityIds,
        ...secondary.entityIds,
      ]),
    ].sort(),
  );

  const marketIds = Object.freeze(
    [
      ...new Set([
        ...primary.marketIds,
        ...secondary.marketIds,
      ]),
    ].sort(),
  );

  const industryIds = Object.freeze(
    [
      ...new Set([
        ...primary.industryIds,
        ...secondary.industryIds,
      ]),
    ].sort(),
  );

  const dimensions: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(
    primary.dimensions ?? {},
  )) {
    dimensions[key] = value;
  }

  for (const [key, value] of Object.entries(
    secondary.dimensions ?? {},
  )) {
    dimensions[key] = value;
  }

  const metadata: Record<string, JsonValue> = {};

  for (const [key, value] of Object.entries(
    primary.metadata ?? {},
  )) {
    metadata[key] = value;
  }

  for (const [key, value] of Object.entries(
    secondary.metadata ?? {},
  )) {
    metadata[key] = value;
  }

  return createIntelligenceMetric({
    metricId: primary.metricId,
    type: primary.type,
    source: primary.source,
    name: primary.name,
    normalizedName:
      primary.normalizedName,
    observedAt: latest.observedAt,
    value: latest.value,
    unit: latest.unit,
    direction: latest.direction,
    confidence,
    entityIds,
    marketIds,
    industryIds,
    dimensions:
      Object.keys(dimensions).length > 0
        ? dimensions
        : null,
    metadata:
      Object.keys(metadata).length > 0
        ? metadata
        : null,
  });
}

export function assertMetricCollection(
  metrics: readonly IntelligenceMetric[],
): void {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const metric of metrics) {
    assertMetricIntegrity(metric);

    if (ids.has(metric.metricId)) {
      throw new Error(
        `Duplicate intelligence metric ID: ${metric.metricId}`,
      );
    }

    if (
      fingerprints.has(metric.fingerprint)
    ) {
      throw new Error(
        `Duplicate intelligence metric fingerprint: ${metric.fingerprint}`,
      );
    }

    ids.add(metric.metricId);
    fingerprints.add(metric.fingerprint);
  }
}