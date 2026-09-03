import { immutable, invariant, requireKnown } from "../constitution/invariants.js";
import { claimId, evidenceId, nonEmpty, stableFingerprint, type ClaimId, type EvidenceId, type Fingerprint } from "./primitives.js";

export type ClaimStatus = "VERIFIED" | "REJECTED" | "REQUIRES_REVIEW" | "UNKNOWN";

export interface Claim {
  readonly id: ClaimId;
  readonly statement: string;
  readonly evidenceIds: readonly EvidenceId[];
  readonly status: Exclude<ClaimStatus, "UNKNOWN">;
  readonly fingerprint: Fingerprint;
}

export function createClaim(input: Omit<Claim, "id" | "fingerprint"> & { id?: string }): Readonly<Claim> {
  const status = requireKnown(input.status, "V8_CLAIM_UNKNOWN", "claim.status");
  invariant(input.evidenceIds.length > 0, "V8_CLAIM_NO_EVIDENCE", "A claim must cite at least one evidence record.");
  const evidenceIds = immutable([...new Set(input.evidenceIds.map(evidenceId))].sort());
  const fp = stableFingerprint({ statement: input.statement, evidenceIds, status });
  return immutable({ id: claimId(input.id ?? `claim:${fp}`), statement: nonEmpty(input.statement, "claim.statement"), evidenceIds, status, fingerprint: fp });
}
