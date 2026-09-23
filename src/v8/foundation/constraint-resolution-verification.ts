import {
  invariant,
  immutable,
} from "../constitution/invariants.js";

import {
  contentFingerprint,
} from "./hash.js";

import {
  recordVerification,
} from "./verification.js";

import type {
  AuditActor,
  FoundationRecord,
  FoundationStore,
  VerificationPayload,
} from "./types.js";

import type {
  ConstraintResolution,
  ConstraintResolutionStatus,
} from "../domain/constraint-resolution.js";

function resolutionFingerprint(
  resolution: ConstraintResolution,
): ConstraintResolution["fingerprint"] {
  return contentFingerprint({
    constraintId:
      resolution.constraintId,
    status:
      resolution.status,
    proof:
      resolution.proof,
    reason:
      resolution.reason,
  });
}

function assertResolutionIntegrity(
  resolution: ConstraintResolution,
): void {
  invariant(
    typeof resolution.constraintId ===
      "string" &&
      resolution.constraintId.trim()
        .length > 0,
    "V8_CONSTRAINT_RESOLUTION_ID_EMPTY",
    "Constraint resolution requires a constraint id.",
  );

  invariant(
    resolution.status ===
        "SATISFIED" ||
      resolution.status ===
        "UNSATISFIED" ||
      resolution.status ===
        "UNKNOWN",
    "V8_CONSTRAINT_RESOLUTION_STATUS_INVALID",
    "Constraint resolution status is invalid.",
  );

  invariant(
    resolution.reason.trim().length > 0,
    "V8_CONSTRAINT_RESOLUTION_REASON_EMPTY",
    "Constraint resolution reason cannot be empty.",
  );

  invariant(
    Array.isArray(
      resolution.proof.knowledgeIds,
    ),
    "V8_CONSTRAINT_RESOLUTION_PROOF_INVALID",
    "Constraint resolution knowledge proof is invalid.",
  );

  invariant(
    Array.isArray(
      resolution.proof.claimIds,
    ),
    "V8_CONSTRAINT_RESOLUTION_PROOF_INVALID",
    "Constraint resolution claim proof is invalid.",
  );

  if (
    resolution.status ===
    "SATISFIED"
  ) {
    invariant(
      resolution.proof.knowledgeIds
        .length > 0 ||
        resolution.proof.claimIds
          .length > 0,
      "V8_CONSTRAINT_RESOLUTION_SATISFIED_WITHOUT_PROOF",
      "A satisfied constraint resolution requires proof.",
    );
  }

  if (
    resolution.status ===
    "UNKNOWN"
  ) {
    invariant(
      resolution.proof.knowledgeIds
        .length === 0 &&
        resolution.proof.claimIds
          .length === 0,
      "V8_CONSTRAINT_RESOLUTION_UNKNOWN_WITH_PROOF",
      "An unknown constraint resolution cannot contain satisfaction proof.",
    );
  }

  const expectedFingerprint =
    resolutionFingerprint(
      resolution,
    );

  invariant(
    expectedFingerprint ===
      resolution.fingerprint,
    "V8_CONSTRAINT_RESOLUTION_FINGERPRINT_MISMATCH",
    "Constraint resolution fingerprint does not match its canonical content.",
  );
}

function verificationDecision(
  status: ConstraintResolutionStatus,
): VerificationPayload["decision"] {
  switch (status) {
    case "SATISFIED":
      return "PASS";

    case "UNSATISFIED":
      return "FAIL";

    case "UNKNOWN":
      return "REQUIRES_REVIEW";
  }
}

function verificationReason(
  status: ConstraintResolutionStatus,
): string {
  switch (status) {
    case "SATISFIED":
      return "constraint resolution verification";

    case "UNSATISFIED":
      return "constraint resolution rejected";

    case "UNKNOWN":
      return "constraint resolution requires review";
  }
}

export interface RecordConstraintResolutionVerificationInput {
  readonly resolution: ConstraintResolution;
  readonly checks: readonly string[];
  readonly verifier: AuditActor;
  readonly evidenceHash?: string;
}

