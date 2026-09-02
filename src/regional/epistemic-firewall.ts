import type {
  EvidenceRef,
  RegionalEvidenceSnapshot,
  SemanticClaimId,
  SemanticClaimRef,
} from "./types.ts";

export interface V714ClaimEvidenceBinding {
  readonly claim: SemanticClaimRef;
  readonly evidenceIds: readonly string[];
}

export interface V714FirewallInput {
  readonly evidence: RegionalEvidenceSnapshot;
  readonly semanticClaimIds: readonly SemanticClaimId[];
  readonly bindings: readonly V714ClaimEvidenceBinding[];
}

export interface V714FirewallPass {
  readonly ok: true;
  readonly checkedClaims: number;
  readonly checkedEvidence: number;
}

export interface V714FirewallBlock {
  readonly ok: false;
  readonly reasonCodes: readonly string[];
}

export type V714FirewallResult =
  | V714FirewallPass
  | V714FirewallBlock;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function findEvidence(
  evidence: readonly EvidenceRef[],
  id: string,
): EvidenceRef | undefined {
  return evidence.find((item) => String(item.id) === id);
}

/**
 * NEXMOLD V7.14 — Epistemic Firewall
 *
 * Fail-closed invariants:
 *
 * 1. Evidence must exist.
 * 2. Evidence completeness must be COMPLETE.
 * 3. Every declared semantic claim must have exactly one
 *    explicit binding entry.
 * 4. No binding may reference an undeclared claim.
 * 5. Every binding must contain at least one evidence id.
 * 6. Every bound evidence id must resolve.
 * 7. Every resolved evidence reference must contain
 *    sourceLocator and contentHash.
 * 8. Evidence semantic claims must not silently diverge
 *    from the declared semantic projection.
 *
 * This module never infers missing evidence.
 * This module never infers missing claim bindings.
 */
export function runEpistemicFirewall(
  input: V714FirewallInput,
): V714FirewallResult {
  const reasons: string[] = [];

  const declaredClaimIds = new Set(
    input.semanticClaimIds.map((id) => String(id)),
  );

  const bindingClaimIds = input.bindings.map(
    (binding) => String(binding.claim.id),
  );

  /*
   * ------------------------------------------------------------
   * Evidence boundary
   * ------------------------------------------------------------
   */

  if (input.evidence.completeness !== "COMPLETE") {
    reasons.push("V714_EVIDENCE_NOT_COMPLETE");
  }

  if (input.evidence.evidence.length === 0) {
    reasons.push("V714_EVIDENCE_EMPTY");
  }

  /*
   * ------------------------------------------------------------
   * Claim declaration boundary
   * ------------------------------------------------------------
   */

  if (input.semanticClaimIds.length === 0) {
    reasons.push("V714_SEMANTIC_CLAIMS_EMPTY");
  }

  if (input.bindings.length === 0) {
    reasons.push("V714_CLAIM_BINDINGS_EMPTY");
  }

  /*
   * Every declared semantic claim MUST have exactly
   * one binding entry.
   */

  for (const claimId of declaredClaimIds) {
    const count = bindingClaimIds.filter(
      (bindingId) => bindingId === claimId,
    ).length;

    if (count === 0) {
      reasons.push(
        `V714_CLAIM_BINDING_MISSING:${claimId}`,
      );
    }

    if (count > 1) {
      reasons.push(
        `V714_CLAIM_BINDING_DUPLICATE:${claimId}`,
      );
    }
  }

  /*
   * No binding may introduce a claim that was not declared
   * by the semantic projection.
   */

  for (const binding of input.bindings) {
    const claimId = String(binding.claim.id);

    if (!declaredClaimIds.has(claimId)) {
      reasons.push(
        `V714_CLAIM_BINDING_UNDECLARED:${claimId}`,
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * Binding validation
   * ------------------------------------------------------------
   */

  const evidenceIds = new Set(
    input.evidence.evidence.map((item) => String(item.id)),
  );

  for (const binding of input.bindings) {
    if (!isNonEmptyString(binding.claim.id)) {
      reasons.push("V714_CLAIM_ID_INVALID");
    }

    if (!isNonEmptyString(binding.claim.claimKey)) {
      reasons.push("V714_CLAIM_KEY_INVALID");
    }

    if (binding.evidenceIds.length === 0) {
      reasons.push(
        `V714_CLAIM_WITHOUT_EVIDENCE:${binding.claim.claimKey}`,
      );
      continue;
    }

    for (const evidenceId of binding.evidenceIds) {
      if (!isNonEmptyString(evidenceId)) {
        reasons.push(
          `V714_EVIDENCE_ID_INVALID:${binding.claim.claimKey}`,
        );
        continue;
      }

      if (!evidenceIds.has(evidenceId)) {
        reasons.push(
          `V714_EVIDENCE_REFERENCE_UNRESOLVED:${binding.claim.claimKey}:${evidenceId}`,
        );
      }

      const evidence = findEvidence(
        input.evidence.evidence,
        evidenceId,
      );

      if (evidence) {
        if (!isNonEmptyString(evidence.sourceLocator)) {
          reasons.push(
            `V714_EVIDENCE_LOCATOR_MISSING:${evidenceId}`,
          );
        }

        if (!isNonEmptyString(evidence.contentHash)) {
          reasons.push(
            `V714_EVIDENCE_HASH_MISSING:${evidenceId}`,
          );
        }
      }
    }
  }

  /*
   * ------------------------------------------------------------
   * Evidence semantic-claim consistency
   * ------------------------------------------------------------
   */

  const evidenceClaimIds = new Set(
    input.evidence.semanticClaims.map(
      (claim) => String(claim.id),
    ),
  );

  for (const claimId of declaredClaimIds) {
    if (
      input.evidence.semanticClaims.length > 0 &&
      !evidenceClaimIds.has(claimId)
    ) {
      reasons.push(
        `V714_EVIDENCE_CLAIM_NOT_PRESENT:${claimId}`,
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * FAIL-CLOSED
   * ------------------------------------------------------------
   */

  if (reasons.length > 0) {
    return {
      ok: false,
      reasonCodes: [...new Set(reasons)],
    };
  }

  return {
    ok: true,
    checkedClaims: input.semanticClaimIds.length,
    checkedEvidence: input.evidence.evidence.length,
  };
}



