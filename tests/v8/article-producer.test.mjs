import assert from "node:assert/strict";
import test from "node:test";

import {
  buildKeywordUniverse,
} from "../../.v8-build/src/v8/intelligence/keyword-universe/universe.js";

import {
  buildOpportunities,
  isPublishedTopic,
  planNextArticle,
  selectNextArticleOpportunity,
  topicKey,
} from "../../.v8-build/src/v8/intelligence/article-producer/producer.js";


test(
  "V8 Article Producer builds a keyword universe before opportunity selection",
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
  "V8 Article Producer ranks opportunities and selects the highest eligible topic",
  () => {
    const keywords =
      buildKeywordUniverse({
        seeds: [
          "plastic injection molding",
          "plastic injection molding wall thickness",
          "plastic injection molding draft angle",
        ],
      });

    const byKeyword =
      new Map(
        keywords.map(
          (keyword) => [
            keyword.normalized,
            keyword,
          ],
        ),
      );

    const opportunities =
      buildOpportunities([
        {
          keyword:
            byKeyword.get(
              "plastic injection molding",
            ),

          signals: {
            demand: 0.90,
            relevance: 0.60,
            competition: 0.80,
            authorityGap: 0.20,
            conversionPotential: 0.50,
          },
        },

        {
          keyword:
            byKeyword.get(
              "plastic injection molding wall thickness",
            ),

          signals: {
            demand: 0.80,
            relevance: 0.95,
            competition: 0.35,
            authorityGap: 0.85,
            conversionPotential: 0.80,
          },
        },

        {
          keyword:
            byKeyword.get(
              "plastic injection molding draft angle",
            ),

          signals: {
            demand: 0.70,
            relevance: 0.90,
            competition: 0.50,
            authorityGap: 0.70,
            conversionPotential: 0.75,
          },
        },
      ].map(
        (item) => {
          assert.ok(
            item.keyword,
          );

          return {
            ...item,
            keyword:
              item.keyword,
          };
        },
      ));

    const selection =
      selectNextArticleOpportunity(
        opportunities,
      );

    assert.equal(
      selection.topicKey,
      "plastic injection molding wall thickness",
    );

    assert.equal(
      selection.rank,
      1,
    );
  },
);


test(
  "V8 Article Producer excludes an already produced topic by semantic topic identity",
  () => {
    const keywords =
      buildKeywordUniverse({
        seeds: [
          "plastic injection molding wall thickness",
          "plastic injection molding draft angle",
        ],
      });

    const byKeyword =
      new Map(
        keywords.map(
          (keyword) => [
            keyword.normalized,
            keyword,
          ],
        ),
      );

    const opportunities =
      buildOpportunities([
        {
          keyword:
            byKeyword.get(
              "plastic injection molding wall thickness",
            ),

          signals: {
            demand: 0.90,
            relevance: 0.95,
            competition: 0.20,
            authorityGap: 0.90,
            conversionPotential: 0.90,
          },
        },

        {
          keyword:
            byKeyword.get(
              "plastic injection molding draft angle",
            ),

          signals: {
            demand: 0.80,
            relevance: 0.90,
            competition: 0.30,
            authorityGap: 0.80,
            conversionPotential: 0.80,
          },
        },
      ].map(
        (item) => {
          assert.ok(
            item.keyword,
          );

          return {
            ...item,
            keyword:
              item.keyword,
          };
        },
      ));

    const selected =
      selectNextArticleOpportunity(
        opportunities,
        [
          "Plastic Injection Molding Wall Thickness",
        ],
      );

    assert.equal(
      selected.topicKey,
      "plastic injection molding draft angle",
    );

    assert.notEqual(
      selected.topicKey,
      "plastic injection molding wall thickness",
    );
  },
);


test(
  "V8 Article Producer treats published topics as semantic topics, not slugs",
  () => {
    const keywords =
      buildKeywordUniverse({
        seeds: [
          "Plastic Injection Molding Wall Thickness",
        ],
      });

    const opportunity =
      buildOpportunities([
        {
          keyword:
            keywords[0],

          signals: {
            demand: 0.90,
            relevance: 0.95,
            competition: 0.20,
            authorityGap: 0.90,
            conversionPotential: 0.90,
          },
        },
      ])[0];

    assert.equal(
      topicKey(
        opportunity,
      ),
      "plastic injection molding wall thickness",
    );

    assert.equal(
      isPublishedTopic(
        opportunity,
        [
          "plastic injection molding wall thickness",
        ],
      ),
      true,
    );

    assert.equal(
      isPublishedTopic(
        opportunity,
        [
          "plastic-injection-molding-wall-thickness",
        ],
      ),
      false,
    );
  },
);


test(
  "V8 Article Producer fails closed when no eligible topic remains",
  () => {
    const keywords =
      buildKeywordUniverse({
        seeds: [
          "plastic injection molding wall thickness",
        ],
      });

    const opportunity =
      buildOpportunities([
        {
          keyword:
            keywords[0],

          signals: {
            demand: 0.90,
            relevance: 0.95,
            competition: 0.20,
            authorityGap: 0.90,
            conversionPotential: 0.90,
          },
        },
      ])[0];

    assert.throws(
      () =>
        selectNextArticleOpportunity(
          [
            opportunity,
          ],
          [
            "plastic injection molding wall thickness",
          ],
        ),
      /V8_ARTICLE_PRODUCER_NO_ELIGIBLE_TOPIC/,
    );
  },
);


test(
  "V8 Article Producer plan keeps ranking and exclusion deterministic",
  () => {
    const plan =
      planNextArticle({
        keywordExpansion: {
          seeds: [
            "plastic injection molding",
            "plastic injection molding wall thickness",
            "plastic injection molding draft angle",
          ],
        },

        opportunitySignals: [
          {
            keyword: {
              keyword:
                "plastic injection molding wall thickness",
              normalized:
                "plastic injection molding wall thickness",
              source:
                "SEED",
              intent:
                "INFORMATIONAL",
              terms: [
                "plastic",
                "injection",
                "molding",
                "wall",
                "thickness",
              ],
            },

            signals: {
              demand: 0.80,
              relevance: 0.95,
              competition: 0.35,
              authorityGap: 0.85,
              conversionPotential: 0.80,
            },
          },

          {
            keyword: {
              keyword:
                "plastic injection molding draft angle",
              normalized:
                "plastic injection molding draft angle",
              source:
                "SEED",
              intent:
                "INFORMATIONAL",
              terms: [
                "plastic",
                "injection",
                "molding",
                "draft",
                "angle",
              ],
            },

            signals: {
              demand: 0.70,
              relevance: 0.90,
              competition: 0.50,
              authorityGap: 0.70,
              conversionPotential: 0.75,
            },
          },
        ],

        publishedTopics: [
          "plastic injection molding wall thickness",
        ],

        pageFetcher: {},
        researchSeeds: [],
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
            "V8 article production",
        },
      });

    assert.equal(
      plan.selection.topicKey,
      "plastic injection molding draft angle",
    );

    assert.equal(
      plan.ranked.length,
      2,
    );

    assert.equal(
      plan.eligible.length,
      1,
    );
  },
);