import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKeywordUniverse,
} from "../../.v8-build/src/v8/intelligence/keyword-universe/universe.js";

import {
  assertArticleProducerSelection,
  createArticleProducerTopic,
  selectNextArticleTopic,
} from "../../.v8-build/src/v8/intelligence/article-producer/producer.js";


const WALL_THICKNESS_SEED = Object.freeze({
  url:
    "https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/",
  source:
    "AUTHORITY",
  reason:
    "Authoritative injection molding design guideline for wall thickness research.",
});

const DRAFT_ANGLE_SEED = Object.freeze({
  url:
    "https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/",
  source:
    "AUTHORITY",
  reason:
    "Authoritative injection molding design guideline for draft angle research.",
});

const BASE_SIGNALS = Object.freeze({
  demand:
    0.80,
  relevance:
    0.95,
  competition:
    0.35,
  authorityGap:
    0.85,
  conversionPotential:
    0.80,
});


function createSelectionInput({
  cycleId = "v8-test-cycle",
  topics,
  existingArticles = [],
  producedTopics = [],
  minimumScore = 0.65,
} = {}) {
  return {
    cycleId,

    topics,

    existingArticles,

    producedTopics,

    scope: {
      geography:
        "GLOBAL",
      industries: [
        "INJECTION_MOLDING",
      ],
      languages: [
        "en",
      ],
    },

    context: {
      purpose:
        "V8 article producer test",
    },

    minimumScore,
  };
}


function createTopicInput({
  seeds,
  signals = BASE_SIGNALS,
  researchSeeds = [
    WALL_THICKNESS_SEED,
  ],
} = {}) {
  return {
    seeds,

    signals,

    researchSeeds,
  };
}


test(
  "V8 Article Producer builds a keyword universe before topic selection",
  () => {
    const keywords =
      buildKeywordUniverse({
        seeds: [
          "plastic injection molding",
        ],

        modifiers: [
          "wall thickness",
          "draft angle",
        ],

        questions: [
          "how to design plastic injection molding parts",
        ],
      });

    assert.ok(
      keywords.length >= 3,
    );

    assert.ok(
      keywords.some(
        (keyword) =>
          keyword.normalized ===
          "plastic injection molding",
      ),
    );
  },
);


test(
  "V8 Article Producer creates a deterministic topic from controlled intelligence input",
  () => {
    const topic =
      createArticleProducerTopic(
        createTopicInput({
          seeds: [
            "plastic injection molding wall thickness",
          ],
        }),
      );

    assert.equal(
      topic.keyword.normalized,
      "plastic injection molding wall thickness",
    );

    assert.equal(
      topic.slug,
      "plastic-injection-molding-wall-thickness",
    );

    assert.ok(
      topic.opportunity.score >= 0.65,
    );

    assert.equal(
      topic.researchSeeds.length,
      1,
    );
  },
);


test(
  "V8 Article Producer ranks opportunities and selects the highest eligible topic",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding",
              ],

              signals: {
                demand:
                  0.90,
                relevance:
                  0.60,
                competition:
                  0.80,
                authorityGap:
                  0.20,
                conversionPotential:
                  0.50,
              },

              researchSeeds: [
                WALL_THICKNESS_SEED,
              ],
            }),

            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],

              signals: {
                demand:
                  0.80,
                relevance:
                  0.95,
                competition:
                  0.35,
                authorityGap:
                  0.85,
                conversionPotential:
                  0.80,
              },

              researchSeeds: [
                WALL_THICKNESS_SEED,
              ],
            }),

            createTopicInput({
              seeds: [
                "plastic injection molding draft angle",
              ],

              signals: {
                demand:
                  0.70,
                relevance:
                  0.90,
                competition:
                  0.50,
                authorityGap:
                  0.70,
                conversionPotential:
                  0.75,
              },

              researchSeeds: [
                DRAFT_ANGLE_SEED,
              ],
            }),
          ],
        }),
      );

    assert.ok(
      selection.selected,
    );

    assert.equal(
      selection.selected.keyword.normalized,
      "plastic injection molding wall thickness",
    );

    assert.equal(
      selection.ranked[0].keyword.normalized,
      "plastic injection molding wall thickness",
    );

    assert.equal(
      selection.selected.slug,
      "plastic-injection-molding-wall-thickness",
    );

    assert.equal(
      selection.excluded.length,
      0,
    );

    assert.equal(
      selection.blocked.length,
      0,
    );

    assertArticleProducerSelection(
      selection,
    );
  },
);


test(
  "V8 Article Producer excludes an already produced topic by semantic topic identity",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],

              signals: {
                demand:
                  0.90,
                relevance:
                  0.95,
                competition:
                  0.20,
                authorityGap:
                  0.90,
                conversionPotential:
                  0.90,
              },

              researchSeeds: [
                WALL_THICKNESS_SEED,
              ],
            }),

            createTopicInput({
              seeds: [
                "plastic injection molding draft angle",
              ],

              signals: {
                demand:
                  0.80,
                relevance:
                  0.90,
                competition:
                  0.30,
                authorityGap:
                  0.80,
                conversionPotential:
                  0.80,
              },

              researchSeeds: [
                DRAFT_ANGLE_SEED,
              ],
            }),
          ],

          producedTopics: [
            "Plastic Injection Molding Wall Thickness",
          ],
        }),
      );

    assert.ok(
      selection.selected,
    );

    assert.equal(
      selection.selected.keyword.normalized,
      "plastic injection molding draft angle",
    );

    assert.equal(
      selection.excluded.length,
      1,
    );

    assert.equal(
      selection.excluded[0].topic.keyword.normalized,
      "plastic injection molding wall thickness",
    );

    assert.equal(
      selection.excluded[0].reason,
      "ALREADY_PRODUCED",
    );

    assert.notEqual(
      selection.selected.keyword.normalized,
      "plastic injection molding wall thickness",
    );

    assertArticleProducerSelection(
      selection,
    );
  },
);


