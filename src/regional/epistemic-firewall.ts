/** NEXMOLD V7.14 — Epistemic Firewall. Fail closed on claim/evidence boundary violations. */
import type {
  ClaimEvidenceBinding,
  EvidenceId,
  RegionalEvidenceSnapshot,
  SemanticClaimId,
} from "./types.ts";

export interface V714ClaimEvidenceBinding {
  readonly claim: ClaimEvidenceBinding["claim"];
  readonly evidenceIds: readonly string[];
}

export interface V714FirewallPass {
  readonly ok: true;
  readonly checkedClaims: number;
  readonly checkedEvidence: number;
  readonly reasonCodes: readonly string[];
}

export interface V714FirewallBlock {
  readonly ok: false;
  readonly checkedClaims: number;
  readonly checkedEvidence: number;
  readonly reasonCodes: readonly string[];
}

export type V714FirewallResult = V714FirewallPass | V714FirewallBlock;

export function runEpistemicFirewall(input: {
  readonly evidence: RegionalEvidenceSnapshot;
  readonly semanticClaimIds: readonly SemanticClaimId[];
  readonly bindings: readonly V714ClaimEvidenceBinding[];
}): V714FirewallResult {
  const reasons: string[] = [];
  const claimIds = new Set(input.semanticClaimIds.map(String));
  const evidenceIds = new Set(
    input.evidence.evidence.map((evidence) => String(evidence.id)),
  );
  const boundClaims = new Set<string>();

  if (input.evidence.completeness !== "COMPLETE") {
    reasons.push("V714_FIREWALL_EVIDENCE_INCOMPLETE");
  }

  if (input.semanticClaimIds.length === 0) {
    reasons.push("V714_FIREWALL_NO_SEMANTIC_CLAIMS");
  }

  if (input.bindings.length !== input.semanticClaimIds.length) {
    reasons.push("V714_FIREWALL_BINDING_CARDINALITY_MISMATCH");
  }

  for (const binding of input.bindings) {
    const claimId = String(binding.claim.id);

    if (!claimIds.has(claimId)) {
      reasons.push(`V714_FIREWALL_UNDECLARED_CLAIM:${claimId}`);
    }

    if (boundClaims.has(claimId)) {
      reasons.push(`V714_FIREWALL_DUPLICATE_CLAIM:${claimId}`);
    }

    boundClaims.add(claimId);

    if (binding.evidenceIds.length === 0) {
      reasons.push(`V714_FIREWALL_CLAIM_WITHOUT_EVIDENCE:${claimId}`);
    }

    for (const evidenceId of binding.evidenceIds) {
      const normalizedId = String(evidenceId).trim();
      if (!normalizedId) {
        reasons.push(`V714_FIREWALL_EMPTY_EVIDENCE_ID:${claimId}`);
      } else if (!evidenceIds.has(normalizedId)) {
        reasons.push(`V714_FIREWALL_UNRESOLVED_EVIDENCE:${normalizedId}`);
      }
    }
  }

  for (const claimId of claimIds) {
    if (!boundClaims.has(claimId)) {
      reasons.push(`V714_FIREWALL_MISSING_BINDING:${claimId}`);
    }
  }

  return reasons.length > 0
    ? {
        ok: false,
        checkedClaims: input.semanticClaimIds.length,
        checkedEvidence: input.evidence.evidence.length,
        reasonCodes: reasons,
      }
    : {
        ok: true,
        checkedClaims: input.semanticClaimIds.length,
        checkedEvidence: input.evidence.evidence.length,
        reasonCodes: [],
      };
}

export function normalizeFirewallBindings(
  bindings: readonly V714ClaimEvidenceBinding[],
): readonly ClaimEvidenceBinding[] {
  return bindings.map((binding) => ({
    claim: binding.claim,
    evidenceIds: binding.evidenceIds.map(
      (evidenceId) => String(evidenceId).trim() as EvidenceId,
    ),
  }));
}

export function assertFirewallPass(
  result: V714FirewallResult,
): asserts result is V714FirewallPass {
  if (!result.ok) {
    throw new Error(
      `V714_EPISTEMIC_FIREWALL_BLOCKED:${result.reasonCodes.join(",")}`,
    );
  }
}

export type { EvidenceId };
