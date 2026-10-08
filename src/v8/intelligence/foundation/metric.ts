import {
  immutable,
  invariant,
} from "../../constitution/invariants.js";

import {
  contentFingerprint,
} from "../../foundation/hash.js";

import {
  clamp,
  normalizeText,
  uniqueStrings,
  type JsonValue,
} from "../shared.js";

import type {
  Fingerprint,
} from "../../domain/primitives.js";

import type {
  IntelligenceConfidence,
  IntelligenceDirection,
  IntelligenceEvidenceRef,
  IntelligenceLineageRef,
  IntelligenceMetric,
  IntelligenceMetricType,
} from "./types.js";

/* -------------------------------------------------------------------------- */
/* Public contracts                                                           */
/* -------------------------------------------------------------------------- */

export interface CreateIntelligenceMetricInput {
  readonly metricId?: string;

  readonly type: IntelligenceMetricType;

  readonly name: string;

  readonly subject: string;

  readonly entityIds?: readonly string[];

  readonly value: number;

  readonly normalizedValue?: number;

  readonly unit?: string;

  readonly observedAt: string;

  readonly baseline?: number;

  readonly target?: number;

  readonly direction?: IntelligenceDirection;

  readonly confidence?: IntelligenceConfidence;

  readonly signalIds?: readonly string[];

  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];

  readonly lineage?: readonly IntelligenceLineageRef[];

  readonly metadata?: Readonly<
    Record<string, JsonValue>
  >;
}

export interface MetricFilter {
  readonly types?: readonly IntelligenceMetricType[];

  readonly names?: readonly string[];

  readonly subjects?: readonly string[];

  readonly entityIds?: readonly string[];

  readonly signalIds?: readonly string[];

  readonly minValue?: number;

  readonly maxValue?: number;

  readonly minNormalizedValue?: number;

  readonly maxNormalizedValue?: number;

  readonly confidences?: readonly IntelligenceConfidence[];

  readonly directions?: readonly IntelligenceDirection[];

  readonly observedAfter?: string;

  readonly observedBefore?: string;
}

export interface MetricAggregation {
  readonly type: IntelligenceMetricType;

  readonly name: string;

  readonly subject: string;

  readonly count: number;

  readonly totalValue: number;

  readonly averageValue: number;

  readonly minimumValue: number;

  readonly maximumValue: number;

  readonly weightedValue: number;

  readonly averageNormalizedValue: number;

  readonly averageConfidenceRank: number;

  readonly latestObservedAt: string;

  readonly metricIds: readonly string[];
}

export interface MetricSummary {
  readonly count: number;

  readonly names: readonly string[];

  readonly subjects: readonly string[];

  readonly types: readonly IntelligenceMetricType[];

  readonly totalValue: number;

  readonly averageValue: number;

  readonly averageNormalizedValue: number;

  readonly averageConfidenceRank: number;

  readonly latestObservedAt: string | null;

  readonly earliestObservedAt: string | null;

  readonly fingerprint: Fingerprint;
}

/* -------------------------------------------------------------------------- */
/* Constants                                                                  */
/* -------------------------------------------------------------------------- */

const CONFIDENCE_RANK: Readonly<
  Record<IntelligenceConfidence, number>
> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const DIRECTIONS: readonly IntelligenceDirection[] = [
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
  "UNKNOWN",
];

/* -------------------------------------------------------------------------- */
/* Primitive normalization                                                    */
/* -------------------------------------------------------------------------- */

function requireNonEmpty(
  value: string,
  field: string,
): string {
  invariant(
    typeof value === "string" &&
      value.trim().length > 0,
    "V8_INTELLIGENCE_METRIC_VALUE_REQUIRED",
    `${field} must be non-empty.`,
  );

  return value.trim();
}

function normalizeIdentifier(
  value: string,
  field: string,
): string {
  return requireNonEmpty(value, field);
}

function normalizeName(
  value: string,
): string {
  return normalizeText(
    requireNonEmpty(value, "name"),
  );
}

function normalizeSubject(
  value: string,
): string {
  return normalizeText(
    requireNonEmpty(value, "subject"),
  );
}

function normalizeIsoTimestamp(
  value: string,
  field = "observedAt",
): string {
  const normalized =
    requireNonEmpty(value, field);

  const timestamp =
    Date.parse(normalized);

  invariant(
    Number.isFinite(timestamp),
    "V8_INTELLIGENCE_METRIC_TIMESTAMP_INVALID",
    `${field} must be a valid ISO timestamp.`,
  );

  return new Date(timestamp).toISOString();
}

