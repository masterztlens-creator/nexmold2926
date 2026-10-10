import test from "node:test";
import assert from "node:assert/strict";

import {
  evaluateSearchOpportunity,
} from "../../../.v8-build/src/v8/intelligence/opportunity/decision.js";

import {
  createMarketDemand,
} from "../../../.v8-build/src/v8/intelligence/market/demand.js";

function createOpportunity(overrides = {}) {
  const keyword = {
    keyword: "custom injection molding manufacturer",
    normalized: "custom injection molding manufacturer",
    source: "SEED",
    intent: "COMMERCIAL",
    language: "en",
    market: "US",
    terms: [
      "custom",
      "injection",
      "molding",
      "manufacturer",
    ],
  };

  return {
    keyword,
    score: 0.88,
    demand: 0.84,
    relevance: 0.94,
    competition: 0.32,
    authorityGap: 0.72,
    conversionPotential: 0.91,
    reasons: [
      "high-demand",
      "high-relevance",
      "competitive-opening",
    ],
    ...overrides,
  };
}

function createDemand(overrides = {}) {
  return createMarketDemand({
    id: "market-demand:custom-injection-molding",
    market: "US",
    geography: "United States",
    language: "en",
    audience: "B2B manufacturing buyers",
    problem:
      "Find a qualified custom injection molding manufacturer.",
    intent: "COMMERCIAL",
    entities: [
      "custom injection molding",
      "manufacturer",
    ],
    queryObservations: [
      {
        id: "observation:custom-injection-molding",
        query: "custom injection molding manufacturer",
        normalizedQuery:
          "custom injection molding manufacturer",
        source: "SEARCH",
        intent: "COMMERCIAL",
        language: "en",
        market: "US",
        observedAt: "2026-10-10T00:00:00.000Z",
      },
    ],
    demandSignals: [],
    existingCoverage: [],
    uncertainty: "LOW",
    ...overrides,
  });
}

function createEvidence(overrides = {}) {
  return {
    availableEvidence: [
      "evidence:verified-source-001",
    ],
    missingEvidence: [],
    contradictions: [],
    unresolvedQuestions: [],
    ...overrides,
  };
}

function createCoverage(overrides = {}) {
  return {
    existingCoverageRefs: [],
    equivalentCoverage: [],
    relatedCoverage: [],
    ...overrides,
  };
}

function evaluate(overrides = {}) {
  return evaluateSearchOpportunity({
    decisionId: "search-opportunity:test-001",
    opportunity: createOpportunity(),
    demand: createDemand(),
    scope: "IN_SCOPE",
    evidence: createEvidence(),
    coverage: createCoverage(),
    ...overrides,
  });
}

test("high-value in-scope opportunity recommends planning without authorizing publication", () => {
  const result = evaluate();

  assert.equal(
    result.marketDecision.state,
    "COVER",
  );

  assert.equal(
    result.recommendation,
    "PURSUE",
  );

  assert.equal(
    result.nextStep,
    "PLAN_CONTENT",
  );

  assert.equal(
    result.planningEligible,
    true,
  );

  assert.equal(
    result.publicationEligible,
    false,
  );

  assert.ok(
    String(result.fingerprint).length > 0,
  );

  assert.equal(
    Object.isFrozen(result),
    true,
  );
});

test("missing evidence requires research instead of immediate pursuit", () => {
  const result = evaluate({
    evidence: createEvidence({
      availableEvidence: [],
      missingEvidence: [
        "Authoritative evidence for engineering requirements",
      ],
    }),
  });

  assert.equal(
    result.marketDecision.state,
    "RESEARCH_REQUIRED",
  );

  assert.equal(
    result.recommendation,
    "RESEARCH",
  );

  assert.equal(
    result.nextStep,
    "RESEARCH_EVIDENCE",
  );

  assert.ok(
    result.researchActions.length > 0,
  );

  assert.equal(
    result.planningEligible,
    false,
  );

  assert.equal(
    result.publicationEligible,
    false,
  );
});

