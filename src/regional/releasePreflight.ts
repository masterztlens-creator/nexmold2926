/** NEXMOLD V7.15 — Regional release preflight. */
import type { V714RegionalCompilerPublished } from "./regionalCompiler.ts";
import { runPublicationGate, validateRegionalPublishArtifactRuntime } from "./publication-gate.ts";
import type { RegionalEligibilityDecision } from "./types.ts";

export type RegionalPublishedCompileResult = V714RegionalCompilerPublished["result"];

export interface RegionalReleasePreflightResult {
  readonly passed: boolean;
  readonly checks: readonly { readonly id:string; readonly passed:boolean }[];
}

function validateRouteProjection(result:RegionalPublishedCompileResult):boolean{
  const {artifact,route}=result;
  if(artifact===null||route===null)return result.eligibility.status!=="ELIGIBLE";
  return route.artifact===artifact &&
    route.pageId===artifact.pageId &&
    route.locale===artifact.locale &&
    route.region===artifact.region &&
    route.canonicalUrl===artifact.canonicalUrl &&
    route.contentHash===artifact.pageContentHash;
}

function validateHreflangProjection(result:RegionalPublishedCompileResult):boolean{
  const {artifact,hreflang}=result;
  if(artifact===null||hreflang===null)return result.eligibility.status!=="ELIGIBLE";
  if(hreflang.pageId!==artifact.pageId)return false;
  if(hreflang.edges.length!==artifact.hreflangSet.length)return false;
  const allowed=new Set(artifact.hreflangSet.map(String));
  const seen=new Set<string>();
  for(const edge of hreflang.edges){
    if(edge.sourcePageId!==artifact.pageId||edge.sourceLocale!==artifact.locale)return false;
    if(!allowed.has(String(edge.targetLocale))||seen.has(String(edge.targetLocale)))return false;
    if(typeof edge.targetCanonicalUrl!=="string"||edge.targetCanonicalUrl.trim().length===0)return false;
    seen.add(String(edge.targetLocale));
  }
  return seen.size===allowed.size;
}

export function runRegionalReleasePreflight(result:RegionalPublishedCompileResult):RegionalReleasePreflightResult{
  const artifact=result.artifact;
  const route=result.route;
  const hreflang=result.hreflang;
  const authorization=result.publicationAuthorization;

  const publicationRevalidated=
    artifact!==null &&
    authorization!==undefined &&
    authorization.eligibility===result.eligibility &&
    authorization.firewall!==undefined &&
    runPublicationGate({
      eligibility:authorization.eligibility as RegionalEligibilityDecision,
      firewall:authorization.firewall,
      artifact,
    });

  const checks=[
    {id:"eligibility-present",passed:Boolean(result.eligibility)},
    {id:"eligible-status",passed:result.eligibility.status==="ELIGIBLE"},
    {id:"publication-authorization-present",passed:Boolean(authorization)},
    {id:"publication-gate-passed",passed:Boolean(authorization?.publication?.ok===true)},
    {id:"publication-gate-revalidated",passed:Boolean(publicationRevalidated?.ok===true)},
    {id:"authorization-eligibility-identity",passed:Boolean(authorization&&authorization.eligibility===result.eligibility)},
    {id:"authorized-artifact-identity",passed:Boolean(authorization&&authorization.publication?.ok===true&&authorization.publication.artifact===artifact)},
    {id:"artifact-runtime-valid",passed:artifact===null||validateRegionalPublishArtifactRuntime(artifact)},
    {id:"artifact-present-for-eligible",passed:result.eligibility.status!=="ELIGIBLE"||artifact!==null},
    {id:"route-present-for-eligible",passed:result.eligibility.status!=="ELIGIBLE"||route!==null},
    {id:"hreflang-present-for-eligible",passed:result.eligibility.status!=="ELIGIBLE"||hreflang!==null},
    {id:"artifact-route-identity",passed:validateRouteProjection(result)},
    {id:"artifact-hash-identity",passed:artifact===null||route===null||artifact.pageContentHash===route.contentHash},
    {id:"artifact-canonical-identity",passed:artifact===null||route===null||artifact.canonicalUrl===route.canonicalUrl},
    {id:"hreflang-projection-integrity",passed:validateHreflangProjection(result)},
    {id:"blocked-has-zero-public-projections",passed:result.eligibility.status==="ELIGIBLE"||(artifact===null&&route===null&&hreflang===null)},
  ];
  return Object.freeze({passed:checks.every(check=>check.passed),checks});
}
