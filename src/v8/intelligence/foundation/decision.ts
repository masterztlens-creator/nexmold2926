import {
  clamp,
  type JsonValue,
} from "../shared.js";
import {
  contentFingerprint,
  immutable,
} from "../../constitution/invariants.js";
import type {
  IntelligenceDecision,
  IntelligenceDecisionAction,
  IntelligenceDecisionEvidence,
  IntelligenceDecisionStatus,
  IntelligenceDecisionType,
} from "./types.js";

export interface CreateIntelligenceDecisionInput {
  readonly decisionId?: string;
  readonly type: IntelligenceDecisionType;
  readonly action: IntelligenceDecisionAction;
  readonly subject: string;
  readonly normalizedSubject?: string;
  readonly status?: IntelligenceDecisionStatus;
  readonly rationale: string;
  readonly confidence?: number;
  readonly priority?: number;
  readonly expectedImpact?: number;
  readonly evidence?: readonly IntelligenceDecisionEvidence[];
  readonly entityIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly prerequisiteDecisionIds?: readonly string[];
  readonly metadata?: Readonly<Record<string, JsonValue>> | null;
  readonly createdAt: string;
  readonly effectiveAt?: string | null;
  readonly expiresAt?: string | null;
}

export interface DecisionFilter {
  readonly types?: readonly IntelligenceDecisionType[];
  readonly actions?: readonly IntelligenceDecisionAction[];
  readonly statuses?: readonly IntelligenceDecisionStatus[];
  readonly subjects?: readonly string[];
  readonly entityIds?: readonly string[];
  readonly signalIds?: readonly string[];
  readonly metricIds?: readonly string[];
  readonly minConfidence?: number;
  readonly minPriority?: number;
  readonly minExpectedImpact?: number;
}

export interface DecisionSummary {
  readonly count: number;
  readonly approved: number;
  readonly rejected: number;
  readonly pending: number;
  readonly subjects: readonly string[];
  readonly actions: readonly IntelligenceDecisionAction[];
  readonly averageConfidence: number;
  readonly averagePriority: number;
  readonly averageExpectedImpact: number;
  readonly fingerprint: string;
}

function normalizeIdentifier(value: string): string {
  return value.trim();
}

function normalizeSubject(value: string): string {
  return value.trim();
}

