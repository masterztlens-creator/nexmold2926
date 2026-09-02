#!/usr/bin/env node

/**
 * NEXMOLD V7.14 Contract Tests
 *
 * Zero-dependency contract surface.
 *
 * Runtime:
 *   Node 24+ with --experimental-strip-types
 *
 * These tests exercise the REAL src/regional implementation.
 *
 * Core invariant:
 *
 *   Public Artifact = 0
 *   whenever any mandatory publication condition is blocked.
 */

import assert from "node:assert/strict";

import {
  compileRegionalPage,
} from "../../src/regional/regionalCompiler.ts";

import {
  runPublicationGate,
} from "../../src/regional/publication-gate.ts";

import {
  evaluateRegionalEligibility,
} from "../../src/regional/eligibility.ts";

const PAGE_ID = "contract-test-page";
const CANONICAL = "https://example.com/contract-test";

const pageId = PAGE_ID;
const locale = "en-US";
const region = "US";

const semantic = {
  pageId,
  locale,
  region,
  semanticClaimIds: [
    "claim-contract-test",
  ],
};

const evidence = {
  evidence: [
    {
      id: "evidence-contract-test",
      sourceType: "test-fixture",
      sourceLocator: "tests/contracts/v714-contracts.mjs",
      contentHash: "hash-contract-test",
    },
  ],
  semanticClaims: [
    {
      id: "claim-contract-test",
      claimKey: "contract.test.claim",
    },
  ],
  completeness: "COMPLETE",
};

function makeInput(overrides = {}) {
  return {
    pageId,
    locale,
    region,
    applicability: "APPLICABLE",
    compliance: "VERIFIED",
    semantic,
    evidence,
    ...overrides,
  };
}

function makeCompilerInput(overrides = {}) {
  return {
    compileInput: makeInput(overrides),
    bindings: [
      {
        claim: {
          id: "claim-contract-test",
          claimKey: "contract.test.claim",
        },
        evidenceIds: [
          "evidence-contract-test",
        ],
      },
    ],
    canonicalUrl: CANONICAL,
    hreflangSet: [
      "en-US",
      "en-GB",
      "de-DE",
    ],
    canonicalByLocale: new Map([
      ["en-US", CANONICAL],
      ["en-GB", "https://example.com/en-gb/contract-test"],
      ["de-DE", "https://example.com/de-de/contract-test"],
    ]),
  };
}

const results = [];

function pass(name) {
  results.push({
    name,
    passed: true,
  });
}

function fail(name, error) {
  results.push({
    name,
    passed: false,
    detail: error instanceof Error
      ? error.message
      : String(error),
  });
}

function test(name, fn) {
  try {
    fn();
    pass(name);
  } catch (error) {
    fail(name, error);
  }
}

/*
 * ------------------------------------------------------------
 * 01 — ELIGIBLE must publish
 * ------------------------------------------------------------
 */
test("eligible-publishes-artifact", () => {
  const result = compileRegionalPage(
    makeCompilerInput(),
  );

  assert.equal(result.published, true);
  assert.notEqual(result.result.artifact, null);
  assert.notEqual(result.result.route, null);
  assert.notEqual(result.result.hreflang, null);
});

/*
 * ------------------------------------------------------------
 * 02 — Artifact must be branded
 * ------------------------------------------------------------
 */
test("artifact-is-branded", () => {
  const result = compileRegionalPage(
    makeCompilerInput(),
  );

  assert.equal(result.published, true);

  const artifact = result.result.artifact;

  assert.ok(artifact);

  const brandSymbol = Object.getOwnPropertySymbols(
    artifact,
  ).find((symbol) =>
    String(symbol).includes("RegionalPublishArtifact"),
  );

  assert.ok(brandSymbol);

  assert.equal(
    artifact[brandSymbol],
    "RegionalPublishArtifact",
  );
});

/*
 * ------------------------------------------------------------
 * 03 — BLOCKED must fail closed
 * ------------------------------------------------------------
 */
