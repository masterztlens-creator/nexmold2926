import test from "node:test";
import assert from "node:assert/strict";

import {
  createMarketDemand,
} from "../../../../.v8-build/src/v8/intelligence/market/demand.js";

import {
  createMarketDecision,
} from "../../../../.v8-build/src/v8/intelligence/market/decision.js";

import {
  createResearchAction,
} from "../../../../.v8-build/src/v8/intelligence/market/research-action.js";

import {
  assertMarketDecisionResearchConsistency,
  assertMarketDecisionInvariant,
  assertMarketDemandInvariant,
  assertResearchActionInvariant,
} from "../../../../.v8-build/src/v8/intelligence/market/invariants.js";

import {
  assertMarketDecisionTransition,
  transitionMarketDecision,
} from "../../../../.v8-build/src/v8/intelligence/market/state-machine.js";

const OBSERVATION_ID = "observation:market:001";
const UNKNOWN_OBSERVATION_ID = "observation:market:unknown";

const OBSERVED_AT = "2026-09-23T00:00:00.000Z";

function baseObservation(overrides = {}) {
  return {
    id: OBSERVATION_ID,
    query: "plastic injection molding wall thickness",
    normalizedQuery:
      "plastic injection molding wall thickness",
    source: "SEARCH",
    intent: "INFORMATIONAL",
    language: "en",
    market: "US",
    observedAt: OBSERVED_AT,
    ...overrides,
  };
}

function baseDemand(overrides = {}) {
  return createMarketDemand({
    id: "market-demand:test:001",
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
      baseObservation(),
    ],
    demandSignals: [
      {
        type: "QUERY_FREQUENCY",
        value: "1",
        sourceObservationIds: [
          OBSERVATION_ID,
        ],
      },
    ],
    existingCoverage: [],
    uncertainty: "LOW",
    ...overrides,
  });
}

function baseResearchAction(overrides = {}) {
  return createResearchAction({
    id: "research-action:test:001",
    decisionId: "market-decision:test:001",
    type: "SEARCH_EVIDENCE",
    question:
      "What authoritative engineering evidence defines suitable injection molding wall thickness?",
    target:
      "plastic injection molding wall thickness",
    priority: "HIGH",
    requiredEvidence: [
      "authoritative engineering guidance",
      "material-specific constraints",
    ],
    status: "PLANNED",
    ...overrides,
  });
}

function baseDecisionInput(overrides = {}) {
  return {
    id: "market-decision:test:001",
    demandId: "market-demand:test:001",
    state: "EVALUATING",
    rationale:
      "The demand has been interpreted and requires evidence evaluation before coverage.",
    evidenceRequirements: [],
    researchActions: [],
    existingCoverageRefs: [],
    targetAsset: null,
    confidence: "MEDIUM",
    uncertainty: false,
    ...overrides,
  };
}

function baseDecision(overrides = {}) {
  return createMarketDecision(
    baseDecisionInput(overrides),
  );
}

test(
  "MarketDemand rejects an empty observation set",
  () => {
    assert.throws(
      () =>
        createMarketDemand({
          id: "market-demand:test:empty-observations",
          market: "US",
          geography: "United States",
          language: "en",
          audience: "B2B product engineers",
          problem:
            "How to determine suitable plastic injection molding wall thickness",
          intent: "INFORMATIONAL",
          entities: [
            "plastic injection molding",
          ],
          queryObservations: [],
          demandSignals: [],
          existingCoverage: [],
          uncertainty: "LOW",
        }),
      /observation/i,
    );
  },
);

test(
  "MarketDemand rejects a signal that references an unknown observation",
  () => {
    assert.throws(
      () =>
        createMarketDemand(
          baseDemand({
            demandSignals: [
              {
                type: "QUERY_FREQUENCY",
                value: "1",
                sourceObservationIds: [
                  UNKNOWN_OBSERVATION_ID,
                ],
              },
            ],
          }),
        ),
      /observation/i,
    );
  },
);

test(
  "MarketDecision rejects DISCOVERED to COVER",
  () => {
    assert.throws(
      () =>
        assertMarketDecisionTransition(
          "DISCOVERED",
          "COVER",
        ),
      /transition/i,
    );
  },
);

test(
  "MarketDecision rejects RESEARCH_REQUIRED to COVER",
  () => {
    assert.throws(
      () =>
        assertMarketDecisionTransition(
          "RESEARCH_REQUIRED",
          "COVER",
        ),
      /transition/i,
    );
  },
);

test(
  "COVER decision rejects UNKNOWN confidence",
  () => {
    assert.throws(
      () =>
        createMarketDecision({
          id:
            "market-decision:test:cover-unknown-confidence",
          demandId: "market-demand:test:001",
          state: "COVER",
          rationale:
            "Evidence appears sufficient for coverage.",
          evidenceRequirements: [
            "authoritative engineering evidence",
          ],
          researchActions: [],
          existingCoverageRefs: [],
          targetAsset: "ARTICLE",
          confidence: "UNKNOWN",
          uncertainty: false,
        }),
      /confidence/i,
    );
  },
);

