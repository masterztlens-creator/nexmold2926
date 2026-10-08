import { contentFingerprint } from "../../foundation/hash.js";
import { immutable, invariant } from "../../constitution/invariants.js";
import type { Fingerprint } from "../../domain/primitives.js";
import type {
  IntelligenceConfidence,
  IntelligenceDirection,
  IntelligenceEvidenceRef,
  IntelligenceFeedback,
  IntelligenceFeedbackType,
  IntelligenceLineageRef,
} from "./types.js";
import type { JsonValue } from "../shared.js";
import { normalizeText } from "../shared.js";

export interface CreateIntelligenceFeedbackInput {
  readonly feedbackId: string;
  readonly type: IntelligenceFeedbackType;
  readonly subject: string;
  readonly value: JsonValue;
  readonly observedAt?: string;
  readonly entityIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly outcomeId?: string;
  readonly direction: IntelligenceDirection;
  readonly confidence: IntelligenceConfidence;
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly lineage?: readonly IntelligenceLineageRef[];
  readonly metadata?: Readonly<Record<string, JsonValue>>;
}

export interface FeedbackFilter {
  readonly type?: IntelligenceFeedbackType;
  readonly subject?: string;
  readonly entityId?: string;
  readonly signalId?: string;
  readonly metricId?: string;
  readonly outcomeId?: string;
  readonly direction?: IntelligenceDirection;
  readonly confidence?: IntelligenceConfidence;
  readonly minObservedAt?: string;
  readonly maxObservedAt?: string;
}

export interface FeedbackSummary {
  readonly total: number;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
  readonly unknown: number;
  readonly confidenceDistribution: Readonly<
    Record<IntelligenceConfidence, number>
  >;
  readonly types: readonly IntelligenceFeedbackType[];
  readonly directions: readonly IntelligenceDirection[];
  readonly subjects: readonly string[];
  readonly entityIds: readonly string[];
  readonly signalIds: readonly string[];
  readonly metricIds: readonly string[];
}

const CONFIDENCE_RANK: Readonly<
  Record<IntelligenceConfidence, number>
> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const CONFIDENCES: readonly IntelligenceConfidence[] = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
];

const DIRECTIONS: readonly IntelligenceDirection[] = [
  "POSITIVE",
  "NEGATIVE",
  "NEUTRAL",
  "UNKNOWN",
];

const FEEDBACK_TYPES: readonly IntelligenceFeedbackType[] = [
  "SEARCH",
  "SEO",
  "GEO",
  "TRAFFIC",
  "ENGAGEMENT",
  "INQUIRY",
  "LEAD",
  "CONVERSION",
  "REVENUE",
  "CONTENT",
  "EXPERIMENT",
  "SYSTEM",
];

function requireNonEmpty(
  value: string,
  field: string,
): string {
  invariant(
    typeof value === "string",
    "INTELLIGENCE_FEEDBACK_INVALID_FIELD",
    `${field} must be a string`,
  );

  const trimmed = value.trim();

  invariant(
    normalizeText(trimmed).length > 0,
    "INTELLIGENCE_FEEDBACK_EMPTY_FIELD",
    `${field} must not be empty`,
  );

  return trimmed;
}

function normalizeIds(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  if (!values || values.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = requireNonEmpty(value, field);

    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(normalized);
  }

  return result.sort((left, right) =>
    left.localeCompare(right),
  );
}

function normalizeConfidence(
  value: IntelligenceConfidence,
): IntelligenceConfidence {
  invariant(
    CONFIDENCES.includes(value),
    "INTELLIGENCE_FEEDBACK_INVALID_CONFIDENCE",
    `Invalid feedback confidence: ${String(value)}`,
  );

  return value;
}

function normalizeDirection(
  value: IntelligenceDirection,
): IntelligenceDirection {
  invariant(
    DIRECTIONS.includes(value),
    "INTELLIGENCE_FEEDBACK_INVALID_DIRECTION",
    `Invalid feedback direction: ${String(value)}`,
  );

  return value;
}

