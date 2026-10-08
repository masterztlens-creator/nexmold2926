import { contentFingerprint } from "../../foundation/hash.js";
import { immutable } from "../../constitution/invariants.js";
import type { Fingerprint } from "../../domain/primitives.js";
import type {
  IntelligenceConfidence,
  IntelligenceEvidenceRef,
  IntelligenceExperiment,
  IntelligenceExperimentStatus,
  IntelligenceExperimentVariant,
  IntelligenceLineageRef,
} from "./types.js";

export interface CreateIntelligenceExperimentInput {
  readonly experimentId?: string;
  readonly name: string;
  readonly hypothesis: string;
  readonly status?: IntelligenceExperimentStatus;
  readonly subject: string;
  readonly metricIds: readonly string[];
  readonly signalIds: readonly string[];
  readonly variants: readonly IntelligenceExperimentVariant[];
  readonly controlVariantId?: string;
  readonly successCriteria: readonly string[];
  readonly constraints: readonly string[];
  readonly startAt?: string;
  readonly endAt?: string;
  readonly observations?: readonly string[];
  readonly outcomeIds?: readonly string[];
  readonly confidence: IntelligenceConfidence;
  readonly lineage?: readonly IntelligenceLineageRef[];
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
}

export interface ExperimentFilter {
  readonly statuses?: readonly IntelligenceExperimentStatus[];
  readonly subjects?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly minConfidence?: IntelligenceConfidence;
}

export interface ExperimentSummary {
  readonly count: number;
  readonly running: number;
  readonly completed: number;
  readonly stopped: number;
  readonly draft: number;
  readonly fingerprint: Fingerprint;
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

function requiredText(
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

function normalizedText(
  value: string,
): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function uniqueStrings(
  values: readonly string[],
): readonly string[] {
  return Object.freeze(
    [
      ...new Set(
        values
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ].sort(),
  );
}

function normalizeTimestamp(
  value: string | undefined,
  field: string,
): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `Experiment ${field} must not be empty.`,
    );
  }

  const time = Date.parse(normalized);

  if (!Number.isFinite(time)) {
    throw new Error(
      `Invalid experiment ${field} timestamp: ${value}`,
    );
  }

  return new Date(time).toISOString();
}

function serializeLineage(
  refs: readonly IntelligenceLineageRef[],
): readonly Record<string, unknown>[] {
  return refs.map((ref) => ({
    aggregateType: ref.aggregateType,
    aggregateId: ref.aggregateId,
    version: ref.version,
    fingerprint: String(ref.fingerprint),
  }));
}

function serializeEvidence(
  refs: readonly IntelligenceEvidenceRef[],
): readonly Record<string, unknown>[] {
  return refs.map((ref) => ({
    evidenceId: ref.evidenceId,
    sourceId:
      ref.sourceId === undefined
        ? null
        : ref.sourceId,
    snapshotId:
      ref.snapshotId === undefined
        ? null
        : ref.snapshotId,
    aggregateType:
      ref.aggregateType === undefined
        ? null
        : ref.aggregateType,
    fingerprint:
      ref.fingerprint === undefined
        ? null
        : String(ref.fingerprint),
    locator:
      ref.locator === undefined
        ? null
        : ref.locator,
    excerpt:
      ref.excerpt === undefined
        ? null
        : ref.excerpt,
    confidence:
      ref.confidence === undefined
        ? null
        : ref.confidence,
  }));
}

function serializeVariant(
  variant: IntelligenceExperimentVariant,
): Record<string, unknown> {
  return {
    variantId: variant.variantId,
    name: variant.name,
    description: variant.description,
    parameters: variant.parameters,
    fingerprint: String(variant.fingerprint),
  };
}

