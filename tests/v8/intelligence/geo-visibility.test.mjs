
import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateGeoVisibility,
} from "../../../.v8-build/src/v8/intelligence/geo/visibility.js";

const TARGET = Object.freeze({
  brandName: "Nexmold",
  entityAliases: ["Nexmold Manufacturing"],
  ownedDomains: ["nexmold.com"],
  competitorNames: ["Protolabs", "Xometry"],
  targetQueries: [
    "plastic injection molding wall thickness",
    "custom injection molding manufacturer",
  ],
});

function createSnapshot(overrides = {}) {
  return {
    query: "plastic injection molding wall thickness",
    platform: "test-platform",
    observedAt: "2026-10-10T09:30:00Z",
    answerText:
      "Nexmold explains injection molding wall thickness. Protolabs also provides design guidance.",
    citedUrls: [
      "https://nexmold.com/knowledge/wall-thickness/",
      "https://example.org/injection-molding-guide",
    ],
    ...overrides,
  };
}

test(
  "measures brand mentions, citation rates, owned citations, and competitors",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [createSnapshot()],
    );

    assert.equal(report.passed, true);
    assert.equal(report.metrics.observationCount, 1);
    assert.equal(report.metrics.distinctQueryCount, 1);
    assert.equal(report.metrics.distinctPlatformCount, 1);
    assert.equal(report.metrics.brandMentionRate, 1);
    assert.equal(report.metrics.answerCitationRate, 1);
    assert.equal(report.metrics.ownedCitationShare, 0.5);
    assert.equal(report.metrics.meanCitationsPerAnswer, 2);

    assert.equal(
      report.metrics.competitorMentionRates.Protolabs,
      1,
    );

    assert.equal(
      report.metrics.competitorMentionRates.Xometry,
      0,
    );

    assert.equal(
      report.observations[0].targetMentioned,
      true,
    );

    assert.equal(
      report.observations[0].ownedCitationCount,
      1,
    );

    assert.equal(
      report.observations[0].externalCitationUrls.length,
      1,
    );
  },
);

test(
  "does not count a brand embedded inside a longer token",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [
        createSnapshot({
          answerText:
            "The Nexmolder identifier is mentioned, but the target brand is not.",
          citedUrls: [],
        }),
      ],
    );

    assert.equal(report.metrics.brandMentionRate, 0);
    assert.equal(
      report.observations[0].targetMentioned,
      false,
    );
  },
);

test(
  "blocks an empty target brand and missing owned domains",
  () => {
    const report = evaluateGeoVisibility(
      {
        ...TARGET,
        brandName: " ",
        entityAliases: [],
        ownedDomains: [],
      },
      [createSnapshot()],
    );

    assert.equal(report.passed, false);

    assert.ok(
      report.findings.some(
        (item) =>
          item.code === "GEO_VISIBILITY_BRAND_EMPTY",
      ),
    );

    assert.ok(
      report.findings.some(
        (item) =>
          item.code === "GEO_VISIBILITY_OWNED_DOMAINS_EMPTY",
      ),
    );
  },
);

test(
  "blocks missing observations",
  () => {
    const report = evaluateGeoVisibility(TARGET, []);

    assert.equal(report.passed, false);

    assert.ok(
      report.findings.some(
        (item) =>
          item.code === "GEO_VISIBILITY_SNAPSHOTS_EMPTY",
      ),
    );
  },
);

test(
  "blocks observations with missing query, platform, timestamp, or answer",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [
        createSnapshot({
          query: " ",
          platform: "",
          observedAt: "yesterday",
          answerText: "",
        }),
      ],
    );

    assert.equal(report.passed, false);

    const codes = report.findings.map(
      (item) => item.code,
    );

    assert.ok(
      codes.includes("GEO_VISIBILITY_QUERY_EMPTY"),
    );

    assert.ok(
      codes.includes("GEO_VISIBILITY_PLATFORM_EMPTY"),
    );

    assert.ok(
      codes.includes("GEO_VISIBILITY_TIMESTAMP_INVALID"),
    );

    assert.ok(
      codes.includes("GEO_VISIBILITY_ANSWER_EMPTY"),
    );

    assert.ok(
      codes.includes("GEO_VISIBILITY_NO_VALID_OBSERVATIONS"),
    );
  },
);

test(
  "blocks malformed citation URLs instead of silently accepting the observation",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [
        createSnapshot({
          citedUrls: [
            "javascript:alert(1)",
          ],
        }),
      ],
    );

    assert.equal(report.passed, false);

    assert.ok(
      report.findings.some(
        (item) =>
          item.code ===
          "GEO_VISIBILITY_CITATION_URL_INVALID",
      ),
    );

    assert.equal(
      report.metrics.observationCount,
      0,
    );
  },
);

test(
  "reports incomplete configured query coverage",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [createSnapshot()],
    );

    assert.equal(
      report.metrics.queryCoverage,
      0.5,
    );

    assert.ok(
      report.findings.some(
        (item) =>
          item.code ===
          "GEO_VISIBILITY_QUERY_COVERAGE_INCOMPLETE",
      ),
    );
  },
);

test(
  "returns immutable report, metrics, observations, and nested arrays",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [createSnapshot()],
    );

    assert.equal(
      Object.isFrozen(report),
      true,
    );

    assert.equal(
      Object.isFrozen(report.findings),
      true,
    );

    assert.equal(
      Object.isFrozen(report.observations),
      true,
    );

    assert.equal(
      Object.isFrozen(report.metrics),
      true,
    );

    assert.equal(
      Object.isFrozen(
        report.metrics.competitorMentionRates,
      ),
      true,
    );

    assert.equal(
      Object.isFrozen(report.observations[0]),
      true,
    );

    assert.equal(
      Object.isFrozen(
        report.observations[0].ownedCitationUrls,
      ),
      true,
    );

    assert.equal(
      Object.isFrozen(
        report.observations[0].externalCitationUrls,
      ),
      true,
    );
  },
);

test(
  "uses null rather than inventing owned citation share when no citations exist",
  () => {
    const report = evaluateGeoVisibility(
      TARGET,
      [
        createSnapshot({
          citedUrls: [],
        }),
      ],
    );

    assert.equal(
      report.metrics.answerCitationRate,
      0,
    );

    assert.equal(
      report.metrics.ownedCitationShare,
      null,
    );

    assert.equal(
      report.metrics.meanCitationsPerAnswer,
      0,
    );

    assert.ok(
      report.findings.some(
        (item) =>
          item.code ===
          "GEO_VISIBILITY_NO_CITATIONS",
      ),
    );
  },
);
