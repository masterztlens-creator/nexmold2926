import { immutable, invariant } from "../../constitution/invariants.js";
import {
  contentFingerprint,
  normalizeText,
  uniqueStrings,
} from "../shared.js";
import type {
  IntelligenceEvidenceRef,
  IntelligenceLearning,
  IntelligenceLearningOutcome,
  IntelligenceLearningRule,
  IntelligenceLearningSignal,
} from "./types.js";

export interface CreateIntelligenceLearningInput {
  readonly learningId: string;
  readonly cycleId: string;
  readonly sourceDecisionIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly rule?: IntelligenceLearningRule;
  readonly outcome: IntelligenceLearningOutcome;
  readonly confidence: number;
  readonly createdAt?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface LearningFilter {
  readonly cycleId?: string;
  readonly ruleType?: string;
  readonly minConfidence?: number;
  readonly maxConfidence?: number;
  readonly signalId?: string;
  readonly decisionId?: string;
}

export interface LearningSummary {
  readonly total: number;
  readonly averageConfidence: number;
  readonly highConfidence: number;
  readonly lowConfidence: number;
  readonly ruleTypes: readonly string[];
  readonly cycleIds: readonly string[];
}

function requireNonEmpty(value: string, field: string): string {
  const normalized = normalizeText(value);
  invariant(normalized.length > 0, `${field} must not be empty`);
  return normalized;
}

function normalizeTimestamp(value: string | undefined): string {
  if (value === undefined) {
    return new Date(0).toISOString();
  }

  const timestamp = new Date(value);
  invariant(
    Number.isFinite(timestamp.getTime()),
    "learning createdAt must be a valid timestamp",
  );

  return timestamp.toISOString();
}

function normalizeConfidence(value: number): number {
  invariant(Number.isFinite(value), "learning confidence must be finite");
  invariant(
    value >= 0 && value <= 1,
    "learning confidence must be between 0 and 1",
  );

  return Math.round(value * 1_000_000) / 1_000_000;
}

function normalizeUnknown(
  value: unknown,
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }

  if (typeof value === "number") {
    invariant(Number.isFinite(value), "learning metadata contains invalid number");
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

  invariant(false, "learning metadata contains unsupported value");
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

  const result = refs.map((ref) => {
    invariant(
      typeof ref === "object" && ref !== null,
      "learning evidence reference must be an object",
    );

    const normalized = {
      evidenceId: requireNonEmpty(ref.evidenceId, "evidenceRef.evidenceId"),
      sourceId: requireNonEmpty(ref.sourceId, "evidenceRef.sourceId"),
      snapshotId: requireNonEmpty(ref.snapshotId, "evidenceRef.snapshotId"),
      excerptHash: requireNonEmpty(
        ref.excerptHash,
        "evidenceRef.excerptHash",
      ),
      evidenceHash: requireNonEmpty(
        ref.evidenceHash,
        "evidenceRef.evidenceHash",
      ),
    } satisfies IntelligenceEvidenceRef;

    return normalized;
  });

  const seen = new Set<string>();
  const deduplicated: IntelligenceEvidenceRef[] = [];

  for (const ref of result) {
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
    deduplicated.push(ref);
  }

  return deduplicated;
}

function normalizeSignalIds(
  values: readonly string[] | undefined,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) => requireNonEmpty(value, "signalId")),
  );
}

function normalizeDecisionIds(
  values: readonly string[] | undefined,
): readonly string[] {
  return uniqueStrings(
    (values ?? []).map((value) => requireNonEmpty(value, "decisionId")),
  );
}

function normalizeRule(
  rule: IntelligenceLearningRule,
): IntelligenceLearningRule {
  invariant(
    typeof rule === "object" && rule !== null,
    "learning rule must be an object",
  );

  const normalized = {
    ruleId: requireNonEmpty(rule.ruleId, "learning ruleId"),
    type: requireNonEmpty(rule.type, "learning rule type"),
    condition: requireNonEmpty(
      rule.condition,
      "learning rule condition",
    ),
    action: requireNonEmpty(rule.action, "learning rule action"),
    priority: Math.trunc(rule.priority),
  } satisfies IntelligenceLearningRule;

  invariant(
    Number.isFinite(normalized.priority),
    "learning rule priority must be finite",
  );

  invariant(
    normalized.priority >= 0,
    "learning rule priority must be non-negative",
  );

  return normalized;
}