function normalizeFiniteNumber(
  value: number,
  field: string,
): number {
  invariant(
    Number.isFinite(value),
    "V8_INTELLIGENCE_METRIC_NUMBER_INVALID",
    `${field} must be a finite number.`,
  );

  return value;
}

function normalizeOptionalFiniteNumber(
  value: number | undefined,
  field: string,
): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  return normalizeFiniteNumber(
    value,
    field,
  );
}

function normalizeConfidence(
  value: IntelligenceConfidence | undefined,
): IntelligenceConfidence {
  const confidence =
    value ?? "MEDIUM";

  invariant(
    Object.prototype.hasOwnProperty.call(
      CONFIDENCE_RANK,
      confidence,
    ),
    "V8_INTELLIGENCE_METRIC_CONFIDENCE_INVALID",
    `Unsupported metric confidence: ${String(confidence)}.`,
  );

  return confidence;
}

function normalizeDirection(
  value: IntelligenceDirection | undefined,
): IntelligenceDirection {
  const direction =
    value ?? "UNKNOWN";

  invariant(
    DIRECTIONS.includes(direction),
    "V8_INTELLIGENCE_METRIC_DIRECTION_INVALID",
    `Unsupported metric direction: ${String(direction)}.`,
  );

  return direction;
}

function normalizeIds(
  values: readonly string[] | undefined,
): readonly string[] {
  return Object.freeze(
    uniqueStrings(values ?? []),
  );
}

function normalizeEvidenceRefs(
  values:
    | readonly IntelligenceEvidenceRef[]
    | undefined,
): readonly IntelligenceEvidenceRef[] {
  const refs =
    values ?? [];

  const seen =
    new Set<string>();

  const normalized =
    refs
      .map((ref) => {
        invariant(
          typeof ref.evidenceId ===
            "string" &&
            ref.evidenceId.trim().length >
              0,
          "V8_INTELLIGENCE_METRIC_EVIDENCE_ID_REQUIRED",
          "Every metric evidence reference requires evidenceId.",
        );

        const normalizedRef =
          immutable({
            evidenceId:
              ref.evidenceId.trim(),
            ...(ref.sourceId
              ? {
                  sourceId:
                    ref.sourceId.trim(),
                }
              : {}),
            ...(ref.snapshotId
              ? {
                  snapshotId:
                    ref.snapshotId.trim(),
                }
              : {}),
            ...(ref.aggregateType
              ? {
                  aggregateType:
                    ref.aggregateType,
                }
              : {}),
            ...(ref.fingerprint
              ? {
                  fingerprint:
                    ref.fingerprint,
                }
              : {}),
            ...(ref.locator
              ? {
                  locator:
                    ref.locator,
                }
              : {}),
            ...(ref.excerpt
              ? {
                  excerpt:
                    ref.excerpt,
                }
              : {}),
            ...(ref.confidence
              ? {
                  confidence:
                    ref.confidence,
                }
              : {}),
          });

        const key =
          [
            normalizedRef.evidenceId,
            normalizedRef.sourceId ?? "",
            normalizedRef.snapshotId ?? "",
            normalizedRef.fingerprint ?? "",
            normalizedRef.locator ?? "",
          ].join("|");

        invariant(
          !seen.has(key),
          "V8_INTELLIGENCE_METRIC_EVIDENCE_DUPLICATE",
          `Duplicate metric evidence reference: ${key}.`,
        );

        seen.add(key);

        return normalizedRef;
      })
      .sort((left, right) =>
        left.evidenceId.localeCompare(
          right.evidenceId,
        ),
      );

  return Object.freeze(
    normalized,
  );
}

