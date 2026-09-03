/** NEXMOLD V7.15 — canonical Regional Compiler adapter. */
import { evaluateRegionalEligibility } from "./eligibility.ts";
import { runEpistemicFirewall, normalizeFirewallBindings, type V714ClaimEvidenceBinding, type V714FirewallPass } from "./epistemic-firewall.ts";
import { createRegionalPublishArtifact, projectHreflang, projectRegionalRoute } from "./regionalPublishArtifact.ts";
import { runPublicationGate, type V714PublicationGatePass } from "./publication-gate.ts";
import type { CanonicalUrl, EligibleRegionalDecision, RegionalCompileInput, RegionalCompileResult } from "./types.ts";

export interface V714RegionalCompilerInput { readonly compileInput:RegionalCompileInput; readonly bindings:readonly V714ClaimEvidenceBinding[]; readonly canonicalUrl:CanonicalUrl; readonly hreflangSet:readonly RegionalCompileInput["locale"][]; readonly canonicalByLocale:ReadonlyMap<RegionalCompileInput["locale"],CanonicalUrl>; }
export interface V714PublicationAuthorization { readonly eligibility:EligibleRegionalDecision; readonly firewall:V714FirewallPass; readonly publication:V714PublicationGatePass; }
export interface V714RegionalCompilerBlocked { readonly published:false; readonly result:RegionalCompileResult; readonly reasonCodes:readonly string[]; }
export interface V714RegionalCompilerPublished { readonly published:true; readonly result:RegionalCompileResult & {readonly publicationAuthorization:V714PublicationAuthorization}; }
export type V714RegionalCompilerResult=V714RegionalCompilerPublished|V714RegionalCompilerBlocked;

function blocked(eligibility:RegionalCompileResult["eligibility"],reasonCodes:readonly string[]):V714RegionalCompilerBlocked{return{published:false,result:{eligibility,artifact:null,route:null,hreflang:null},reasonCodes:[...new Set(reasonCodes)]};}
function nonEmptyString(value:unknown):value is string{return typeof value==="string"&&value.trim().length>0;}

/**
 * Compiler-level publication boundary. Producer validates this too, but the
 * compiler must remain fail-closed when called directly by another adapter.
 */
function validateProjectionBoundary(input:V714RegionalCompilerInput):string[]{
  const reasons:string[]=[];
  const declared=new Set(input.hreflangSet.map(String));
  const mapEntries=[...input.canonicalByLocale.entries()];
  const mapLocales=new Set(mapEntries.map(([locale])=>String(locale)));
  if(input.hreflangSet.length===0)reasons.push("V715_COMPILER_HREFLANG_SET_EMPTY");
  if(declared.size!==input.hreflangSet.length)reasons.push("V715_COMPILER_HREFLANG_SET_DUPLICATE");
  if(!declared.has(String(input.compileInput.locale)))reasons.push("V715_COMPILER_HREFLANG_SOURCE_LOCALE_MISSING");
  if(mapLocales.size!==mapEntries.length||mapEntries.length!==declared.size||[...mapLocales].some(locale=>!declared.has(locale)))reasons.push("V715_COMPILER_CANONICAL_MAP_SET_MISMATCH");
  const sourceCanonical=input.canonicalByLocale.get(input.compileInput.locale);
  if(!nonEmptyString(input.canonicalUrl)||sourceCanonical!==input.canonicalUrl)reasons.push("V715_COMPILER_SOURCE_CANONICAL_MISMATCH");
  for(const locale of input.hreflangSet){
    const url=input.canonicalByLocale.get(locale);
    if(!nonEmptyString(url))reasons.push(`V715_COMPILER_HREFLANG_CANONICAL_MISSING:${String(locale)}`);
  }
  return [...new Set(reasons)];
}

export function compileRegionalPage(input:V714RegionalCompilerInput):V714RegionalCompilerResult{
  if(!input)throw new Error("V714_REGIONAL_COMPILER_INPUT_REQUIRED");
  const eligibility=evaluateRegionalEligibility(input.compileInput);
  if(eligibility.status!=="ELIGIBLE")return blocked(eligibility,eligibility.reasonCodes);

  const projectionBoundary=validateProjectionBoundary(input);
  if(projectionBoundary.length)return blocked(eligibility,projectionBoundary);

  const firewall=runEpistemicFirewall({evidence:input.compileInput.evidence,semanticClaimIds:input.compileInput.semantic.semanticClaimIds,bindings:input.bindings});
  if(!firewall.ok)return blocked(eligibility,firewall.reasonCodes);

  const artifactBindings=normalizeFirewallBindings(input.bindings);
  let artifact;
  try{
    artifact=createRegionalPublishArtifact({input:input.compileInput,eligibility,firewall,bindings:artifactBindings,canonicalUrl:input.canonicalUrl,hreflangSet:input.hreflangSet});
  }catch(error){
    return blocked(eligibility,[`V715_ARTIFACT_CREATION_FAILED:${error instanceof Error?error.message:String(error)}`]);
  }
  const publication=runPublicationGate({eligibility,firewall,artifact});
  if(!publication.ok)return blocked(eligibility,publication.reasonCodes);
  const publishedArtifact=publication.artifact;
  return{published:true,result:{eligibility,artifact:publishedArtifact,route:projectRegionalRoute(publishedArtifact),hreflang:projectHreflang(publishedArtifact.pageId,publishedArtifact.locale,publishedArtifact.region,input.canonicalByLocale),publicationAuthorization:{eligibility,firewall,publication}}};
}