test("blocked-produces-zero-public-artifact", () => {
  const result = compileRegionalPage(
    makeCompilerInput({
      applicability: "UNKNOWN",
      compliance: "UNKNOWN",
    }),
  );

  assert.equal(result.published, false);
  assert.equal(result.result.artifact, null);
  assert.equal(result.result.route, null);
  assert.equal(result.result.hreflang, null);
});

/*
 * ------------------------------------------------------------
 * 04 — NOT_APPLICABLE must never publish
 * ------------------------------------------------------------
 */
test("not-applicable-produces-zero-public-artifact", () => {
  const result = compileRegionalPage(
    makeCompilerInput({
      applicability: "NOT_APPLICABLE",
    }),
  );

  assert.equal(result.published, false);
  assert.equal(result.result.artifact, null);
});

/*
 * ------------------------------------------------------------
 * 05 — REVIEW / non-verified compliance must block
 * ------------------------------------------------------------
 */
test("non-verified-compliance-produces-zero-public-artifact", () => {
  const result = compileRegionalPage(
    makeCompilerInput({
      compliance: "REQUIRES_REVIEW",
    }),
  );

  assert.equal(result.published, false);
  assert.equal(result.result.artifact, null);
});

/*
 * ------------------------------------------------------------
 * 06 — Incomplete evidence must block
 * ------------------------------------------------------------
 */
test("incomplete-evidence-produces-zero-public-artifact", () => {
  const result = compileRegionalPage(
    makeCompilerInput({
      evidence: {
        ...evidence,
        completeness: "INCOMPLETE",
      },
    }),
  );

  assert.equal(result.published, false);
  assert.equal(result.result.artifact, null);
});

/*
 * ------------------------------------------------------------
 * 07 — Semantic claim / evidence binding failure must block
 * ------------------------------------------------------------
 */
test("missing-evidence-binding-produces-zero-public-artifact", () => {
  const result = compileRegionalPage({
    ...makeCompilerInput(),
    bindings: [],
  });

  assert.equal(result.published, false);
  assert.equal(result.result.artifact, null);
});

/*
 * ------------------------------------------------------------
 * 08 — Artifact is the single projection source
 * ------------------------------------------------------------
 */
test("route-is-projected-from-artifact", () => {
  const result = compileRegionalPage(
    makeCompilerInput(),
  );

  assert.equal(result.published, true);

  const artifact = result.result.artifact;
  const route = result.result.route;

  assert.ok(artifact);
  assert.ok(route);

  assert.equal(route.artifact, artifact);
  assert.equal(route.pageId, artifact.pageId);
  assert.equal(route.locale, artifact.locale);
  assert.equal(route.region, artifact.region);
  assert.equal(route.canonicalUrl, artifact.canonicalUrl);
});

/*
 * ------------------------------------------------------------
 * 09 — Content hash identity
 * ------------------------------------------------------------
 */
test("route-hash-equals-artifact-hash", () => {
  const result = compileRegionalPage(
    makeCompilerInput(),
  );

  assert.equal(result.published, true);

  const artifact = result.result.artifact;
  const route = result.result.route;

  assert.ok(artifact);
  assert.ok(route);

  assert.equal(
    route.contentHash,
    artifact.pageContentHash,
  );
});

/*
 * ------------------------------------------------------------
 * 10 — Publication gate must not manufacture artifacts
 * ------------------------------------------------------------
 */
test("publication-gate-blocks-without-artifact", () => {
  const eligibility = evaluateRegionalEligibility(
    makeInput(),
  );

  const publication = runPublicationGate({
    eligibility,
    firewall: {
      ok: true,
      bindings: [],
    },
    artifact: null,
  });

  assert.equal(publication.ok, false);

  assert.ok(
    publication.reasonCodes.includes(
      "V714_PUBLIC_ARTIFACT_ABSENT",
    ),
  );
});

/*
 * ------------------------------------------------------------
 * Final result
 * ------------------------------------------------------------
 */

const failed = results.filter(
  (result) => !result.passed,
);

console.log(
  JSON.stringify(
    {
      schema: "nexmold.v7.14.contract-tests.v1",
      passed: failed.length === 0,
      total: results.length,
      failed: failed.length,
      results,
    },
    null,
    2,
  ),
);

process.exitCode = failed.length === 0 ? 0 : 1;