function normalizeLineage(
  values:
    | readonly IntelligenceLineageRef[]
    | undefined,
): readonly IntelligenceLineageRef[] {
  const refs =
    values ?? [];

  const seen =
    new Set<string>();

  const normalized =
    refs
      .map((ref) => {
        invariant(
          typeof ref.aggregateId ===
            "string" &&
            ref.aggregateId.trim().length >
              0,
          "V8_INTELLIGENCE_METRIC_LINEAGE_ID_REQUIRED",
          "Every metric lineage reference requires aggregateId.",
        );

        invariant(
          Number.isInteger(ref.version) &&
            ref.version > 0,
          "V8_INTELLIGENCE_METRIC_LINEAGE_VERSION_INVALID",
          "Metric lineage version must be a positive integer.",
        );

        invariant(
          typeof ref.fingerprint ===
            "string" &&
            ref.fingerprint.length > 0,
          "V8_INTELLIGENCE_METRIC_LINEAGE_FINGERPRINT_REQUIRED",
          "Every metric lineage reference requires a fingerprint.",
        );

        const normalizedRef =
          immutable({
            aggregateType:
              ref.aggregateType,
            aggregateId:
              ref.aggregateId.trim(),
            version:
              ref.version,
            fingerprint:
              ref.fingerprint,
          });

        const key =
          [
            normalizedRef.aggregateType,
            normalizedRef.aggregateId,
            normalizedRef.version,
            normalizedRef.fingerprint,
          ].join("|");

        invariant(
          !seen.has(key),
          "V8_INTELLIGENCE_METRIC_LINEAGE_DUPLICATE",
          `Duplicate metric lineage reference: ${key}.`,
        );

        seen.add(key);

        return normalizedRef;
      })
      .sort((left, right) => {
        const aggregate =
          left.aggregateType.localeCompare(
            right.aggregateType,
          );

        if (aggregate !== 0) {
          return aggregate;
        }

        const id =
          left.aggregateId.localeCompare(
            right.aggregateId,
          );

        if (id !== 0) {
          return id;
        }

        return left.version - right.version;
      });

  return Object.freeze(
    normalized,
  );
}

function normalizeMetadata(
  value:
    | Readonly<Record<string, JsonValue>>
    | undefined,
): Readonly<
  Record<string, JsonValue>
> | undefined {
  if (!value) {
    return undefined;
  }

  const result:
    Record<string, JsonValue> = {};

  for (const key of Object.keys(value).sort()) {
    result[key] = value[key] as JsonValue;
  }

  return Object.freeze(result);
}

function normalizeNormalizedValue(
  value: number | undefined,
  rawValue: number,
): number {
  const normalized =
    value ?? clamp(rawValue);

  invariant(
    Number.isFinite(normalized),
    "V8_INTELLIGENCE_METRIC_NORMALIZED_VALUE_INVALID",
    "normalizedValue must be finite.",
  );

  return normalized;
}

/* -------------------------------------------------------------------------- */
/* Fingerprint serialization                                                  */
/* -------------------------------------------------------------------------- */

function serializeEvidenceRefs(
  refs: readonly IntelligenceEvidenceRef[],
): JsonValue {
  return refs.map(
    (ref) => ({
      evidenceId:
        ref.evidenceId,
      sourceId:
        ref.sourceId ?? null,
      snapshotId:
        ref.snapshotId ?? null,
      aggregateType:
        ref.aggregateType ?? null,
      fingerprint:
        ref.fingerprint ?? null,
      locator:
        ref.locator ?? null,
      excerpt:
        ref.excerpt ?? null,
      confidence:
        ref.confidence ?? null,
    }),
  );
}

function serializeLineage(
  lineage: readonly IntelligenceLineageRef[],
): JsonValue {
  return lineage.map(
    (ref) => ({
      aggregateType:
        ref.aggregateType,
      aggregateId:
        ref.aggregateId,
      version:
        ref.version,
      fingerprint:
        ref.fingerprint,
    }),
  );
}

function serializeMetricForFingerprint(
  metric: IntelligenceMetric,
): JsonValue {
  return {
    metricId:
      metric.metricId,
    type:
      metric.type,
    name:
      metric.name,
    subject:
      metric.subject,
    entityIds: [
      ...metric.entityIds,
    ],
    value:
      metric.value,
    normalizedValue:
      metric.normalizedValue,
    unit:
      metric.unit ?? null,
    observedAt:
      metric.observedAt,
    baseline:
      metric.baseline ?? null,
    target:
      metric.target ?? null,
    direction:
      metric.direction,
    confidence:
      metric.confidence,
    signalIds: [
      ...metric.signalIds,
    ],
    evidenceRefs:
      serializeEvidenceRefs(
        metric.evidenceRefs,
      ),
    lineage:
      serializeLineage(
        metric.lineage,
      ),
    metadata:
      metric.metadata ?? null,
  };
}

/* -------------------------------------------------------------------------- */
/* Creation                                                                   */
/* -------------------------------------------------------------------------- */