test(
  "V8 Article Producer treats persisted article slug and primary keyword as existing topic identity",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],

              signals: {
                demand:
                  0.90,
                relevance:
                  0.95,
                competition:
                  0.20,
                authorityGap:
                  0.90,
                conversionPotential:
                  0.90,
              },

              researchSeeds: [
                WALL_THICKNESS_SEED,
              ],
            }),

            createTopicInput({
              seeds: [
                "plastic injection molding draft angle",
              ],

              signals: {
                demand:
                  0.80,
                relevance:
                  0.90,
                competition:
                  0.30,
                authorityGap:
                  0.80,
                conversionPotential:
                  0.80,
              },

              researchSeeds: [
                DRAFT_ANGLE_SEED,
              ],
            }),
          ],

          existingArticles: [
            {
              slug:
                "plastic-injection-molding-wall-thickness",

              primaryKeyword:
                "Plastic Injection Molding Wall Thickness",
            },
          ],
        }),
      );

    assert.ok(
      selection.selected,
    );

    assert.equal(
      selection.selected.keyword.normalized,
      "plastic injection molding draft angle",
    );

    assert.equal(
      selection.excluded.length,
      1,
    );

    assert.equal(
      selection.excluded[0].reason,
      "ALREADY_PRODUCED",
    );
  },
);


test(
  "V8 Article Producer does not treat an unrelated slug as the semantic topic",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],
            }),
          ],

          existingArticles: [
            {
              slug:
                "plastic-injection-molding-draft-angle",
            },
          ],
        }),
      );

    assert.ok(
      selection.selected,
    );

    assert.equal(
      selection.selected.keyword.normalized,
      "plastic injection molding wall thickness",
    );

    assert.equal(
      selection.excluded.length,
      0,
    );
  },
);


test(
  "V8 Article Producer fails closed when no eligible topic remains",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],
            }),
          ],

          producedTopics: [
            "plastic injection molding wall thickness",
          ],
        }),
      );

    assert.equal(
      selection.selected,
      null,
    );

    assert.equal(
      selection.excluded.length,
      1,
    );

    assert.equal(
      selection.excluded[0].reason,
      "ALREADY_PRODUCED",
    );
  },
);


test(
  "V8 Article Producer blocks a topic below the minimum score threshold",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],

              signals: {
                demand:
                  0.10,
                relevance:
                  0.10,
                competition:
                  0.90,
                authorityGap:
                  0.10,
                conversionPotential:
                  0.10,
              },
            }),
          ],

          minimumScore:
            0.65,
        }),
      );

    assert.equal(
      selection.selected,
      null,
    );

    assert.equal(
      selection.blocked.length,
      1,
    );

    assert.equal(
      selection.blocked[0].reason,
      "BELOW_SCORE_THRESHOLD",
    );
  },
);


test(
  "V8 Article Producer blocks a topic without explicit research seeds",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],

              researchSeeds: [],
            }),
          ],
        }),
      );

    assert.equal(
      selection.selected,
      null,
    );

    assert.equal(
      selection.blocked.length,
      1,
    );

    assert.equal(
      selection.blocked[0].reason,
      "NO_RESEARCH_SEEDS",
    );
  },
);


test(
  "V8 Article Producer keeps ranking deterministic across repeated selection",
  () => {
    const input =
      createSelectionInput({
        topics: [
          createTopicInput({
            seeds: [
              "plastic injection molding draft angle",
            ],

            signals: {
              demand:
                0.70,
              relevance:
                0.90,
              competition:
                0.50,
              authorityGap:
                0.70,
              conversionPotential:
                0.75,
            },

            researchSeeds: [
              DRAFT_ANGLE_SEED,
            ],
          }),

          createTopicInput({
            seeds: [
              "plastic injection molding wall thickness",
            ],

            signals: {
              demand:
                0.80,
              relevance:
                0.95,
              competition:
                0.35,
              authorityGap:
                0.85,
              conversionPotential:
                0.80,
            },

            researchSeeds: [
              WALL_THICKNESS_SEED,
            ],
          }),
        ],
      });

    const first =
      selectNextArticleTopic(
        input,
      );

    const second =
      selectNextArticleTopic(
        input,
      );

    assert.deepEqual(
      first,
      second,
    );

    assert.equal(
      first.selected.keyword.normalized,
      "plastic injection molding wall thickness",
    );
  },
);


test(
  "V8 Article Producer invariant accepts a valid selected topic",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],
            }),
          ],
        }),
      );

    assert.ok(
      selection.selected,
    );

    assert.doesNotThrow(
      () =>
        assertArticleProducerSelection(
          selection,
        ),
    );
  },
);


test(
  "V8 Article Producer invariant accepts a fail-closed selection with no selected topic",
  () => {
    const selection =
      selectNextArticleTopic(
        createSelectionInput({
          topics: [
            createTopicInput({
              seeds: [
                "plastic injection molding wall thickness",
              ],
            }),
          ],

          producedTopics: [
            "plastic injection molding wall thickness",
          ],
        }),
      );

    assert.equal(
      selection.selected,
      null,
    );

    assert.doesNotThrow(
      () =>
        assertArticleProducerSelection(
          selection,
        ),
    );
  },
);

