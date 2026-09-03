#!/usr/bin/env node
/**
 * NEXMOLD V7.15 — contract integration/adversarial matrix.
 * Run: node --experimental-strip-types tests/contracts/v715-integration.mjs
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT=process.env.NEXMOLD_ROOT?path.resolve(process.env.NEXMOLD_ROOT):process.cwd();
const regional=(file)=>import(`${pathToFileURL(path.join(ROOT,"src","regional",file)).href}?v715-test=${Date.now()}-${Math.random()}`);

function fixture(overrides={}){
  const pageId="v715-integration-fixture",locale="en-US",region="US";
  const claimId="claim:v715:integration",evidenceId="evidence:v715:integration";
  const canonical="https://nxmold.com/v715-integration-fixture/";
  const compileInput={
    pageId,locale,region,applicability:"APPLICABLE",compliance:"VERIFIED",
    semantic:{pageId,locale,region,semanticClaimIds:[claimId]},
    evidence:{
      evidence:[{id:evidenceId,sourceType:"test",sourceLocator:"v715://fixture",contentHash:"a".repeat(64)}],
      semanticClaims:[{id:claimId,claimKey:"v715.integration.fixture"}],
      completeness:"COMPLETE",
    },...overrides,
  };
  return {
    compileInput,
    bindings:[{claim:{id:claimId,claimKey:"v715.integration.fixture"},evidenceIds:[evidenceId]}],
    canonicalUrl:canonical, hreflangSet:[locale], canonicalByLocale:new Map([[locale,canonical]]),
  };
}
const blocked=(label,result)=>{
  assert.equal(result.published,false,`${label}: must block`);
  assert.equal(result.result,null,`${label}: blocked result must not leak`);
  assert.ok(result.reasonCodes.length>0,`${label}: reasonCodes`);
};

export async function runV715IntegrationGate(){
  const [compiler,eligibility,artifact,publicationGate,producer,preflight]=await Promise.all([
    regional("regionalCompiler.ts"),regional("eligibility.ts"),regional("regionalPublishArtifact.ts"),
    regional("publication-gate.ts"),regional("Producer.ts"),regional("releasePreflight.ts"),
  ]);

  for(const [name,mod,fn] of [
    ["compiler",compiler,"compileRegionalPage"],["eligibility",eligibility,"evaluateRegionalEligibility"],
    ["artifact",artifact,"createRegionalPublishArtifact"],["publicationGate",publicationGate,"runPublicationGate"],
    ["producer",producer,"runV714Producer"],["preflight",preflight,"runRegionalReleasePreflight"],
  ])assert.equal(typeof mod[fn],"function",`${name}: export`);

  const good=fixture();
  const expected=eligibility.evaluateRegionalEligibility(good.compileInput);
  assert.equal(expected.status,"ELIGIBLE");

  const compiled=compiler.compileRegionalPage(good);
  assert.equal(compiled.published,true);
  assert.ok(compiled.result.artifact&&compiled.result.route&&compiled.result.hreflang);

  const produced=producer.runV714Producer(good);
  assert.equal(produced.published,true);
  assert.equal(produced.result.artifact,compiled.result.artifact);

  const pass=preflight.runRegionalReleasePreflight(produced.result);
  assert.equal(pass.passed,true,"PASS path");
  assert.ok(pass.checks.every(c=>c.passed));

  // BLOCK path
  for(const [label,overrides] of [
    ["unknown-applicability",{applicability:"UNKNOWN"}],
    ["not-applicable",{applicability:"NOT_APPLICABLE"}],
    ["requires-review",{compliance:"REQUIRES_REVIEW"}],
    ["not-verified",{compliance:"NOT_VERIFIED"}],
    ["incomplete-evidence",{evidence:{...good.compileInput.evidence,completeness:"INCOMPLETE"}}],
  ]){
    const input=fixture(overrides);
    blocked(`${label}: compiler`,compiler.compileRegionalPage(input));
    blocked(`${label}: producer`,producer.runV714Producer(input));
  }

  // Producer boundary block
  blocked("identity: producer",producer.runV714Producer({
    ...good,canonicalUrl:"https://nxmold.com/wrong/",canonicalByLocale:new Map([[good.compileInput.locale,good.canonicalUrl]])
  }));
  blocked("hreflang: producer",producer.runV714Producer({
    ...good,hreflangSet:["en-US","de-DE"],canonicalByLocale:new Map([["en-US",good.canonicalUrl]])
  }));

  // PublicationGate identity mismatch with a recomputed, structurally valid artifact.
  const original=compiled.result.artifact;
  const mismatchedBase={...original,pageId:"v715-other-page"};
  const mismatched={...mismatchedBase,pageContentHash:artifact.computeRegionalPublishArtifactHash(mismatchedBase)};
  const identityGate=publicationGate.runPublicationGate({
    eligibility:compiled.result.eligibility,
    firewall:compiled.result.publicationAuthorization.firewall,
    artifact:mismatched,
  });
  assert.equal(identityGate.ok,false,"identity mismatch must block");
  assert.ok(identityGate.reasonCodes.includes("V714_ARTIFACT_PAGE_ID_MISMATCH"));

  // Tamper path: content is changed without changing the stored hash.
  const tampered={...original,evidence:{...original.evidence,semanticClaims:[...original.evidence.semanticClaims,{id:"claim:v715:tampered",claimKey:"tampered"}]}};
  const tamperedGate=publicationGate.runPublicationGate({
    eligibility:compiled.result.eligibility,firewall:compiled.result.publicationAuthorization.firewall,artifact:tampered,
  });
  assert.equal(tamperedGate.ok,false,"tamper must block");

  // Hash mismatch path.
  const hashMismatch={...original,pageContentHash:"0".repeat(64)};
  const hashGate=publicationGate.runPublicationGate({
    eligibility:compiled.result.eligibility,firewall:compiled.result.publicationAuthorization.firewall,artifact:hashMismatch,
  });
  assert.equal(hashGate.ok,false,"hash mismatch must block");
  assert.ok(hashGate.reasonCodes.includes("V714_ARTIFACT_HASH_INVALID"));

  // Hreflang mismatch path at release preflight.
  const badHreflang={...produced.result,hreflang:{
    ...produced.result.hreflang,
    edges:[{...produced.result.hreflang.edges[0],targetCanonicalUrl:"https://nxmold.com/tampered/"}],
  }};
  const hreflangPreflight=preflight.runRegionalReleasePreflight(badHreflang);
  assert.equal(hreflangPreflight.passed,false,"hreflang mismatch must block");
  assert.equal(hreflangPreflight.checks.find(c=>c.id==="hreflang-projection-integrity")?.passed,false);

  return Object.freeze({
    ok:true,status:"PASS",gate:"V715_INTEGRATION_GATE",
    architecture:"V7.14_SINGLE_PUBLICATION_ARCHITECTURE",
    matrix:["PASS path","BLOCK path","tamper path","identity mismatch","hash mismatch","hreflang mismatch"],
  });
}

if(import.meta.url===pathToFileURL(process.argv[1]).href){
  try{
    const result=await runV715IntegrationGate();
    console.log("[NEXMOLD][V7.15] PASS — Producer -> Compiler -> Artifact -> PublicationGate -> Route Projection -> Hreflang Projection -> ReleasePreflight");
    console.log("[NEXMOLD][V7.15] PASS — PASS/BLOCK/tamper/identity/hash/hreflang matrix verified");
  }catch(error){
    console.error(`[NEXMOLD][V7.15] FAIL — ${error instanceof Error?error.stack??error.message:String(error)}`);
    process.exitCode=1;
  }
}
