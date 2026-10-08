import {
  contentFingerprint,
} from "../../foundation/hash.js";
import {
  immutable,
} from "../../constitution/invariants.js";
import type {
  IntelligenceConfidence,
  IntelligenceDecision,
  IntelligenceDecisionType,
  IntelligenceEvidenceRef,
  IntelligenceLineageRef,
  IntelligenceStatus,
} from "./types.js";
import type {
  JsonValue,
} from "../shared.js";

export interface CreateIntelligenceDecisionInput {
  readonly decisionId?: string;
  readonly type: IntelligenceDecisionType;
  readonly subject: string;
  readonly status?: IntelligenceStatus;
  readonly reasons?: readonly string[];
  readonly analysisIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly evidenceRefs?: readonly IntelligenceEvidenceRef[];
  readonly lineage?: readonly IntelligenceLineageRef[];
  readonly confidence?: IntelligenceConfidence;
  readonly expectedOutcome?: string;
  readonly constraints?: readonly string[];
  readonly foundationDecisionId?: string;
  readonly decidedAt: string;
}

export interface DecisionFilter {
  readonly types?: readonly IntelligenceDecisionType[];
  readonly statuses?: readonly IntelligenceStatus[];
  readonly subjects?: readonly string[];
  readonly analysisIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly foundationDecisionIds?: readonly string[];
  readonly confidences?: readonly IntelligenceConfidence[];
}

export interface DecisionSummary {
  readonly count: number;
  readonly approved: number;
  readonly rejected: number;
  readonly active: number;
  readonly blocked: number;
  readonly watch: number;
  readonly retired: number;
  readonly subjects: readonly string[];
  readonly types: readonly IntelligenceDecisionType[];
  readonly statuses: readonly IntelligenceStatus[];
  readonly fingerprint: string;
}

const CONFIDENCE_ORDER: Readonly<
  Record<IntelligenceConfidence, number>
> = {
  VERY_LOW: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  VERY_HIGH: 4,
};

const VALID_STATUSES: readonly IntelligenceStatus[] = [
  "ACTIVE",
  "WATCH",
  "BLOCKED",
  "REJECTED",
  "RETIRED",
];

const VALID_TYPES: readonly IntelligenceDecisionType[] = [
  "APPROVE",
  "REJECT",
  "WATCH",
  "PURSUE",
  "UPDATE",
  "MERGE",
  "SPLIT",
  "RETIRE",
  "EXPERIMENT",
];

function normalizeIdentifier(
  value: string,
  field: string,
): string {
  const normalized = value.trim();

  if (!normalized) {
    throw new Error(
      `Decision ${field} must not be empty.`,
    );
  }

  return normalized;
}

function normalizeRequiredText(
  value: string,
  field: string,
): string {
  return normalizeIdentifier(value, field);
}

function normalizeSubject(
  value: string,
): string {
  return normalizeRequiredText(
    value,
    "subject",
  );
}

function normalizeTimestamp(
  value: string,
): string {
  const normalized = normalizeRequiredText(
    value,
    "decidedAt",
  );

  const parsed = Date.parse(normalized);

  if (!Number.isFinite(parsed)) {
    throw new Error(
      `Invalid decision decidedAt timestamp: ${value}`,
    );
  }

  return new Date(parsed).toISOString();
}

function normalizeStringArray(
  values: readonly string[] | undefined,
  field: string,
): readonly string[] {
  const result = [
    ...new Set(
      (values ?? []).map((value) =>
        normalizeIdentifier(value, field),
      ),
    ),
  ].sort();

  return Object.freeze(result);
}

function normalizeReasons(
  values: readonly string[] | undefined,
): readonly string[] {
  const result = [
    ...new Set(
      (values ?? [])
        .map((value) =>
          normalizeRequiredText(
            value,
            "reason",
          ),
        ),
    ),
  ].sort();

  return Object.freeze(result);
}

function normalizeConstraints(
  values: readonly string[] | undefined,
): readonly string[] {
  const result = [
    ...new Set(
      (values ?? [])
        .map((value) =>
          normalizeRequiredText(
            value,
            "constraint",
          ),
        ),
    ),
  ].sort();

  return Object.freeze(result);
}