function normalizeOutcome(
  outcome: IntelligenceLearningOutcome,
): IntelligenceLearningOutcome {
  invariant(
    typeof outcome === "object" && outcome !== null,
    "learning outcome must be an object",
  );

  return {
    outcomeId: requireNonEmpty(outcome.outcomeId, "learning outcomeId"),
    status: requireNonEmpty(outcome.status, "learning outcome status"),
    summary: requireNonEmpty(outcome.summary, "learning outcome summary"),
    impact: outcome.impact,
    metricIds: uniqueStrings(
      (outcome.metricIds ?? []).map((value) =>
        requireNonEmpty(value, "learning outcome metricId"),
      ),
    ),
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

function serializeLearningForFingerprint(
  learning: IntelligenceLearning,
): Record<string, unknown> {
  return {
    learningId: learning.learningId,
    cycleId: learning.cycleId,
    sourceDecisionIds: [...learning.sourceDecisionIds],
    signalIds: [...learning.signalIds],
    evidenceRefs: serializeEvidenceRefs(learning.evidenceRefs),
    rule: {
      ruleId: learning.rule.ruleId,
      type: learning.rule.type,
      condition: learning.rule.condition,
      action: learning.rule.action,
      priority: learning.rule.priority,
    },
    outcome: {
      outcomeId: learning.outcome.outcomeId,
      status: learning.outcome.status,
      summary: learning.outcome.summary,
      impact: learning.outcome.impact,
      metricIds: [...learning.outcome.metricIds],
    },
    confidence: learning.confidence,
    createdAt: learning.createdAt,
    metadata: normalizeMetadata(learning.metadata),
  };
}

export function createIntelligenceLearning(
  input: CreateIntelligenceLearningInput,
): IntelligenceLearning {
  const learningId = requireNonEmpty(
    input.learningId,
    "learningId",
  );
  const cycleId = requireNonEmpty(input.cycleId, "cycleId");
  const createdAt = normalizeTimestamp(input.createdAt);
  const confidence = normalizeConfidence(input.confidence);
  const sourceDecisionIds = normalizeDecisionIds(
    input.sourceDecisionIds,
  );
  const signalIds = normalizeSignalIds(input.signalIds);
  const evidenceRefs = normalizeEvidenceRefs(input.evidenceRefs);
  const rule = normalizeRule(input.rule);
  const outcome = normalizeOutcome(input.outcome);
  const metadata = normalizeMetadata(input.metadata);

  const provisional: IntelligenceLearning = {
    learningId,
    cycleId,
    sourceDecisionIds,
    signalIds,
    evidenceRefs,
    rule,
    outcome,
    confidence,
    createdAt,
    metadata,
    fingerprint: "",
  };

  const fingerprint = contentFingerprint(
    serializeLearningForFingerprint(provisional),
  );

  const result: IntelligenceLearning = {
    ...provisional,
    fingerprint,
  };

  immutable(result);
  assertLearningIntegrity(result);

  return result;
}

export function learningFingerprint(
  learning: IntelligenceLearning,
): string {
  return contentFingerprint(
    serializeLearningForFingerprint(learning),
  );
}

export function assertLearningIntegrity(
  learning: IntelligenceLearning,
): void {
  invariant(
    typeof learning === "object" && learning !== null,
    "learning must be an object",
  );

  invariant(
    normalizeText(learning.learningId).length > 0,
    "learningId must not be empty",
  );

  invariant(
    normalizeText(learning.cycleId).length > 0,
    "cycleId must not be empty",
  );

  invariant(
    Number.isFinite(learning.confidence) &&
      learning.confidence >= 0 &&
      learning.confidence <= 1,
    "learning confidence must be between 0 and 1",
  );

  invariant(
    learning.fingerprint === learningFingerprint(learning),
    `learning fingerprint mismatch: ${learning.learningId}`,
  );

  invariant(
    learning.rule.priority >= 0 &&
      Number.isFinite(learning.rule.priority),
    `learning rule priority invalid: ${learning.learningId}`,
  );

  invariant(
    learning.outcome.metricIds.length ===
      new Set(learning.outcome.metricIds).size,
    `learning outcome metricIds must be unique: ${learning.learningId}`,
  );
}

export function deduplicateLearnings(
  learnings: readonly IntelligenceLearning[],
): readonly IntelligenceLearning[] {
  const byFingerprint = new Map<string, IntelligenceLearning>();

  for (const learning of learnings) {
    assertLearningIntegrity(learning);

    const existing = byFingerprint.get(learning.fingerprint);

    if (!existing) {
      byFingerprint.set(learning.fingerprint, learning);
      continue;
    }

    if (learning.confidence > existing.confidence) {
      byFingerprint.set(learning.fingerprint, learning);
      continue;
    }

    if (
      learning.confidence === existing.confidence &&
      learning.createdAt < existing.createdAt
    ) {
      byFingerprint.set(learning.fingerprint, learning);
    }
  }

  return [...byFingerprint.values()].sort((left, right) => {
    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.learningId.localeCompare(right.learningId);
  });
}

export function filterLearnings(
  learnings: readonly IntelligenceLearning[],
  filter: LearningFilter = {},
): readonly IntelligenceLearning[] {
  return learnings.filter((learning) => {
    assertLearningIntegrity(learning);

    if (
      filter.cycleId !== undefined &&
      learning.cycleId !== filter.cycleId
    ) {
      return false;
    }

    if (
      filter.ruleType !== undefined &&
      learning.rule.type !== filter.ruleType
    ) {
      return false;
    }

    if (
      filter.minConfidence !== undefined &&
      learning.confidence < filter.minConfidence
    ) {
      return false;
    }

    if (
      filter.maxConfidence !== undefined &&
      learning.confidence > filter.maxConfidence
    ) {
      return false;
    }

    if (
      filter.signalId !== undefined &&
      !learning.signalIds.includes(filter.signalId)
    ) {
      return false;
    }

    if (
      filter.decisionId !== undefined &&
      !learning.sourceDecisionIds.includes(filter.decisionId)
    ) {
      return false;
    }

    return true;
  });
}

export function summarizeLearnings(
  learnings: readonly IntelligenceLearning[],
): LearningSummary {
  const normalized = deduplicateLearnings(learnings);

  if (normalized.length === 0) {
    return {
      total: 0,
      averageConfidence: 0,
      highConfidence: 0,
      lowConfidence: 0,
      ruleTypes: [],
      cycleIds: [],
    };
  }

  const averageConfidence =
    normalized.reduce(
      (total, learning) => total + learning.confidence,
      0,
    ) / normalized.length;

  return {
    total: normalized.length,
    averageConfidence:
      Math.round(averageConfidence * 1_000_000) / 1_000_000,
    highConfidence: normalized.filter(
      (learning) => learning.confidence >= 0.8,
    ).length,
    lowConfidence: normalized.filter(
      (learning) => learning.confidence < 0.5,
    ).length,
    ruleTypes: uniqueStrings(
      normalized.map((learning) => learning.rule.type),
    ),
    cycleIds: uniqueStrings(
      normalized.map((learning) => learning.cycleId),
    ),
  };
}

export function rankLearnings(
  learnings: readonly IntelligenceLearning[],
): readonly IntelligenceLearning[] {
  return [...deduplicateLearnings(learnings)].sort((left, right) => {
    if (right.confidence !== left.confidence) {
      return right.confidence - left.confidence;
    }

    if (right.rule.priority !== left.rule.priority) {
      return right.rule.priority - left.rule.priority;
    }

    if (left.createdAt !== right.createdAt) {
      return left.createdAt.localeCompare(right.createdAt);
    }

    return left.learningId.localeCompare(right.learningId);
  });
}

export function assertLearningCollection(
  learnings: readonly IntelligenceLearning[],
): void {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const learning of learnings) {
    assertLearningIntegrity(learning);

    invariant(
      !ids.has(learning.learningId),
      `duplicate learningId: ${learning.learningId}`,
    );

    invariant(
      !fingerprints.has(learning.fingerprint),
      `duplicate learning fingerprint: ${learning.learningId}`,
    );

    ids.add(learning.learningId);
    fingerprints.add(learning.fingerprint);
  }
}