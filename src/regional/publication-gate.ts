/**
 * NEXMOLD V7.14 — fail-closed Publication Gate.
 * The gate never creates, mutates, discovers, or projects an artifact.
 */
import type {
  EligibleRegionalDecision,
  RegionalEligibilityDecision,
  RegionalPublishArtifact,
} from "./types.ts";
import type { V714FirewallPass } from "./epistemic-firewall.ts";

export interface V714PublicationGateInput {
  readonly eligibility: RegionalEligibilityDecision;
  readonly firewall: V714FirewallPass;
  readonly artifact: RegionalPublishArtifact | null;
}

export interface V714PublicationGatePass {
  readonly ok: true;
  readonly artifact: RegionalPublishArtifact;
}

export interface V714PublicationGateBlock {
  readonly ok: false;
  readonly reasonCodes: readonly string[];
}

export type V714PublicationGateResult =
  | V714PublicationGatePass
  | V714PublicationGateBlock;

export const V714PublicationGateReason = Object.freeze({
  FIREWALL_NOT_PASSED: "V714_FIREWALL_NOT_PASSED",
  ELIGIBILITY_NOT_ELIGIBLE: "V714_ELIGIBILITY_NOT_ELIGIBLE",
  APPLICABILITY_NOT_APPLICABLE: "V714_APPLICABILITY_NOT_APPLICABLE",
  COMPLIANCE_NOT_VERIFIED: "V714_COMPLIANCE_NOT_VERIFIED",
  EVIDENCE_NOT_COMPLETE: "V714_EVIDENCE_NOT_COMPLETE",
  ARTIFACT_ABSENT: "V714_PUBLIC_ARTIFACT_ABSENT",
  ARTIFACT_INVALID: "V714_PUBLIC_ARTIFACT_INVALID",
  ARTIFACT_CONTRACT_VERSION: "V714_ARTIFACT_CONTRACT_VERSION_INVALID",
  ARTIFACT_PAGE_ID_MISMATCH: "V714_ARTIFACT_PAGE_ID_MISMATCH",
  ARTIFACT_LOCALE_MISMATCH: "V714_ARTIFACT_LOCALE_MISMATCH",
  ARTIFACT_REGION_MISMATCH: "V714_ARTIFACT_REGION_MISMATCH",
  ARTIFACT_CANONICAL_MISSING: "V714_ARTIFACT_CANONICAL_MISSING",
  ARTIFACT_HREFLANG_EMPTY: "V714_ARTIFACT_HREFLANG_EMPTY",
  ARTIFACT_HASH_INVALID: "V714_ARTIFACT_HASH_INVALID",
  ARTIFACT_ELIGIBILITY_MISMATCH: "V714_ARTIFACT_ELIGIBILITY_MISMATCH",
  ARTIFACT_CLAIM_LINEAGE_INVALID: "V714_ARTIFACT_CLAIM_LINEAGE_INVALID",
  ARTIFACT_EVIDENCE_LINEAGE_INVALID: "V714_ARTIFACT_EVIDENCE_LINEAGE_INVALID",
} as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function nonEmptyArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value) && value.length > 0;
}

export function validateRegionalPublishArtifactRuntime(
  artifact: unknown,
): artifact is RegionalPublishArtifact {
  if (!isRecord(artifact)) return false;
  if (!nonEmptyString(artifact.pageId)) return false;
  if (!nonEmptyString(artifact.locale)) return false;
  if (!nonEmptyString(artifact.region)) return false;
  if (!nonEmptyString(artifact.canonicalUrl)) return false;
  if (!nonEmptyArray(artifact.hreflangSet)) return false;
  if (!nonEmptyString(artifact.pageContentHash)) return false;
  if (!/^[a-f0-9]{64}$/i.test(artifact.pageContentHash)) return false;
  if (artifact.contractVersion !== "V7.14-PUBLISH-ARTIFACT-3") return false;
  if (!isRecord(artifact.seoEligibility)) return false;
  if (!isRecord(artifact.evidence)) return false;
  if (!Array.isArray(artifact.evidence.evidence)) return false;
  if (!Array.isArray(artifact.evidence.semanticClaims)) return false;
  if (artifact.evidence.completeness !== "COMPLETE") return false;
  if (!Array.isArray(artifact.bindings)) return false;
  if (artifact.bindings.length !== artifact.evidence.semanticClaims.length) return false;

  const claimIds = artifact.evidence.semanticClaims.map((claim) =>
    isRecord(claim) ? String(claim.id ?? "") : "",
  );
  if (claimIds.some((id) => !id) || new Set(claimIds).size !== claimIds.length) return false;

  const evidenceIds = new Set(
    artifact.evidence.evidence.map((item) =>
      isRecord(item) ? String(item.id ?? "") : "",
    ),
  );
  if (evidenceIds.has("") || evidenceIds.size !== artifact.evidence.evidence.length) return false;

  const bound = new Set<string>();
  for (const rawBinding of artifact.bindings) {
    if (!isRecord(rawBinding) || !isRecord(rawBinding.claim)) return false;
    const claimId = String(rawBinding.claim.id ?? "");
    if (!claimIds.includes(claimId) || bound.has(claimId)) return false;
    if (!Array.isArray(rawBinding.evidenceIds) || rawBinding.evidenceIds.length === 0) return false;
    for (const evidenceId of rawBinding.evidenceIds) {
      if (!evidenceIds.has(String(evidenceId))) return false;
    }
    bound.add(claimId);
  }
  return claimIds.every((id) => bound.has(id));
}

