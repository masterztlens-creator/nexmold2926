import { contentFingerprint } from "../../foundation/hash.js";
import { immutable, invariant } from "../../constitution/invariants.js";
import type { Fingerprint } from "../../domain/primitives.js";
import type {
  IntelligenceConfidence,
  IntelligenceEvidenceRef,
  IntelligenceLearning,
  IntelligenceLearningStatus,
  IntelligenceLearningType,
  IntelligenceLineageRef,
} from "./types.js";
import { normalizeText } from "../shared.js";

export interface CreateIntelligenceLearningInput {
  readonly learningId: string;
  readonly type: IntelligenceLearningType;
  readonly status: IntelligenceLearningStatus;
  readonly statement: string;
  readonly sourceSignalIds?: readonly string[];
  readonly sourceObservationIds?: readonly string[];
  readonly sourceExperimentIds?: readonly string[];
  readonly sourceOutcomeIds?: readonly string[];
  readonly supportingMetricIds?: readonly string[];
  readonly confidence: IntelligenceConfidence;
  readonly relevance: number;
  readonly decayRate: number;
  readonly createdAt?: string;
  readonly lastValidatedAt?: string;
  readonly expiresAt?: string;
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly lineage?: readonly IntelligenceLineageRef[];
}

export interface LearningFilter {
  readonly type?: IntelligenceLearningType;
  readonly status?: IntelligenceLearningStatus;
  readonly minRelevance?: number;
  readonly maxRelevance?: number;
  readonly minDecayRate?: number;
  readonly maxDecayRate?: number;
  readonly minConfidence?: IntelligenceConfidence;
  readonly maxConfidence?: IntelligenceConfidence;
  readonly signalId?: string;
  readonly observationId?: string;
  readonly experimentId?: string;
  readonly outcomeId?: string;
  readonly metricId?: string;
}

export interface LearningSummary {
  readonly total: number;
  readonly candidate: number;
  readonly validated: number;
  readonly promoted: number;
  readonly watch: number;
  readonly rejected: number;
  readonly retired: number;
  readonly averageRelevance: number;
  readonly averageDecayRate: number;
  readonly confidenceDistribution: Readonly<
    Record<IntelligenceConfidence, number>
  >;
  readonly types: readonly IntelligenceLearningType[];
  readonly statuses: readonly IntelligenceLearningStatus[];
}

const CONFIDENCE_RANK: Readonly<Record<IntelligenceConfidence, number>> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const LEARNING_TYPES: readonly IntelligenceLearningType[] = [
  "PATTERN",
  "RULE",
  "HEURISTIC",
  "CAUSAL_HINT",
  "FAILURE",
  "SUCCESS",
  "PREFERENCE",
  "ANOMALY",
  "STRATEGY",
];

const LEARNING_STATUSES: readonly IntelligenceLearningStatus[] = [
  "CANDIDATE",
  "VALIDATED",
  "PROMOTED",
  "WATCH",
  "REJECTED",
  "RETIRED",
];

const CONFIDENCES: readonly IntelligenceConfidence[] = [
  "VERY_LOW",
  "LOW",
  "MEDIUM",
  "HIGH",
  "VERY_HIGH",
];

function requireNonEmpty(value: string, field: string): string {
  invariant(
    typeof value === "string",
    "INTELLIGENCE_LEARNING_INVALID_FIELD",
    `${field} must be a string`,
  );

  const normalized = normalizeText(value);

  invariant(
    normalized.length > 0,
    "INTELLIGENCE_LEARNING_EMPTY_FIELD",
    `${field} must not be empty`,
  );

  return value.trim();
}

function normalizeIdList(
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

  return result.sort((left, right) => left.localeCompare(right));
}

function normalizeConfidence(
  value: IntelligenceConfidence,
): IntelligenceConfidence {
  invariant(
    CONFIDENCES.includes(value),
    "INTELLIGENCE_LEARNING_INVALID_CONFIDENCE",
    `Invalid learning confidence: ${String(value)}`,
  );

  return value;
}

function normalizeLearningType(
  value: IntelligenceLearningType,
): IntelligenceLearningType {
  invariant(
    LEARNING_TYPES.includes(value),
    "INTELLIGENCE_LEARNING_INVALID_TYPE",
    `Invalid learning type: ${String(value)}`,
  );

  return value;
}

function normalizeLearningStatus(
  value: IntelligenceLearningStatus,
): IntelligenceLearningStatus {
  invariant(
    LEARNING_STATUSES.includes(value),
    "INTELLIGENCE_LEARNING_INVALID_STATUS",
    `Invalid learning status: ${String(value)}`,
  );

  return value;
}