test(
  "COVER decision rejects unresolved uncertainty",
  () => {
    assert.throws(
      () =>
        createMarketDecision({
          id:
            "market-decision:test:cover-uncertain",
          demandId: "market-demand:test:001",
          state: "COVER",
          rationale:
            "Evidence appears sufficient for coverage.",
          evidenceRequirements: [
            "authoritative engineering evidence",
          ],
          researchActions: [],
          existingCoverageRefs: [],
          targetAsset: "ARTICLE",
          confidence: "HIGH",
          uncertainty: true,
        }),
      /uncertainty/i,
    );
  },
);

test(
  "MERGE decision requires existing coverage",
  () => {
    assert.throws(
      () =>
        createMarketDecision({
          id:
            "market-decision:test:merge-without-coverage",
          demandId: "market-demand:test:001",
          state: "MERGE",
          rationale:
            "An equivalent existing asset should absorb this demand.",
          evidenceRequirements: [],
          researchActions: [],
          existingCoverageRefs: [],
          targetAsset: "ARTICLE",
          confidence: "HIGH",
          uncertainty: false,
        }),
      /coverage/i,
    );
  },
);

test(
  "MarketDecision supports the legal research loop",
  () => {
    const discovered = baseDecision({
      state: "DISCOVERED",
      rationale:
        "The demand has been discovered but not yet interpreted.",
      confidence: "UNKNOWN",
      uncertainty: true,
    });

    const interpreted =
      transitionMarketDecision(
        discovered.state,
        "INTERPRETED",
      );

    assert.equal(
      interpreted,
      "INTERPRETED",
    );

    const evaluating =
      transitionMarketDecision(
        interpreted,
        "EVALUATING",
      );

    assert.equal(
      evaluating,
      "EVALUATING",
    );

    const researchAction =
      baseResearchAction();

    const researchRequired =
      createMarketDecision(
        baseDecisionInput({
          state: "RESEARCH_REQUIRED",
          rationale:
            "Available evidence is insufficient; additional research is required.",
          researchActions: [
            researchAction.id,
          ],
          evidenceRequirements: [
            "authoritative engineering evidence",
          ],
          confidence: "LOW",
          uncertainty: true,
        }),
      );

    assert.equal(
      researchRequired.state,
      "RESEARCH_REQUIRED",
    );

    assertMarketDecisionResearchConsistency(
      researchRequired,
      [researchAction],
    );

    const returnedToEvaluating =
      transitionMarketDecision(
        researchRequired.state,
        "EVALUATING",
      );

    assert.equal(
      returnedToEvaluating,
      "EVALUATING",
    );

    const covered =
      createMarketDecision(
        baseDecisionInput({
          state: "COVER",
          rationale:
            "Evidence is sufficient and uncertainty has been resolved.",
          evidenceRequirements: [
            "authoritative engineering evidence",
          ],
          researchActions: [
            researchAction.id,
          ],
          targetAsset: "ARTICLE",
          confidence: "HIGH",
          uncertainty: false,
        }),
      );

    assert.equal(
      covered.state,
      "COVER",
    );

    assertMarketDecisionInvariant(
      covered,
    );
  },
);

test(
  "MarketDecision rejects RESEARCH_REQUIRED without research actions",
  () => {
    assert.throws(
      () =>
        createMarketDecision({
          id:
            "market-decision:test:research-without-action",
          demandId: "market-demand:test:001",
          state: "RESEARCH_REQUIRED",
          rationale:
            "Evidence is insufficient.",
          evidenceRequirements: [
            "authoritative engineering evidence",
          ],
          researchActions: [],
          existingCoverageRefs: [],
          targetAsset: null,
          confidence: "LOW",
          uncertainty: true,
        }),
      /research/i,
    );
  },
);

test(
  "ResearchAction requires a non-empty research question",
  () => {
    assert.throws(
      () =>
        createResearchAction(
          baseResearchAction({
            question: "   ",
          }),
        ),
      /question/i,
    );
  },
);

test(
  "ResearchAction invariant enforces a valid decision reference",
  () => {
    const action =
      baseResearchAction();

    assert.doesNotThrow(
      () =>
        assertResearchActionInvariant(
          action,
        ),
    );
  },
);