function normalizeNormalizedSubject(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function normalizeRequiredText(
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

function normalizeIsoTimestamp(
  value: string,
  field: string,
): string {
  const trimmed = value.trim();

  if (!trimmed) {
    throw new Error(
      `Decision ${field} must not be empty.`,
    );
  }

  const timestamp = Date.parse(trimmed);

  if (!Number.isFinite(timestamp)) {
    throw new Error(
      `Invalid decision ${field} timestamp: ${value}`,
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

  return normalizeIsoTimestamp(value, field);
}

function normalizeFiniteNumber(
  value: number,
  field: string,
): number {
  if (!Number.isFinite(value)) {
    throw new Error(
      `Decision ${field} must be a finite number.`,
    );
  }

  return value;
}

function normalizeScore(
  value: number | undefined,
  fallback: number,
): number {
  return clamp(value ?? fallback, 0, 1);
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

function normalizeEvidence(
  evidence:
    | readonly IntelligenceDecisionEvidence[]
    | undefined,
): readonly IntelligenceDecisionEvidence[] {
  if (!evidence || evidence.length === 0) {
    return Object.freeze([]);
  }

  const normalized = evidence
    .map((item) => ({
      evidenceId: normalizeIdentifier(
        item.evidenceId,
      ),
      sourceId: normalizeIdentifier(
        item.sourceId,
      ),
      snapshotId: normalizeIdentifier(
        item.snapshotId,
      ),
      claimId:
        item.claimId === null ||
        item.claimId === undefined
          ? null
          : normalizeIdentifier(item.claimId),
      confidence: clamp(
        item.confidence,
        0,
        1,
      ),
      role: normalizeRequiredText(
        item.role,
        "evidence role",
      ),
    }))
    .sort((left, right) => {
      if (
        left.evidenceId !== right.evidenceId
      ) {
        return left.evidenceId.localeCompare(
          right.evidenceId,
        );
      }

      if (
        left.sourceId !== right.sourceId
      ) {
        return left.sourceId.localeCompare(
          right.sourceId,
        );
      }

      return left.role.localeCompare(
        right.role,
      );
    });

  const seen = new Set<string>();
  const result: IntelligenceDecisionEvidence[] =
    [];

  for (const item of normalized) {
    if (!item.evidenceId) {
      throw new Error(
        "Decision evidenceId must not be empty.",
      );
    }

    if (!item.sourceId) {
      throw new Error(
        "Decision evidence sourceId must not be empty.",
      );
    }

    if (!item.snapshotId) {
      throw new Error(
        "Decision evidence snapshotId must not be empty.",
      );
    }

    const key = [
      item.evidenceId,
      item.sourceId,
      item.snapshotId,
      item.claimId ?? "",
      item.role,
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(item);
  }

  return Object.freeze(result);
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

function serializeEvidence(
  evidence:
    | readonly IntelligenceDecisionEvidence[],
): readonly JsonValue[] {
  return evidence.map(
    (item): JsonValue => ({
      evidenceId: item.evidenceId,
      sourceId: item.sourceId,
      snapshotId: item.snapshotId,
      claimId: item.claimId,
      confidence: item.confidence,
      role: item.role,
    }),
  );
}

function serializeDecisionForFingerprint(
  decision: IntelligenceDecision,
): JsonValue {
  return {
    decisionId: decision.decisionId,
    type: decision.type,
    action: decision.action,
    subject: decision.subject,
    normalizedSubject: decision.normalizedSubject,
    status: decision.status,
    rationale: decision.rationale,
    confidence: decision.confidence,
    priority: decision.priority,
    expectedImpact: decision.expectedImpact,
    evidence: serializeEvidence(
      decision.evidence,
    ),
    entityIds: [...decision.entityIds],
    signalIds: [...decision.signalIds],
    metricIds: [...decision.metricIds],
    prerequisiteDecisionIds: [
      ...decision.prerequisiteDecisionIds,
    ],
    metadata: decision.metadata,
    createdAt: decision.createdAt,
    effectiveAt: decision.effectiveAt,
    expiresAt: decision.expiresAt,
  };
}

export function createIntelligenceDecision(
  input: CreateIntelligenceDecisionInput,
): IntelligenceDecision {
  const subject = normalizeSubject(input.subject);

  if (!subject) {
    throw new Error(
      "Decision subject must not be empty.",
    );
  }

  const normalizedSubject =
    input.normalizedSubject !== undefined
      ? normalizeNormalizedSubject(
          input.normalizedSubject,
        )
      : normalizeNormalizedSubject(subject);

  if (!normalizedSubject) {
    throw new Error(
      "Decision normalizedSubject must not be empty.",
    );
  }

  const rationale = normalizeRequiredText(
    input.rationale,
    "rationale",
  );

  const createdAt = normalizeIsoTimestamp(
    input.createdAt,
    "createdAt",
  );

  const effectiveAt =
    normalizeOptionalTimestamp(
      input.effectiveAt,
      "effectiveAt",
    );

  const expiresAt =
    normalizeOptionalTimestamp(
      input.expiresAt,
      "expiresAt",
    );

  if (
    effectiveAt !== null &&
    expiresAt !== null &&
    effectiveAt > expiresAt
  ) {
    throw new Error(
      "Decision effectiveAt must not be later than expiresAt.",
    );
  }

  const confidence = normalizeScore(
    input.confidence,
    0,
  );

  const priority = normalizeScore(
    input.priority,
    0.5,
  );

  const expectedImpact = normalizeScore(
    input.expectedImpact,
    0.5,
  );

  const evidence = normalizeEvidence(
    input.evidence,
  );

  const entityIds = normalizeStringArray(
    input.entityIds,
  );

  const signalIds = normalizeStringArray(
    input.signalIds,
  );

  const metricIds = normalizeStringArray(
    input.metricIds,
  );

  const prerequisiteDecisionIds =
    normalizeStringArray(
      input.prerequisiteDecisionIds,
    );

  const metadata = normalizeMetadata(
    input.metadata,
  );

  const status =
    input.status ?? "PENDING";

  const decisionId =
    normalizeIdentifier(
      input.decisionId ?? "",
    ) ||
    `decision:intelligence:v8:${contentFingerprint(
      {
        type: input.type,
        action: input.action,
        subject,
        normalizedSubject,
        rationale,
        createdAt,
        effectiveAt,
        expiresAt,
      },
    )}`;

  const fingerprint = contentFingerprint(
    serializeDecisionForFingerprint({
      decisionId,
      type: input.type,
      action: input.action,
      subject,
      normalizedSubject,
      status,
      rationale,
      confidence,
      priority,
      expectedImpact,
      evidence,
      entityIds,
      signalIds,
      metricIds,
      prerequisiteDecisionIds,
      metadata,
      createdAt,
      effectiveAt,
      expiresAt,
      fingerprint: "",
    }),
  );

  return immutable({
    decisionId,
    type: input.type,
    action: input.action,
    subject,
    normalizedSubject,
    status,
    rationale,
    confidence,
    priority,
    expectedImpact,
    evidence,
    entityIds,
    signalIds,
    metricIds,
    prerequisiteDecisionIds,
    metadata,
    createdAt,
    effectiveAt,
    expiresAt,
    fingerprint,
  });
}

export function decisionFingerprint(
  decision: IntelligenceDecision,
): string {
  return contentFingerprint(
    serializeDecisionForFingerprint(
      decision,
    ),
  );
}

export function assertDecisionIntegrity(
  decision: IntelligenceDecision,
): void {
  if (!decision.decisionId.trim()) {
    throw new Error(
      "Decision decisionId must not be empty.",
    );
  }

  if (!decision.subject.trim()) {
    throw new Error(
      "Decision subject must not be empty.",
    );
  }

  if (!decision.normalizedSubject.trim()) {
    throw new Error(
      "Decision normalizedSubject must not be empty.",
    );
  }

  if (!decision.rationale.trim()) {
    throw new Error(
      "Decision rationale must not be empty.",
    );
  }

  if (
    !Number.isFinite(decision.confidence) ||
    decision.confidence < 0 ||
    decision.confidence > 1
  ) {
    throw new Error(
      "Decision confidence must be between 0 and 1.",
    );
  }

  if (
    !Number.isFinite(decision.priority) ||
    decision.priority < 0 ||
    decision.priority > 1
  ) {
    throw new Error(
      "Decision priority must be between 0 and 1.",
    );
  }

  if (
    !Number.isFinite(
      decision.expectedImpact,
    ) ||
    decision.expectedImpact < 0 ||
    decision.expectedImpact > 1
  ) {
    throw new Error(
      "Decision expectedImpact must be between 0 and 1.",
    );
  }

  if (
    decision.effectiveAt !== null &&
    decision.expiresAt !== null &&
    decision.effectiveAt >
      decision.expiresAt
  ) {
    throw new Error(
      `Decision ${decision.decisionId} has invalid effective/expires range.`,
    );
  }

  const calculated =
    decisionFingerprint(decision);

  if (calculated !== decision.fingerprint) {
    throw new Error(
      `Decision fingerprint mismatch for ${decision.decisionId}.`,
    );
  }
}

export function deduplicateDecisions(
  decisions: readonly IntelligenceDecision[],
): readonly IntelligenceDecision[] {
  const byFingerprint = new Map<
    string,
    IntelligenceDecision
  >();

  for (const decision of decisions) {
    assertDecisionIntegrity(decision);

    const existing = byFingerprint.get(
      decision.fingerprint,
    );

    if (!existing) {
      byFingerprint.set(
        decision.fingerprint,
        decision,
      );
      continue;
    }

    if (
      decision.confidence >
        existing.confidence ||
      (
        decision.confidence ===
          existing.confidence &&
        decision.priority >
          existing.priority
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
        if (
          right.priority !== left.priority
        ) {
          return (
            right.priority -
            left.priority
          );
        }

        if (
          right.expectedImpact !==
          left.expectedImpact
        ) {
          return (
            right.expectedImpact -
            left.expectedImpact
          );
        }

        return left.decisionId.localeCompare(
          right.decisionId,
        );
      },
    ),
  );
}

export function filterDecisions(
  decisions: readonly IntelligenceDecision[],
  filter: DecisionFilter,
): readonly IntelligenceDecision[] {
  const typeSet = filter.types
    ? new Set(filter.types)
    : null;

  const actionSet = filter.actions
    ? new Set(filter.actions)
    : null;

  const statusSet = filter.statuses
    ? new Set(filter.statuses)
    : null;

  const subjectSet = filter.subjects
    ? new Set(
        filter.subjects.map(
          normalizeNormalizedSubject,
        ),
      )
    : null;

  const entitySet = filter.entityIds
    ? new Set(filter.entityIds)
    : null;

  const signalSet = filter.signalIds
    ? new Set(filter.signalIds)
    : null;

  const metricSet = filter.metricIds
    ? new Set(filter.metricIds)
    : null;

  return Object.freeze(
    decisions.filter((decision) => {
      if (
        typeSet &&
        !typeSet.has(decision.type)
      ) {
        return false;
      }

      if (
        actionSet &&
        !actionSet.has(decision.action)
      ) {
        return false;
      }

      if (
        statusSet &&
        !statusSet.has(decision.status)
      ) {
        return false;
      }

      if (
        subjectSet &&
        !subjectSet.has(
          decision.normalizedSubject,
        )
      ) {
        return false;
      }

      if (
        filter.minConfidence !==
          undefined &&
        decision.confidence <
          clamp(
            filter.minConfidence,
            0,
            1,
          )
      ) {
        return false;
      }

      if (
        filter.minPriority !==
          undefined &&
        decision.priority <
          clamp(
            filter.minPriority,
            0,
            1,
          )
      ) {
        return false;
      }

      if (
        filter.minExpectedImpact !==
          undefined &&
        decision.expectedImpact <
          clamp(
            filter.minExpectedImpact,
            0,
            1,
          )
      ) {
        return false;
      }

      if (entitySet) {
        if (
          !decision.entityIds.some(
            (id) => entitySet.has(id),
          )
        ) {
          return false;
        }
      }

      if (signalSet) {
        if (
          !decision.signalIds.some(
            (id) => signalSet.has(id),
          )
        ) {
          return false;
        }
      }

      if (metricSet) {
        if (
          !decision.metricIds.some(
            (id) => metricSet.has(id),
          )
        ) {
          return false;
        }
      }

      return true;
    }),
  );
}

export function summarizeDecisions(
  decisions: readonly IntelligenceDecision[],
): DecisionSummary {
  const normalized =
    deduplicateDecisions(decisions);

  const subjects = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (decision) =>
            decision.normalizedSubject,
        ),
      ),
    ].sort(),
  );

  const actions = Object.freeze(
    [
      ...new Set(
        normalized.map(
          (decision) =>
            decision.action,
        ),
      ),
    ].sort(),
  );

  const approved = normalized.filter(
    (decision) =>
      decision.status === "APPROVED",
  ).length;

  const rejected = normalized.filter(
    (decision) =>
      decision.status === "REJECTED",
  ).length;

  const pending = normalized.filter(
    (decision) =>
      decision.status === "PENDING",
  ).length;

  const averageConfidence =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, decision) =>
            sum + decision.confidence,
          0,
        ) / normalized.length;

  const averagePriority =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, decision) =>
            sum + decision.priority,
          0,
        ) / normalized.length;

  const averageExpectedImpact =
    normalized.length === 0
      ? 0
      : normalized.reduce(
          (sum, decision) =>
            sum +
            decision.expectedImpact,
          0,
        ) / normalized.length;

  const fingerprint = contentFingerprint({
    count: normalized.length,
    approved,
    rejected,
    pending,
    subjects,
    actions,
    averageConfidence,
    averagePriority,
    averageExpectedImpact,
  });

  return {
    count: normalized.length,
    approved,
    rejected,
    pending,
    subjects,
    actions,
    averageConfidence,
    averagePriority,
    averageExpectedImpact,
    fingerprint,
  };
}

