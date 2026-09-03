/** NEXMOLD V7.15 — authoritative Regional Publish Artifact. */
import { createHash } from "node:crypto";
import { regionalPublishArtifactBrand, type CanonicalUrl, type ContentHash, type EligibleRegionalDecision, type HreflangProjection, type Locale, type PageId, type RegionalCompileInput, type RegionalPublishArtifact, type RegionalRouteProjection, type ClaimEvidenceBinding } from "./types.ts";
import type { V714FirewallPass } from "./epistemic-firewall.ts";

export const REGIONAL_PUBLISH_ARTIFACT_VERSION="V7.14-PUBLISH-ARTIFACT-3" as const;
type ArtifactInput={readonly input:RegionalCompileInput;readonly eligibility:EligibleRegionalDecision;readonly firewall:V714FirewallPass;readonly bindings:readonly ClaimEvidenceBinding[];readonly canonicalUrl:CanonicalUrl;readonly hreflangSet:readonly Locale[];};
function stable(value:unknown):string{if(value===null||typeof value!=="object")return JSON.stringify(value);if(Array.isArray(value))return `[${value.map(stable).join(",")}]`;const record=value as Record<string,unknown>;return `{${Object.keys(record).sort().map(key=>`${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;}
export function computeRegionalPublishArtifactHash(artifact:Pick<RegionalPublishArtifact,"pageId"|"locale"|"region"|"canonicalUrl"|"hreflangSet"|"evidence"|"bindings">):ContentHash{return createHash("sha256").update(stable({version:REGIONAL_PUBLISH_ARTIFACT_VERSION,pageId:artifact.pageId,locale:artifact.locale,region:artifact.region,canonicalUrl:artifact.canonicalUrl,hreflangSet:[...artifact.hreflangSet],semanticClaims:artifact.evidence.semanticClaims,evidence:artifact.evidence.evidence,bindings:artifact.bindings}),"utf8").digest("hex") as ContentHash;}
export function verifyRegionalPublishArtifactHash(artifact:Pick<RegionalPublishArtifact,"pageContentHash"|"pageId"|"locale"|"region"|"canonicalUrl"|"hreflangSet"|"evidence"|"bindings">):boolean{return artifact.pageContentHash===computeRegionalPublishArtifactHash(artifact);}
function assertArtifactInput(input:ArtifactInput):void{
  if(!input.firewall.ok)throw new Error("V714_ARTIFACT_FIREWALL_REQUIRED");
  if(input.eligibility.status!=="ELIGIBLE"||input.eligibility.applicability!=="APPLICABLE"||input.eligibility.compliance!=="VERIFIED")throw new Error("V714_ARTIFACT_ELIGIBILITY_REQUIRED");
  if(input.input.evidence.completeness!=="COMPLETE")throw new Error("V714_ARTIFACT_EVIDENCE_REQUIRED");
  if(input.input.semantic.pageId!==input.input.pageId||input.input.semantic.locale!==input.input.locale||input.input.semantic.region!==input.input.region)throw new Error("V714_ARTIFACT_SEMANTIC_IDENTITY_MISMATCH");
  const declaredClaimIds=input.input.evidence.semanticClaims.map(claim=>String(claim.id));const semanticClaimIds=input.input.semantic.semanticClaimIds.map(String);
  if(declaredClaimIds.length===0)throw new Error("V714_ARTIFACT_NO_DECLARED_CLAIMS");
  if(new Set(declaredClaimIds).size!==declaredClaimIds.length)throw new Error("V714_ARTIFACT_DUPLICATE_DECLARED_CLAIM");
  if(declaredClaimIds.length!==semanticClaimIds.length||declaredClaimIds.some(id=>!semanticClaimIds.includes(id)))throw new Error("V714_ARTIFACT_SEMANTIC_CLAIM_DECLARATION_MISMATCH");
  if(!input.canonicalUrl.trim()||input.hreflangSet.length===0)throw new Error("V714_ARTIFACT_CANONICAL_OR_HREFLANG_EMPTY");
  if(!input.hreflangSet.includes(input.input.locale))throw new Error("V715_ARTIFACT_SOURCE_LOCALE_MISSING");
  if(new Set(input.hreflangSet).size!==input.hreflangSet.length)throw new Error("V715_ARTIFACT_DUPLICATE_HREFLANG_LOCALE");
  const evidenceIds=new Set(input.input.evidence.evidence.map(evidence=>String(evidence.id)));if(evidenceIds.size!==input.input.evidence.evidence.length)throw new Error("V714_ARTIFACT_DUPLICATE_EVIDENCE");
  if(input.bindings.length!==declaredClaimIds.length)throw new Error("V714_ARTIFACT_CLAIM_BINDING_MISMATCH");
  const bound=new Set<string>();
  for(const binding of input.bindings){const id=String(binding.claim.id);if(!declaredClaimIds.includes(id))throw new Error(`V714_ARTIFACT_UNDECLARED_BINDING:${id}`);if(bound.has(id))throw new Error(`V714_ARTIFACT_DUPLICATE_BINDING:${id}`);if(binding.claim.claimKey.trim().length===0)throw new Error(`V714_ARTIFACT_EMPTY_CLAIM_KEY:${id}`);if(binding.evidenceIds.length===0)throw new Error(`V714_ARTIFACT_BINDING_WITHOUT_EVIDENCE:${id}`);for(const evidenceId of binding.evidenceIds)if(!evidenceIds.has(String(evidenceId)))throw new Error(`V714_ARTIFACT_UNRESOLVED_EVIDENCE:${String(evidenceId)}`);bound.add(id);}
  for(const id of declaredClaimIds)if(!bound.has(id))throw new Error(`V714_ARTIFACT_MISSING_BINDING:${id}`);
}
export function createRegionalPublishArtifact(input:ArtifactInput):RegionalPublishArtifact{assertArtifactInput(input);const artifactBase={pageId:input.input.pageId,locale:input.input.locale,region:input.input.region,canonicalUrl:input.canonicalUrl,hreflangSet:[...input.hreflangSet],evidence:input.input.evidence,bindings:input.bindings.map(binding=>Object.freeze({claim:binding.claim,evidenceIds:[...binding.evidenceIds]}))};const pageContentHash=computeRegionalPublishArtifactHash(artifactBase);return Object.freeze({[regionalPublishArtifactBrand]:"RegionalPublishArtifact" as const,...artifactBase,seoEligibility:input.eligibility,pageContentHash,contractVersion:REGIONAL_PUBLISH_ARTIFACT_VERSION});}
export function projectRegionalRoute(artifact:RegionalPublishArtifact):RegionalRouteProjection{return Object.freeze({pageId:artifact.pageId,locale:artifact.locale,region:artifact.region,canonicalUrl:artifact.canonicalUrl,contentHash:artifact.pageContentHash,artifact});}
export function projectHreflang(pageId:PageId,sourceLocale:Locale,_region:RegionalPublishArtifact["region"],canonicalByLocale:ReadonlyMap<Locale,CanonicalUrl>):HreflangProjection{return Object.freeze({pageId,edges:[...canonicalByLocale.entries()].map(([targetLocale,targetCanonicalUrl])=>Object.freeze({sourcePageId:pageId,sourceLocale,targetLocale,targetCanonicalUrl}))});}