export function createIntelligenceMetric(
  input: CreateIntelligenceMetricInput,
): IntelligenceMetric {
  const type =
    input.type;

  invariant(
    typeof type === "string" &&
      type.length > 0,
    "V8_INTELLIGENCE_METRIC_TYPE_REQUIRED",
    "Metric type is required.",
  );

  const name =
    normalizeName(
      input.name,
    );

  const subject =
    normalizeSubject(
      input.subject,
    );

  const value =
    normalizeFiniteNumber(
      input.value,
      "value",
    );

  const normalizedValue =
    normalizeNormalizedValue(
      input.normalizedValue,
      value,
    );

  const observedAt =
    normalizeIsoTimestamp(
      input.observedAt,
    );

  const baseline =
    normalizeOptionalFiniteNumber(
      input.baseline,
      "baseline",
    );

  const target =
    normalizeOptionalFiniteNumber(
      input.target,
      "target",
    );

  const confidence =
    normalizeConfidence(
      input.confidence,
    );

  const direction =
    normalizeDirection(
      input.direction,
    );

  const entityIds =
    normalizeIds(
      input.entityIds,
    );

  const signalIds =
    normalizeIds(
      input.signalIds,
    );

  const evidenceRefs =
    normalizeEvidenceRefs(
      input.evidenceRefs,
    );

  const lineage =
    normalizeLineage(
      input.lineage,
    );

  const unit =
    input.unit === undefined
      ? undefined
      : requireNonEmpty(
          input.unit,
          "unit",
        );

  const metadata =
    normalizeMetadata(
      input.metadata,
    );

  const metricId =
    input.metricId &&
    input.metricId.trim().length > 0
      ? input.metricId.trim()
      : `metric:v8:${contentFingerprint({
          type,
          name,
          subject,
          entityIds: [
            ...entityIds,
          ],
          value,
          normalizedValue,
          unit:
            unit ?? null,
          observedAt,
          baseline:
            baseline ?? null,
          target:
            target ?? null,
          direction,
          confidence,
          signalIds: [
            ...signalIds,
          ],
          evidenceRefs:
            serializeEvidenceRefs(
              evidenceRefs,
            ),
          lineage:
            serializeLineage(
              lineage,
            ),
        })}`;

  const provisional =
    immutable({
      metricId,
      type,
      name,
      subject,
      entityIds,
      value,
      normalizedValue,
      ...(unit !== undefined
        ? {
            unit,
          }
        : {}),
      observedAt,
      ...(baseline !== undefined
        ? {
            baseline,
          }
        : {}),
      ...(target !== undefined
        ? {
            target,
          }
        : {}),
      direction,
      confidence,
      signalIds,
      evidenceRefs,
      lineage,
      ...(metadata !== undefined
        ? {
            metadata,
          }
        : {}),
      fingerprint:
        "",
    }) as IntelligenceMetric;

  const fingerprint =
    metricFingerprint(
      provisional,
    );

  return immutable({
    ...provisional,
    fingerprint,
  });
}

/* -------------------------------------------------------------------------- */
/* Fingerprint / integrity                                                    */
/* -------------------------------------------------------------------------- */

export function metricFingerprint(
  metric: IntelligenceMetric,
): Fingerprint {
  return contentFingerprint(
    serializeMetricForFingerprint(
      metric,
    ),
  );
}

