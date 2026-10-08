import { immutable, invariant } from "../../constitution/invariants.js";
import {
  clamp,
  contentFingerprint,
  normalizeText,
  uniqueStrings,
} from "../shared.js";
import type {
  IntelligenceEvidenceRef,
  IntelligenceFeedback,
  IntelligenceFeedbackSignal,
} from "./types.js";

export interface CreateIntelligenceFeedbackInput {
  readonly feedbackId: string;
  readonly cycleId: string;
  readonly sourceEntityIds?: readonly string[];
  readonly sourceSignalIds?: readonly string[];
  readonly sourceDecisionIds?: readonly string[];
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly signal: IntelligenceFeedbackSignal;
  readonly confidence: number;
  readonly observedAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface FeedbackFilter {
  readonly cycleId?: string;
  readonly signalType?: string;
  readonly sourceEntityId?: string;
  readonly sourceSignalId?: string;
  readonly sourceDecisionId?: string;
  readonly minConfidence?: number;
  readonly maxConfidence?: number;
  readonly startObservedAt?: string;
  readonly endObservedAt?: string;
}

export interface FeedbackAggregation {
  readonly signalType: string;
  readonly count: number;
  readonly totalImpact: number;
  readonly averageImpact: number;
  readonly averageConfidence: number;
  readonly positiveCount: number;
  readonly negativeCount: number;
  readonly neutralCount: number;
  readonly feedbackIds: readonly string[];
}

export interface FeedbackSummary {
  readonly total: number;
  readonly averageConfidence: number;
  readonly totalImpact: number;
  readonly positive: number;
  readonly negative: number;
  readonly neutral: number;
  readonly signalTypes: readonly string[];
  readonly cycleIds: readonly string[];
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = normalizeText(value);
  invariant(normalized.length > 0, `${field} must not be empty`);
  return normalized;
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
    `${field} must be a valid timestamp`,
  );

  return timestamp.toISOString();
}

function normalizeConfidence(value: number): number {
  invariant(Number.isFinite(value), "feedback confidence must be finite");
  invariant(
    value >= 0 && value <= 1,
    "feedback confidence must be between 0 and 1",
  );

  return Math.round(clamp(value, 0, 1) * 1_000_000) / 1_000_000;
}

function normalizeImpact(value: number): number {
  invariant(Number.isFinite(value), "feedback impact must be finite");

  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeIds(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) => requireNonEmpty(value, field)),
  );
}

function normalizeUnknown(value: unknown): unknown {
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
      "feedback metadata contains invalid number",
    );
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeUnknown(item));
  }

  if (typeof value === "object") {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, unknown> = {};

    for (const key of Object.keys(record).sort()) {
      normalized[key] = normalizeUnknown(record[key]);
    }

    return normalized;
  }

  invariant(false, "feedback metadata contains unsupported value");
}

function normalizeMetadata(
  value: Readonly<Record<string, unknown>> | undefined,
): Readonly<Record<string, unknown>> {
  if (!value) {
    return {};
  }

  return normalizeUnknown(value) as Readonly<Record<string, unknown>>;
}