function normalizeType(
  value: IntelligenceFeedbackType,
): IntelligenceFeedbackType {
  invariant(
    FEEDBACK_TYPES.includes(value),
    "INTELLIGENCE_FEEDBACK_INVALID_TYPE",
    `Invalid feedback type: ${String(value)}`,
  );

  return value;
}

function normalizeTimestamp(
  value: string | undefined,
  field: string,
): string {
  if (value === undefined) {
    return new Date(0).toISOString();
  }

  const timestamp = new Date(value);

  invariant(
    Number.isFinite(timestamp.getTime()),
    "INTELLIGENCE_FEEDBACK_INVALID_TIMESTAMP",
    `${field} must be a valid timestamp`,
  );

  return timestamp.toISOString();
}

function normalizeJsonValue(
  value: JsonValue,
): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    invariant(
      Number.isFinite(value),
      "INTELLIGENCE_FEEDBACK_INVALID_VALUE",
      "Feedback numeric value must be finite",
    );

    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) =>
      normalizeJsonValue(item),
    );
  }

  const result: Record<string, JsonValue> = {};

  for (const key of Object.keys(value).sort()) {
    result[key] = normalizeJsonValue(value[key]);
  }

  return result;
}

function normalizeMetadata(
  metadata:
    | Readonly<Record<string, JsonValue>>
    | undefined,
): Readonly<Record<string, JsonValue>> | undefined {
  if (metadata === undefined) {
    return undefined;
  }

  const result: Record<string, JsonValue> = {};

  for (const key of Object.keys(metadata).sort()) {
    result[key] = normalizeJsonValue(metadata[key]);
  }

  return result;
}