export function assertMetricIntegrity(
  metric: IntelligenceMetric,
): void {
  invariant(
    typeof metric.metricId ===
      "string" &&
      metric.metricId.trim().length >
        0,
    "V8_INTELLIGENCE_METRIC_ID_REQUIRED",
    "Metric metricId must be non-empty.",
  );

  invariant(
    typeof metric.name ===
      "string" &&
      metric.name.trim().length >
        0,
    "V8_INTELLIGENCE_METRIC_NAME_REQUIRED",
    "Metric name must be non-empty.",
  );

  invariant(
    typeof metric.subject ===
      "string" &&
      metric.subject.trim().length >
        0,
    "V8_INTELLIGENCE_METRIC_SUBJECT_REQUIRED",
    "Metric subject must be non-empty.",
  );

  invariant(
    Number.isFinite(metric.value),
    "V8_INTELLIGENCE_METRIC_VALUE_INVALID",
    "Metric value must be finite.",
  );

  invariant(
    Number.isFinite(
      metric.normalizedValue,
    ),
    "V8_INTELLIGENCE_METRIC_NORMALIZED_VALUE_INVALID",
    "Metric normalizedValue must be finite.",
  );

  invariant(
    Number.isFinite(
      metric.baseline ?? 0,
    ),
    "V8_INTELLIGENCE_METRIC_BASELINE_INVALID",
    "Metric baseline must be finite when provided.",
  );

  invariant(
    Number.isFinite(
      metric.target ?? 0,
    ),
    "V8_INTELLIGENCE_METRIC_TARGET_INVALID",
    "Metric target must be finite when provided.",
  );

  invariant(
    typeof metric.observedAt ===
      "string" &&
      Number.isFinite(
        Date.parse(
          metric.observedAt,
        ),
      ),
    "V8_INTELLIGENCE_METRIC_TIMESTAMP_INVALID",
    "Metric observedAt must be a valid timestamp.",
  );

  invariant(
    Object.prototype.hasOwnProperty.call(
      CONFIDENCE_RANK,
      metric.confidence,
    ),
    "V8_INTELLIGENCE_METRIC_CONFIDENCE_INVALID",
    `Unsupported metric confidence: ${String(metric.confidence)}.`,
  );

  invariant(
    DIRECTIONS.includes(
      metric.direction,
    ),
    "V8_INTELLIGENCE_METRIC_DIRECTION_INVALID",
    `Unsupported metric direction: ${String(metric.direction)}.`,
  );

  const calculated =
    metricFingerprint(
      metric,
    );

  invariant(
    calculated ===
      metric.fingerprint,
    "V8_INTELLIGENCE_METRIC_FINGERPRINT_MISMATCH",
    `Metric fingerprint mismatch for ${metric.metricId}.`,
  );
}

/* -------------------------------------------------------------------------- */
/* Deduplication                                                              */
/* -------------------------------------------------------------------------- */

