import {
  immutable,
  invariant,
  requireKnown,
} from "../constitution/invariants.js";

import {
  claimId,
  evidenceId,
  nonEmpty,
  type ClaimId,
  type EvidenceId,
  type Fingerprint,
} from "./primitives.js";

import {
  contentFingerprint,
} from "../foundation/hash.js";

export type ClaimStatus =
  | "VERIFIED"
  | "REJECTED"
  | "REQUIRES_REVIEW"
  | "UNKNOWN";

export type ClaimEpistemicLevel =
  | "OBSERVATION"
  | "METHOD"
  | "INTERPRETATION"
  | "ENGINEERING_INFERENCE"
  | "RECOMMENDATION";

export interface Claim {
  id: ClaimId;
  statement: string;
  evidenceIds: readonly EvidenceId[];
  status: Exclude<
    ClaimStatus,
    "UNKNOWN"
  >;
  fingerprint: Fingerprint;

  scope?: string;
  conditions?: readonly string[];
  units?: readonly string[];

  confidence?:
    | "HIGH"
    | "MEDIUM"
    | "LOW";

  epistemicLevel?:
    ClaimEpistemicLevel;

  isUniversal?: boolean;
}

export function createClaim(
  input: Omit<
    Claim,
    "id" | "fingerprint"
  > & {
    id?: string;
  },
): Readonly<Claim> {
  const status = requireKnown(
    input.status,
    "V8_CLAIM_UNKNOWN",
    "claim.status",
  );

  invariant(
    input.evidenceIds.length > 0,
    "V8_CLAIM_NO_EVIDENCE",
    "A claim must cite at least one evidence record.",
  );

  const evidenceIds = immutable(
    [
      ...new Set(
        input.evidenceIds.map(evidenceId),
      ),
    ].sort(),
  );

  const statement = nonEmpty(
    input.statement,
    "claim.statement",
  );

  const fp = contentFingerprint({
    statement,
    evidenceIds,
    status,
    scope: input.scope,
    conditions: input.conditions,
    units: input.units,
    confidence: input.confidence,
    epistemicLevel:
      input.epistemicLevel,
    isUniversal:
      input.isUniversal,
  });

  return immutable({
    id: claimId(
      input.id ?? `claim:${fp}`,
    ),

    statement,

    evidenceIds,

    status,

    fingerprint: fp,

    ...(input.scope
      ? { scope: input.scope }
      : {}),

    ...(input.conditions
      ? {
          conditions: [
            ...input.conditions,
          ],
        }
      : {}),

    ...(input.units
      ? {
          units: [
            ...input.units,
          ],
        }
      : {}),

    ...(input.confidence
      ? {
          confidence:
            input.confidence,
        }
      : {}),

    ...(input.epistemicLevel
      ? {
          epistemicLevel:
            input.epistemicLevel,
        }
      : {}),

    ...(input.isUniversal !== undefined
      ? {
          isUniversal:
            input.isUniversal,
        }
      : {}),
  });
}