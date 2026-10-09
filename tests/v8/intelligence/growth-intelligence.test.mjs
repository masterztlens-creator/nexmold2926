import test from "node:test";
import assert from "node:assert/strict";

import {
  runGrowthIntelligenceCycle,
  assertGrowthIntelligenceInvariants,
  assertGrowthIntelligenceResult,
} from "../../../.v8-build/src/v8/intelligence/growth-intelligence/index.js";

function createIndustry(overrides = {}) {
  return {
    industryId: "industry:injection-molding",
    name: "Plastic Injection Molding",
    description: "Industrial injection molding services.",
    capabilities: [
      "injection molding",
      "mold making",
      "assembly",
    ],
    products: [
      "plastic components",
    ],
    services: [
      "custom injection molding",
    ],
    targetMarkets: [
      "North America",
      "Europe",
    ],
    targetAudiences: [
      "OEM",
      "product engineers",
    ],
    languages: [
      "en",
    ],
    markets: [
      "North America",
      "Europe",
    ],
    exclusions: [],
    version: "1",
    ...overrides,
  };
}

function createInput(overrides = {}) {
  return {
    cycleId: "growth-cycle:baseline-001",
    industry: createIndustry(),
    markets: [],
    keywords: [],
    opportunities: [],
    signals: [],
    existingNiches: [],
    existingTopics: [],
    publishedSlugs: [],
    ...overrides,
  };
}

test(
  "V8 Growth Intelligence produces a valid result for an empty evidence set",
  () => {
    const result = runGrowthIntelligenceCycle(
      createInput(),
    );

    assert.equal(
      result.cycleId,
      "growth-cycle:baseline-001",
    );

    assert.equal(
      result.industry.industryId,
      "industry:injection-molding",
    );

    assert.ok(
      result.fingerprint.startsWith(
        "growth-intelligence:v8:",
      ),
    );

    assert.deepEqual(
      result.evidence,
      [],
    );

    assert.deepEqual(
      result.niches,
      [],
    );

    assert.deepEqual(
      result.opportunities,
      [],
    );

    assert.deepEqual(
      result.topics,
      [],
    );

    assert.deepEqual(
      result.contentOpportunities,
      [],
    );

    assertGrowthIntelligenceResult(
      result,
    );
  },
);

test(
  "V8 Growth Intelligence produces deterministic output for identical input",
  () => {
    const input = createInput();

    const first = runGrowthIntelligenceCycle(
      input,
    );

    const second = runGrowthIntelligenceCycle(
      input,
    );

    assert.equal(
      first.fingerprint,
      second.fingerprint,
    );

    assert.deepEqual(
      first,
      second,
    );
  },
);

test(
  "V8 Growth Intelligence normalizes the cycle identifier",
  () => {
    const result = runGrowthIntelligenceCycle(
      createInput({
        cycleId: "  growth-cycle:normalized-001  ",
      }),
    );

    assert.equal(
      result.cycleId,
      "growth-cycle:normalized-001",
    );
  },
);

test(
  "V8 Growth Intelligence rejects an empty cycle identifier",
  () => {
    assert.throws(
      () =>
        runGrowthIntelligenceCycle(
          createInput({
            cycleId: "   ",
          }),
        ),
      /non-empty cycleId/,
    );
  },
);

test(
  "V8 Growth Intelligence rejects an industry without an identifier",
  () => {
    assert.throws(
      () =>
        runGrowthIntelligenceCycle(
          createInput({
            industry: createIndustry({
              industryId: "   ",
            }),
          }),
        ),
      /industry\.industryId/,
    );
  },
);

test(
  "V8 Growth Intelligence rejects an industry without a name",
  () => {
    assert.throws(
      () =>
        runGrowthIntelligenceCycle(
          createInput({
            industry: createIndustry({
              name: "   ",
            }),
          }),
        ),
      /industry\.name/,
    );
  },
);

test(
  "V8 Growth Intelligence detects a modified result fingerprint",
  () => {
    const result = runGrowthIntelligenceCycle(
      createInput(),
    );

    const tampered = {
      ...result,
      fingerprint: "tampered-fingerprint",
    };

    const report =
      assertGrowthIntelligenceInvariants(
        tampered,
      );

    assert.equal(
      report.passed,
      false,
    );

    assert.ok(
      report.violations.some(
        (violation) =>
          violation.includes(
            "invalid growth intelligence fingerprint",
          ),
      ),
    );

    assert.throws(
      () =>
        assertGrowthIntelligenceResult(
          tampered,
        ),
      /invariant failure/i,
    );
  },
);

test(
  "V8 Growth Intelligence reports duplicate blocked items",
  () => {
    const result = runGrowthIntelligenceCycle(
      createInput(),
    );

    const tampered = {
      ...result,
      blocked: [
        {
          subject: "test topic",
          reason: "LOW_SCORE",
        },
        {
          subject: "test topic",
          reason: "LOW_SCORE",
        },
      ],
    };

    const report =
      assertGrowthIntelligenceInvariants(
        tampered,
      );

    assert.equal(
      report.passed,
      false,
    );

    assert.ok(
      report.violations.some(
        (violation) =>
          violation.includes(
            "duplicate blocked item",
          ),
      ),
    );
  },
);

test(
  "V8 Growth Intelligence detects a niche assigned to the wrong industry",
  () => {
    const result = runGrowthIntelligenceCycle(
      createInput(),
    );

    const tampered = {
      ...result,
      niches: [
        {
          nicheId: "niche:test",
          industryId: "industry:unrelated",
          name: "Test niche",
          normalizedName: "test niche",
          description: "Test fixture",
          lifecycle: "DISCOVERED",
          decision: "WATCH",
          score: 0.5,
          opportunityId: "opportunity:test",
          evidenceIds: [],
          keywordIds: [],
          marketIds: [],
          commercialIntent: "LOW",
          createdAt: "1970-01-01T00:00:00.000Z",
          updatedAt: "1970-01-01T00:00:00.000Z",
          fingerprint: "niche:v8:test",
        },
      ],
    };

    const report =
      assertGrowthIntelligenceInvariants(
        tampered,
      );

    assert.equal(
      report.passed,
      false,
    );

    assert.ok(
      report.violations.some(
        (violation) =>
          violation.includes(
            "niche belongs to wrong industry",
          ),
      ),
    );
  },
);