function normalizeRatio(value: number, field: string): number {
  invariant(
    typeof value === "number" && Number.isFinite(value),
    "INTELLIGENCE_LEARNING_INVALID_NUMBER",
    `${field} must be a finite number`,
  );

  invariant(
    value >= 0 && value <= 1,
    "INTELLIGENCE_LEARNING_INVALID_RANGE",
    `${field} must be between 0 and 1`,
  );

  return Math.round(value * 1_000_000) / 1_000_000;
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
    "INTELLIGENCE_LEARNING_INVALID_TIMESTAMP",
    `${field} must be a valid timestamp`,
  );

  return timestamp.toISOString();
}

function normalizeRequiredTimestamp(
  value: string | undefined,
): string {
  if (value === undefined) {
    return new Date(0).toISOString();
  }

  const normalized = normalizeTimestamp(value, "createdAt");

  invariant(
    normalized !== undefined,
    "INTELLIGENCE_LEARNING_INVALID_TIMESTAMP",
    "createdAt must be defined",
  );

  return normalized;
}

function normalizeEvidenceRefs(
  refs: readonly IntelligenceEvidenceRef[] | undefined,
): readonly IntelligenceEvidenceRef[] {
  if (!refs || refs.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: IntelligenceEvidenceRef[] = [];

  for (const ref of refs) {
    invariant(
      typeof ref === "object" && ref !== null,
      "INTELLIGENCE_LEARNING_INVALID_EVIDENCE",
      "Every evidence reference must be an object",
    );

    const evidenceId = requireNonEmpty(
      ref.evidenceId,
      "evidenceRef.evidenceId",
    );

    const normalized: IntelligenceEvidenceRef = {
      evidenceId,
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
            confidence: normalizeConfidence(ref.confidence),
          }
        : {}),
    };

    const key = JSON.stringify(serializeEvidenceRef(normalized));

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result.sort((left, right) =>
    left.evidenceId.localeCompare(right.evidenceId),
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
  lineage: readonly IntelligenceLineageRef[] | undefined,
): readonly IntelligenceLineageRef[] {
  if (!lineage || lineage.length === 0) {
    return [];
  }

  const seen = new Set<string>();
  const result: IntelligenceLineageRef[] = [];

  for (const ref of lineage) {
    invariant(
      typeof ref === "object" && ref !== null,
      "INTELLIGENCE_LEARNING_INVALID_LINEAGE",
      "Every lineage reference must be an object",
    );

    invariant(
      typeof ref.aggregateType === "string" &&
        ref.aggregateType.length > 0,
      "INTELLIGENCE_LEARNING_INVALID_LINEAGE",
      "lineage.aggregateType must not be empty",
    );

    const aggregateId = requireNonEmpty(
      ref.aggregateId,
      "lineage.aggregateId",
    );

    invariant(
      Number.isInteger(ref.version) && ref.version >= 1,
      "INTELLIGENCE_LEARNING_INVALID_LINEAGE",
      "lineage.version must be a positive integer",
    );

    invariant(
      typeof ref.fingerprint === "string" &&
        ref.fingerprint.length > 0,
      "INTELLIGENCE_LEARNING_INVALID_LINEAGE",
      "lineage.fingerprint must not be empty",
    );

    const normalized: IntelligenceLineageRef = {
      aggregateType: ref.aggregateType,
      aggregateId,
      version: ref.version,
      fingerprint: ref.fingerprint,
    };

    const key = JSON.stringify(serializeLineageRef(normalized));

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(normalized);
  }

  return result.sort((left, right) => {
    const aggregateType = left.aggregateType.localeCompare(
      right.aggregateType,
    );

    if (aggregateType !== 0) {
      return aggregateType;
    }

    const aggregateId = left.aggregateId.localeCompare(right.aggregateId);

    if (aggregateId !== 0) {
      return aggregateId;
    }

    return left.version - right.version;
  });
}

function serializeLearningForFingerprint(
  learning: IntelligenceLearning,
): Record<string, unknown> {
  return {
    learningId: learning.learningId,
    type: learning.type,
    status: learning.status,
    statement: learning.statement,
    normalizedStatement: learning.normalizedStatement,
    sourceSignalIds: [...learning.sourceSignalIds],
    sourceObservationIds: [...learning.sourceObservationIds],
    sourceExperimentIds: [...learning.sourceExperimentIds],
    sourceOutcomeIds: [...learning.sourceOutcomeIds],
    supportingMetricIds: [...learning.supportingMetricIds],
    confidence: learning.confidence,
    relevance: learning.relevance,
    decayRate: learning.decayRate,
    createdAt: learning.createdAt,
    lastValidatedAt: learning.lastValidatedAt ?? null,
    expiresAt: learning.expiresAt ?? null,
    evidenceRefs: learning.evidenceRefs.map(serializeEvidenceRef),
    lineage: learning.lineage.map(serializeLineageRef),
  };
}

function computeLearningFingerprint(
  learning: IntelligenceLearning,
): Fingerprint {
  return contentFingerprint(serializeLearningForFingerprint(learning));
}

function assertTimestampOrder(
  createdAt: string,
  lastValidatedAt: string | undefined,
  expiresAt: string | undefined,
): void {
  const created = Date.parse(createdAt);

  if (lastValidatedAt !== undefined) {
    invariant(
      Date.parse(lastValidatedAt) >= created,
      "INTELLIGENCE_LEARNING_INVALID_TIME_ORDER",
      "lastValidatedAt must not precede createdAt",
    );
  }

  if (expiresAt !== undefined) {
    invariant(
      Date.parse(expiresAt) >= created,
      "INTELLIGENCE_LEARNING_INVALID_TIME_ORDER",
      "expiresAt must not precede createdAt",
    );
  }

  if (
    lastValidatedAt !== undefined &&
    expiresAt !== undefined
  ) {
    invariant(
      Date.parse(expiresAt) >= Date.parse(lastValidatedAt),
      "INTELLIGENCE_LEARNING_INVALID_TIME_ORDER",
      "expiresAt must not precede lastValidatedAt",
    );
  }
}

export function createIntelligenceLearning(
  input: CreateIntelligenceLearningInput,
): IntelligenceLearning {
  const learningId = requireNonEmpty(
    input.learningId,
    "learningId",
  );

  const type = normalizeLearningType(input.type);
  const status = normalizeLearningStatus(input.status);

  const statement = requireNonEmpty(
    input.statement,
    "statement",
  );

  const normalizedStatement = normalizeText(statement);

  invariant(
    normalizedStatement.length > 0,
    "INTELLIGENCE_LEARNING_EMPTY_STATEMENT",
    "normalizedStatement must not be empty",
  );

  const sourceSignalIds = normalizeIdList(
    input.sourceSignalIds,
    "sourceSignalId",
  );

  const sourceObservationIds = normalizeIdList(
    input.sourceObservationIds,
    "sourceObservationId",
  );

  const sourceExperimentIds = normalizeIdList(
    input.sourceExperimentIds,
    "sourceExperimentId",
  );

  const sourceOutcomeIds = normalizeIdList(
    input.sourceOutcomeIds,
    "sourceOutcomeId",
  );

  const supportingMetricIds = normalizeIdList(
    input.supportingMetricIds,
    "supportingMetricId",
  );

  const confidence = normalizeConfidence(input.confidence);
  const relevance = normalizeRatio(
    input.relevance,
    "relevance",
  );
  const decayRate = normalizeRatio(
    input.decayRate,
    "decayRate",
  );

  const createdAt = normalizeRequiredTimestamp(
    input.createdAt,
  );

  const lastValidatedAt = normalizeTimestamp(
    input.lastValidatedAt,
    "lastValidatedAt",
  );

  const expiresAt = normalizeTimestamp(
    input.expiresAt,
    "expiresAt",
  );

  assertTimestampOrder(
    createdAt,
    lastValidatedAt,
    expiresAt,
  );

  const evidenceRefs = normalizeEvidenceRefs(
    input.evidenceRefs,
  );

  const lineage = normalizeLineage(input.lineage);

  invariant(
    sourceSignalIds.length +
      sourceObservationIds.length +
      sourceExperimentIds.length +
      sourceOutcomeIds.length +
      supportingMetricIds.length +
      evidenceRefs.length +
      lineage.length >
      0,
    "INTELLIGENCE_LEARNING_NO_PROVENANCE",
    `Learning ${learningId} must have at least one source, evidence reference, or lineage reference`,
  );

  const provisional = {
    learningId,
    type,
    status,
    statement,
    normalizedStatement,
    sourceSignalIds,
    sourceObservationIds,
    sourceExperimentIds,
    sourceOutcomeIds,
    supportingMetricIds,
    confidence,
    relevance,
    decayRate,
    createdAt,
    ...(lastValidatedAt !== undefined
      ? { lastValidatedAt }
      : {}),
    ...(expiresAt !== undefined
      ? { expiresAt }
      : {}),
    evidenceRefs,
    lineage,
  } satisfies Omit<IntelligenceLearning, "fingerprint">;

  const fingerprint = contentFingerprint(provisional);

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
): Fingerprint {
  return computeLearningFingerprint(learning);
}

export function assertLearningIntegrity(
  learning: IntelligenceLearning,
): void {
  invariant(
    typeof learning === "object" && learning !== null,
    "INTELLIGENCE_LEARNING_INVALID_OBJECT",
    "learning must be an object",
  );

  invariant(
    typeof learning.learningId === "string" &&
      normalizeText(learning.learningId).length > 0,
    "INTELLIGENCE_LEARNING_INVALID_ID",
    "learningId must not be empty",
  );

  invariant(
    LEARNING_TYPES.includes(learning.type),
    "INTELLIGENCE_LEARNING_INVALID_TYPE",
    `Invalid learning type: ${String(learning.type)}`,
  );

  invariant(
    LEARNING_STATUSES.includes(learning.status),
    "INTELLIGENCE_LEARNING_INVALID_STATUS",
    `Invalid learning status: ${String(learning.status)}`,
  );

  invariant(
    typeof learning.statement === "string" &&
      normalizeText(learning.statement).length > 0,
    "INTELLIGENCE_LEARNING_INVALID_STATEMENT",
    `Learning ${learning.learningId} has an empty statement`,
  );

  invariant(
    learning.normalizedStatement ===
      normalizeText(learning.statement),
    "INTELLIGENCE_LEARNING_NORMALIZATION_MISMATCH",
    `Learning ${learning.learningId} normalizedStatement mismatch`,
  );

  invariant(
    CONFIDENCES.includes(learning.confidence),
    "INTELLIGENCE_LEARNING_INVALID_CONFIDENCE",
    `Learning ${learning.learningId} has invalid confidence`,
  );

  invariant(
    Number.isFinite(learning.relevance) &&
      learning.relevance >= 0 &&
      learning.relevance <= 1,
    "INTELLIGENCE_LEARNING_INVALID_RELEVANCE",
    `Learning ${learning.learningId} relevance must be between 0 and 1`,
  );

  invariant(
    Number.isFinite(learning.decayRate) &&
      learning.decayRate >= 0 &&
      learning.decayRate <= 1,
    "INTELLIGENCE_LEARNING_INVALID_DECAY",
    `Learning ${learning.learningId} decayRate must be between 0 and 1`,
  );

  invariant(
    Number.isFinite(Date.parse(learning.createdAt)),
    "INTELLIGENCE_LEARNING_INVALID_TIMESTAMP",
    `Learning ${learning.learningId} createdAt is invalid`,
  );

  assertTimestampOrder(
    learning.createdAt,
    learning.lastValidatedAt,
    learning.expiresAt,
  );

  const expectedFingerprint = learningFingerprint(learning);

  invariant(
    learning.fingerprint === expectedFingerprint,
    "INTELLIGENCE_LEARNING_FINGERPRINT_MISMATCH",
    `Learning fingerprint mismatch: ${learning.learningId}`,
  );
}

export function deduplicateLearnings(
  learnings: readonly IntelligenceLearning[],
): readonly IntelligenceLearning[] {
  const byKey = new Map<string, IntelligenceLearning>();

  for (const learning of learnings) {
    assertLearningIntegrity(learning);

    const key = learning.normalizedStatement;
    const existing = byKey.get(key);

    if (!existing) {
      byKey.set(key, learning);
      continue;
    }

    const confidenceDelta =
      CONFIDENCE_RANK[learning.confidence] -
      CONFIDENCE_RANK[existing.confidence];

    if (confidenceDelta > 0) {
      byKey.set(key, learning);
      continue;
    }

    if (
      confidenceDelta === 0 &&
      learning.relevance > existing.relevance
    ) {
      byKey.set(key, learning);
      continue;
    }

    if (
      confidenceDelta === 0 &&
      learning.relevance === existing.relevance &&
      learning.createdAt < existing.createdAt
    ) {
      byKey.set(key, learning);
    }
  }

  return [...byKey.values()].sort((left, right) => {
    const statementOrder =
      left.normalizedStatement.localeCompare(
        right.normalizedStatement,
      );

    if (statementOrder !== 0) {
      return statementOrder;
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
      filter.type !== undefined &&
      learning.type !== filter.type
    ) {
      return false;
    }

    if (
      filter.status !== undefined &&
      learning.status !== filter.status
    ) {
      return false;
    }

    if (
      filter.minRelevance !== undefined &&
      learning.relevance < filter.minRelevance
    ) {
      return false;
    }

    if (
      filter.maxRelevance !== undefined &&
      learning.relevance > filter.maxRelevance
    ) {
      return false;
    }

    if (
      filter.minDecayRate !== undefined &&
      learning.decayRate < filter.minDecayRate
    ) {
      return false;
    }

    if (
      filter.maxDecayRate !== undefined &&
      learning.decayRate > filter.maxDecayRate
    ) {
      return false;
    }

    if (
      filter.minConfidence !== undefined &&
      CONFIDENCE_RANK[learning.confidence] <
        CONFIDENCE_RANK[filter.minConfidence]
    ) {
      return false;
    }

    if (
      filter.maxConfidence !== undefined &&
      CONFIDENCE_RANK[learning.confidence] >
        CONFIDENCE_RANK[filter.maxConfidence]
    ) {
      return false;
    }

    if (
      filter.signalId !== undefined &&
      !learning.sourceSignalIds.includes(filter.signalId)
    ) {
      return false;
    }

    if (
      filter.observationId !== undefined &&
      !learning.sourceObservationIds.includes(
        filter.observationId,
      )
    ) {
      return false;
    }

    if (
      filter.experimentId !== undefined &&
      !learning.sourceExperimentIds.includes(
        filter.experimentId,
      )
    ) {
      return false;
    }

    if (
      filter.outcomeId !== undefined &&
      !learning.sourceOutcomeIds.includes(
        filter.outcomeId,
      )
    ) {
      return false;
    }

    if (
      filter.metricId !== undefined &&
      !learning.supportingMetricIds.includes(
        filter.metricId,
      )
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

  let relevanceTotal = 0;
  let decayRateTotal = 0;

  let candidate = 0;
  let validated = 0;
  let promoted = 0;
  let watch = 0;
  let rejected = 0;
  let retired = 0;

  for (const learning of normalized) {
    confidenceDistribution[learning.confidence] += 1;

    relevanceTotal += learning.relevance;
    decayRateTotal += learning.decayRate;

    switch (learning.status) {
      case "CANDIDATE":
        candidate += 1;
        break;
      case "VALIDATED":
        validated += 1;
        break;
      case "PROMOTED":
        promoted += 1;
        break;
      case "WATCH":
        watch += 1;
        break;
      case "REJECTED":
        rejected += 1;
        break;
      case "RETIRED":
        retired += 1;
        break;
    }
  }

  const total = normalized.length;

  return {
    total,
    candidate,
    validated,
    promoted,
    watch,
    rejected,
    retired,
    averageRelevance:
      total === 0
        ? 0
        : Math.round(
            (relevanceTotal / total) * 1_000_000,
          ) / 1_000_000,
    averageDecayRate:
      total === 0
        ? 0
        : Math.round(
            (decayRateTotal / total) * 1_000_000,
          ) / 1_000_000,
    confidenceDistribution,
    types: [
      ...new Set(
        normalized.map((learning) => learning.type),
      ),
    ].sort((left, right) => left.localeCompare(right)),
    statuses: [
      ...new Set(
        normalized.map((learning) => learning.status),
      ),
    ].sort((left, right) => left.localeCompare(right)),
  };
}

export function rankLearnings(
  learnings: readonly IntelligenceLearning[],
): readonly IntelligenceLearning[] {
  return [...deduplicateLearnings(learnings)].sort(
    (left, right) => {
      const confidence =
        CONFIDENCE_RANK[right.confidence] -
        CONFIDENCE_RANK[left.confidence];

      if (confidence !== 0) {
        return confidence;
      }

      if (right.relevance !== left.relevance) {
        return right.relevance - left.relevance;
      }

      if (left.decayRate !== right.decayRate) {
        return left.decayRate - right.decayRate;
      }

      if (left.createdAt !== right.createdAt) {
        return left.createdAt.localeCompare(right.createdAt);
      }

      return left.learningId.localeCompare(right.learningId);
    },
  );
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
      "INTELLIGENCE_LEARNING_DUPLICATE_ID",
      `Duplicate learningId: ${learning.learningId}`,
    );

    invariant(
      !fingerprints.has(learning.fingerprint),
      "INTELLIGENCE_LEARNING_DUPLICATE_FINGERPRINT",
      `Duplicate learning fingerprint: ${learning.learningId}`,
    );

    ids.add(learning.learningId);
    fingerprints.add(learning.fingerprint);
  }
}