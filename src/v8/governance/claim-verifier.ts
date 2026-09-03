import { invariant, immutable } from "../constitution/invariants.js";
import { createClaim, type Claim } from "../domain/claim.js";
import type { EvidencePayload, FoundationRecord, FoundationStore } from "../foundation/types.js";
import type { ClaimVerificationResult } from "./types.js";

export class ClaimVerifier {
  constructor(private readonly store: FoundationStore) {}

  verify(input: Omit<Claim, "id" | "fingerprint"> & { id?: string }): ClaimVerificationResult {
    const claim = createClaim(input);
    const reasons: string[] = [];
    const records = claim.evidenceIds.map(id => this.store.get<EvidencePayload>("EVIDENCE", id));
    if (records.some(record => record === null)) {
      return immutable({ verdict: "REJECTED", claim, evidenceCount: records.filter(Boolean).length, reasons: ["Every cited evidence record must exist."] });
    }
    const evidence = records as FoundationRecord<EvidencePayload>[];
    if (evidence.some(record => record.state !== "AUDITED")) {
      return immutable({ verdict: "REQUIRES_REVIEW", claim, evidenceCount: evidence.length, reasons: ["Every cited evidence record must be AUDITED."] });
    }
    const lineageOk = evidence.every(record => record.lineage.some(link => link.type === "SNAPSHOT") && record.payload.snapshotId.length > 0);
    if (!lineageOk) {
      return immutable({ verdict: "REJECTED", claim, evidenceCount: evidence.length, reasons: ["Evidence must retain snapshot lineage."] });
    }
    if (claim.status !== "VERIFIED") {
      return immutable({ verdict: "REQUIRES_REVIEW", claim, evidenceCount: evidence.length, reasons: ["A claim cannot be verified while its epistemic status is not VERIFIED."] });
    }
    return immutable({ verdict: "VERIFIED", claim, evidenceCount: evidence.length, reasons: [] });
  }

  assertVerified(input: Omit<Claim, "id" | "fingerprint"> & { id?: string }): Readonly<Claim> {
    const result = this.verify(input);
    invariant(result.verdict === "VERIFIED", "V8_GOVERNANCE_CLAIM_NOT_VERIFIED", result.reasons.join(" ") || "Claim verification failed.");
    return result.claim;
  }
}