export function rankDecisions(
  decisions: readonly IntelligenceDecision[],
): readonly IntelligenceDecision[] {
  return Object.freeze(
    [...deduplicateDecisions(decisions)].sort(
      (left, right) => {
        const leftScore =
          left.priority *
          left.expectedImpact *
          left.confidence;

        const rightScore =
          right.priority *
          right.expectedImpact *
          right.confidence;

        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }

        if (
          right.priority !==
          left.priority
        ) {
          return (
            right.priority -
            left.priority
          );
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
  assertDecisionIntegrity(primary);
  assertDecisionIntegrity(secondary);

  if (
    primary.normalizedSubject !==
    secondary.normalizedSubject
  ) {
    throw new Error(
      "Cannot merge decisions with different subjects.",
    );
  }

  if (primary.type !== secondary.type) {
    throw new Error(
      "Cannot merge decisions with different types.",
    );
  }

  if (
    primary.action !== secondary.action
  ) {
    throw new Error(
      "Cannot merge decisions with different actions.",
    );
  }

  const latest =
    primary.createdAt >= secondary.createdAt
      ? primary
      : secondary;

  const evidence = [
    ...primary.evidence,
    ...secondary.evidence,
  ];

  const entityIds = Object.freeze(
    [
      ...new Set([
        ...primary.entityIds,
        ...secondary.entityIds,
      ]),
    ].sort(),
  );

  const signalIds = Object.freeze(
    [
      ...new Set([
        ...primary.signalIds,
        ...secondary.signalIds,
      ]),
    ].sort(),
  );

  const metricIds = Object.freeze(
    [
      ...new Set([
        ...primary.metricIds,
        ...secondary.metricIds,
      ]),
    ].sort(),
  );

  const prerequisiteDecisionIds =
    Object.freeze(
      [
        ...new Set([
          ...primary.prerequisiteDecisionIds,
          ...secondary.prerequisiteDecisionIds,
        ]),
      ].sort(),
    );

  const metadata: Record<
    string,
    JsonValue
  > = {};

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

  const effectiveAt =
    latest.effectiveAt ??
    primary.effectiveAt ??
    secondary.effectiveAt ??
    null;

  const expiresAt =
    latest.expiresAt ??
    primary.expiresAt ??
    secondary.expiresAt ??
    null;

  return createIntelligenceDecision({
    decisionId: primary.decisionId,
    type: primary.type,
    action: primary.action,
    subject: primary.subject,
    normalizedSubject:
      primary.normalizedSubject,
    status:
      primary.status === "APPROVED" ||
      secondary.status === "APPROVED"
        ? "APPROVED"
        : latest.status,
    rationale:
      latest.rationale,
    confidence: Math.max(
      primary.confidence,
      secondary.confidence,
    ),
    priority: Math.max(
      primary.priority,
      secondary.priority,
    ),
    expectedImpact: Math.max(
      primary.expectedImpact,
      secondary.expectedImpact,
    ),
    evidence,
    entityIds,
    signalIds,
    metricIds,
    prerequisiteDecisionIds,
    metadata:
      Object.keys(metadata).length > 0
        ? metadata
        : null,
    createdAt:
      primary.createdAt <=
      secondary.createdAt
        ? primary.createdAt
        : secondary.createdAt,
    effectiveAt,
    expiresAt,
  });
}

export function assertDecisionCollection(
  decisions: readonly IntelligenceDecision[],
): void {
  const ids = new Set<string>();
  const fingerprints = new Set<string>();

  for (const decision of decisions) {
    assertDecisionIntegrity(decision);

    if (ids.has(decision.decisionId)) {
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

    ids.add(decision.decisionId);
    fingerprints.add(
      decision.fingerprint,
    );
  }
}