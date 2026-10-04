import test from "node:test";
import assert from "node:assert/strict";

import {
  runV8ArticleRuntime,
} from "../../../.v8-build/src/v8/runtime/article-runtime.js";

import {
  HttpPageFetcher,
} from "../../../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";


const ACTOR = Object.freeze({
  id: "v8:article-runtime-topic-selection-test",
  role: "SYSTEM",
});


const FIXTURE_BASE_URL =
  "https://example.com/v8-article-runtime-topic-selection";


const OPPORTUNITY = Object.freeze({
  keyword: {
    keyword:
      "plastic injection molding wall thickness",

    normalized:
      "plastic injection molding wall thickness",

    source:
      "TEST",

    intent:
      "INFORMATIONAL",

    language:
      "en",

    market:
      "GLOBAL",

    terms:
      [
        "plastic",
        "injection",
        "molding",
        "wall",
        "thickness",
      ],
  },

  score:
    1,

  demand:
    1,

  relevance:
    1,

  competition:
    0,

  authorityGap:
    1,

  conversionPotential:
    0.5,

  reasons:
    [
      "V8 article runtime topic-selection regression test.",
    ],
});


function createPageFetcher(
  pages,
) {
  const fetcher =
    new HttpPageFetcher({
      timeoutMs:
        5000,

      maxBytes:
        1024 * 1024,
    });

  const originalFetch =
    globalThis.fetch;

  globalThis.fetch =
    async (
      input,
    ) => {
      const requestedUrl =
        typeof input ===
          "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;

      const page =
        pages.get(
          requestedUrl,
        );

      assert.ok(
        page,
        `Unexpected fixture URL requested: ${requestedUrl}`,
      );

      return new Response(
        page.body,
        {
          status:
            200,

          headers:
            {
              "content-type":
                "text/html; charset=utf-8",
            },
        },
      );
    };

  return {
    fetcher,

    restore() {
      globalThis.fetch =
        originalFetch;
    },
  };
}


function createAcquisitionConfig(
  url,
) {
  return {
    actorId:
      ACTOR.id,

    researchSeeds:
      [
        {
          url,

          source:
            "TEST",

          reason:
            "V8 Runtime topic-selection regression fixture.",

          relevanceScore:
            100,

          candidateKind:
            "SEED",

          title:
            "V8 Runtime Topic Selection Fixture",
        },
      ],

    maxCandidates:
      1,

    maxPages:
      1,

    maxDepth:
      0,

    sameHostOnly:
      false,
  };
}


function createRuntimeInput({
  url,
  question,
  fetcher,
}) {
  return {
    opportunity:
      OPPORTUNITY,

    searchProvider:
      undefined,

    pageFetcher:
      fetcher,

    store:
      new InMemoryFoundationStore(),

    actor:
      ACTOR,

    acquisition:
      createAcquisitionConfig(
        url,
      ),

    scope:
      {
        geography:
          "GLOBAL",

        industries:
          [
            "PLASTIC_INJECTION_MOLDING",
          ],

        languages:
          [
            "en",
          ],
      },

    context:
      {
        purpose:
          "Regression test for deterministic Runtime Evidence topic selection.",

        variables:
          {
            acquisitionMode:
              "TEST_FIXTURE",

            discoveryMode:
              "V8_SELF_OWNED_TEST",

            searchProvider:
              "NONE",
          },
      },

    problem:
      {
        question,

        constraints:
          [
            "VERIFIED evidence only",

            "No unsupported factual injection",

            "No irrelevant Evidence may enter Truth Production",
          ],
      },

    title:
      "V8 Article Runtime Topic Selection Regression",
  };
}


async function runFixture({
  url,
  html,
  question,
}) {
  const pages =
    new Map([
      [
        url,
        {
          body:
            html,
        },
      ],
    ]);

  const {
    fetcher,
    restore,
  } =
    createPageFetcher(
      pages,
    );

  try {
    return await runV8ArticleRuntime(
      createRuntimeInput({
        url,
        question,
        fetcher,
      }),
    );
  } finally {
    restore();
  }
}


function articleContains(
  runtime,
  value,
) {
  return runtime.content.body
    .toLowerCase()
    .includes(
      value.toLowerCase(),
    );
}


test(
  "V8 Runtime selects wall thickness as the core topic instead of high shrinkage",
  async () => {
    const url =
      `${FIXTURE_BASE_URL}/high-shrinkage`;

    const html = `
      <!doctype html>
      <html>
        <head>
          <title>Injection molding material fixture</title>
        </head>

        <body>
          <main>
            <article>
              <h1>Plastic injection molding material behavior</h1>

              <section>
                <h2>Material behavior</h2>

                <p>
                  High shrinkage materials can require careful dimensional
                  compensation during plastic injection molding.
                </p>

                <p>
                  Material shrinkage can influence part dimensions and
                  processing behavior.
                </p>
              </section>

              <section>
                <h2>Wall thickness</h2>

                <p>
                  For this fixture, recommended wall thickness is 2.5 mm
                  for the tested injection molding application.
                </p>

                <p>
                  Nominal wall thickness should remain uniform where practical.
                </p>
              </section>
            </article>
          </main>
        </body>
      </html>
    `;

    const runtime =
      await runFixture({
        url,

        html,

        question:
          "What wall thickness is appropriate for plastic injection molding with high shrinkage materials?",
      });

    assert.ok(
      runtime.verifiedEvidenceIds.length >
        0,
      "Runtime must produce verified Evidence",
    );

    assert.ok(
      runtime.claimIds.length >
        0,
      "Runtime must produce Claims",
    );

    assert.ok(
      runtime.knowledgeIds.length >
        0,
      "Runtime must produce Knowledge",
    );

    assert.ok(
      runtime.decisionId.length >
        0,
      "Runtime must produce a Decision",
    );

    assert.ok(
      runtime.content.body.length >
        0,
      "Runtime must produce Content",
    );

    assert.ok(
      articleContains(
        runtime,
        "wall thickness",
      ),
      "Runtime Content must remain centered on wall thickness",
    );
  },
);