function normalizeEvidenceRefs(
  values:
    | readonly IntelligenceEvidenceRef[]
    | undefined,
): readonly IntelligenceEvidenceRef[] {
  const normalized = (values ?? []).map(
    (item) => {
      const evidenceId =
        normalizeIdentifier(
          item.evidenceId,
          "evidenceId",
        );

      return {
        evidenceId,
        sourceId:
          item.sourceId === undefined
            ? undefined
            : normalizeIdentifier(
                item.sourceId,
                "sourceId",
              ),
        snapshotId:
          item.snapshotId === undefined
            ? undefined
            : normalizeIdentifier(
                item.snapshotId,
                "snapshotId",
              ),
        aggregateType:
          item.aggregateType,
        fingerprint:
          item.fingerprint,
        locator:
          item.locator === undefined
            ? undefined
            : normalizeIdentifier(
                item.locator,
                "evidence locator",
              ),
        excerpt:
          item.excerpt === undefined
            ? undefined
            : normalizeRequiredText(
                item.excerpt,
                "evidence excerpt",
              ),
        confidence:
          item.confidence,
      } satisfies IntelligenceEvidenceRef;
    },
  );

  const sorted = [...normalized].sort(
    (left, right) => {
      const evidenceCompare =
        left.evidenceId.localeCompare(
          right.evidenceId,
        );

      if (evidenceCompare !== 0) {
        return evidenceCompare;
      }

      return (
        (left.locator ?? "").localeCompare(
          right.locator ?? "",
        )
      );
    },
  );

  const seen = new Set<string>();
  const result: IntelligenceEvidenceRef[] =
    [];

  for (const item of sorted) {
    const key = contentFingerprint({
      evidenceId: item.evidenceId,
      sourceId: item.sourceId ?? null,
      snapshotId: item.snapshotId ?? null,
      aggregateType:
        item.aggregateType ?? null,
      fingerprint:
        item.fingerprint ?? null,
      locator: item.locator ?? null,
      excerpt: item.excerpt ?? null,
      confidence:
        item.confidence ?? null,
    });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return Object.freeze(result);
}

function normalizeLineage(
  values:
    | readonly IntelligenceLineageRef[]
    | undefined,
): readonly IntelligenceLineageRef[] {
  const normalized = (values ?? []).map(
    (item) => ({
      aggregateType:
        item.aggregateType,
      aggregateId:
        normalizeIdentifier(
          item.aggregateId,
          "lineage aggregateId",
        ),
      version: item.version,
      fingerprint:
        item.fingerprint,
    }),
  );

  for (const item of normalized) {
    if (
      !Number.isInteger(item.version) ||
      item.version < 0
    ) {
      throw new Error(
        `Decision lineage version must be a non-negative integer: ${item.aggregateId}`,
      );
    }
  }

  normalized.sort(
    (left, right) => {
      const typeCompare =
        left.aggregateType.localeCompare(
          right.aggregateType,
        );

      if (typeCompare !== 0) {
        return typeCompare;
      }

      const idCompare =
        left.aggregateId.localeCompare(
          right.aggregateId,
        );

      if (idCompare !== 0) {
        return idCompare;
      }

      return left.version - right.version;
    },
  );

  const seen = new Set<string>();
  const result: IntelligenceLineageRef[] =
    [];

  for (const item of normalized) {
    const key = [
      item.aggregateType,
      item.aggregateId,
      item.version,
      item.fingerprint,
    ].join(":");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return Object.freeze(result);
}

function serializeEvidenceRefs(
  values:
    | readonly IntelligenceEvidenceRef[],
): readonly JsonValue[] {
  return values.map(
    (item): JsonValue => ({
      evidenceId: item.evidenceId,
      sourceId:
        item.sourceId ?? null,
      snapshotId:
        item.snapshotId ?? null,
      aggregateType:
        item.aggregateType ?? null,
      fingerprint:
        item.fingerprint ?? null,
      locator:
        item.locator ?? null,
      excerpt:
        item.excerpt ?? null,
      confidence:
        item.confidence ?? null,
    }),
  );
}

function serializeLineage(
  values:
    | readonly IntelligenceLineageRef[],
): readonly JsonValue[] {
  return values.map(
    (item): JsonValue => ({
      aggregateType:
        item.aggregateType,
      aggregateId:
        item.aggregateId,
      version: item.version,
      fingerprint:
        item.fingerprint,
    }),
  );
}

function serializeDecisionForFingerprint(
  decision: IntelligenceDecision,
): JsonValue {
  return {
    decisionId: decision.decisionId,
    type: decision.type,
    subject: decision.subject,
    status: decision.status,
    reasons: [...decision.reasons],
    analysisIds: [
      ...decision.analysisIds,
    ],
    signalIds: [
      ...decision.signalIds,
    ],
    metricIds: [
      ...decision.metricIds,
    ],
    evidenceRefs:
      serializeEvidenceRefs(
        decision.evidenceRefs,
      ),
    lineage: serializeLineage(
      decision.lineage,
    ),
    confidence: decision.confidence,
    expectedOutcome:
      decision.expectedOutcome ?? null,
    constraints: [
      ...decision.constraints,
    ],
    foundationDecisionId:
      decision.foundationDecisionId ??
      null,
    decidedAt: decision.decidedAt,
  };
}

function normalizeConfidence(
  value:
    | IntelligenceConfidence
    | undefined,
): IntelligenceConfidence {
  return value ?? "MEDIUM";
}

function validateDecisionType(
  value: IntelligenceDecisionType,
): void {
  if (!VALID_TYPES.includes(value)) {
    throw new Error(
      `Unknown intelligence decision type: ${value}`,
    );
  }
}

function validateStatus(
  value: IntelligenceStatus,
): void {
  if (!VALID_STATUSES.includes(value)) {
    throw new Error(
      `Unknown intelligence decision status: ${value}`,
    );
  }
}

export function createIntelligenceDecision(
  input: CreateIntelligenceDecisionInput,
): IntelligenceDecision {
  validateDecisionType(input.type);

  const subject = normalizeSubject(
    input.subject,
  );

  const decidedAt =
    normalizeTimestamp(
      input.decidedAt,
    );

  const reasons =
    normalizeReasons(
      input.reasons,
    );

  const analysisIds =
    normalizeStringArray(
      input.analysisIds,
      "analysisId",
    );

  const signalIds =
    normalizeStringArray(
      input.signalIds,
      "signalId",
    );

  const metricIds =
    normalizeStringArray(
      input.metricIds,
      "metricId",
    );

  const evidenceRefs =
    normalizeEvidenceRefs(
      input.evidenceRefs,
    );

  const lineage =
    normalizeLineage(
      input.lineage,
    );

  const confidence =
    normalizeConfidence(
      input.confidence,
    );

  const expectedOutcome =
    input.expectedOutcome ===
    undefined
      ? undefined
      : normalizeRequiredText(
          input.expectedOutcome,
          "expectedOutcome",
        );

  const constraints =
    normalizeConstraints(
      input.constraints,
    );

  const foundationDecisionId =
    input.foundationDecisionId ===
    undefined
      ? undefined
      : normalizeIdentifier(
          input.foundationDecisionId,
          "foundationDecisionId",
        );

  const status =
    input.status ?? "WATCH";

  validateStatus(status);

  const provisionalId =
    input.decisionId ===
    undefined
      ? contentFingerprint({
          type: input.type,
          subject,
          decidedAt,
          reasons,
          analysisIds,
          signalIds,
          metricIds,
        })
      : normalizeIdentifier(
          input.decisionId,
          "decisionId",
        );

  const decisionId =
    `decision:intelligence:v8:${provisionalId}`;

  const provisional: IntelligenceDecision =
    {
      decisionId,
      type: input.type,
      subject,
      status,
      reasons,
      analysisIds,
      signalIds,
      metricIds,
      evidenceRefs,
      lineage,
      confidence,
      expectedOutcome,
      constraints,
      foundationDecisionId,
      decidedAt,
      fingerprint:
        "" as IntelligenceDecision["fingerprint"],
    };

  const fingerprint =
    contentFingerprint(
      serializeDecisionForFingerprint(
        provisional,
      ),
    );

  const result: IntelligenceDecision =
    {
      ...provisional,
      fingerprint,
    };

  immutable(result);
  assertDecisionIntegrity(result);

  return result;
}

export function decisionFingerprint(
  decision: IntelligenceDecision,
): IntelligenceDecision["fingerprint"] {
  return contentFingerprint(
    serializeDecisionForFingerprint(
      decision,
    ),
  );
}

export function assertDecisionIntegrity(
  decision: IntelligenceDecision,
): void {
  if (
    !decision.decisionId.trim()
  ) {
    throw new Error(
      "Decision decisionId must not be empty.",
    );
  }

  validateDecisionType(
    decision.type,
  );

  validateStatus(
    decision.status,
  );

  if (!decision.subject.trim()) {
    throw new Error(
      `Decision subject must not be empty: ${decision.decisionId}`,
    );
  }

  if (
    !Array.isArray(
      decision.reasons,
    )
  ) {
    throw new Error(
      `Decision reasons must be an array: ${decision.decisionId}`,
    );
  }

  if (
    !Array.isArray(
      decision.analysisIds,
    )
  ) {
    throw new Error(
      `Decision analysisIds must be an array: ${decision.decisionId}`,
    );
  }

  if (
    !Array.isArray(
      decision.signalIds,
    )
  ) {
    throw new Error(
      `Decision signalIds must be an array: ${decision.decisionId}`,
    );
  }

  if (
    !Array.isArray(
      decision.metricIds,
    )
  ) {
    throw new Error(
      `Decision metricIds must be an array: ${decision.decisionId}`,
    );
  }

  if (
    !Array.isArray(
      decision.evidenceRefs,
    )
  ) {
    throw new Error(
      `Decision evidenceRefs must be an array: ${decision.decisionId}`,
    );
  }

  if (
    !Array.isArray(
      decision.lineage,
    )
  ) {
    throw new Error(
      `Decision lineage must be an array: ${decision.decisionId}`,
    );
  }

  if (
    !Number.isInteger(
      CONFIDENCE_ORDER[
        decision.confidence
      ],
    )
  ) {
    throw new Error(
      `Decision confidence is invalid: ${decision.decisionId}`,
    );
  }

  const decidedAt =
    Date.parse(
      decision.decidedAt,
    );

  if (!Number.isFinite(decidedAt)) {
    throw new Error(
      `Decision decidedAt is invalid: ${decision.decisionId}`,
    );
  }

  for (const id of [
    ...decision.analysisIds,
    ...decision.signalIds,
    ...decision.metricIds,
  ]) {
    if (!id.trim()) {
      throw new Error(
        `Decision contains an empty reference: ${decision.decisionId}`,
      );
    }
  }

  const calculated =
    decisionFingerprint(
      decision,
    );

  if (
    calculated !==
    decision.fingerprint
  ) {
    throw new Error(
      `Decision fingerprint mismatch: ${decision.decisionId}`,
    );
  }
}

export function deduplicateDecisions(
  decisions:
    | readonly IntelligenceDecision[],
): readonly IntelligenceDecision[] {
  const byFingerprint =
    new Map<
      string,
      IntelligenceDecision
    >();

  for (const decision of decisions) {
    assertDecisionIntegrity(
      decision,
    );

    if (
      !byFingerprint.has(
        decision.fingerprint,
      )
    ) {
      byFingerprint.set(
        decision.fingerprint,
        decision,
      );
    }
  }

  return Object.freeze(
    [...byFingerprint.values()].sort(
      (left, right) => {
        const confidenceCompare =
          CONFIDENCE_ORDER[
            right.confidence
          ] -
          CONFIDENCE_ORDER[
            left.confidence
          ];

        if (
          confidenceCompare !== 0
        ) {
          return confidenceCompare;
        }

        const timeCompare =
          right.decidedAt.localeCompare(
            left.decidedAt,
          );

        if (timeCompare !== 0) {
          return timeCompare;
        }

        return left.decisionId.localeCompare(
          right.decisionId,
        );
      },
    ),
  );
}

export function filterDecisions(
  decisions:
    | readonly IntelligenceDecision[],
  filter: DecisionFilter = {},
): readonly IntelligenceDecision[] {
  const typeSet =
    filter.types === undefined
      ? undefined
      : new Set(filter.types);

  const statusSet =
    filter.statuses === undefined
      ? undefined
      : new Set(filter.statuses);

  const subjectSet =
    filter.subjects === undefined
      ? undefined
      : new Set(
          filter.subjects.map(
            (subject) =>
              subject
                .trim()
                .toLowerCase(),
          ),
        );

  const analysisSet =
    filter.analysisIds === undefined
      ? undefined
      : new Set(
          filter.analysisIds,
        );

  const signalSet =
    filter.signalIds === undefined
      ? undefined
      : new Set(
          filter.signalIds,
        );

  const metricSet =
    filter.metricIds === undefined
      ? undefined
      : new Set(
          filter.metricIds,
        );

  const foundationSet =
    filter.foundationDecisionIds ===
    undefined
      ? undefined
      : new Set(
          filter.foundationDecisionIds,
        );

  const confidenceSet =
    filter.confidences === undefined
      ? undefined
      : new Set(
          filter.confidences,
        );

  return Object.freeze(
    decisions.filter(
      (decision) => {
        if (
          typeSet !== undefined &&
          !typeSet.has(
            decision.type,
          )
        ) {
          return false;
        }

        if (
          statusSet !== undefined &&
          !statusSet.has(
            decision.status,
          )
        ) {
          return false;
        }

        if (
          subjectSet !== undefined &&
          !subjectSet.has(
            decision.subject
              .trim()
              .toLowerCase(),
          )
        ) {
          return false;
        }

        if (
          analysisSet !== undefined &&
          !decision.analysisIds.some(
            (id) =>
              analysisSet.has(id),
          )
        ) {
          return false;
        }

        if (
          signalSet !== undefined &&
          !decision.signalIds.some(
            (id) =>
              signalSet.has(id),
          )
        ) {
          return false;
        }

        if (
          metricSet !== undefined &&
          !decision.metricIds.some(
            (id) =>
              metricSet.has(id),
          )
        ) {
          return false;
        }

        if (
          foundationSet !== undefined
        ) {
          if (
            decision.foundationDecisionId ===
              undefined ||
            !foundationSet.has(
              decision.foundationDecisionId,
            )
          ) {
            return false;
          }
        }

        if (
          confidenceSet !==
            undefined &&
          !confidenceSet.has(
            decision.confidence,
          )
        ) {
          return false;
        }

        return true;
      },
    ),
  );
}

export function summarizeDecisions(
  decisions:
    | readonly IntelligenceDecision[],
): DecisionSummary {
  const normalized =
    deduplicateDecisions(
      decisions,
    );

  const subjects = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (decision) =>
            decision.subject,
        ),
      ),
    ].sort(),
  );

  const types = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (decision) =>
            decision.type,
        ),
      ),
    ].sort(),
  );

  const statuses =
    Object.freeze(
      [
        ...new Set(
          normalized.map(
            (decision) =>
              decision.status,
          ),
        ),
      ].sort(),
    );

  const approved =
    normalized.filter(
      (decision) =>
        decision.type ===
        "APPROVE",
    ).length;

  const rejected =
    normalized.filter(
      (decision) =>
        decision.type ===
        "REJECT",
    ).length;

  const active =
    normalized.filter(
      (decision) =>
        decision.status ===
        "ACTIVE",
    ).length;

  const blocked =
    normalized.filter(
      (decision) =>
        decision.status ===
        "BLOCKED",
    ).length;

  const watch =
    normalized.filter(
      (decision) =>
        decision.status ===
        "WATCH",
    ).length;

  const retired =
    normalized.filter(
      (decision) =>
        decision.status ===
        "RETIRED",
    ).length;

  const fingerprint =
    contentFingerprint({
      count: normalized.length,
      approved,
      rejected,
      active,
      blocked,
      watch,
      retired,
      subjects,
      types,
      statuses,
    });

  return {
    count: normalized.length,
    approved,
    rejected,
    active,
    blocked,
    watch,
    retired,
    subjects,
    types,
    statuses,
    fingerprint,
  };
}