function identityReasons(
  artifact: RegionalPublishArtifact,
  eligibility: RegionalEligibilityDecision,
): string[] {
  const reasons: string[] = [];
  if (artifact.pageId !== eligibility.pageId) reasons.push(V714PublicationGateReason.ARTIFACT_PAGE_ID_MISMATCH);
  if (artifact.locale !== eligibility.locale) reasons.push(V714PublicationGateReason.ARTIFACT_LOCALE_MISMATCH);
  if (artifact.region !== eligibility.region) reasons.push(V714PublicationGateReason.ARTIFACT_REGION_MISMATCH);
  return reasons;
}

function eligibilityReasons(
  artifact: RegionalPublishArtifact,
  eligibility: EligibleRegionalDecision,
): string[] {
  const embedded = artifact.seoEligibility;
  if (
    embedded.pageId !== eligibility.pageId ||
    embedded.locale !== eligibility.locale ||
    embedded.region !== eligibility.region ||
    embedded.status !== eligibility.status ||
    embedded.applicability !== eligibility.applicability ||
    embedded.compliance !== eligibility.compliance ||
    embedded.evidence.completeness !== eligibility.evidence.completeness
  ) {
    return [V714PublicationGateReason.ARTIFACT_ELIGIBILITY_MISMATCH];
  }
  return [];
}

export function runPublicationGate(
  input: V714PublicationGateInput,
): V714PublicationGateResult {
  const reasons: string[] = [];

  if (!input.firewall?.ok) reasons.push(V714PublicationGateReason.FIREWALL_NOT_PASSED);

  const eligibility = input.eligibility;
  if (eligibility.status !== "ELIGIBLE") {
    reasons.push(`${V714PublicationGateReason.ELIGIBILITY_NOT_ELIGIBLE}:${eligibility.status}`);
  }
  if (eligibility.applicability !== "APPLICABLE") reasons.push(V714PublicationGateReason.APPLICABILITY_NOT_APPLICABLE);
  if (eligibility.compliance !== "VERIFIED") reasons.push(V714PublicationGateReason.COMPLIANCE_NOT_VERIFIED);
  if (eligibility.evidence.completeness !== "COMPLETE") reasons.push(V714PublicationGateReason.EVIDENCE_NOT_COMPLETE);

  if (input.artifact === null) {
    reasons.push(V714PublicationGateReason.ARTIFACT_ABSENT);
  } else if (!validateRegionalPublishArtifactRuntime(input.artifact)) {
    reasons.push(V714PublicationGateReason.ARTIFACT_INVALID);
  } else {
    reasons.push(...identityReasons(input.artifact, eligibility));
    reasons.push(...eligibilityReasons(input.artifact, eligibility));
    if (!nonEmptyString(input.artifact.canonicalUrl)) reasons.push(V714PublicationGateReason.ARTIFACT_CANONICAL_MISSING);
    if (!nonEmptyArray(input.artifact.hreflangSet)) reasons.push(V714PublicationGateReason.ARTIFACT_HREFLANG_EMPTY);
    if (!/^[a-f0-9]{64}$/i.test(input.artifact.pageContentHash)) reasons.push(V714PublicationGateReason.ARTIFACT_HASH_INVALID);
  }

  if (reasons.length > 0) {
    return { ok: false, reasonCodes: [...new Set(reasons)] };
  }

  return { ok: true, artifact: input.artifact as RegionalPublishArtifact };
}
