import { invariant } from "../constitution/invariants.js";
import { contentFingerprint } from "./hash.js";
import type {
  FoundationRecord,
  LineageLink,
} from "./types.js";

interface ProblemPayload {
  readonly contextId: string;
  readonly question: string;
  readonly constraints: readonly string[];
}

interface DecisionReference {
  readonly problemId: string;
}

function problemBody(
  record: FoundationRecord<ProblemPayload>,
) {
  return {
    aggregateType: record.aggregateType,
    aggregateId: record.aggregateId,
    version: record.version,
    state: record.state,
    payload: record.payload,
    lineage: record.lineage,
    previousFingerprint: record.previousFingerprint,
    actor: record.actor,
    reason: record.reason,
    recordedAt: record.recordedAt,
  };
}

function assertProblemRecordIntegrity(
  record: FoundationRecord<ProblemPayload>,
): void {
  invariant(
    record.aggregateType === "PROBLEM",
    "V8_PROBLEM_CONSTRAINT_INVALID_RECORD",
    "Problem constraint gate requires a PROBLEM record.",
  );

  invariant(
    record.payload !== null &&
      typeof record.payload === "object",
    "V8_PROBLEM_CONSTRAINT_INVALID_PAYLOAD",
    "Problem payload is invalid.",
  );

  invariant(
    Array.isArray(record.payload.constraints),
    "V8_PROBLEM_CONSTRAINT_INVALID",
    "Problem constraints must be an array.",
  );

  invariant(
    record.payload.constraints.every(
      (constraint) =>
        typeof constraint === "string" &&
        constraint.trim().length > 0,
    ),
    "V8_PROBLEM_CONSTRAINT_INVALID",
    "Problem constraints must contain only non-empty strings.",
  );

  const expectedFingerprint =
    contentFingerprint(problemBody(record));

  invariant(
    expectedFingerprint === record.fingerprint,
    "V8_PROBLEM_CONSTRAINT_FINGERPRINT_MISMATCH",
    `Problem ${record.aggregateId} fingerprint does not match its persisted payload.`,
  );
}

function findProblemLineage(
  lineage: readonly LineageLink[],
  problemId: string,
): LineageLink | undefined {
  return lineage.find(
    (link) =>
      link.type === "PROBLEM" &&
      link.id === problemId,
  );
}

export function assertProblemConstraintClosure(
  decision: DecisionReference,
  problem: FoundationRecord<ProblemPayload>,
  decisionLineage: readonly LineageLink[],
): void {
  assertProblemRecordIntegrity(problem);

  invariant(
    problem.state === "REGISTERED",
    "V8_PROBLEM_CONSTRAINT_PROBLEM_NOT_REGISTERED",
    `Problem ${problem.aggregateId} must be registered.`,
  );

  invariant(
    decision.problemId === problem.aggregateId,
    "V8_PROBLEM_CONSTRAINT_PROBLEM_MISMATCH",
    "Decision problem reference does not match the Problem record.",
  );

  const problemLink = findProblemLineage(
    decisionLineage,
    problem.aggregateId,
  );

  invariant(
    problemLink !== undefined,
    "V8_PROBLEM_CONSTRAINT_LINEAGE_MISSING",
    `Decision ${decision.problemId} is missing its Problem lineage link.`,
  );

  invariant(
    problemLink.version === problem.version,
    "V8_PROBLEM_CONSTRAINT_VERSION_MISMATCH",
    `Decision ${decision.problemId} is not bound to the current Problem version.`,
  );

  invariant(
    problemLink.fingerprint === problem.fingerprint,
    "V8_PROBLEM_CONSTRAINT_FINGERPRINT_UNBOUND",
    `Decision ${decision.problemId} is not bound to the exact Problem fingerprint.`,
  );
}