#!/usr/bin/env node
/**
 * NEXMOLD V7.15 — mandatory integration gate.
 *
 * This gate deliberately exercises the existing V7.14 production boundary:
 * Producer -> RegionalCompiler -> Eligibility -> Firewall -> Artifact ->
 * PublicationGate -> Projection -> RegionalReleasePreflight.
 * It does not create a second publication architecture.
 */
import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const ROOT = process.env.NEXMOLD_ROOT ? path.resolve(process.env.NEXMOLD_ROOT) : process.cwd();
const regional = (file) => import(`${pathToFileURL(path.join(ROOT, "src", "regional", file)).href}?v715=${Date.now()}-${Math.random()}`);

function fixture(overrides = {}) {
  const pageId = "v715-integration-fixture";
  const locale = "en-US";
  const region = "US";
  const claimId = "claim:v715:integration";
  const evidenceId = "evidence:v715:integration";
  const canonical = "https://nxmold.com/v715-integration-fixture/";
  const compileInput = {
    pageId, locale, region,
    applicability: "APPLICABLE",
    compliance: "VERIFIED",
    semantic: { pageId, locale, region, semanticClaimIds: [claimId] },
    evidence: {
      evidence: [{ id: evidenceId, sourceType: "test", sourceLocator: "v715://fixture", contentHash: "a".repeat(64) }],
      semanticClaims: [{ id: claimId, claimKey: "v715.integration.fixture" }],
      completeness: "COMPLETE",
    },
    ...overrides,
  };
  return {
    compileInput,
    bindings: [{ claim: { id: claimId, claimKey: "v715.integration.fixture" }, evidenceIds: [evidenceId] }],
    canonicalUrl: canonical,
    hreflangSet: [locale],
    canonicalByLocale: new Map([[locale, canonical]]),
  };
}

function assertBlocked(label, result) {
  assert.equal(result.published, false, `${label}: published`);
  assert.equal(result.result, null, `${label}: result leaked`);
  assert.ok(Array.isArray(result.reasonCodes), `${label}: reasonCodes missing`);
}

export async function runV715IntegrationGate() {
  const [compiler, eligibility, artifact, publicationGate, producer, preflight] = await Promise.all([
    regional("regionalCompiler.ts"),
    regional("eligibility.ts"),
    regional("regionalPublishArtifact.ts"),
    regional("publication-gate.ts"),
    regional("Producer.ts"),
    regional("releasePreflight.ts"),
  ]);

  assert.equal(typeof compiler.compileRegionalPage, "function");
  assert.equal(typeof eligibility.evaluateRegionalEligibility, "function");
  assert.equal(typeof artifact.createRegionalPublishArtifact, "function");
  assert.equal(typeof publicationGate.runPublicationGate, "function");
  assert.equal(typeof producer.runV714Producer, "function");
  assert.equal(typeof preflight.runRegionalReleasePreflight, "function");

  const good = fixture();
  const expectedEligibility = eligibility.evaluateRegionalEligibility(good.compileInput);
  assert.equal(expectedEligibility.status, "ELIGIBLE");

  const compiled = compiler.compileRegionalPage(good);
  assert.equal(compiled.published, true);
  assert.ok(compiled.result);
  assert.equal(compiled.result.eligibility.status, expectedEligibility.status);
  assert.ok(compiled.result.artifact);
  assert.ok(compiled.result.route);
  assert.ok(compiled.result.hreflang);

  const produced = producer.runV714Producer(good);
  assert.equal(produced.published, true, "Producer must publish the golden path");
  assert.ok(produced.result);
  assert.equal(produced.result.artifact, compiled.result.artifact);

  const preflightResult = preflight.runRegionalReleasePreflight(produced.result);
  assert.equal(preflightResult.passed, true, "Regional release preflight must pass published result");
  assert.ok(preflightResult.checks.every((check) => check.passed), "All preflight checks must pass");

  for (const [label, overrides] of [
    ["unknown-applicability", { applicability: "UNKNOWN" }],
    ["not-applicable", { applicability: "NOT_APPLICABLE" }],
    ["requires-review", { compliance: "REQUIRES_REVIEW" }],
    ["not-verified", { compliance: "NOT_VERIFIED" }],
    ["incomplete-evidence", { evidence: { ...good.compileInput.evidence, completeness: "INCOMPLETE" } }],
  ]) {
    const input = fixture(overrides);
    const expected = eligibility.evaluateRegionalEligibility(input.compileInput);
    assert.notEqual(expected.status, "ELIGIBLE", `${label}: eligibility unexpectedly eligible`);
    const compiledBlocked = compiler.compileRegionalPage(input);
    assertBlocked(`${label}: compiler`, compiledBlocked);
    assert.equal(compiledBlocked.result, null);
    const producedBlocked = producer.runV714Producer(input);
    assertBlocked(`${label}: producer`, producedBlocked);
    assert.equal(producedBlocked.result, null);
  }

  const missingBinding = { ...good, bindings: [] };
  const missingBindingCompiled = compiler.compileRegionalPage(missingBinding);
  assertBlocked("missing-binding: compiler", missingBindingCompiled);
  const missingBindingProduced = producer.runV714Producer(missingBinding);
  assertBlocked("missing-binding: producer", missingBindingProduced);

  const unresolvedEvidence = {
    ...good,
    bindings: [{ claim: { id: "claim:v715:integration", claimKey: "v715.integration.fixture" }, evidenceIds: ["evidence:does-not-exist"] }],
  };
  const unresolvedProduced = producer.runV714Producer(unresolvedEvidence);
  assertBlocked("unresolved-evidence: producer", unresolvedProduced);

  return Object.freeze({
    ok: true,
    status: "PASS",
    gate: "V715_INTEGRATION_GATE",
    architecture: "V7.14_SINGLE_PUBLICATION_ARCHITECTURE",
    producer: "PASS",
    compiler: "PASS",
    eligibility: "PASS",
    artifact: "PASS",
    publicationGate: "PASS",
    projection: "PASS",
    releasePreflight: "PASS",
    blockedCases: 7,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runV715IntegrationGate();
    console.log("[NEXMOLD][V7.15] PASS — mandatory Producer -> Compiler -> Artifact -> Publication Gate -> Projection chain verified");
    console.log(`[NEXMOLD][V7.15] PASS — RegionalReleasePreflight verified; blocked cases=${result.blockedCases}`);
  } catch (error) {
    console.error(`[NEXMOLD][V7.15] FAIL — ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}