function normalizeEvidenceRefs(
  refs: readonly IntelligenceEvidenceRef[] | undefined,
): readonly IntelligenceEvidenceRef[] {
  if (!refs || refs.length === 0) {
    return [];
  }

  const normalized = refs.map((ref) => {
    invariant(
      typeof ref === "object" && ref !== null,
      "feedback evidence reference must be an object",
    );

    return {
      evidenceId: requireNonEmpty(
        ref.evidenceId,
        "evidenceRef.evidenceId",
      ),
      sourceId: requireNonEmpty(
        ref.sourceId,
        "evidenceRef.sourceId",
      ),
      snapshotId: requireNonEmpty(
        ref.snapshotId,
        "evidenceRef.snapshotId",
      ),
      excerptHash: requireNonEmpty(
        ref.excerptHash,
        "evidenceRef.excerptHash",
      ),
      evidenceHash: requireNonEmpty(
        ref.evidenceHash,
        "evidenceRef.evidenceHash",
      ),
    } satisfies IntelligenceEvidenceRef;
  });

  const seen = new Set<string>();
  const result: IntelligenceEvidenceRef[] = [];

  for (const ref of normalized) {
    const key = [
      ref.evidenceId,
      ref.sourceId,
      ref.snapshotId,
      ref.excerptHash,
      ref.evidenceHash,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(ref);
  }

  return result;
}

function normalizeFeedbackSignal(
  signal: IntelligenceFeedbackSignal,
): IntelligenceFeedbackSignal {
  invariant(
    typeof signal === "object" && signal !== null,
    "feedback signal must be an object",
  );

  return {
    signalId: requireNonEmpty(
      signal.signalId,
      "feedback signalId",
    ),
    signal: requireNonEmpty(
      signal.signal,
      "feedback signal",
    ),
    impact: normalizeImpact(signal.impact),
    direction: requireNonEmpty(
      signal.direction,
      "feedback direction",
    ),
    metricIds: normalizeIds(
      signal.metricIds,
      "feedback metricId",
    ),
    notes:
      signal.notes === undefined
        ? undefined
        : requireNonEmpty(signal.notes, "feedback notes"),
  };
}

function serializeEvidenceRefs(
  refs: readonly IntelligenceEvidenceRef[],
): readonly Record<string, string>[] {
  return refs.map((ref) => ({
    evidenceId: ref.evidenceId,
    sourceId: ref.sourceId,
    snapshotId: ref.snapshotId,
    excerptHash: ref.excerptHash,
    evidenceHash: ref.evidenceHash,
  }));
}

function serializeFeedbackForFingerprint(
  feedback: IntelligenceFeedback,
): Record<string, unknown> {
  return {
    feedbackId: feedback.feedbackId,
    cycleId: feedback.cycleId,
    sourceEntityIds: [...feedback.sourceEntityIds],
    sourceSignalIds: [...feedback.sourceSignalIds],
    sourceDecisionIds: [...feedback.sourceDecisionIds],
    evidenceRefs: serializeEvidenceRefs(feedback.evidenceRefs),
    signal: {
      signalId: feedback.signal.signalId,
      signal: feedback.signal.signal,
      impact: feedback.signal.impact,
      direction: feedback.signal.direction,
      metricIds: [...feedback.signal.metricIds],
      notes: feedback.signal.notes,
    },
    confidence: feedback.confidence,
    observedAt: feedback.observedAt,
    metadata: normalizeMetadata(feedback.metadata),
  };
}

export function createIntelligenceFeedback(
  input: CreateIntelligenceFeedbackInput,
): IntelligenceFeedback {
  const feedbackId = requireNonEmpty(
    input.feedbackId,
    "feedbackId",
  );

  const cycleId = requireNonEmpty(
    input.cycleId,
    "cycleId",
  );

  const sourceEntityIds = normalizeIds(
    input.sourceEntityIds,
    "sourceEntityId",
  );

  const sourceSignalIds = normalizeIds(
    input.sourceSignalIds,
    "sourceSignalId",
  );

  const sourceDecisionIds = normalizeIds(
    input.sourceDecisionIds,
    "sourceDecisionId",
  );

  const evidenceRefs = normalizeEvidenceRefs(
    input.evidenceRefs,
  );

  const signal = normalizeFeedbackSignal(input.signal);

  const confidence = normalizeConfidence(
    input.confidence,
  );

  const observedAt = normalizeTimestamp(
    input.observedAt,
    "feedback observedAt",
  );

  const metadata = normalizeMetadata(
    input.metadata,
  );

  const provisional: IntelligenceFeedback = {
    feedbackId,
    cycleId,
    sourceEntityIds,
    sourceSignalIds,
    sourceDecisionIds,
    evidenceRefs,
    signal,
    confidence,
    observedAt,
    metadata,
    fingerprint: "",
  };

  const fingerprint = contentFingerprint(
    serializeFeedbackForFingerprint(provisional),
  );

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
): string {
  return contentFingerprint(
    serializeFeedbackForFingerprint(feedback),
  );
}

export function assertFeedbackIntegrity(
  feedback: IntelligenceFeedback,
): void {
  invariant(
    typeof feedback === "object" &&
      feedback !== null,
    "feedback must be an object",
  );

  invariant(
    normalizeText(feedback.feedbackId).length > 0,
    "feedbackId must not be empty",
  );

  invariant(
    normalizeText(feedback.cycleId).length > 0,
    "cycleId must not be empty",
  );

  invariant(
    Number.isFinite(feedback.confidence) &&
      feedback.confidence >= 0 &&
      feedback.confidence <= 1,
    `invalid feedback confidence: ${feedback.feedbackId}`,
  );

  invariant(
    Number.isFinite(feedback.signal.impact),
    `invalid feedback impact: ${feedback.feedbackId}`,
  );

  invariant(
    feedback.signal.metricIds.length ===
      new Set(feedback.signal.metricIds).size,
    `feedback metricIds must be unique: ${feedback.feedbackId}`,
  );

  invariant(
    feedback.fingerprint === feedbackFingerprint(feedback),
    `feedback fingerprint mismatch: ${feedback.feedbackId}`,
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

    const existing = byFingerprint.get(item.fingerprint);

    if (!existing) {
      byFingerprint.set(item.fingerprint, item);
      continue;
    }

    if (item.confidence > existing.confidence) {
      byFingerprint.set(item.fingerprint, item);
      continue;
    }

    if (
      item.confidence === existing.confidence &&
      item.observedAt < existing.observedAt
    ) {
      byFingerprint.set(item.fingerprint, item);
    }
  }

  return [...byFingerprint.values()].sort(
    (left, right) => {
      if (left.observedAt !== right.observedAt) {
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
      filter.cycleId !== undefined &&
      item.cycleId !== filter.cycleId
    ) {
      return false;
    }

    if (
      filter.signalType !== undefined &&
      item.signal.signal !== filter.signalType
    ) {
      return false;
    }

    if (
      filter.sourceEntityId !== undefined &&
      !item.sourceEntityIds.includes(
        filter.sourceEntityId,
      )
    ) {
      return false;
    }

    if (
      filter.sourceSignalId !== undefined &&
      !item.sourceSignalIds.includes(
        filter.sourceSignalId,
      )
    ) {
      return false;
    }

    if (
      filter.sourceDecisionId !== undefined &&
      !item.sourceDecisionIds.includes(
        filter.sourceDecisionId,
      )
    ) {
      return false;
    }

    if (
      filter.minConfidence !== undefined &&
      item.confidence < filter.minConfidence
    ) {
      return false;
    }

    if (
      filter.maxConfidence !== undefined &&
      item.confidence > filter.maxConfidence
    ) {
      return false;
    }

    if (
      filter.startObservedAt !== undefined &&
      item.observedAt < filter.startObservedAt
    ) {
      return false;
    }

    if (
      filter.endObservedAt !== undefined &&
      item.observedAt > filter.endObservedAt
    ) {
      return false;
    }

    return true;
  });
}

export function aggregateFeedback(
  feedback: readonly IntelligenceFeedback[],
): readonly FeedbackAggregation[] {
  const groups = new Map<
    string,
    IntelligenceFeedback[]
  >();

  for (const item of deduplicateFeedback(feedback)) {
    const key = item.signal.signal;

    const group = groups.get(key);

    if (group) {
      group.push(item);
    } else {
      groups.set(key, [item]);
    }
  }

  return [...groups.entries()]
    .map(([signalType, items]) => {
      const totalImpact = items.reduce(
        (total, item) =>
          total + item.signal.impact,
        0,
      );

      const averageConfidence =
        items.reduce(
          (total, item) =>
            total + item.confidence,
          0,
        ) / items.length;

      return {
        signalType,
        count: items.length,
        totalImpact:
          Math.round(totalImpact * 1_000_000) /
          1_000_000,
        averageImpact:
          Math.round(
            (totalImpact / items.length) *
              1_000_000,
          ) / 1_000_000,
        averageConfidence:
          Math.round(
            averageConfidence * 1_000_000,
          ) / 1_000_000,
        positiveCount: items.filter(
          (item) =>
            item.signal.impact > 0,
        ).length,
        negativeCount: items.filter(
          (item) =>
            item.signal.impact < 0,
        ).length,
        neutralCount: items.filter(
          (item) =>
            item.signal.impact === 0,
        ).length,
        feedbackIds: items
          .map((item) => item.feedbackId)
          .sort(),
      };
    })
    .sort((left, right) => {
      if (right.totalImpact !== left.totalImpact) {
        return right.totalImpact - left.totalImpact;
      }

      return left.signalType.localeCompare(
        right.signalType,
      );
    });
}

export function summarizeFeedback(
  feedback: readonly IntelligenceFeedback[],
): FeedbackSummary {
  const normalized = deduplicateFeedback(
    feedback,
  );

  if (normalized.length === 0) {
    return {
      total: 0,
      averageConfidence: 0,
      totalImpact: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      signalTypes: [],
      cycleIds: [],
    };
  }

  const totalImpact = normalized.reduce(
    (total, item) =>
      total + item.signal.impact,
    0,
  );

  const averageConfidence =
    normalized.reduce(
      (total, item) =>
        total + item.confidence,
      0,
    ) / normalized.length;

  return {
    total: normalized.length,
    averageConfidence:
      Math.round(
        averageConfidence * 1_000_000,
      ) / 1_000_000,
    totalImpact:
      Math.round(totalImpact * 1_000_000) /
      1_000_000,
    positive: normalized.filter(
      (item) =>
        item.signal.impact > 0,
    ).length,
    negative: normalized.filter(
      (item) =>
        item.signal.impact < 0,
    ).length,
    neutral: normalized.filter(
      (item) =>
        item.signal.impact === 0,
    ).length,
    signalTypes: uniqueStrings(
      normalized.map(
        (item) => item.signal.signal,
      ),
    ),
    cycleIds: uniqueStrings(
      normalized.map(
        (item) => item.cycleId,
      ),
    ),
  };
}

export function rankFeedback(
  feedback: readonly IntelligenceFeedback[],
): readonly IntelligenceFeedback[] {
  return [
    ...deduplicateFeedback(feedback),
  ].sort((left, right) => {
    const leftScore =
      Math.abs(left.signal.impact) *
      left.confidence;

    const rightScore =
      Math.abs(right.signal.impact) *
      right.confidence;

    if (rightScore !== leftScore) {
      return rightScore - leftScore;
    }

    if (
      right.confidence !== left.confidence
    ) {
      return (
        right.confidence -
        left.confidence
      );
    }

    if (
      left.observedAt !== right.observedAt
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
      `duplicate feedbackId: ${item.feedbackId}`,
    );

    invariant(
      !fingerprints.has(item.fingerprint),
      `duplicate feedback fingerprint: ${item.feedbackId}`,
    );

    ids.add(item.feedbackId);
    fingerprints.add(item.fingerprint);
  }
}