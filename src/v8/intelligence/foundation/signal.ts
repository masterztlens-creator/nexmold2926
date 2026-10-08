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
} from "../shared.js";

import type {
  Fingerprint,
} from "../../domain/primitives.js";

import type {
  JsonValue,
} from "../shared.js";

import type {
  IntelligenceConfidence,
  IntelligenceDirection,
  IntelligenceEvidenceRef,
  IntelligencePolarity,
  IntelligenceSignal,
  IntelligenceSignalSource,
  IntelligenceSignalType,
} from "./types.js";

export interface CreateIntelligenceSignalInput {
  readonly signalId?: string;
  readonly type: IntelligenceSignalType;
  readonly source: IntelligenceSignalSource;
  readonly subject: string;
  readonly entityIds?: readonly string[];
  readonly observedAt: string;
  readonly value: JsonValue;
  readonly unit?: string;
  readonly direction?: IntelligenceDirection;
  readonly polarity?: IntelligencePolarity;
  readonly confidence?: IntelligenceConfidence;
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly lineage?: IntelligenceSignal["lineage"];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface SignalFilter {
  readonly type?: IntelligenceSignalType;
  readonly source?: IntelligenceSignalSource;
  readonly subject?: string;
  readonly entityId?: string;
  readonly direction?: IntelligenceDirection;
  readonly polarity?: IntelligencePolarity;
  readonly minimumConfidence?: IntelligenceConfidence;
  readonly observedAfter?: string;
  readonly observedBefore?: string;
}

export interface SignalAggregation {
  readonly subject: string;
  readonly signalCount: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly neutralCount: number;
  readonly confidenceScore: number;
  readonly averageNumericValue: number | null;
  readonly latestObservedAt: string;
  readonly signalIds: readonly string[];
  readonly fingerprint: Fingerprint;
}

export interface SignalSummary {
  readonly total: number;
  readonly byType: Readonly<
    Partial<Record<IntelligenceSignalType, number>>
  >;
  readonly bySource: Readonly<
    Partial<Record<IntelligenceSignalSource, number>>
  >;
  readonly byDirection: Readonly<
    Partial<Record<IntelligenceDirection, number>>
  >;
  readonly byPolarity: Readonly<
    Partial<Record<IntelligencePolarity, number>>
  >;
  readonly averageConfidence: number;
  readonly fingerprint: Fingerprint;
}

const CONFIDENCE_SCORE: Readonly<
  Record<IntelligenceConfidence, number>
> = {
  VERY_LOW: 0,
  LOW: 0.25,
  MEDIUM: 0.5,
  HIGH: 0.75,
  VERY_HIGH: 1,
};

const DIRECTIONS: readonly IntelligenceDirection[] = [
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
  "UNKNOWN",
];

const POLARITIES: readonly IntelligencePolarity[] = [
  "OPPORTUNITY",
  "RISK",
  "NEUTRAL",
  "UNKNOWN",
];

function assertNonEmpty(
  value: string,
  field: string,
): string {
  invariant(
    typeof value === "string" &&
      value.trim().length > 0,
    "V8_INTELLIGENCE_SIGNAL_VALUE_REQUIRED",
    `${field} must be non-empty.`,
  );

  return value.trim();
}

function assertConfidence(
  confidence: IntelligenceConfidence,
): void {
  invariant(
    Object.prototype.hasOwnProperty.call(
      CONFIDENCE_SCORE,
      confidence,
    ),
    "V8_INTELLIGENCE_SIGNAL_CONFIDENCE_INVALID",
    `Unsupported confidence: ${String(confidence)}.`,
  );
}

function assertDirection(
  direction: IntelligenceDirection,
): void {
  invariant(
    DIRECTIONS.includes(direction),
    "V8_INTELLIGENCE_SIGNAL_DIRECTION_INVALID",
    `Unsupported direction: ${String(direction)}.`,
  );
}

function assertPolarity(
  polarity: IntelligencePolarity,
): void {
  invariant(
    POLARITIES.includes(polarity),
    "V8_INTELLIGENCE_SIGNAL_POLARITY_INVALID",
    `Unsupported polarity: ${String(polarity)}.`,
  );
}

function assertTimestamp(
  value: string,
  field: string,
): void {
  assertNonEmpty(value, field);

  invariant(
    !Number.isNaN(Date.parse(value)),
    "V8_INTELLIGENCE_SIGNAL_TIMESTAMP_INVALID",
    `${field} must be a valid timestamp.`,
  );
}

function normalizeEntityIds(
  entityIds:
    | readonly string[]
    | undefined,
): string[] {
  return uniqueStrings(
    entityIds ?? [],
  );
}

function normalizeEvidenceRefs(
  refs:
    | readonly IntelligenceEvidenceRef[]
    | undefined,
): IntelligenceEvidenceRef[] {
  const seen = new Set<string>();

  const result: IntelligenceEvidenceRef[] = [];

  for (const ref of refs ?? []) {
    invariant(
      typeof ref.evidenceId ===
        "string" &&
        ref.evidenceId.trim()
          .length > 0,
      "V8_INTELLIGENCE_SIGNAL_EVIDENCE_ID_REQUIRED",
      "Evidence reference id must be non-empty.",
    );

    const key = [
      ref.evidenceId,
      ref.sourceId ?? "",
      ref.snapshotId ?? "",
      ref.fingerprint ?? "",
      ref.locator ?? "",
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);

    result.push(
      immutable({
        ...ref,
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
        ...(ref.locator
          ? {
              locator:
                ref.locator.trim(),
            }
          : {}),
      }),
    );
  }

  return result;
}

function numericValue(
  value: JsonValue,
): number | null {
  if (
    typeof value ===
    "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  return null;
}

function defaultDirection(
  value: JsonValue,
): IntelligenceDirection {
  const numeric =
    numericValue(value);

  if (numeric === null) {
    return "UNKNOWN";
  }

  if (numeric > 0) {
    return "POSITIVE";
  }

  if (numeric < 0) {
    return "NEGATIVE";
  }

  return "NEUTRAL";
}

function defaultPolarity(
  direction: IntelligenceDirection,
): IntelligencePolarity {
  if (direction === "POSITIVE") {
    return "OPPORTUNITY";
  }

  if (direction === "NEGATIVE") {
    return "RISK";
  }

  if (direction === "NEUTRAL") {
    return "NEUTRAL";
  }

  return "UNKNOWN";
}

function signalFingerprintPayload(
  signal: Omit<
    IntelligenceSignal,
    "fingerprint"
  >,
): JsonValue {
  return {
    signalId:
      signal.signalId,
    type:
      signal.type,
    source:
      signal.source,
    subject:
      signal.subject,
    normalizedSubject:
      signal.normalizedSubject,
    entityIds:
      signal.entityIds,
    observedAt:
      signal.observedAt,
    value:
      signal.value,
    unit:
      signal.unit ?? null,
    direction:
      signal.direction,
    polarity:
      signal.polarity,
    confidence:
      signal.confidence,
    evidenceRefs:
      signal.evidenceRefs,
    lineage:
      signal.lineage,
    metadata:
      signal.metadata ?? null,
  };
}

export function normalizeSignalSubject(
  subject: string,
): string {
  const normalized =
    normalizeText(subject);

  invariant(
    normalized.length > 0,
    "V8_INTELLIGENCE_SIGNAL_SUBJECT_EMPTY",
    "Signal subject must contain meaningful text.",
  );

  return normalized;
}

export function signalConfidenceScore(
  confidence: IntelligenceConfidence,
): number {
  assertConfidence(confidence);

  return CONFIDENCE_SCORE[
    confidence
  ];
}

export function createIntelligenceSignal(
  input: CreateIntelligenceSignalInput,
): IntelligenceSignal {
  const subject =
    assertNonEmpty(
      input.subject,
      "subject",
    );

  const normalizedSubject =
    normalizeSignalSubject(
      subject,
    );

  assertTimestamp(
    input.observedAt,
    "observedAt",
  );

  const confidence =
    input.confidence ??
    "MEDIUM";

  assertConfidence(
    confidence,
  );

  const direction =
    input.direction ??
    defaultDirection(
      input.value,
    );

  assertDirection(direction);

  const polarity =
    input.polarity ??
    defaultPolarity(
      direction,
    );

  assertPolarity(polarity);

  const entityIds =
    normalizeEntityIds(
      input.entityIds,
    );

  const evidenceRefs =
    normalizeEvidenceRefs(
      input.evidenceRefs,
    );

  const lineage = [
    ...(input.lineage ?? []),
  ];

  for (const link of lineage) {
    invariant(
      typeof link.aggregateId ===
        "string" &&
        link.aggregateId.trim()
          .length > 0,
      "V8_INTELLIGENCE_SIGNAL_LINEAGE_ID_REQUIRED",
      "Signal lineage aggregateId must be non-empty.",
    );

    invariant(
      Number.isInteger(
        link.version,
      ) &&
        link.version > 0,
      "V8_INTELLIGENCE_SIGNAL_LINEAGE_VERSION_INVALID",
      "Signal lineage version must be a positive integer.",
    );

    invariant(
      typeof link.fingerprint ===
        "string" &&
        link.fingerprint.length > 0,
      "V8_INTELLIGENCE_SIGNAL_LINEAGE_FINGERPRINT_REQUIRED",
      "Signal lineage fingerprint is required.",
    );
  }

  const signalId =
    input.signalId ??
    `signal:${contentFingerprint(
      {
        type:
          input.type,
        source:
          input.source,
        normalizedSubject,
        observedAt:
          input.observedAt,
        value:
          input.value,
        entityIds,
      },
    )}`;

  assertNonEmpty(
    signalId,
    "signalId",
  );

  const signalWithoutFingerprint =
    immutable({
      signalId,
      type:
        input.type,
      source:
        input.source,
      subject,
      normalizedSubject,
      entityIds,
      observedAt:
        input.observedAt,
      value:
        input.value,
      ...(input.unit
        ? {
            unit:
              input.unit.trim(),
          }
        : {}),
      direction,
      polarity,
      confidence,
      evidenceRefs,
      lineage,
      ...(input.metadata
        ? {
            metadata: {
              ...input.metadata,
            },
          }
        : {}),
    }) as Omit<
      IntelligenceSignal,
      "fingerprint"
    >;

  const fingerprint =
    contentFingerprint(
      signalFingerprintPayload(
        signalWithoutFingerprint,
      ),
    );

  return immutable({
    ...signalWithoutFingerprint,
    fingerprint,
  });
}

export function signalFingerprint(
  signal: IntelligenceSignal,
): Fingerprint {
  return contentFingerprint(
    signalFingerprintPayload(
      signal,
    ),
  );
}

export function assertSignalIntegrity(
  signal: IntelligenceSignal,
): void {
  assertNonEmpty(
    signal.signalId,
    "signalId",
  );

  assertNonEmpty(
    signal.subject,
    "subject",
  );

  invariant(
    signal.normalizedSubject ===
      normalizeSignalSubject(
        signal.subject,
      ),
    "V8_INTELLIGENCE_SIGNAL_NORMALIZATION_MISMATCH",
    `Signal ${signal.signalId} normalizedSubject mismatch.`,
  );

  assertTimestamp(
    signal.observedAt,
    "observedAt",
  );

  assertConfidence(
    signal.confidence,
  );

  assertDirection(
    signal.direction,
  );

  assertPolarity(
    signal.polarity,
  );

  const expected =
    signalFingerprint(
      signal,
    );

  invariant(
    expected ===
      signal.fingerprint,
    "V8_INTELLIGENCE_SIGNAL_FINGERPRINT_MISMATCH",
    `Signal ${signal.signalId} fingerprint mismatch.`,
  );

  const duplicateEntityIds =
    signal.entityIds.length !==
    new Set(
      signal.entityIds,
    ).size;

  invariant(
    !duplicateEntityIds,
    "V8_INTELLIGENCE_SIGNAL_ENTITY_DUPLICATE",
    `Signal ${signal.signalId} contains duplicate entity references.`,
  );
}

export function deduplicateSignals(
  signals: readonly IntelligenceSignal[],
): readonly IntelligenceSignal[] {
  const result =
    new Map<
      string,
      IntelligenceSignal
    >();

  for (const signal of signals) {
    assertSignalIntegrity(
      signal,
    );

    const key = [
      signal.type,
      signal.source,
      signal.normalizedSubject,
      signal.observedAt,
      contentFingerprint(
        signal.value,
      ),
      signal.entityIds.join(","),
    ].join("|");

    const existing =
      result.get(key);

    if (!existing) {
      result.set(
        key,
        signal,
      );
      continue;
    }

    const existingScore =
      signalConfidenceScore(
        existing.confidence,
      );

    const currentScore =
      signalConfidenceScore(
        signal.confidence,
      );

    if (
      currentScore >
      existingScore
    ) {
      result.set(
        key,
        signal,
      );
    }
  }

  return immutable([
    ...result.values(),
  ]);
}

export function filterSignals(
  signals: readonly IntelligenceSignal[],
  filter: SignalFilter,
): readonly IntelligenceSignal[] {
  let result =
    [...signals];

  if (filter.type) {
    result =
      result.filter(
        (signal) =>
          signal.type ===
          filter.type,
      );
  }

  if (filter.source) {
    result =
      result.filter(
        (signal) =>
          signal.source ===
          filter.source,
      );
  }

  if (filter.subject) {
    const subject =
      normalizeSignalSubject(
        filter.subject,
      );

    result =
      result.filter(
        (signal) =>
          signal.normalizedSubject ===
          subject,
      );
  }

  if (filter.entityId) {
    result =
      result.filter(
        (signal) =>
          signal.entityIds.includes(
            filter.entityId as string,
          ),
      );
  }

  if (filter.direction) {
    result =
      result.filter(
        (signal) =>
          signal.direction ===
          filter.direction,
      );
  }

  if (filter.polarity) {
    result =
      result.filter(
        (signal) =>
          signal.polarity ===
          filter.polarity,
      );
  }

  if (
    filter.minimumConfidence
  ) {
    const minimum =
      signalConfidenceScore(
        filter.minimumConfidence,
      );

    result =
      result.filter(
        (signal) =>
          signalConfidenceScore(
            signal.confidence,
          ) >= minimum,
      );
  }

  if (
    filter.observedAfter
  ) {
    assertTimestamp(
      filter.observedAfter,
      "observedAfter",
    );

    const after =
      Date.parse(
        filter.observedAfter,
      );

    result =
      result.filter(
        (signal) =>
          Date.parse(
            signal.observedAt,
          ) >= after,
      );
  }

  if (
    filter.observedBefore
  ) {
    assertTimestamp(
      filter.observedBefore,
      "observedBefore",
    );

    const before =
      Date.parse(
        filter.observedBefore,
      );

    result =
      result.filter(
        (signal) =>
          Date.parse(
            signal.observedAt,
          ) <= before,
      );
  }

  return immutable(
    result,
  );
}

export function aggregateSignalsBySubject(
  signals: readonly IntelligenceSignal[],
): readonly SignalAggregation[] {
  const groups =
    new Map<
      string,
      IntelligenceSignal[]
    >();

  for (const signal of signals) {
    assertSignalIntegrity(
      signal,
    );

    const group =
      groups.get(
        signal.normalizedSubject,
      ) ?? [];

    group.push(signal);

    groups.set(
      signal.normalizedSubject,
      group,
    );
  }

  const aggregations:
    SignalAggregation[] = [];

  for (
    const [
      subject,
      group,
    ] of groups
  ) {
    let positiveCount = 0;
    let negativeCount = 0;
    let neutralCount = 0;

    let confidenceTotal = 0;

    let numericTotal = 0;
    let numericCount = 0;

    let latestObservedAt =
      group[0]
        ?.observedAt ??
      "1970-01-01T00:00:00.000Z";

    for (const signal of group) {
      if (
        signal.direction ===
        "POSITIVE"
      ) {
        positiveCount += 1;
      }

      if (
        signal.direction ===
        "NEGATIVE"
      ) {
        negativeCount += 1;
      }

      if (
        signal.direction ===
        "NEUTRAL"
      ) {
        neutralCount += 1;
      }

      confidenceTotal +=
        signalConfidenceScore(
          signal.confidence,
        );

      const numeric =
        numericValue(
          signal.value,
        );

      if (numeric !== null) {
        numericTotal += numeric;
        numericCount += 1;
      }

      if (
        Date.parse(
          signal.observedAt,
        ) >
        Date.parse(
          latestObservedAt,
        )
      ) {
        latestObservedAt =
          signal.observedAt;
      }
    }

    const confidenceScore =
      group.length > 0
        ? clamp(
            confidenceTotal /
              group.length,
          )
        : 0;

    const fingerprint =
      contentFingerprint({
        subject,
        signalIds:
          group.map(
            (signal) =>
              signal.signalId,
          ),
        signalCount:
          group.length,
        positiveCount,
        negativeCount,
        neutralCount,
        confidenceScore,
        averageNumericValue:
          numericCount > 0
            ? numericTotal /
              numericCount
            : null,
        latestObservedAt,
      });

    aggregations.push(
      immutable({
        subject,
        signalCount:
          group.length,
        positiveCount,
        negativeCount,
        neutralCount,
        confidenceScore,
        averageNumericValue:
          numericCount > 0
            ? numericTotal /
              numericCount
            : null,
        latestObservedAt,
        signalIds:
          group.map(
            (signal) =>
              signal.signalId,
          ),
        fingerprint,
      }),
    );
  }

  aggregations.sort(
    (left, right) =>
      left.subject.localeCompare(
        right.subject,
      ),
  );

  return immutable(
    aggregations,
  );
}

export function summarizeSignals(
  signals: readonly IntelligenceSignal[],
): SignalSummary {
  const byType:
    Partial<
      Record<
        IntelligenceSignalType,
        number
      >
    > = {};

  const bySource:
    Partial<
      Record<
        IntelligenceSignalSource,
        number
      >
    > = {};

  const byDirection:
    Partial<
      Record<
        IntelligenceDirection,
        number
      >
    > = {};

  const byPolarity:
    Partial<
      Record<
        IntelligencePolarity,
        number
      >
    > = {};

  let confidenceTotal = 0;

  for (const signal of signals) {
    assertSignalIntegrity(
      signal,
    );

    byType[signal.type] =
      (byType[signal.type] ??
        0) + 1;

    bySource[signal.source] =
      (bySource[signal.source] ??
        0) + 1;

    byDirection[
      signal.direction
    ] =
      (byDirection[
        signal.direction
      ] ?? 0) + 1;

    byPolarity[
      signal.polarity
    ] =
      (byPolarity[
        signal.polarity
      ] ?? 0) + 1;

    confidenceTotal +=
      signalConfidenceScore(
        signal.confidence,
      );
  }

  const averageConfidence =
    signals.length > 0
      ? clamp(
          confidenceTotal /
            signals.length,
        )
      : 0;

  const fingerprint =
    contentFingerprint({
      total:
        signals.length,
      byType,
      bySource,
      byDirection,
      byPolarity,
      averageConfidence,
    });

  return immutable({
    total:
      signals.length,
    byType,
    bySource,
    byDirection,
    byPolarity,
    averageConfidence,
    fingerprint,
  });
}

export function rankSignals(
  signals: readonly IntelligenceSignal[],
): readonly IntelligenceSignal[] {
  const sorted =
    [...signals].sort(
      (left, right) => {
        const confidenceDelta =
          signalConfidenceScore(
            right.confidence,
          ) -
          signalConfidenceScore(
            left.confidence,
          );

        if (
          confidenceDelta !==
          0
        ) {
          return confidenceDelta;
        }

        const dateDelta =
          Date.parse(
            right.observedAt,
          ) -
          Date.parse(
            left.observedAt,
          );

        if (
          dateDelta !==
          0
        ) {
          return dateDelta;
        }

        return left.signalId.localeCompare(
          right.signalId,
        );
      },
    );

  return immutable(
    sorted,
  );
}

export function mergeSignals(
  primary: IntelligenceSignal,
  secondary: IntelligenceSignal,
): IntelligenceSignal {
  assertSignalIntegrity(
    primary,
  );

  assertSignalIntegrity(
    secondary,
  );

  invariant(
    primary.type ===
      secondary.type,
    "V8_INTELLIGENCE_SIGNAL_MERGE_TYPE_CONFLICT",
    "Signals with different types cannot be merged.",
  );

  invariant(
    primary.source ===
      secondary.source,
    "V8_INTELLIGENCE_SIGNAL_MERGE_SOURCE_CONFLICT",
    "Signals with different sources cannot be merged.",
  );

  invariant(
    primary.normalizedSubject ===
      secondary.normalizedSubject,
    "V8_INTELLIGENCE_SIGNAL_MERGE_SUBJECT_CONFLICT",
    "Signals with different subjects cannot be merged.",
  );

  const confidence =
    signalConfidenceScore(
      primary.confidence,
    ) >=
    signalConfidenceScore(
      secondary.confidence,
    )
      ? primary.confidence
      : secondary.confidence;

  const evidenceMap =
    new Map<
      string,
      IntelligenceEvidenceRef
    >();

  for (const ref of [
    ...primary.evidenceRefs,
    ...secondary.evidenceRefs,
  ]) {
    const key = [
      ref.evidenceId,
      ref.sourceId ?? "",
      ref.snapshotId ?? "",
      ref.fingerprint ?? "",
      ref.locator ?? "",
    ].join("|");

    evidenceMap.set(
      key,
      ref,
    );
  }

  const entityIds =
    uniqueStrings([
      ...primary.entityIds,
      ...secondary.entityIds,
    ]);

  const lineageMap =
    new Map<
      string,
      IntelligenceSignal["lineage"][number]
    >();

  for (const link of [
    ...primary.lineage,
    ...secondary.lineage,
  ]) {
    const key = [
      link.aggregateType,
      link.aggregateId,
      link.version,
      link.fingerprint,
    ].join("|");

    lineageMap.set(
      key,
      link,
    );
  }

  const latest =
    Date.parse(
      primary.observedAt,
    ) >=
    Date.parse(
      secondary.observedAt,
    )
      ? primary
      : secondary;

  const mergedWithoutFingerprint =
    immutable({
      ...latest,
      signalId:
        primary.signalId,
      entityIds,
      confidence,
      evidenceRefs: [
        ...evidenceMap.values(),
      ],
      lineage: [
        ...lineageMap.values(),
      ],
      metadata: {
        ...(primary.metadata ??
          {}),
        ...(secondary.metadata ??
          {}),
      },
    }) as Omit<
      IntelligenceSignal,
      "fingerprint"
    >;

  const fingerprint =
    contentFingerprint(
      signalFingerprintPayload(
        mergedWithoutFingerprint,
      ),
    );

  return immutable({
    ...mergedWithoutFingerprint,
    fingerprint,
  });
}

export function assertSignalCollection(
  signals: readonly IntelligenceSignal[],
): void {
  const ids =
    new Set<string>();

  for (const signal of signals) {
    assertSignalIntegrity(
      signal,
    );

    invariant(
      !ids.has(
        signal.signalId,
      ),
      "V8_INTELLIGENCE_SIGNAL_ID_DUPLICATE",
      `Duplicate signal id: ${signal.signalId}.`,
    );

    ids.add(
      signal.signalId,
    );
  }
}