export function deduplicateMetrics(
  metrics: readonly IntelligenceMetric[],
): readonly IntelligenceMetric[] {
  const byFingerprint =
    new Map<
      Fingerprint,
      IntelligenceMetric
    >();

  for (const metric of metrics) {
    assertMetricIntegrity(
      metric,
    );

    const existing =
      byFingerprint.get(
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
      confidenceRank(
        metric.confidence,
      ) >
        confidenceRank(
          existing.confidence,
        ) ||
      (
        metric.confidence ===
          existing.confidence &&
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
    [
      ...byFingerprint.values(),
    ].sort(compareMetrics),
  );
}

/* -------------------------------------------------------------------------- */
/* Filtering                                                                  */
/* -------------------------------------------------------------------------- */

export function filterMetrics(
  metrics: readonly IntelligenceMetric[],
  filter: MetricFilter,
): readonly IntelligenceMetric[] {
  const typeSet =
    filter.types
      ? new Set(
          filter.types,
        )
      : undefined;

  const nameSet =
    filter.names
      ? new Set(
          filter.names.map(
            normalizeName,
          ),
        )
      : undefined;

  const subjectSet =
    filter.subjects
      ? new Set(
          filter.subjects.map(
            normalizeSubject,
          ),
        )
      : undefined;

  const entitySet =
    filter.entityIds
      ? new Set(
          normalizeIds(
            filter.entityIds,
          ),
        )
      : undefined;

  const signalSet =
    filter.signalIds
      ? new Set(
          normalizeIds(
            filter.signalIds,
          ),
        )
      : undefined;

  const confidenceSet =
    filter.confidences
      ? new Set(
          filter.confidences,
        )
      : undefined;

  const directionSet =
    filter.directions
      ? new Set(
          filter.directions,
        )
      : undefined;

  const observedAfter =
    filter.observedAfter !==
    undefined
      ? normalizeIsoTimestamp(
          filter.observedAfter,
          "observedAfter",
        )
      : undefined;

  const observedBefore =
    filter.observedBefore !==
    undefined
      ? normalizeIsoTimestamp(
          filter.observedBefore,
          "observedBefore",
        )
      : undefined;

  if (
    filter.minValue !==
      undefined
  ) {
    normalizeFiniteNumber(
      filter.minValue,
      "minValue",
    );
  }

  if (
    filter.maxValue !==
      undefined
  ) {
    normalizeFiniteNumber(
      filter.maxValue,
      "maxValue",
    );
  }

  if (
    filter.minNormalizedValue !==
      undefined
  ) {
    normalizeFiniteNumber(
      filter.minNormalizedValue,
      "minNormalizedValue",
    );
  }

  if (
    filter.maxNormalizedValue !==
      undefined
  ) {
    normalizeFiniteNumber(
      filter.maxNormalizedValue,
      "maxNormalizedValue",
    );
  }

  return Object.freeze(
    metrics.filter(
      (metric) => {
        if (
          typeSet &&
          !typeSet.has(
            metric.type,
          )
        ) {
          return false;
        }

        if (
          nameSet &&
          !nameSet.has(
            metric.name,
          )
        ) {
          return false;
        }

        if (
          subjectSet &&
          !subjectSet.has(
            metric.subject,
          )
        ) {
          return false;
        }

        if (
          confidenceSet &&
          !confidenceSet.has(
            metric.confidence,
          )
        ) {
          return false;
        }

        if (
          directionSet &&
          !directionSet.has(
            metric.direction,
          )
        ) {
          return false;
        }

        if (
          filter.minValue !==
            undefined &&
          metric.value <
            filter.minValue
        ) {
          return false;
        }

        if (
          filter.maxValue !==
            undefined &&
          metric.value >
            filter.maxValue
        ) {
          return false;
        }

        if (
          filter.minNormalizedValue !==
            undefined &&
          metric.normalizedValue <
            filter.minNormalizedValue
        ) {
          return false;
        }

        if (
          filter.maxNormalizedValue !==
            undefined &&
          metric.normalizedValue >
            filter.maxNormalizedValue
        ) {
          return false;
        }

        if (
          observedAfter &&
          metric.observedAt <=
            observedAfter
        ) {
          return false;
        }

        if (
          observedBefore &&
          metric.observedAt >=
            observedBefore
        ) {
          return false;
        }

        if (entitySet) {
          const matches =
            metric.entityIds.some(
              (id) =>
                entitySet.has(id),
            );

          if (!matches) {
            return false;
          }
        }

        if (signalSet) {
          const matches =
            metric.signalIds.some(
              (id) =>
                signalSet.has(id),
            );

          if (!matches) {
            return false;
          }
        }

        return true;
      },
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Aggregation                                                                */
/* -------------------------------------------------------------------------- */

export function aggregateMetricsByName(
  metrics: readonly IntelligenceMetric[],
): readonly MetricAggregation[] {
  const groups =
    new Map<
      string,
      IntelligenceMetric[]
    >();

  for (const metric of metrics) {
    assertMetricIntegrity(
      metric,
    );

    const key =
      [
        metric.type,
        metric.name,
        metric.subject,
      ].join("|");

    const existing =
      groups.get(key);

    if (existing) {
      existing.push(
        metric,
      );
    } else {
      groups.set(
        key,
        [metric],
      );
    }
  }

  const result:
    MetricAggregation[] = [];

  for (const group of groups.values()) {
    if (
      group.length ===
      0
    ) {
      continue;
    }

    const values =
      group.map(
        (metric) =>
          metric.value,
      );

    const totalValue =
      values.reduce(
        (sum, value) =>
          sum + value,
        0,
      );

    const averageValue =
      totalValue /
      group.length;

    const minimumValue =
      Math.min(
        ...values,
      );

    const maximumValue =
      Math.max(
        ...values,
      );

    const totalNormalizedValue =
      group.reduce(
        (sum, metric) =>
          sum +
          metric.normalizedValue,
        0,
      );

    const averageNormalizedValue =
      totalNormalizedValue /
      group.length;

    const averageConfidenceRank =
      group.reduce(
        (sum, metric) =>
          sum +
          confidenceRank(
            metric.confidence,
          ),
        0,
      ) / group.length;

    const weightedDenominator =
      group.reduce(
        (sum, metric) =>
          sum +
          Math.max(
            confidenceRank(
              metric.confidence,
            ),
            1,
          ),
        0,
      );

    const weightedValue =
      group.reduce(
        (sum, metric) =>
          sum +
          metric.value *
            Math.max(
              confidenceRank(
                metric.confidence,
              ),
              1,
            ),
        0,
      ) /
      weightedDenominator;

    const latestObservedAt =
      [...group]
        .sort(
          compareMetricsByTimeDescending,
        )[0]
        ?.observedAt ?? "";

    result.push({
      type:
        group[0].type,
      name:
        group[0].name,
      subject:
        group[0].subject,
      count:
        group.length,
      totalValue,
      averageValue,
      minimumValue,
      maximumValue,
      weightedValue,
      averageNormalizedValue,
      averageConfidenceRank,
      latestObservedAt,
      metricIds:
        Object.freeze(
          group
            .map(
              (metric) =>
                metric.metricId,
            )
            .sort(),
        ),
    });
  }

  return Object.freeze(
    result.sort(
      (left, right) => {
        if (
          right.weightedValue !==
          left.weightedValue
        ) {
          return (
            right.weightedValue -
            left.weightedValue
          );
        }

        const type =
          left.type.localeCompare(
            right.type,
          );

        if (type !== 0) {
          return type;
        }

        return left.name.localeCompare(
          right.name,
        );
      },
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Summary                                                                    */
/* -------------------------------------------------------------------------- */

export function summarizeMetrics(
  metrics: readonly IntelligenceMetric[],
): MetricSummary {
  const normalized =
    deduplicateMetrics(
      metrics,
    );

  const names =
    Object.freeze(
      [
        ...new Set(
          normalized.map(
            (metric) =>
              metric.name,
          ),
        ),
      ].sort(),
    );

  const subjects =
    Object.freeze(
      [
        ...new Set(
          normalized.map(
            (metric) =>
              metric.subject,
          ),
        ),
      ].sort(),
    );

  const types =
    Object.freeze(
      [
        ...new Set(
          normalized.map(
            (metric) =>
              metric.type,
          ),
        ),
      ].sort(),
    );

  const totalValue =
    normalized.reduce(
      (sum, metric) =>
        sum + metric.value,
      0,
    );

  const averageValue =
    normalized.length === 0
      ? 0
      : totalValue /
        normalized.length;

  const averageNormalizedValue =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, metric) =>
            sum +
            metric.normalizedValue,
          0,
        ) /
        normalized.length;

  const averageConfidenceRank =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, metric) =>
            sum +
            confidenceRank(
              metric.confidence,
            ),
          0,
        ) /
        normalized.length;

  const ordered =
    [
      ...normalized,
    ].sort(
      compareMetricsByTimeAscending,
    );

  const latestObservedAt =
    ordered.at(-1)
      ?.observedAt ??
    null;

  const earliestObservedAt =
    ordered[0]
      ?.observedAt ??
    null;

  const fingerprint =
    contentFingerprint({
      count:
        normalized.length,
      names,
      subjects,
      types,
      totalValue,
      averageValue,
      averageNormalizedValue,
      averageConfidenceRank,
      latestObservedAt,
      earliestObservedAt,
    });

  return {
    count:
      normalized.length,
    names,
    subjects,
    types,
    totalValue,
    averageValue,
    averageNormalizedValue,
    averageConfidenceRank,
    latestObservedAt,
    earliestObservedAt,
    fingerprint,
  };
}

/* -------------------------------------------------------------------------- */
/* Ranking                                                                    */
/* -------------------------------------------------------------------------- */

export function rankMetrics(
  metrics: readonly IntelligenceMetric[],
): readonly IntelligenceMetric[] {
  return Object.freeze(
    [
      ...deduplicateMetrics(
        metrics,
      ),
    ].sort(
      (left, right) => {
        const leftScore =
          Math.abs(
            left.normalizedValue,
          ) *
          (
            confidenceRank(
              left.confidence,
            ) + 1
          );

        const rightScore =
          Math.abs(
            right.normalizedValue,
          ) *
          (
            confidenceRank(
              right.confidence,
            ) + 1
          );

        if (
          rightScore !==
          leftScore
        ) {
          return (
            rightScore -
            leftScore
          );
        }

        return compareMetrics(
          left,
          right,
        );
      },
    ),
  );
}

/* -------------------------------------------------------------------------- */
/* Merge                                                                      */
/* -------------------------------------------------------------------------- */

export function mergeMetrics(
  primary: IntelligenceMetric,
  secondary: IntelligenceMetric,
): IntelligenceMetric {
  assertMetricIntegrity(
    primary,
  );

  assertMetricIntegrity(
    secondary,
  );

  invariant(
    primary.type ===
      secondary.type,
    "V8_INTELLIGENCE_METRIC_MERGE_TYPE_CONFLICT",
    "Cannot merge metrics with different types.",
  );

  invariant(
    primary.name ===
      secondary.name,
    "V8_INTELLIGENCE_METRIC_MERGE_NAME_CONFLICT",
    "Cannot merge metrics with different names.",
  );

  invariant(
    primary.subject ===
      secondary.subject,
    "V8_INTELLIGENCE_METRIC_MERGE_SUBJECT_CONFLICT",
    "Cannot merge metrics with different subjects.",
  );

  const latest =
    primary.observedAt >=
      secondary.observedAt
      ? primary
      : secondary;

  const confidence =
    confidenceRank(
      primary.confidence,
    ) >=
    confidenceRank(
      secondary.confidence,
    )
      ? primary.confidence
      : secondary.confidence;

  const entityIds =
    normalizeIds([
      ...primary.entityIds,
      ...secondary.entityIds,
    ]);

  const signalIds =
    normalizeIds([
      ...primary.signalIds,
      ...secondary.signalIds,
    ]);

  const evidenceRefs =
    normalizeEvidenceRefs([
      ...primary.evidenceRefs,
      ...secondary.evidenceRefs,
    ]);

  const lineage =
    normalizeLineage([
      ...primary.lineage,
      ...secondary.lineage,
    ]);

  const metadataEntries:
    Record<string, JsonValue> =
    {};

  for (const [key, value] of Object.entries(
    primary.metadata ?? {},
  )) {
    metadataEntries[key] =
      value;
  }

  for (const [key, value] of Object.entries(
    secondary.metadata ?? {},
  )) {
    metadataEntries[key] =
      value;
  }

  return createIntelligenceMetric({
    metricId:
      primary.metricId,
    type:
      primary.type,
    name:
      primary.name,
    subject:
      primary.subject,
    entityIds,
    value:
      latest.value,
    normalizedValue:
      latest.normalizedValue,
    ...(latest.unit !== undefined
      ? {
          unit:
            latest.unit,
        }
      : {}),
    observedAt:
      latest.observedAt,
    ...(latest.baseline !==
    undefined
      ? {
          baseline:
            latest.baseline,
        }
      : {}),
    ...(latest.target !==
    undefined
      ? {
          target:
            latest.target,
        }
      : {}),
    direction:
      latest.direction,
    confidence,
    signalIds,
    evidenceRefs,
    lineage,
    metadata:
      Object.keys(
        metadataEntries,
      ).length > 0
        ? metadataEntries
        : undefined,
  });
}

/* -------------------------------------------------------------------------- */
/* Collection integrity                                                       */
/* -------------------------------------------------------------------------- */

export function assertMetricCollection(
  metrics: readonly IntelligenceMetric[],
): void {
  const ids =
    new Set<string>();

  const fingerprints =
    new Set<Fingerprint>();

  for (const metric of metrics) {
    assertMetricIntegrity(
      metric,
    );

    invariant(
      !ids.has(
        metric.metricId,
      ),
      "V8_INTELLIGENCE_METRIC_ID_DUPLICATE",
      `Duplicate intelligence metric ID: ${metric.metricId}.`,
    );

    invariant(
      !fingerprints.has(
        metric.fingerprint,
      ),
      "V8_INTELLIGENCE_METRIC_FINGERPRINT_DUPLICATE",
      `Duplicate intelligence metric fingerprint: ${metric.fingerprint}.`,
    );

    ids.add(
      metric.metricId,
    );

    fingerprints.add(
      metric.fingerprint,
    );
  }
}

/* -------------------------------------------------------------------------- */
/* Internal helpers                                                           */
/* -------------------------------------------------------------------------- */

function confidenceRank(
  confidence: IntelligenceConfidence,
): number {
  return CONFIDENCE_RANK[
    confidence
  ];
}

function compareMetricsByTimeAscending(
  left: IntelligenceMetric,
  right: IntelligenceMetric,
): number {
  if (
    left.observedAt !==
    right.observedAt
  ) {
    return left.observedAt.localeCompare(
      right.observedAt,
    );
  }

  return left.metricId.localeCompare(
    right.metricId,
  );
}

function compareMetricsByTimeDescending(
  left: IntelligenceMetric,
  right: IntelligenceMetric,
): number {
  if (
    left.observedAt !==
    right.observedAt
  ) {
    return right.observedAt.localeCompare(
      left.observedAt,
    );
  }

  return left.metricId.localeCompare(
    right.metricId,
  );
}

function compareMetrics(
  left: IntelligenceMetric,
  right: IntelligenceMetric,
): number {
  const time =
    compareMetricsByTimeDescending(
      left,
      right,
    );

  if (time !== 0) {
    return time;
  }

  const type =
    left.type.localeCompare(
      right.type,
    );

  if (type !== 0) {
    return type;
  }

  return left.metricId.localeCompare(
    right.metricId,
  );
}