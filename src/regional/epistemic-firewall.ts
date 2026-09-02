/** NEXMOLD V7.14 — Epistemic Firewall. Fail closed on claim/evidence boundary violations. */
import type { ClaimEvidenceBinding, EvidenceId, RegionalEvidenceSnapshot, SemanticClaimId } from "./types.ts";

export type V714ClaimEvidenceBinding = ClaimEvidenceBinding;
export interface V714FirewallPass { readonly ok: true; readonly checkedClaims: number; readonly checkedEvidence: number; readonly reasonCodes: readonly string[]; }
export interface V714FirewallBlock { readonly ok: false; readonly checkedClaims: number; readonly checkedEvidence: number; readonly reasonCodes: readonly string[]; }
export type V714FirewallResult = V714FirewallPass | V714FirewallBlock;

export function runEpistemicFirewall(input: {
  readonly evidence: RegionalEvidenceSnapshot;
  readonly semanticClaimIds: readonly SemanticClaimId[];
  readonly bindings: readonly V714ClaimEvidenceBinding[];
}): V714FirewallResult {
  const reasons: string[] = [];
  const claimIds = new Set(input.semanticClaimIds.map(String));
  const evidenceIds = new Set(input.evidence.evidence.map(e => String(e.id)));
  const boundClaims = new Set<string>();

  if (input.evidence.completeness !== "COMPLETE") reasons.push("V714_FIREWALL_EVIDENCE_INCOMPLETE");
  if (!input.semanticClaimIds.length) reasons.push("V714_FIREWALL_NO_SEMANTIC_CLAIMS");
  if (input.bindings.length !== input.semanticClaimIds.length) reasons.push("V714_FIREWALL_BINDING_CARDINALITY_MISMATCH");

  for (const binding of input.bindings) {
    const claimId = String(binding.claim.id);
    if (!claimIds.has(claimId)) reasons.push(`V714_FIREWALL_UNDECLARED_CLAIM:${claimId}`);
    if (boundClaims.has(claimId)) reasons.push(`V714_FIREWALL_DUPLICATE_CLAIM:${claimId}`);
    boundClaims.add(claimId);
    if (!binding.evidenceIds.length) reasons.push(`V714_FIREWALL_CLAIM_WITHOUT_EVIDENCE:${claimId}`);
    for (const evidenceId of binding.evidenceIds) {
      if (!evidenceIds.has(String(evidenceId))) reasons.push(`V714_FIREWALL_UNRESOLVED_EVIDENCE:${evidenceId}`);
    }
  }
  for (const claimId of claimIds) if (!boundClaims.has(claimId)) reasons.push(`V714_FIREWALL_MISSING_BINDING:${claimId}`);

  return reasons.length
    ? { ok: false, checkedClaims: input.semanticClaimIds.length, checkedEvidence: input.evidence.evidence.length, reasonCodes: reasons }
    : { ok: true, checkedClaims: input.semanticClaimIds.length, checkedEvidence: input.evidence.evidence.length, reasonCodes: [] };
}

export function assertFirewallPass(result: V714FirewallResult): asserts result is V714FirewallPass {
  if (!result.ok) throw new Error(`V714_EPISTEMIC_FIREWALL_BLOCKED:${result.reasonCodes.join(",")}`);
}

export type { EvidenceId };
