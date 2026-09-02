/**
 * NEXMOLD V7.14 — Regional Publish Artifact Factory
 * Fail closed. The artifact is the single persisted publication source.
 */
import { createHash } from "node:crypto";
import type {
  CanonicalUrl, ContentHash, EligibleRegionalDecision, HreflangProjection,
  Locale, PageId, RegionalCompileInput, RegionalPublishArtifact,
  RegionalRouteProjection,
} from "./types.ts";
import { regionalPublishArtifactBrand } from "./types.ts";
import type { ClaimEvidenceBinding } from "./types.ts";
import type { V714FirewallPass } from "./epistemic-firewall.ts";

export const REGIONAL_PUBLISH_ARTIFACT_VERSION = "V7.14-PUBLISH-ARTIFACT-2" as const;

type ArtifactInput = {
  readonly input: RegionalCompileInput;
  readonly eligibility: EligibleRegionalDecision;
  readonly firewall: V714FirewallPass;
  readonly bindings: readonly ClaimEvidenceBinding[];
  readonly canonicalUrl: CanonicalUrl;
  readonly hreflangSet: readonly Locale[];
};

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${stable(record[k])}`).join(",")}}`;
}
function hash(value: unknown): ContentHash {
  return createHash("sha256").update(stable(value), "utf8").digest("hex") as ContentHash;
}

function assertEligible(input: ArtifactInput): void {
  if (!input.firewall.ok) throw new Error("V714_ARTIFACT_FIREWALL_REQUIRED");
  if (input.eligibility.status !== "ELIGIBLE") throw new Error("V714_ARTIFACT_ELIGIBILITY_REQUIRED");
  if (input.eligibility.applicability !== "APPLICABLE") throw new Error("V714_ARTIFACT_APPLICABILITY_REQUIRED");
  if (input.eligibility.compliance !== "VERIFIED") throw new Error("V714_ARTIFACT_COMPLIANCE_REQUIRED");
  if (input.eligibility.evidence.completeness !== "COMPLETE") throw new Error("V714_ARTIFACT_EVIDENCE_REQUIRED");
  if (input.input.semantic.pageId !== input.input.pageId) throw new Error("V714_ARTIFACT_PAGE_ID_MISMATCH");
  if (input.input.semantic.locale !== input.input.locale) throw new Error("V714_ARTIFACT_LOCALE_MISMATCH");
  if (input.input.semantic.region !== input.input.region) throw new Error("V714_ARTIFACT_REGION_MISMATCH");
  if (!input.canonicalUrl.trim()) throw new Error("V714_ARTIFACT_CANONICAL_URL_EMPTY");
  if (!input.hreflangSet.length) throw new Error("V714_ARTIFACT_HREFLANG_EMPTY");

  const claims = input.input.evidence.semanticClaims;
  if (!claims.length) throw new Error("V714_ARTIFACT_SEMANTIC_CLAIMS_EMPTY");
  if (input.bindings.length !== claims.length) throw new Error("V714_ARTIFACT_BINDING_CARDINALITY_MISMATCH");

  const claimIds = new Set(claims.map(x => String(x.id)));
  const bindingIds = new Set<string>();
  for (const binding of input.bindings) {
    const claimId = String(binding.claim.id);
    if (!claimIds.has(claimId)) throw new Error(`V714_ARTIFACT_UNDECLARED_BINDING:${claimId}`);
    if (bindingIds.has(claimId)) throw new Error(`V714_ARTIFACT_DUPLICATE_BINDING:${claimId}`);
    bindingIds.add(claimId);
    if (!binding.evidenceIds.length) throw new Error(`V714_ARTIFACT_BINDING_WITHOUT_EVIDENCE:${claimId}`);
  }
  for (const claim of claims) {
    if (!bindingIds.has(String(claim.id))) throw new Error(`V714_ARTIFACT_MISSING_BINDING:${claim.id}`);
  }

  const evidenceIds = new Set(input.input.evidence.evidence.map(x => String(x.id)));
  for (const binding of input.bindings) {
    for (const id of binding.evidenceIds) {
      if (!evidenceIds.has(String(id))) throw new Error(`V714_ARTIFACT_UNRESOLVED_EVIDENCE:${id}`);
    }
  }
}

export function createRegionalPublishArtifact(input: ArtifactInput): RegionalPublishArtifact {
  assertEligible(input);

  const pageContentHash = hash({
    version: REGIONAL_PUBLISH_ARTIFACT_VERSION,
    pageId: input.input.pageId,
    locale: input.input.locale,
    region: input.input.region,
    canonicalUrl: input.canonicalUrl,
    hreflangSet: [...input.hreflangSet],
    semanticClaims: input.input.evidence.semanticClaims,
    evidence: input.input.evidence.evidence.map(e => ({
      id: e.id, sourceType: e.sourceType, sourceLocator: e.sourceLocator,
      contentHash: e.contentHash,
    })),
    bindings: input.bindings.map(b => ({
      claimId: b.claim.id,
      claimKey: b.claim.claimKey,
      evidenceIds: [...b.evidenceIds],
    })),
  });

  return Object.freeze({
    [regionalPublishArtifactBrand]: "RegionalPublishArtifact" as const,
    pageId: input.input.pageId,
    locale: input.input.locale,
    region: input.input.region,
    canonicalUrl: input.canonicalUrl,
    hreflangSet: [...input.hreflangSet],
    seoEligibility: input.eligibility,
    evidence: input.input.evidence,
    bindings: input.bindings.map(b => ({ claim: b.claim, evidenceIds: [...b.evidenceIds] })),
    pageContentHash,
  });
}

export function projectRegionalRoute(artifact: RegionalPublishArtifact): RegionalRouteProjection {
  return Object.freeze({
    pageId: artifact.pageId, locale: artifact.locale, region: artifact.region,
    canonicalUrl: artifact.canonicalUrl, contentHash: artifact.pageContentHash, artifact,
  });
}

export function projectHreflang(
  pageId: PageId, sourceLocale: Locale, _region: RegionalPublishArtifact["region"],
  canonicalByLocale: ReadonlyMap<Locale, CanonicalUrl>,
): HreflangProjection {
  return Object.freeze({
    pageId,
    edges: [...canonicalByLocale.entries()].map(([targetLocale, targetCanonicalUrl]) => ({
      sourcePageId: pageId, sourceLocale, targetLocale, targetCanonicalUrl,
    })),
  });
}
