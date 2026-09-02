/** NEXMOLD V7.14 — single authoritative Regional Publish Artifact. */
import { createHash } from "node:crypto";
import { regionalPublishArtifactBrand, type CanonicalUrl, type ContentHash, type EligibleRegionalDecision, type HreflangProjection, type Locale, type PageId, type RegionalCompileInput, type RegionalPublishArtifact, type RegionalRouteProjection, type ClaimEvidenceBinding } from "./types.ts";
import type { V714FirewallPass } from "./epistemic-firewall.ts";
export const REGIONAL_PUBLISH_ARTIFACT_VERSION = "V7.14-PUBLISH-ARTIFACT-3" as const;

type ArtifactInput = { readonly input: RegionalCompileInput; readonly eligibility: EligibleRegionalDecision; readonly firewall: V714FirewallPass; readonly bindings: readonly ClaimEvidenceBinding[]; readonly canonicalUrl: CanonicalUrl; readonly hreflangSet: readonly Locale[] };
function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map(k => `${JSON.stringify(k)}:${stable(record[k])}`).join(",")}}`;
}
function hash(value: unknown): ContentHash { return createHash("sha256").update(stable(value), "utf8").digest("hex") as ContentHash; }
function assertArtifactInput(input: ArtifactInput): void {
  if (!input.firewall.ok) throw new Error("V714_ARTIFACT_FIREWALL_REQUIRED");
  if (input.eligibility.status !== "ELIGIBLE" || input.eligibility.applicability !== "APPLICABLE" || input.eligibility.compliance !== "VERIFIED") throw new Error("V714_ARTIFACT_ELIGIBILITY_REQUIRED");
  if (input.input.evidence.completeness !== "COMPLETE") throw new Error("V714_ARTIFACT_EVIDENCE_REQUIRED");
  if (input.input.semantic.pageId !== input.input.pageId || input.input.semantic.locale !== input.input.locale || input.input.semantic.region !== input.input.region) throw new Error("V714_ARTIFACT_SEMANTIC_IDENTITY_MISMATCH");
  if (!input.canonicalUrl.trim() || !input.hreflangSet.length) throw new Error("V714_ARTIFACT_CANONICAL_OR_HREFLANG_EMPTY");
  const claims = input.input.evidence.semanticClaims;
  if (!claims.length || input.bindings.length !== claims.length) throw new Error("V714_ARTIFACT_CLAIM_BINDING_MISMATCH");
  const claimIds = new Set(claims.map(String)); const bound = new Set<string>(); const evidenceIds = new Set(input.input.evidence.evidence.map(e => String(e.id)));
  for (const b of input.bindings) { const id = String(b.claim.id); if (!claimIds.has(id)) throw new Error(`V714_ARTIFACT_UNDECLARED_BINDING:${id}`); if (bound.has(id)) throw new Error(`V714_ARTIFACT_DUPLICATE_BINDING:${id}`); bound.add(id); if (!b.evidenceIds.length) throw new Error(`V714_ARTIFACT_BINDING_WITHOUT_EVIDENCE:${id}`); for (const e of b.evidenceIds) if (!evidenceIds.has(String(e))) throw new Error(`V714_ARTIFACT_UNRESOLVED_EVIDENCE:${e}`); }
  for (const id of claimIds) if (!bound.has(id)) throw new Error(`V714_ARTIFACT_MISSING_BINDING:${id}`);
}
export function createRegionalPublishArtifact(input: ArtifactInput): RegionalPublishArtifact {
  assertArtifactInput(input);
  const pageContentHash = hash({ version: REGIONAL_PUBLISH_ARTIFACT_VERSION, pageId: input.input.pageId, locale: input.input.locale, region: input.input.region, canonicalUrl: input.canonicalUrl, hreflangSet: [...input.hreflangSet], semanticClaims: input.input.evidence.semanticClaims, evidence: input.input.evidence.evidence, bindings: input.bindings });
  return Object.freeze({ [regionalPublishArtifactBrand]: "RegionalPublishArtifact" as const, pageId: input.input.pageId, locale: input.input.locale, region: input.input.region, canonicalUrl: input.canonicalUrl, hreflangSet: [...input.hreflangSet], seoEligibility: input.eligibility, evidence: input.input.evidence, bindings: input.bindings.map(b => ({ claim: b.claim, evidenceIds: [...b.evidenceIds] })), pageContentHash, contractVersion: REGIONAL_PUBLISH_ARTIFACT_VERSION });
}
export function projectRegionalRoute(artifact: RegionalPublishArtifact): RegionalRouteProjection { return Object.freeze({ pageId: artifact.pageId, locale: artifact.locale, region: artifact.region, canonicalUrl: artifact.canonicalUrl, contentHash: artifact.pageContentHash, artifact }); }
export function projectHreflang(pageId: PageId, sourceLocale: Locale, _region: RegionalPublishArtifact["region"], canonicalByLocale: ReadonlyMap<Locale, CanonicalUrl>): HreflangProjection { return Object.freeze({ pageId, edges: [...canonicalByLocale.entries()].map(([targetLocale, targetCanonicalUrl]) => ({ sourcePageId: pageId, sourceLocale, targetLocale, targetCanonicalUrl })) }); }