export function recordConstraintResolutionVerification(
  store: FoundationStore,
  input: RecordConstraintResolutionVerificationInput,
): FoundationRecord<VerificationPayload> {
  const {
    resolution,
    checks,
    verifier,
    evidenceHash,
  } = input;

  assertResolutionIntegrity(
    resolution,
  );

  invariant(
    checks.length > 0,
    "V8_CONSTRAINT_RESOLUTION_VERIFICATION_CHECKS_REQUIRED",
    "Constraint resolution verification requires explicit checks.",
  );

  const normalizedChecks =
    immutable(
      checks.map((check) => {
        invariant(
          typeof check ===
              "string" &&
            check.trim()
              .length > 0,
          "V8_CONSTRAINT_RESOLUTION_VERIFICATION_CHECK_INVALID",
          "Constraint resolution verification checks must be non-empty strings.",
        );

        return check.trim();
      }),
    );

  const decision =
    verificationDecision(
      resolution.status,
    );

  const record =
    recordVerification(
      store,
      "CONSTRAINT_RESOLUTION",
      resolution.fingerprint,
      decision,
      normalizedChecks,
      verifier,
      evidenceHash,
    );

  invariant(
    record.aggregateType ===
      "VERIFICATION",
    "V8_CONSTRAINT_RESOLUTION_VERIFICATION_TYPE_INVALID",
    "Constraint resolution verification must be persisted as VERIFICATION.",
  );

  invariant(
    record.payload.targetType ===
      "CONSTRAINT_RESOLUTION",
    "V8_CONSTRAINT_RESOLUTION_VERIFICATION_TARGET_INVALID",
    "Verification target type must be CONSTRAINT_RESOLUTION.",
  );

  invariant(
    record.payload.targetId ===
      resolution.fingerprint,
    "V8_CONSTRAINT_RESOLUTION_VERIFICATION_TARGET_MISMATCH",
    "Verification target must bind to the exact constraint resolution fingerprint.",
  );

  invariant(
    record.payload.decision ===
      decision,
    "V8_CONSTRAINT_RESOLUTION_VERIFICATION_DECISION_MISMATCH",
    "Persisted verification decision does not match the resolution status.",
  );

  return record;
}

export function hasPassingConstraintResolutionVerification(
  store: FoundationStore,
  resolution: ConstraintResolution,
): boolean {
  assertResolutionIntegrity(
    resolution,
  );

  return store
    .auditTrail()
    .some(
      (record) => {
        if (
          record.aggregateType !==
          "VERIFICATION"
        ) {
          return false;
        }

        if (
          record.state !==
          "VERIFIED"
        ) {
          return false;
        }

        if (
          !record.payload ||
          typeof record.payload !==
            "object"
        ) {
          return false;
        }

        const payload =
          record.payload as VerificationPayload;

        return (
          payload.targetType ===
            "CONSTRAINT_RESOLUTION" &&
          payload.targetId ===
            resolution.fingerprint &&
          payload.decision ===
            "PASS"
        );
      },
    );
}

export function getConstraintResolutionVerification(
  store: FoundationStore,
  resolution: ConstraintResolution,
): FoundationRecord<VerificationPayload> | null {
  assertResolutionIntegrity(
    resolution,
  );

  const matches =
    store
      .auditTrail()
      .filter(
        (record) => {
          if (
            record.aggregateType !==
            "VERIFICATION"
          ) {
            return false;
          }

          if (
            !record.payload ||
            typeof record.payload !==
              "object"
          ) {
            return false;
          }

          const payload =
            record.payload as VerificationPayload;

          return (
            payload.targetType ===
              "CONSTRAINT_RESOLUTION" &&
            payload.targetId ===
              resolution.fingerprint
          );
        },
      );

  if (
    matches.length === 0
  ) {
    return null;
  }

  const latest =
    matches[matches.length - 1];

  return latest as FoundationRecord<VerificationPayload>;
}

export function assertPassingConstraintResolutionVerification(
  store: FoundationStore,
  resolution: ConstraintResolution,
): void {
  invariant(
    hasPassingConstraintResolutionVerification(
      store,
      resolution,
    ),
    "V8_CONSTRAINT_RESOLUTION_VERIFICATION_REQUIRED",
    `Constraint resolution ${resolution.fingerprint} does not have a persisted PASS verification.`,
  );
}