function normalizeEvidenceRefs(
  refs:
    | readonly IntelligenceEvidenceRef[]
    | undefined,
): readonly IntelligenceEvidenceRef[] {
  if (!refs || refs.length === 0) {
    return [];
  }

  const result: IntelligenceEvidenceRef[] = [];
  const seen = new Set<string>();

  for (const ref of refs) {
    invariant(
      typeof ref === "object" && ref !== null,
      "INTELLIGENCE_FEEDBACK_INVALID_EVIDENCE",
      "Every evidence reference must be an object",
    );

    const normalized: IntelligenceEvidenceRef = {
      evidenceId: requireNonEmpty(
        ref.evidenceId,
        "evidenceRef.evidenceId",
      ),
      ...(ref.sourceId !== undefined
        ? {
            sourceId: requireNonEmpty(
              ref.sourceId,
              "evidenceRef.sourceId",
            ),
          }
        : {}),
      ...(ref.snapshotId !== undefined
        ? {
            snapshotId: requireNonEmpty(
              ref.snapshotId,
              "evidenceRef.snapshotId",
            ),
          }
        : {}),
      ...(ref.aggregateType !== undefined
        ? {
            aggregateType: ref.aggregateType,
          }
        : {}),
      ...(ref.fingerprint !== undefined
        ? {
            fingerprint: ref.fingerprint,
          }
        : {}),
      ...(ref.locator !== undefined
        ? {
            locator: ref.locator,
          }
        : {}),
      ...(ref.excerpt !== undefined
        ? {
            excerpt: ref.excerpt,
          }
        : {}),
      ...(ref.confidence !== undefined
        ? {
            confidence: normalizeConfidence(
              ref.confidence,
            ),
          }
        : {}),
    };

    const key = JSON.stringify(
      serializeEvidenceRef(normalized),
    );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result.sort((left, right) =>
    left.evidenceId.localeCompare(
      right.evidenceId,
    ),
  );
}

function serializeEvidenceRef(
  ref: IntelligenceEvidenceRef,
): Record<string, string> {
  const result: Record<string, string> = {
    evidenceId: ref.evidenceId,
  };

  if (ref.sourceId !== undefined) {
    result.sourceId = ref.sourceId;
  }

  if (ref.snapshotId !== undefined) {
    result.snapshotId = ref.snapshotId;
  }

  if (ref.aggregateType !== undefined) {
    result.aggregateType = ref.aggregateType;
  }

  if (ref.fingerprint !== undefined) {
    result.fingerprint = ref.fingerprint;
  }

  if (ref.locator !== undefined) {
    result.locator = ref.locator;
  }

  if (ref.excerpt !== undefined) {
    result.excerpt = ref.excerpt;
  }

  if (ref.confidence !== undefined) {
    result.confidence = ref.confidence;
  }

  return result;
}

function serializeLineageRef(
  ref: IntelligenceLineageRef,
): Record<string, string | number> {
  return {
    aggregateType: ref.aggregateType,
    aggregateId: ref.aggregateId,
    version: ref.version,
    fingerprint: ref.fingerprint,
  };
}

function normalizeLineage(
  lineage:
    | readonly IntelligenceLineageRef[]
    | undefined,
): readonly IntelligenceLineageRef[] {
  if (!lineage || lineage.length === 0) {
    return [];
  }

  const result: IntelligenceLineageRef[] = [];
  const seen = new Set<string>();

  for (const ref of lineage) {
    invariant(
      typeof ref === "object" && ref !== null,
      "INTELLIGENCE_FEEDBACK_INVALID_LINEAGE",
      "Every lineage reference must be an object",
    );

    invariant(
      typeof ref.aggregateType === "string" &&
        ref.aggregateType.length > 0,
      "INTELLIGENCE_FEEDBACK_INVALID_LINEAGE",
      "lineage.aggregateType must not be empty",
    );

    const aggregateId = requireNonEmpty(
      ref.aggregateId,
      "lineage.aggregateId",
    );

    invariant(
      Number.isInteger(ref.version) &&
        ref.version >= 1,
      "INTELLIGENCE_FEEDBACK_INVALID_LINEAGE",
      "lineage.version must be a positive integer",
    );

    invariant(
      typeof ref.fingerprint === "string" &&
        ref.fingerprint.length > 0,
      "INTELLIGENCE_FEEDBACK_INVALID_LINEAGE",
      "lineage.fingerprint must not be empty",
    );

    const normalized: IntelligenceLineageRef = {
      aggregateType: ref.aggregateType,
      aggregateId,
      version: ref.version,
      fingerprint: ref.fingerprint,
    };

    const key = JSON.stringify(
      serializeLineageRef(normalized),
    );

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result.sort((left, right) => {
    const aggregateType =
      left.aggregateType.localeCompare(
        right.aggregateType,
      );

    if (aggregateType !== 0) {
      return aggregateType;
    }

    const aggregateId =
      left.aggregateId.localeCompare(
        right.aggregateId,
      );

    if (aggregateId !== 0) {
      return aggregateId;
    }

    return left.version - right.version;
  });
}

function serializeFeedbackForFingerprint(
  feedback: IntelligenceFeedback,
): Record<string, unknown> {
  return {
    feedbackId: feedback.feedbackId,
    type: feedback.type,
    subject: feedback.subject,
    value: normalizeJsonValue(feedback.value),
    observedAt: feedback.observedAt,
    entityIds: [...feedback.entityIds],
    signalIds: [...feedback.signalIds],
    metricIds: [...feedback.metricIds],
    outcomeId: feedback.outcomeId ?? null,
    direction: feedback.direction,
    confidence: feedback.confidence,
    evidenceRefs: feedback.evidenceRefs.map(
      serializeEvidenceRef,
    ),
    lineage: feedback.lineage.map(
      serializeLineageRef,
    ),
    metadata:
      feedback.metadata === undefined
        ? null
        : normalizeMetadata(feedback.metadata),
  };
}

function computeFeedbackFingerprint(
  feedback: IntelligenceFeedback,
): Fingerprint {
  return contentFingerprint(
    serializeFeedbackForFingerprint(feedback),
  );
}

export function createIntelligenceFeedback(
  input: CreateIntelligenceFeedbackInput,
): IntelligenceFeedback {
  const feedbackId = requireNonEmpty(
    input.feedbackId,
    "feedbackId",
  );

  const type = normalizeType(input.type);

  const subject = requireNonEmpty(
    input.subject,
    "subject",
  );

  const value = normalizeJsonValue(input.value);

  const observedAt = normalizeTimestamp(
    input.observedAt,
    "observedAt",
  );

  const entityIds = normalizeIds(
    input.entityIds,
    "entityId",
  );

  const signalIds = normalizeIds(
    input.signalIds,
    "signalId",
  );

  const metricIds = normalizeIds(
    input.metricIds,
    "metricId",
  );

  const outcomeId =
    input.outcomeId === undefined
      ? undefined
      : requireNonEmpty(
          input.outcomeId,
          "outcomeId",
        );

  const direction = normalizeDirection(
    input.direction,
  );

  const confidence = normalizeConfidence(
    input.confidence,
  );

  const evidenceRefs = normalizeEvidenceRefs(
    input.evidenceRefs,
  );

  const lineage = normalizeLineage(
    input.lineage,
  );

  const metadata = normalizeMetadata(
    input.metadata,
  );

  invariant(
    signalIds.length +
      metricIds.length +
      entityIds.length +
      evidenceRefs.length +
      lineage.length >
      0,
    "INTELLIGENCE_FEEDBACK_NO_PROVENANCE",
    `Feedback ${feedbackId} must reference at least one entity, signal, metric, evidence, or lineage record`,
  );

  const provisional = {
    feedbackId,
    type,
    subject,
    value,
    observedAt,
    entityIds,
    signalIds,
    metricIds,
    ...(outcomeId !== undefined
      ? { outcomeId }
      : {}),
    direction,
    confidence,
    evidenceRefs,
    lineage,
    ...(metadata !== undefined
      ? { metadata }
      : {}),
  } satisfies Omit<
    IntelligenceFeedback,
    "fingerprint"
  >;

  const fingerprint =
    contentFingerprint(provisional);

  const result: IntelligenceFeedback = {
    ...provisional,
    fingerprint,
  };

  immutable(result);
  assertFeedbackIntegrity(result);

  return result;
}

export function feedbackFingerprint(
  feedback: IntelligenceFeedback,
): Fingerprint {
  return computeFeedbackFingerprint(feedback);
}

export function assertFeedbackIntegrity(
  feedback: IntelligenceFeedback,
): void {
  invariant(
    typeof feedback === "object" &&
      feedback !== null,
    "INTELLIGENCE_FEEDBACK_INVALID_OBJECT",
    "feedback must be an object",
  );

  invariant(
    typeof feedback.feedbackId === "string" &&
      normalizeText(feedback.feedbackId)
        .length > 0,
    "INTELLIGENCE_FEEDBACK_INVALID_ID",
    "feedbackId must not be empty",
  );

  invariant(
    FEEDBACK_TYPES.includes(feedback.type),
    "INTELLIGENCE_FEEDBACK_INVALID_TYPE",
    `Invalid feedback type: ${String(
      feedback.type,
    )}`,
  );

  invariant(
    typeof feedback.subject === "string" &&
      normalizeText(feedback.subject)
        .length > 0,
    "INTELLIGENCE_FEEDBACK_INVALID_SUBJECT",
    `Feedback ${feedback.feedbackId} subject must not be empty`,
  );

  invariant(
    Number.isFinite(
      Date.parse(feedback.observedAt),
    ),
    "INTELLIGENCE_FEEDBACK_INVALID_TIMESTAMP",
    `Feedback ${feedback.feedbackId} observedAt is invalid`,
  );

  invariant(
    DIRECTIONS.includes(feedback.direction),
    "INTELLIGENCE_FEEDBACK_INVALID_DIRECTION",
    `Feedback ${feedback.feedbackId} direction is invalid`,
  );

  invariant(
    CONFIDENCES.includes(feedback.confidence),
    "INTELLIGENCE_FEEDBACK_INVALID_CONFIDENCE",
    `Feedback ${feedback.feedbackId} confidence is invalid`,
  );

  invariant(
    feedback.entityIds.length ===
      new Set(feedback.entityIds).size,
    "INTELLIGENCE_FEEDBACK_DUPLICATE_ENTITY",
    `Feedback ${feedback.feedbackId} entityIds must be unique`,
  );

  invariant(
    feedback.signalIds.length ===
      new Set(feedback.signalIds).size,
    "INTELLIGENCE_FEEDBACK_DUPLICATE_SIGNAL",
    `Feedback ${feedback.feedbackId} signalIds must be unique`,
  );

  invariant(
    feedback.metricIds.length ===
      new Set(feedback.metricIds).size,
    "INTELLIGENCE_FEEDBACK_DUPLICATE_METRIC",
    `Feedback ${feedback.feedbackId} metricIds must be unique`,
  );

  invariant(
    feedback.fingerprint ===
      feedbackFingerprint(feedback),
    "INTELLIGENCE_FEEDBACK_FINGERPRINT_MISMATCH",
    `Feedback fingerprint mismatch: ${feedback.feedbackId}`,
  );
}

export function deduplicateFeedback(
  feedback: readonly IntelligenceFeedback[],
): readonly IntelligenceFeedback[] {
  const byFingerprint = new Map<
    string,
    IntelligenceFeedback
  >();

  for (const item of feedback) {
    assertFeedbackIntegrity(item);

    const existing = byFingerprint.get(
      item.fingerprint,
    );

    if (!existing) {
      byFingerprint.set(
        item.fingerprint,
        item,
      );
      continue;
    }

    if (
      CONFIDENCE_RANK[item.confidence] >
      CONFIDENCE_RANK[existing.confidence]
    ) {
      byFingerprint.set(
        item.fingerprint,
        item,
      );
      continue;
    }

    if (
      CONFIDENCE_RANK[item.confidence] ===
        CONFIDENCE_RANK[
          existing.confidence
        ] &&
      item.observedAt <
        existing.observedAt
    ) {
      byFingerprint.set(
        item.fingerprint,
        item,
      );
    }
  }

  return [...byFingerprint.values()].sort(
    (left, right) => {
      if (
        left.observedAt !==
        right.observedAt
      ) {
        return left.observedAt.localeCompare(
          right.observedAt,
        );
      }

      return left.feedbackId.localeCompare(
        right.feedbackId,
      );
    },
  );
}

export function filterFeedback(
  feedback: readonly IntelligenceFeedback[],
  filter: FeedbackFilter = {},
): readonly IntelligenceFeedback[] {
  return feedback.filter((item) => {
    assertFeedbackIntegrity(item);

    if (
      filter.type !== undefined &&
      item.type !== filter.type
    ) {
      return false;
    }

    if (
      filter.subject !== undefined &&
      normalizeText(item.subject) !==
        normalizeText(filter.subject)
    ) {
      return false;
    }

    if (
      filter.entityId !== undefined &&
      !item.entityIds.includes(
        filter.entityId,
      )
    ) {
      return false;
    }

    if (
      filter.signalId !== undefined &&
      !item.signalIds.includes(
        filter.signalId,
      )
    ) {
      return false;
    }

    if (
      filter.metricId !== undefined &&
      !item.metricIds.includes(
        filter.metricId,
      )
    ) {
      return false;
    }

    if (
      filter.outcomeId !== undefined &&
      item.outcomeId !==
        filter.outcomeId
    ) {
      return false;
    }

    if (
      filter.direction !== undefined &&
      item.direction !==
        filter.direction
    ) {
      return false;
    }

    if (
      filter.confidence !== undefined &&
      item.confidence !==
        filter.confidence
    ) {
      return false;
    }

    if (
      filter.minObservedAt !== undefined &&
      item.observedAt <
        filter.minObservedAt
    ) {
      return false;
    }

    if (
      filter.maxObservedAt !== undefined &&
      item.observedAt >
        filter.maxObservedAt
    ) {
      return false;
    }

    return true;
  });
}

export function summarizeFeedback(
  feedback: readonly IntelligenceFeedback[],
): FeedbackSummary {
  const normalized =
    deduplicateFeedback(feedback);

  const confidenceDistribution: Record<
    IntelligenceConfidence,
    number
  > = {
    VERY_LOW: 0,
    LOW: 0,
    MEDIUM: 0,
    HIGH: 0,
    VERY_HIGH: 0,
  };

  let positive = 0;
  let negative = 0;
  let neutral = 0;
  let unknown = 0;

  const types = new Set<IntelligenceFeedbackType>();
  const directions =
    new Set<IntelligenceDirection>();
  const subjects = new Set<string>();
  const entityIds = new Set<string>();
  const signalIds = new Set<string>();
  const metricIds = new Set<string>();

  for (const item of normalized) {
    confidenceDistribution[
      item.confidence
    ] += 1;

    types.add(item.type);
    directions.add(item.direction);
    subjects.add(item.subject);

    for (const entityId of item.entityIds) {
      entityIds.add(entityId);
    }

    for (const signalId of item.signalIds) {
      signalIds.add(signalId);
    }

    for (const metricId of item.metricIds) {
      metricIds.add(metricId);
    }

    switch (item.direction) {
      case "POSITIVE":
        positive += 1;
        break;
      case "NEGATIVE":
        negative += 1;
        break;
      case "NEUTRAL":
        neutral += 1;
        break;
      case "UNKNOWN":
        unknown += 1;
        break;
    }
  }

  return {
    total: normalized.length,
    positive,
    negative,
    neutral,
    unknown,
    confidenceDistribution,
    types: [...types].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
    directions: [...directions].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
    subjects: [...subjects].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
    entityIds: [...entityIds].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
    signalIds: [...signalIds].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
    metricIds: [...metricIds].sort(
      (left, right) =>
        left.localeCompare(right),
    ),
  };
}

export function rankFeedback(
  feedback: readonly IntelligenceFeedback[],
): readonly IntelligenceFeedback[] {
  return [
    ...deduplicateFeedback(feedback),
  ].sort((left, right) => {
    const confidence =
      CONFIDENCE_RANK[right.confidence] -
      CONFIDENCE_RANK[left.confidence];

    if (confidence !== 0) {
      return confidence;
    }

    const directionRank = (
      direction: IntelligenceDirection,
    ): number => {
      switch (direction) {
        case "POSITIVE":
          return 3;
        case "NEGATIVE":
          return 2;
        case "NEUTRAL":
          return 1;
        case "UNKNOWN":
          return 0;
      }
    };

    const direction =
      directionRank(right.direction) -
      directionRank(left.direction);

    if (direction !== 0) {
      return direction;
    }

    if (
      left.observedAt !==
      right.observedAt
    ) {
      return left.observedAt.localeCompare(
        right.observedAt,
      );
    }

    return left.feedbackId.localeCompare(
      right.feedbackId,
    );
  });
}

export function assertFeedbackCollection(
  feedback: readonly IntelligenceFeedback[],
): void {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const item of feedback) {
    assertFeedbackIntegrity(item);

    invariant(
      !ids.has(item.feedbackId),
      "INTELLIGENCE_FEEDBACK_DUPLICATE_ID",
      `Duplicate feedbackId: ${item.feedbackId}`,
    );

    invariant(
      !fingerprints.has(
        item.fingerprint,
      ),
      "INTELLIGENCE_FEEDBACK_DUPLICATE_FINGERPRINT",
      `Duplicate feedback fingerprint: ${item.feedbackId}`,
    );

    ids.add(item.feedbackId);
    fingerprints.add(item.fingerprint);
  }
}