export function rankDecisions(
  decisions:
    | readonly IntelligenceDecision[],
): readonly IntelligenceDecision[] {
  return Object.freeze(
    [
      ...deduplicateDecisions(
        decisions,
      ),
    ].sort(
      (left, right) => {
        const statusWeight = (
          status: IntelligenceStatus,
        ): number => {
          switch (status) {
            case "ACTIVE":
              return 5;
            case "WATCH":
              return 4;
            case "BLOCKED":
              return 3;
            case "REJECTED":
              return 2;
            case "RETIRED":
              return 1;
          }
        };

        const statusCompare =
          statusWeight(
            right.status,
          ) -
          statusWeight(
            left.status,
          );

        if (
          statusCompare !== 0
        ) {
          return statusCompare;
        }

        const confidenceCompare =
          CONFIDENCE_ORDER[
            right.confidence
          ] -
          CONFIDENCE_ORDER[
            left.confidence
          ];

        if (
          confidenceCompare !== 0
        ) {
          return confidenceCompare;
        }

        const evidenceCompare =
          right.evidenceRefs.length -
          left.evidenceRefs.length;

        if (
          evidenceCompare !== 0
        ) {
          return evidenceCompare;
        }

        return left.decisionId.localeCompare(
          right.decisionId,
        );
      },
    ),
  );
}