function fingerprintPayload(
  experiment: IntelligenceExperiment,
): Record<string, unknown> {
  return {
    experimentId: experiment.experimentId,
    name: experiment.name,
    hypothesis: experiment.hypothesis,
    status: experiment.status,
    subject: experiment.subject,
    metricIds: [...experiment.metricIds],
    signalIds: [...experiment.signalIds],
    variants: experiment.variants.map(
      serializeVariant,
    ),
    controlVariantId:
      experiment.controlVariantId === undefined
        ? null
        : experiment.controlVariantId,
    successCriteria: [
      ...experiment.successCriteria,
    ],
    constraints: [
      ...experiment.constraints,
    ],
    startAt:
      experiment.startAt === undefined
        ? null
        : experiment.startAt,
    endAt:
      experiment.endAt === undefined
        ? null
        : experiment.endAt,
    observations: [
      ...experiment.observations,
    ],
    outcomeIds: [
      ...experiment.outcomeIds,
    ],
    confidence: experiment.confidence,
    lineage: serializeLineage(
      experiment.lineage,
    ),
    evidenceRefs: serializeEvidence(
      experiment.evidenceRefs,
    ),
  };
}

function variantFingerprint(
  variant: Omit<
    IntelligenceExperimentVariant,
    "fingerprint"
  >,
): Fingerprint {
  return contentFingerprint({
    variantId: variant.variantId,
    name: variant.name,
    description: variant.description,
    parameters: variant.parameters,
  });
}

