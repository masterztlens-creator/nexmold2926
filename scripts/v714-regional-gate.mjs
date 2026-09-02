#!/usr/bin/env node
/**
 * NEXMOLD V7.14 — Canonical Regional Production Gate
 *
 * This is the missing runtime wiring between the V7.14 regional contracts
 * and the production orchestrator.
 *
 * It executes the REAL source modules under src/regional/ and proves:
 *   Evidence -> Claim Binding -> Eligibility -> Epistemic Firewall
 *   -> RegionalPublishArtifact -> Publication Gate -> Projection
 *
 * The gate is deliberately fixture-based. It does not discover, invent,
 * rewrite, or publish site content. It proves that the production boundary
 * is executable and fail-closed before Astro build starts.
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

function fail(message) {
  throw new Error(`[V714_REGIONAL_GATE] ${message}`);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function blocked(result, label) {
  assert(result && result.published === false, `${label}: expected BLOCKED result`);
  assert(result.result === null, `${label}: blocked producer must expose result=null`);
  assert(
    !('artifact' in (result.result ?? {})),
    `${label}: blocked producer exposed a public artifact`,
  );
  assert(Array.isArray(result.reasonCodes) && result.reasonCodes.length > 0, `${label}: no reasonCodes`);
  return result;
}

function buildFixture() {
  const pageId = 'v714-production-gate-fixture';
  const locale = 'en-US';
  const region = 'US';
  const claimId = 'claim:v714:production-gate';
  const evidenceId = 'evidence:v714:production-gate';
  const canonicalUrl = 'https://nxmold.com/v714-production-gate-fixture';

  const evidence = {
    completeness: 'COMPLETE',
    evidence: [
      {
        id: evidenceId,
        sourceLocator: 'v714://production-gate/fixture/evidence-001',
        contentHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      },
    ],
    semanticClaims: [
      {
        id: claimId,
        claimKey: 'v714.production.gate.fixture',
      },
    ],
  };

  const compileInput = {
    pageId,
    locale,
    region,
    applicability: 'APPLICABLE',
    compliance: 'VERIFIED',
    evidence,
    semantic: {
      pageId,
      locale,
      region,
      semanticClaimIds: [claimId],
    },
  };

  const bindings = [
    {
      claim: {
        id: claimId,
        claimKey: 'v714.production.gate.fixture',
      },
      evidenceIds: [evidenceId],
    },
  ];

  return {
    compileInput,
    bindings,
    canonicalUrl,
    hreflangSet: [locale],
    canonicalByLocale: new Map([[locale, canonicalUrl]]),
  };
}

async function importRegional(root, file) {
  const url = pathToFileURL(resolve(root, 'src', 'regional', file)).href;
  return import(`${url}?v714_gate=${Date.now()}`);
}

export async function runV714RegionalGate(context = {}) {
  const root = resolve(context.projectRoot ?? process.cwd());

  const [producerMod, preflightMod, compilerMod] = await Promise.all([
    importRegional(root, 'Producer.ts'),
    importRegional(root, 'releasePreflight.ts'),
    importRegional(root, 'regionalCompiler.ts'),
  ]);

  assert(typeof producerMod.runV714Producer === 'function', 'runV714Producer export missing');
  assert(typeof compilerMod.compileRegionalPage === 'function', 'compileRegionalPage export missing');
  assert(typeof preflightMod.runRegionalReleasePreflight === 'function', 'runRegionalReleasePreflight export missing');

  const fixture = buildFixture();

  // ------------------------------------------------------------
  // Positive path: the complete canonical chain must publish.
  // ------------------------------------------------------------
  const positive = producerMod.runV714Producer(fixture);
  assert(positive.published === true, `positive path blocked: ${(positive.reasonCodes ?? []).join(', ')}`);
  assert(positive.result?.artifact !== null, 'positive path has no RegionalPublishArtifact');
  assert(positive.result?.route !== null, 'positive path has no route projection');
  assert(positive.result?.hreflang !== null, 'positive path has no hreflang projection');

  const artifact = positive.result.artifact;
  const route = positive.result.route;
  const hreflang = positive.result.hreflang;

  assert(Object.isFrozen(artifact), 'RegionalPublishArtifact must be immutable');
  assert(artifact.pageId === fixture.compileInput.pageId, 'artifact pageId mismatch');
  assert(artifact.locale === fixture.compileInput.locale, 'artifact locale mismatch');
  assert(artifact.region === fixture.compileInput.region, 'artifact region mismatch');
  assert(artifact.canonicalUrl === fixture.canonicalUrl, 'artifact canonical mismatch');
  assert(/^[a-f0-9]{64}$/i.test(artifact.pageContentHash), 'artifact hash is not SHA-256 shaped');
  assert(route.artifact === artifact, 'route must project the exact artifact object');
  assert(route.contentHash === artifact.pageContentHash, 'route hash must equal artifact hash');
  assert(route.canonicalUrl === artifact.canonicalUrl, 'route canonical must equal artifact canonical');
  assert(hreflang.pageId === artifact.pageId, 'hreflang page identity mismatch');
  assert(hreflang.edges.length === 1, 'fixture must produce exactly one hreflang edge');
  assert(hreflang.edges[0].targetCanonicalUrl === fixture.canonicalUrl, 'hreflang canonical mismatch');

  const preflight = preflightMod.runRegionalReleasePreflight(positive.result);
  assert(preflight.passed === true, `regional release preflight failed: ${preflight.checks.filter((x) => !x.passed).map((x) => x.id).join(', ')}`);

  // ------------------------------------------------------------
  // Adversarial paths: every mutation must produce zero public artifact.
  // ------------------------------------------------------------
  const incomplete = structuredClone(fixture);
  incomplete.compileInput.evidence.completeness = 'INCOMPLETE';
  blocked(producerMod.runV714Producer(incomplete), 'incomplete evidence');

  const unbound = structuredClone(fixture);
  unbound.bindings = [];
  blocked(producerMod.runV714Producer(unbound), 'missing claim binding');

  const unresolvedEvidence = structuredClone(fixture);
  unresolvedEvidence.bindings[0].evidenceIds = ['evidence:does-not-exist'];
  blocked(producerMod.runV714Producer(unresolvedEvidence), 'unresolved evidence');

  const noApplicability = structuredClone(fixture);
  noApplicability.compileInput.applicability = 'NOT_APPLICABLE';
  blocked(producerMod.runV714Producer(noApplicability), 'not applicable');

  const badCanonical = structuredClone(fixture);
  badCanonical.canonicalUrl = '   ';
  blocked(producerMod.runV714Producer(badCanonical), 'empty canonical');

  // Direct compiler adversarial assertion: blocked compile results contain no artifact.
  const directBlocked = compilerMod.compileRegionalPage(unbound);
  assert(directBlocked.published === false, 'direct compiler must block missing binding');
  assert(directBlocked.result.artifact === null, 'blocked compiler result must have artifact=null');
  assert(directBlocked.result.route === null, 'blocked compiler result must have route=null');
  assert(directBlocked.result.hreflang === null, 'blocked compiler result must have hreflang=null');

  const blockedCount = 6;
  console.log(`[NEXMOLD][V7.14][REGIONAL] PASS — canonical producer/compiler chain verified`);
  console.log(`[NEXMOLD][V7.14][REGIONAL] PASS — Evidence -> Claim -> Firewall -> Artifact -> Publication Gate -> Projection`);
  console.log(`[NEXMOLD][V7.14][REGIONAL] PASS — adversarial blocked cases: ${blockedCount}`);
  console.log(`[NEXMOLD][V7.14][REGIONAL] PASS — Public Artifact = 0 for all blocked cases`);

  return Object.freeze({
    ok: true,
    gate: 'V714_REGIONAL_PRODUCTION_GATE',
    version: 'V7.14',
    publishedArtifactCount: 1,
    blockedCaseCount: blockedCount,
    publicArtifactCountOnBlockedCases: 0,
    preflight: preflight.checks,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  runV714RegionalGate({ projectRoot: process.cwd() }).catch((error) => {
    console.error(`[NEXMOLD][V7.14][REGIONAL] FAIL — ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