export function mergeDecisions(
  primary: IntelligenceDecision,
  secondary: IntelligenceDecision,
): IntelligenceDecision {
  assertDecisionIntegrity(
    primary,
  );

  assertDecisionIntegrity(
    secondary,
  );

  if (
    primary.subject.trim().toLowerCase() !==
    secondary.subject.trim().toLowerCase()
  ) {
    throw new Error(
      "Cannot merge intelligence decisions with different subjects.",
    );
  }

  if (
    primary.type !==
    secondary.type
  ) {
    throw new Error(
      "Cannot merge intelligence decisions with different types.",
    );
  }

  const confidence =
    CONFIDENCE_ORDER[
      primary.confidence
    ] >=
    CONFIDENCE_ORDER[
      secondary.confidence
    ]
      ? primary.confidence
      : secondary.confidence;

  const status =
    primary.status === "ACTIVE" ||
    secondary.status === "ACTIVE"
      ? "ACTIVE"
      : primary.status ===
          "BLOCKED" ||
        secondary.status ===
          "BLOCKED"
        ? "BLOCKED"
        : primary.status ===
            "WATCH" ||
          secondary.status ===
            "WATCH"
          ? "WATCH"
          : primary.status ===
              "REJECTED" &&
            secondary.status ===
              "REJECTED"
            ? "REJECTED"
            : "RETIRED";

  const reasons =
    normalizeReasons([
      ...primary.reasons,
      ...secondary.reasons,
    ]);

  const analysisIds =
    normalizeStringArray(
      [
        ...primary.analysisIds,
        ...secondary.analysisIds,
      ],
      "analysisId",
    );

  const signalIds =
    normalizeStringArray(
      [
        ...primary.signalIds,
        ...secondary.signalIds,
      ],
      "signalId",
    );

  const metricIds =
    normalizeStringArray(
      [
        ...primary.metricIds,
        ...secondary.metricIds,
      ],
      "metricId",
    );

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

  const constraints =
    normalizeConstraints([
      ...primary.constraints,
      ...secondary.constraints,
    ]);

  const expectedOutcome =
    primary.expectedOutcome ??
    secondary.expectedOutcome;

  const foundationDecisionId =
    primary.foundationDecisionId ??
    secondary.foundationDecisionId;

  const decidedAt =
    primary.decidedAt >=
    secondary.decidedAt
      ? primary.decidedAt
      : secondary.decidedAt;

  return createIntelligenceDecision({
    decisionId:
      primary.decisionId,
    type: primary.type,
    subject: primary.subject,
    status,
    reasons,
    analysisIds,
    signalIds,
    metricIds,
    evidenceRefs,
    lineage,
    confidence,
    expectedOutcome,
    constraints,
    foundationDecisionId,
    decidedAt,
  });
}

export function assertDecisionCollection(
  decisions:
    | readonly IntelligenceDecision[],
): void {
  const ids = new Set<string>();
  const fingerprints =
    new Set<string>();

  for (const decision of decisions) {
    assertDecisionIntegrity(
      decision,
    );

    if (
      ids.has(decision.decisionId)
    ) {
      throw new Error(
        `Duplicate intelligence decision ID: ${decision.decisionId}`,
      );
    }

    if (
      fingerprints.has(
        decision.fingerprint,
      )
    ) {
      throw new Error(
        `Duplicate intelligence decision fingerprint: ${decision.fingerprint}`,
      );
    }

    ids.add(
      decision.decisionId,
    );

    fingerprints.add(
      decision.fingerprint,
    );
  }
}