test(
  "V8 Runtime does not collapse multiple requested topics into broad injection molding",
  async () => {
    const url =
      `${FIXTURE_BASE_URL}/multiple-topics`;

    const html = `
      <!doctype html>
      <html>
        <body>
          <main>
            <article>
              <h1>Plastic injection molding design guidance</h1>

              <section>
                <h2>Wall thickness</h2>
                <p>
                  Recommended wall thickness for the tested application is
                  2.5 mm.
                </p>
              </section>

              <section>
                <h2>Draft angle</h2>
                <p>
                  Draft angle should be selected according to the tested
                  surface and mold-release requirements.
                </p>
              </section>

              <section>
                <h2>Rib thickness</h2>
                <p>
                  Rib thickness should be controlled relative to the nominal
                  wall thickness to reduce molding defects.
                </p>
              </section>

              <section>
                <h2>Injection molding</h2>
                <p>
                  Plastic injection molding is the manufacturing process
                  used by this fixture.
                </p>
              </section>
            </article>
          </main>
        </body>
      </html>
    `;

    const runtime =
      await runFixture({
        url,

        html,

        question:
          "What are the recommended wall thickness, draft angle, and rib thickness values for plastic injection molding?",
      });

    assert.ok(
      runtime.verifiedEvidenceIds.length >
        0,
      "Runtime must find at least one topic-relevant Evidence record",
    );

    assert.ok(
      runtime.content.body.length >
        0,
      "Runtime must produce Content",
    );

    assert.ok(
      articleContains(
        runtime,
        "wall thickness",
      ) ||
      articleContains(
        runtime,
        "draft angle",
      ) ||
      articleContains(
        runtime,
        "rib thickness",
      ),
      "Runtime Content must retain at least one explicitly requested design topic",
    );
  },
);


test(
  "V8 Runtime rejects domain-only Evidence when the requested topic is absent",
  async () => {
    const url =
      `${FIXTURE_BASE_URL}/domain-only`;

    const html = `
      <!doctype html>
      <html>
        <body>
          <main>
            <article>
              <h1>Plastic injection molding</h1>

              <p>
                Plastic injection molding is a manufacturing process for
                producing polymer components.
              </p>

              <p>
                Injection molding machines use molds to form plastic parts.
              </p>

              <p>
                The manufacturing process includes injection, packing,
                cooling, and ejection.
              </p>
            </article>
          </main>
        </body>
      </html>
    `;

    await assert.rejects(
      runFixture({
        url,

        html,

        question:
          "What evidence-backed information can be stated about wall thickness for plastic injection molding?",
      }),
      (
        error,
      ) => {
        assert.match(
          String(
            error?.message ??
              error,
          ),
          /V8_ARTICLE_RUNTIME_NO_TOPIC_RELEVANT_EVIDENCE/,
        );

        return true;
      },
    );
  },
);


test(
  "V8 Runtime fails closed when acquired Evidence has no semantic overlap with the Problem",
  async () => {
    const url =
      `${FIXTURE_BASE_URL}/complete-mismatch`;

    const html = `
      <!doctype html>
      <html>
        <body>
          <main>
            <article>
              <h1>Injection molding machine safety</h1>

              <section>
                <h2>Machine safety</h2>

                <p>
                  Operators must follow machine safety procedures during
                  industrial injection molding operations.
                </p>
              </section>

              <section>
                <h2>Guarding</h2>

                <p>
                  Safety guarding must remain closed during machine operation.
                </p>
              </section>

              <section>
                <h2>Emergency stop</h2>

                <p>
                  Emergency stop controls must be available to operators.
                </p>
              </section>
            </article>
          </main>
        </body>
      </html>
    `;

    await assert.rejects(
      runFixture({
        url,

        html,

        question:
          "What evidence-backed information can be stated about plastic injection molding wall thickness?",
      }),
      (
        error,
      ) => {
        assert.match(
          String(
            error?.message ??
              error,
          ),
          /V8_ARTICLE_RUNTIME_NO_TOPIC_RELEVANT_EVIDENCE/,
        );

        return true;
      },
    );
  },
);


test(
  "V8 Runtime preserves fail-closed behavior for an empty semantic topic",
  async () => {
    const url =
      `${FIXTURE_BASE_URL}/empty-topic`;

    const html = `
      <!doctype html>
      <html>
        <body>
          <main>
            <article>
              <h1>Plastic injection molding wall thickness</h1>

              <p>
                Recommended wall thickness is 2.5 mm.
              </p>
            </article>
          </main>
        </body>
      </html>
    `;

    await assert.rejects(
      runFixture({
        url,

        html,

        question:
          "What information?",
      }),
      (
        error,
      ) => {
        assert.match(
          String(
            error?.message ??
              error,
          ),
          /V8_ARTICLE_RUNTIME_INVALID_TOPIC/,
        );

        return true;
      },
    );
  },
);