function normalizeVariant(
  variant: IntelligenceExperimentVariant,
): IntelligenceExperimentVariant {
  const variantId = requiredText(
    variant.variantId,
    "variantId",
  );

  const name = requiredText(
    variant.name,
    "variant name",
  );

  const description = requiredText(
    variant.description,
    "variant description",
  );

  const normalized = {
    variantId,
    name,
    description,
    parameters: variant.parameters,
  };

  const fingerprint =
    variant.fingerprint ||
    variantFingerprint(normalized);

  return immutable({
    ...normalized,
    fingerprint,
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

  for (const variant of normalized) {
    if (ids.has(variant.variantId)) {
      throw new Error(
        `Duplicate experiment variant ID: ${variant.variantId}`,
      );
    }

    ids.add(variant.variantId);
  }

  return Object.freeze(normalized);
}

function confidenceAtLeast(
  actual: IntelligenceConfidence,
  minimum: IntelligenceConfidence,
): boolean {
  return (
    CONFIDENCE_RANK[actual] >=
    CONFIDENCE_RANK[minimum]
  );
}

export function createIntelligenceExperiment(
  input: CreateIntelligenceExperimentInput,
): IntelligenceExperiment {
  const name = requiredText(
    input.name,
    "name",
  );

  const hypothesis = requiredText(
    input.hypothesis,
    "hypothesis",
  );

  const subject = requiredText(
    input.subject,
    "subject",
  );

  const successCriteria = Object.freeze(
    input.successCriteria.map(
      (value) =>
        requiredText(
          value,
          "successCriteria",
        ),
    ),
  );

  const constraints = Object.freeze(
    input.constraints.map(
      (value) =>
        requiredText(
          value,
          "constraints",
        ),
    ),
  );

  if (successCriteria.length === 0) {
    throw new Error(
      "Experiment must contain at least one success criterion.",
    );
  }

  const variants = normalizeVariants(
    input.variants,
  );

  const controlVariantId =
    input.controlVariantId?.trim() ||
    undefined;

  if (
    controlVariantId &&
    !variants.some(
      (variant) =>
        variant.variantId ===
        controlVariantId,
    )
  ) {
    throw new Error(
      `Unknown experiment control variant: ${controlVariantId}`,
    );
  }

  const startAt = normalizeTimestamp(
    input.startAt,
    "startAt",
  );

  const endAt = normalizeTimestamp(
    input.endAt,
    "endAt",
  );

  if (
    startAt &&
    endAt &&
    startAt > endAt
  ) {
    throw new Error(
      "Experiment startAt must not be later than endAt.",
    );
  }

  const observations = uniqueStrings(
    input.observations ?? [],
  );

  const outcomeIds = uniqueStrings(
    input.outcomeIds ?? [],
  );

  const metricIds = uniqueStrings(
    input.metricIds,
  );

  const signalIds = uniqueStrings(
    input.signalIds,
  );

  const lineage = Object.freeze([
    ...(input.lineage ?? []),
  ]);

  const evidenceRefs = Object.freeze([
    ...(input.evidenceRefs ?? []),
  ]);

  const status =
    input.status ?? "DRAFT";

  const experimentId =
    input.experimentId?.trim() ||
    `experiment:v8:${String(
      contentFingerprint({
        name,
        hypothesis,
        subject,
        metricIds,
        signalIds,
        variants:
          variants.map(
            serializeVariant,
          ),
        successCriteria,
        constraints,
      }),
    )}`;

  const base = {
    experimentId,
    name,
    hypothesis,
    status,
    subject,
    metricIds,
    signalIds,
    variants,
    ...(controlVariantId
      ? { controlVariantId }
      : {}),
    successCriteria,
    constraints,
    ...(startAt
      ? { startAt }
      : {}),
    ...(endAt
      ? { endAt }
      : {}),
    observations,
    outcomeIds,
    confidence:
      input.confidence,
    lineage,
    evidenceRefs,
  } satisfies Omit<
    IntelligenceExperiment,
    "fingerprint"
  >;

  return immutable({
    ...base,
    fingerprint:
      contentFingerprint(
        fingerprintPayload({
          ...base,
          fingerprint:
            "" as Fingerprint,
        }),
      ),
  });
}

export function experimentFingerprint(
  experiment: IntelligenceExperiment,
): Fingerprint {
  return contentFingerprint(
    fingerprintPayload(
      experiment,
    ),
  );
}

export function assertExperimentIntegrity(
  experiment: IntelligenceExperiment,
): void {
  requiredText(
    experiment.experimentId,
    "experimentId",
  );

  requiredText(
    experiment.name,
    "name",
  );

  requiredText(
    experiment.hypothesis,
    "hypothesis",
  );

  requiredText(
    experiment.subject,
    "subject",
  );

  if (
    experiment.successCriteria.length ===
    0
  ) {
    throw new Error(
      `Experiment ${experiment.experimentId} has no success criteria.`,
    );
  }

  normalizeVariants(
    experiment.variants,
  );

  if (
    experiment.controlVariantId &&
    !experiment.variants.some(
      (variant) =>
        variant.variantId ===
        experiment.controlVariantId,
    )
  ) {
    throw new Error(
      `Experiment ${experiment.experimentId} has an invalid controlVariantId.`,
    );
  }

  if (
    experiment.startAt &&
    experiment.endAt &&
    experiment.startAt >
      experiment.endAt
  ) {
    throw new Error(
      `Experiment ${experiment.experimentId} has an invalid time range.`,
    );
  }

  const calculated =
    experimentFingerprint(
      experiment,
    );

  if (
    calculated !==
    experiment.fingerprint
  ) {
    throw new Error(
      `Experiment fingerprint mismatch for ${experiment.experimentId}.`,
    );
  }
}

export function deduplicateExperiments(
  experiments: readonly IntelligenceExperiment[],
): readonly IntelligenceExperiment[] {
  const byFingerprint =
    new Map<
      string,
      IntelligenceExperiment
    >();

  for (const experiment of experiments) {
    assertExperimentIntegrity(
      experiment,
    );

    const key = String(
      experiment.fingerprint,
    );

    if (!byFingerprint.has(key)) {
      byFingerprint.set(
        key,
        experiment,
      );
    }
  }

  return Object.freeze(
    [...byFingerprint.values()].sort(
      (left, right) => {
        const confidenceDelta =
          CONFIDENCE_RANK[
            right.confidence
          ] -
          CONFIDENCE_RANK[
            left.confidence
          ];

        if (confidenceDelta !== 0) {
          return confidenceDelta;
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
  const statuses = filter.statuses
    ? new Set(filter.statuses)
    : undefined;

  const subjects = filter.subjects
    ? new Set(
        filter.subjects.map(
          normalizedText,
        ),
      )
    : undefined;

  const metricIds =
    filter.metricIds
      ? new Set(filter.metricIds)
      : undefined;

  const signalIds =
    filter.signalIds
      ? new Set(filter.signalIds)
      : undefined;

  return Object.freeze(
    experiments.filter(
      (experiment) => {
        if (
          statuses &&
          !statuses.has(
            experiment.status,
          )
        ) {
          return false;
        }

        if (
          subjects &&
          !subjects.has(
            normalizedText(
              experiment.subject,
            ),
          )
        ) {
          return false;
        }

        if (
          metricIds &&
          !experiment.metricIds.some(
            (id) =>
              metricIds.has(id),
          )
        ) {
          return false;
        }

        if (
          signalIds &&
          !experiment.signalIds.some(
            (id) =>
              signalIds.has(id),
          )
        ) {
          return false;
        }

        if (
          filter.minConfidence !==
            undefined &&
          !confidenceAtLeast(
            experiment.confidence,
            filter.minConfidence,
          )
        ) {
          return false;
        }

        return true;
      },
    ),
  );
}

export function summarizeExperiments(
  experiments: readonly IntelligenceExperiment[],
): ExperimentSummary {
  const normalized =
    deduplicateExperiments(
      experiments,
    );

  const running =
    normalized.filter(
      (experiment) =>
        experiment.status ===
        "RUNNING",
    ).length;

  const completed =
    normalized.filter(
      (experiment) =>
        experiment.status ===
        "COMPLETED",
    ).length;

  const stopped =
    normalized.filter(
      (experiment) =>
        experiment.status ===
        "STOPPED",
    ).length;

  const draft =
    normalized.filter(
      (experiment) =>
        experiment.status ===
        "DRAFT",
    ).length;

  return immutable({
    count: normalized.length,
    running,
    completed,
    stopped,
    draft,
    fingerprint:
      contentFingerprint({
        count: normalized.length,
        running,
        completed,
        stopped,
        draft,
        experimentIds:
          normalized.map(
            (experiment) =>
              experiment.experimentId,
          ),
      }),
  });
}

export function rankExperiments(
  experiments: readonly IntelligenceExperiment[],
): readonly IntelligenceExperiment[] {
  return Object.freeze(
    [
      ...deduplicateExperiments(
        experiments,
      ),
    ].sort((left, right) => {
      const confidenceDelta =
        CONFIDENCE_RANK[
          right.confidence
        ] -
        CONFIDENCE_RANK[
          left.confidence
        ];

      if (confidenceDelta !== 0) {
        return confidenceDelta;
      }

      const metricDelta =
        right.metricIds.length -
        left.metricIds.length;

      if (metricDelta !== 0) {
        return metricDelta;
      }

      const signalDelta =
        right.signalIds.length -
        left.signalIds.length;

      if (signalDelta !== 0) {
        return signalDelta;
      }

      return left.experimentId.localeCompare(
        right.experimentId,
      );
    }),
  );
}

export function assertExperimentCollection(
  experiments: readonly IntelligenceExperiment[],
): void {
  const ids = new Set<string>();
  const fingerprints =
    new Set<string>();

  for (const experiment of experiments) {
    assertExperimentIntegrity(
      experiment,
    );

    if (
      ids.has(
        experiment.experimentId,
      )
    ) {
      throw new Error(
        `Duplicate intelligence experiment ID: ${experiment.experimentId}`,
      );
    }

    const fingerprint = String(
      experiment.fingerprint,
    );

    if (
      fingerprints.has(
        fingerprint,
      )
    ) {
      throw new Error(
        `Duplicate intelligence experiment fingerprint: ${fingerprint}`,
      );
    }

    ids.add(
      experiment.experimentId,
    );

    fingerprints.add(
      fingerprint,
    );
  }
}