test(
  "MarketDemand fingerprint is deterministic for equivalent input",
  () => {
    const first =
      baseDemand();

    const second =
      createMarketDemand({
        uncertainty: "LOW",
        existingCoverage: [],
        demandSignals: [
          {
            sourceObservationIds: [
              OBSERVATION_ID,
            ],
            value: "1",
            type: "QUERY_FREQUENCY",
          },
        ],
        queryObservations: [
          {
            observedAt: OBSERVED_AT,
            market: "US",
            language: "en",
            intent: "INFORMATIONAL",
            source: "SEARCH",
            normalizedQuery:
              "plastic injection molding wall thickness",
            query:
              "plastic injection molding wall thickness",
            id: OBSERVATION_ID,
          },
        ],
        entities: [
          "plastic injection molding",
          "wall thickness",
        ],
        intent: "INFORMATIONAL",
        problem:
          "How to determine suitable plastic injection molding wall thickness",
        audience:
          "B2B product engineers",
        language: "en",
        geography: "United States",
        market: "US",
        id: "market-demand:test:001",
      });

    assert.equal(
      first.fingerprint,
      second.fingerprint,
    );
  },
);

test(
  "MarketDemand fingerprint is stable under object field reordering",
  () => {
    const first =
      createMarketDemand({
        id: "market-demand:test:order",
        market: "US",
        geography: "United States",
        language: "en",
        audience:
          "B2B product engineers",
        problem:
          "How to determine suitable plastic injection molding wall thickness",
        intent: "INFORMATIONAL",
        entities: [
          "plastic injection molding",
          "wall thickness",
        ],
        queryObservations: [
          baseObservation(),
        ],
        demandSignals: [
          {
            type: "QUERY_FREQUENCY",
            value: "1",
            sourceObservationIds: [
              OBSERVATION_ID,
            ],
          },
        ],
        existingCoverage: [],
        uncertainty: "LOW",
      });

    const second =
      createMarketDemand({
        uncertainty: "LOW",
        existingCoverage: [],
        demandSignals: [
          {
            sourceObservationIds: [
              OBSERVATION_ID,
            ],
            value: "1",
            type: "QUERY_FREQUENCY",
          },
        ],
        queryObservations: [
          baseObservation(),
        ],
        entities: [
          "plastic injection molding",
          "wall thickness",
        ],
        intent: "INFORMATIONAL",
        problem:
          "How to determine suitable plastic injection molding wall thickness",
        audience:
          "B2B product engineers",
        language: "en",
        geography: "United States",
        market: "US",
        id: "market-demand:test:order",
      });

    assert.equal(
      first.fingerprint,
      second.fingerprint,
    );
  },
);

test(
  "MarketDemand is deeply immutable",
  () => {
    const demand =
      baseDemand();

    assert.equal(
      Object.isFrozen(demand),
      true,
    );

    assert.equal(
      Object.isFrozen(
        demand.queryObservations,
      ),
      true,
    );

    assert.equal(
      Object.isFrozen(
        demand.queryObservations[0],
      ),
      true,
    );

    assert.equal(
      Object.isFrozen(
        demand.demandSignals,
      ),
      true,
    );
  },
);

test(
  "MarketDecision is deeply immutable",
  () => {
    const decision =
      createMarketDecision({
        id:
          "market-decision:test:immutable",
        demandId:
          "market-demand:test:001",
        state: "COVER",
        rationale:
          "Evidence is sufficient for coverage.",
        evidenceRequirements: [
          "authoritative engineering evidence",
        ],
        researchActions: [],
        existingCoverageRefs: [],
        targetAsset: "ARTICLE",
        confidence: "HIGH",
        uncertainty: false,
      });

    assert.equal(
      Object.isFrozen(decision),
      true,
    );

    assert.equal(
      Object.isFrozen(
        decision.evidenceRequirements,
      ),
      true,
    );

    assert.equal(
      Object.isFrozen(
        decision.researchActions,
      ),
      true,
    );
  },
);

test(
  "MarketDemand invariant passes for a valid demand",
  () => {
    const demand =
      baseDemand();

    assert.doesNotThrow(
      () =>
        assertMarketDemandInvariant(
          demand,
        ),
    );
  },
);

test(
  "ResearchAction invariant passes for a valid action",
  () => {
    const action =
      baseResearchAction();

    assert.doesNotThrow(
      () =>
        assertResearchActionInvariant(
          action,
        ),
    );
  },
);

test(
  "MarketDecision transition helper preserves the legal state sequence",
  () => {
    const sequence = [
      [
        "DISCOVERED",
        "INTERPRETED",
      ],
      [
        "INTERPRETED",
        "EVALUATING",
      ],
      [
        "EVALUATING",
        "RESEARCH_REQUIRED",
      ],
      [
        "RESEARCH_REQUIRED",
        "EVALUATING",
      ],
      [
        "EVALUATING",
        "COVER",
      ],
    ];

    for (
      const [from, to] of sequence
    ) {
      assert.doesNotThrow(
        () =>
          assertMarketDecisionTransition(
            from,
            to,
          ),
      );
    }
  },
);