test("contradictory evidence blocks immediate pursuit", () => {
  const result = evaluate({
    evidence: createEvidence({
      contradictions: [
        "Conflicting material specifications",
      ],
    }),
  });

  assert.equal(
    result.marketDecision.state,
    "RESEARCH_REQUIRED",
  );

  assert.equal(
    result.recommendation,
    "RESEARCH",
  );

  assert.ok(
    result.researchActions.length > 0,
  );
});

test("equivalent existing coverage recommends merging", () => {
  const result = evaluate({
    coverage: createCoverage({
      equivalentCoverage: [
        "/knowledge-hub/existing-manufacturer-guide/",
      ],
    }),
  });

  assert.equal(
    result.marketDecision.state,
    "MERGE",
  );

  assert.equal(
    result.recommendation,
    "MERGE",
  );

  assert.equal(
    result.nextStep,
    "MERGE_WITH_EXISTING",
  );

  assert.equal(
    result.planningEligible,
    false,
  );
});

test("explicitly out-of-scope opportunities are blocked", () => {
  const result = evaluate({
    scope: "OUT_OF_SCOPE",
  });

  assert.equal(
    result.marketDecision.state,
    "BLOCK",
  );

  assert.equal(
    result.recommendation,
    "BLOCK",
  );

  assert.equal(
    result.nextStep,
    "BLOCKED",
  );

  assert.equal(
    result.planningEligible,
    false,
  );
});

test("unknown business scope requires review", () => {
  const result = evaluate({
    scope: "UNKNOWN",
  });

  assert.equal(
    result.marketDecision.state,
    "DEFER",
  );

  assert.equal(
    result.recommendation,
    "WATCH",
  );

  assert.equal(
    result.nextStep,
    "REVIEW_SCOPE",
  );

  assert.equal(
    result.planningEligible,
    false,
  );
});

test("low opportunity score does not override canonical evidence decision but prevents active planning", () => {
  const result = evaluate({
    opportunity: createOpportunity({
      score: 0.4,
    }),
  });

  assert.equal(
    result.marketDecision.state,
    "COVER",
  );

  assert.equal(
    result.recommendation,
    "WATCH",
  );

  assert.equal(
    result.nextStep,
    "REVIEW_PRIORITY",
  );

  assert.equal(
    result.planningEligible,
    false,
  );

  assert.equal(
    result.publicationEligible,
    false,
  );
});

test("low business relevance requires review", () => {
  const result = evaluate({
    opportunity: createOpportunity({
      relevance: 0.2,
    }),
  });

  assert.equal(
    result.marketDecision.state,
    "DEFER",
  );

  assert.equal(
    result.recommendation,
    "WATCH",
  );

  assert.equal(
    result.planningEligible,
    false,
  );
});

test("invalid opportunity scores fail closed", () => {
  assert.throws(
    () => evaluate({
      opportunity: createOpportunity({
        score: Number.NaN,
      }),
    }),
    /V8_SEARCH_OPPORTUNITY_INVALID_SCORE/,
  );

  assert.throws(
    () => evaluate({
      opportunity: createOpportunity({
        relevance: 1.1,
      }),
    }),
    /V8_SEARCH_OPPORTUNITY_INVALID_SCORE/,
  );
});

test("contradictory explicit scope signals are rejected", () => {
  assert.throws(
    () => evaluate({
      scope: "IN_SCOPE",
      signals: [
        {
          type: "OUT_OF_SCOPE",
          value: "Conflicting scope assertion",
        },
      ],
    }),
    /V8_SEARCH_OPPORTUNITY_SCOPE_CONFLICT/,
  );
});

test("the same deterministic input produces the same assessment fingerprint", () => {
  const first = evaluate();
  const second = evaluate();

  assert.equal(
    String(first.fingerprint),
    String(second.fingerprint),
  );
});

test("strategy thresholds are configurable", () => {
  const result = evaluate({
    policy: {
      minimumOpportunityScore: 0.95,
      minimumRelevance: 0.7,
    },
  });

  assert.equal(
    result.recommendation,
    "WATCH",
  );

  assert.equal(
    result.policy.minimumOpportunityScore,
    0.95,
  );

  assert.equal(
    result.planningEligible,
    false,
  );
});