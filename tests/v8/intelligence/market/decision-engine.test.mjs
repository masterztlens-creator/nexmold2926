import test from "node:test";
import assert from "node:assert/strict";

import {
  createMarketDemand,
} from "../../../../.v8-build/src/v8/intelligence/market/demand.js";

import {
  evaluateMarketDecision,
} from "../../../../.v8-build/src/v8/intelligence/market/decision-engine.js";

function baseDemand(overrides = {}) {
  return createMarketDemand({
    id: "market-demand:engine:001",
    market: "US",
    geography: "United States",
    language: "en",
    audience: "B2B product engineers",
    problem:
      "How to determine suitable plastic injection molding wall thickness",
    intent: "INFORMATIONAL",
    entities: [
      "plastic injection molding",
      "wall thickness",
    ],
    queryObservations: [
      {
        id: "observation:engine:001",
        query:
          "plastic injection molding wall thickness",
        normalizedQuery:
          "plastic injection molding wall thickness",
        source: "SEARCH",
        intent: "INFORMATIONAL",
        language: "en",
        market: "US",
        observedAt:
          "2026-09-23T00:00:00.000Z",
      },
    ],
    demandSignals: [
      {
        type: "PROBLEM_SIGNAL",
        value:
          "engineering wall thickness guidance",
        sourceObservationIds: [
          "observation:engine:001",
        ],
      },
    ],
    existingCoverage: [],
    uncertainty: "LOW",
    ...overrides,
  });
}

function baseInput(overrides = {}) {
  return {
    decisionId:
      "market-decision:engine:001",
    demand: baseDemand(),
    evidence: {
      availableEvidence: [
        "authoritative engineering guidance",
      ],
      missingEvidence: [],
      contradictions: [],
      unresolvedQuestions: [],
    },
    coverage: {
      existingCoverageRefs: [],
      equivalentCoverage: [],
      relatedCoverage: [],
    },
    signals: [
      {
        type: "DEMAND_VALID",
        value:
          "Observed market demand is valid.",
      },
      {
        type: "EVIDENCE_SUFFICIENT",
        value:
          "Evidence requirements are satisfied.",
      },
    ],
    targetAsset: "GUIDE",
    confidence: "HIGH",
    evidenceRequirements: [
      "authoritative engineering evidence",
      "claim-level source binding",
    ],
    ...overrides,
  };
}

test(
  "Decision engine produces COVER when evidence is sufficient and no uncertainty remains",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput(),
      );

    assert.equal(
      result.decision.state,
      "COVER",
    );

    assert.equal(
      result.decision.targetAsset,
      "GUIDE",
    );

    assert.equal(
      result.decision.confidence,
      "HIGH",
    );

    assert.equal(
      result.decision.uncertainty,
      false,
    );

    assert.equal(
      result.researchActions.length,
      0,
    );

    assert.equal(
      result.terminal,
      true,
    );
  },
);

test(
  "Decision engine fails closed when evidence is missing",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          evidence: {
            availableEvidence: [],
            missingEvidence: [
              "material-specific wall thickness limits",
            ],
            contradictions: [],
            unresolvedQuestions: [],
          },
          signals: [
            {
              type: "DEMAND_VALID",
              value: "Demand is observed.",
            },
          ],
        }),
      );

    assert.equal(
      result.decision.state,
      "RESEARCH_REQUIRED",
    );

    assert.equal(
      result.decision.confidence,
      "LOW",
    );

    assert.equal(
      result.decision.uncertainty,
      true,
    );

    assert.ok(
      result.researchActions.length > 0,
    );

    assert.equal(
      result.researchActions[0].status,
      "PLANNED",
    );
  },
);

test(
  "Decision engine creates contradiction research action",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          evidence: {
            availableEvidence: [
              "source A",
              "source B",
            ],
            missingEvidence: [],
            contradictions: [
              "Source A and source B disagree on applicable thickness.",
            ],
            unresolvedQuestions: [],
          },
          signals: [],
        }),
      );

    assert.equal(
      result.decision.state,
      "RESEARCH_REQUIRED",
    );

    assert.ok(
      result.researchActions.some(
        (action) =>
          action.type ===
          "SEARCH_CONTRADICTION",
      ),
    );
  },
);

test(
  "Equivalent existing coverage produces MERGE",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          coverage: {
            existingCoverageRefs: [
              "article:wall-thickness",
            ],
            equivalentCoverage: [
              "article:wall-thickness",
            ],
            relatedCoverage: [],
          },
        }),
      );

    assert.equal(
      result.decision.state,
      "MERGE",
    );

    assert.deepEqual(
      result.decision.existingCoverageRefs,
      [
        "article:wall-thickness",
      ],
    );

    assert.equal(
      result.researchActions.length,
      0,
    );
  },
);

test(
  "OUT_OF_SCOPE blocks the demand",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          signals: [
            {
              type: "OUT_OF_SCOPE",
              value:
                "Demand does not belong to the defined market scope.",
            },
          ],
        }),
      );

    assert.equal(
      result.decision.state,
      "BLOCK",
    );

    assert.equal(
      result.terminal,
      true,
    );
  },
);

test(
  "DEMAND_WEAK produces IGNORE",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          signals: [
            {
              type: "DEMAND_WEAK",
              value:
                "Observed demand is insufficient.",
            },
          ],
        }),
      );

    assert.equal(
      result.decision.state,
      "IGNORE",
    );
  },
);

test(
  "Human review produces DEFER",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          signals: [
            {
              type: "REQUIRES_HUMAN_REVIEW",
              value:
                "Business scope requires explicit governance review.",
            },
          ],
        }),
      );

    assert.equal(
      result.decision.state,
      "DEFER",
    );
  },
);

test(
  "UNKNOWN demand uncertainty cannot produce COVER",
  () => {
    const result =
      evaluateMarketDecision(
        baseInput({
          demand: baseDemand({
            uncertainty: "UNKNOWN",
          }),
        }),
      );

    assert.equal(
      result.decision.state,
      "RESEARCH_REQUIRED",
    );

    assert.equal(
      result.decision.uncertainty,
      true,
    );

    assert.ok(
      result.researchActions.length > 0,
    );
  },
);

test(
  "Decision engine is deterministic",
  () => {
    const first =
      evaluateMarketDecision(
        baseInput(),
      );

    const second =
      evaluateMarketDecision(
        baseInput(),
      );

    assert.equal(
      first.decision.fingerprint,
      second.decision.fingerprint,
    );

    assert.deepEqual(
      first.researchActions.map(
        (action) =>
          action.fingerprint,
      ),
      second.researchActions.map(
        (action) =>
          action.fingerprint,
      ),
    );
  },
);

test(
  "Decision engine rejects missing decision id",
  () => {
    assert.throws(
      () =>
        evaluateMarketDecision(
          baseInput({
            decisionId: "   ",
          }),
        ),
      /decisionId/i,
    );
  },
);

test(
  "Decision engine requires observed demand",
  () => {
    assert.throws(
      () =>
        evaluateMarketDecision(
          baseInput({
            demand: baseDemand({
              queryObservations: [],
            }),
          }),
        ),
      /observation/i,
    );
  },
);