import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

import {
  runV8ArticleRuntime,
} from "../../../.v8-build/src/v8/runtime/article-runtime.js";

import {
  ContentCompiler,
} from "../../../.v8-build/src/v8/content-compiler/compiler.js";

import {
  ProjectionProjector,
} from "../../../.v8-build/src/v8/projection/projector.js";

/*
 * ============================================================================
 * NEXMOLD V8-29
 * HANDOFF SINGLE-TRUTH CONTRACT
 * ============================================================================
 *
 * Contract:
 *
 *   ONE REAL PUBLICATION RUN
 *            │
 *            ▼
 *       ONE Decision
 *            │
 *            ▼
 *        ONE Content
 *            │
 *            ▼
 *       ONE Projection
 *            │
 *            ▼
 *   ONE Publication Handoff
 *
 * This layer extends V8-29's first-layer Runtime Single Truth Contract.
 *
 * V8-29.1 proves:
 *
 *   Evidence → Claim → Knowledge → Decision → Content
 *
 * This layer proves:
 *
 *   Decision → Content → Projection → Handoff
 *
 * The test intentionally uses the actual Article Runtime, actual
 * ContentCompiler, actual ProjectionProjector and the same canonical
 * handoff fingerprint construction used by the Final Publication Gate.
 *
 * No production source is modified by this test.
 *
 * No Internet provider is required.
 *
 * The acquisition boundary is deterministic so that this contract remains
 * reproducible in local execution and CI.
 *
 * ============================================================================
 */

const TEST_URL =
  "https://example.test/plastic-injection-molding-wall-thickness";

const FIXED_FETCHED_AT =
  "2026-10-06T00:00:00.000Z";

const TITLE =
  "Plastic Injection Molding Wall Thickness";

const PRIMARY_KEYWORD =
  "plastic injection molding wall thickness";

const SCOPE_ID =
  "scope:v8-29:injection-molding";

const CONTEXT_ID =
  "context:v8-29:injection-molding";

const PROBLEM_ID =
  "problem:v8-29:plastic-injection-molding-wall-thickness";

const ACTOR_ID =
  "v8-29-handoff-single-truth-test";

const HANDOFF_SCHEMA =
  "nexmold.v8.real-publication-handoff.v1";

const TEST_HTML = `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <title>Plastic Injection Molding Wall Thickness</title>
  </head>
  <body>
    <article>
      <h1>Plastic Injection Molding Wall Thickness</h1>

      <section>
        <h2>Wall Thickness</h2>

        <p>
          Plastic injection molding wall thickness affects filling behavior,
          cooling, shrinkage, sink marks, warpage, and part quality.
        </p>

        <p>
          Wall thickness should be evaluated together with material,
          geometry, flow length, draft, and molding conditions rather than
          treated as a universal value for every injection molded part.
        </p>
      </section>
    </article>
  </body>
</html>
`;

/*
 * ============================================================================
 * Deterministic PageFetcher
 * ============================================================================
 *
 * The production Article Runtime remains untouched.
 *
 * Only the network boundary is deterministic for this integration contract.
 * ============================================================================
 */

class DeterministicPageFetcher {
  constructor() {
    this.calls = [];
  }

  async fetch(url) {
    this.calls.push(url);

    return {
      requestedUrl:
        url,

      finalUrl:
        TEST_URL,

      redirectChain:
        [
          url,
        ],

      status:
        200,

      mediaType:
        "text/html",

      body:
        TEST_HTML,

      bytes:
        new TextEncoder().encode(
          TEST_HTML,
        ),

      fetchedAt:
        FIXED_FETCHED_AT,
    };
  }
}

/*
 * ============================================================================
 * Deterministic Runtime Opportunity
 * ============================================================================
 */

const opportunity = Object.freeze({
  keyword: Object.freeze({
    keyword:
      PRIMARY_KEYWORD,

    normalized:
      PRIMARY_KEYWORD,

    source:
      "SEED",

    intent:
      "INFORMATIONAL",

    language:
      "en",

    market:
      "GLOBAL",

    terms:
      Object.freeze([
        "plastic",
        "injection",
        "molding",
        "wall",
        "thickness",
      ]),
  }),

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
    1,

  reasons:
    Object.freeze([
      "Deterministic V8-29 Handoff contract fixture.",
      "Engineering information relevant to injection molding wall thickness.",
      "Requires evidence-backed publication lineage.",
    ]),
});

/*
 * ============================================================================
 * Runtime Execution
 * ============================================================================
 */

async function executeRuntime() {
  const store =
    new InMemoryFoundationStore();

  const pageFetcher =
    new DeterministicPageFetcher();

  const runtime =
    await runV8ArticleRuntime({
      store,

      pageFetcher,

      opportunity,

      actor: {
        id:
          ACTOR_ID,

        role:
          "SYSTEM",
      },

      scope: {
        id:
          SCOPE_ID,

        geography:
          "GLOBAL",

        industries:
          [
            "injection-molding",
          ],

        languages:
          [
            "en",
          ],
      },

      context: {
        id:
          CONTEXT_ID,

        purpose:
          "Deterministic V8-29 Handoff Single-Truth contract verification.",

        variables:
          {
            subject:
              PRIMARY_KEYWORD,

            audience:
              "manufacturing engineers",

            application:
              "plastic injection molding",
          },
      },

      problem: {
        id:
          PROBLEM_ID,

        question:
          "Determine applicable engineering guidance for plastic injection molding wall thickness.",

        constraints:
          [
            "Use verified evidence.",
            "Do not create unsupported universal rules.",
            "Preserve exact Decision lineage through Content.",
            "Preserve exact Content identity through Projection and Handoff.",
          ],
      },

      title:
        TITLE,

      acquisition: {
        maxQueries:
          1,

        maxCandidates:
          1,

        maxPages:
          1,

        maxDepth:
          0,

        sameHostOnly:
          true,

        researchSeeds:
          [
            Object.freeze({
              url:
                TEST_URL,

              source:
                "DIRECT",

              reason:
                "V8-29 deterministic handoff test seed.",
            }),
          ],

        actorId:
          ACTOR_ID,
      },
    });

  return {
    store,
    runtime,
    pageFetcher,
  };
}

/*
 * ============================================================================
 * Canonical Handoff Helpers
 * ============================================================================
 *
 * These intentionally mirror the canonical Final Publication Gate:
 *
 *   canonicalJson(value)
 *   sha256Text(canonicalJson(handoffPayload))
 *
 * JSON.stringify is used deliberately because that is the exact canonical
 * serialization currently used by scripts/v8-final-publication-gate.mjs.
 * ============================================================================
 */

function canonicalJson(value) {
  return JSON.stringify(
    value,
  );
}

function sha256Text(value) {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

function createHandoffPages({
  content,
  decisionId,
  projectionId,
  projectionFingerprint,
}) {
  const pageDefinitions = [
    Object.freeze({
      locale:
        "de",

      region:
        "DE",

      canonicalRoute:
        `/de/wissen/${"plastic-injection-molding-wall-thickness"}/`,

      title:
        content.title,
    }),

    Object.freeze({
      locale:
        "en",

      region:
        "GLOBAL",

      canonicalRoute:
        `/knowledge/${"plastic-injection-molding-wall-thickness"}/`,

      title:
        content.title,
    }),

    Object.freeze({
      locale:
        "fr",

      region:
        "FR",

      canonicalRoute:
        `/fr/knowledge/${"plastic-injection-molding-wall-thickness"}/`,

      title:
        content.title,
    }),
  ];

  const alternates = Object.freeze([
    Object.freeze({
      locale:
        "de",

      route:
        `/de/wissen/${"plastic-injection-molding-wall-thickness"}/`,
    }),

    Object.freeze({
      locale:
        "en",

      route:
        `/knowledge/${"plastic-injection-molding-wall-thickness"}/`,
    }),

    Object.freeze({
      locale:
        "fr",

      route:
        `/fr/knowledge/${"plastic-injection-molding-wall-thickness"}/`,
    }),
  ]);

  return pageDefinitions
    .map(
      (page) =>
        ({
          locale:
            page.locale,

          region:
            page.region,

          canonicalRoute:
            page.canonicalRoute,

          title:
            page.title,

          body:
            content.body,

          alternates:
            alternates.map(
              (alternate) => ({
                locale:
                  alternate.locale,

                route:
                  alternate.route,
              }),
            ),

          contentId:
            content.id,

          decisionId:
            decisionId,

          projectionId:
            projectionId,

          projectionFingerprint:
            String(
              projectionFingerprint,
            ),

          regionalProjectionId:
            `regional-projection:${projectionId}:${page.locale}`,

          regionalProjectionFingerprint:
            sha256Text(
              canonicalJson({
                projectionId,
                locale:
                  page.locale,
                canonicalRoute:
                  page.canonicalRoute,
              }),
            ),

          routeMetadataFingerprint:
            sha256Text(
              canonicalJson({
                projectionId,
                locale:
                  page.locale,
                route:
                  page.canonicalRoute,
              }),
            ),
        }),
    )
    .sort(
      (a, b) =>
        `${a.locale}:${a.canonicalRoute}`.localeCompare(
          `${b.locale}:${b.canonicalRoute}`,
        ),
    );
}

function createCanonicalHandoff({
  content,
  decisionId,
  projectionId,
  projectionFingerprint,
  scopeId,
  contextId,
}) {
  const pages =
    createHandoffPages({
      content,
      decisionId,
      projectionId,
      projectionFingerprint,
    });

  /*
   * Property order is intentionally identical to the production
   * v8-final-publication-gate handoff payload:
   *
   * schema
   * contentId
   * decisionId
   * projectionId
   * projectionFingerprint
   * scopeId
   * contextId
   * pages
   */
  const handoffPayload =
    Object.freeze({
      schema:
        HANDOFF_SCHEMA,

      contentId:
        content.id,

      decisionId:
        decisionId,

      projectionId:
        projectionId,

      projectionFingerprint:
        String(
          projectionFingerprint,
        ),

      scopeId:
        scopeId,

      contextId:
        contextId,

      pages:
        pages,
    });

  const handoffFingerprint =
    sha256Text(
      canonicalJson(
        handoffPayload,
      ),
    );

  assert.match(
    handoffFingerprint,
    /^[a-f0-9]{64}$/,
    "V8_29_HANDOFF_FINGERPRINT_MUST_BE_SHA256",
  );

  return Object.freeze({
    ...handoffPayload,

    fingerprint:
      handoffFingerprint,
  });
}

/*
 * ============================================================================
 * Runtime → Projection
 * ============================================================================
 *
 * This deliberately uses the actual ContentCompiler and ProjectionProjector.
 *
 * No synthetic Projection identity is accepted.
 * ============================================================================
 */

async function executeTruthToProjection() {
  const {
    store,
    runtime,
    pageFetcher,
  } =
    await executeRuntime();

  const decision =
    store.get(
      "DECISION",
      runtime.decisionId,
    );

  assert.ok(
    decision,
    "V8_29_DECISION_RECORD_MUST_EXIST_FOR_PROJECTION",
  );

  const compiler =
    new ContentCompiler(
      store,
    );

  const compiled =
    compiler.compile({
      decisionId:
        runtime.decisionId,

      scopeId:
        runtime.scopeId,

      contextId:
        runtime.contextId,

      title:
        TITLE,
    });

  const projectionProjector =
    new ProjectionProjector(
      store,
    );

  const projectionResult =
    projectionProjector.project({
      compiled,

      scopeId:
        runtime.scopeId,

      contextId:
        runtime.contextId,
    });

  const projected =
    projectionResult.projected;

  return {
    store,
    runtime,
    pageFetcher,
    decision,
    compiled,
    projected,
  };
}

/*
 * ============================================================================
 * V8-29.8
 * RUNTIME DECISION == HANDOFF DECISION
 * ============================================================================
 */

test(
  "V8-29 Handoff: Runtime Decision identity is exactly preserved into Handoff",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    assert.equal(
      runtime.decisionId,
      handoff.decisionId,
      "V8_29_RUNTIME_DECISION_MUST_EQUAL_HANDOFF_DECISION",
    );
  },
);

/*
 * ============================================================================
 * V8-29.9
 * RUNTIME CONTENT == HANDOFF CONTENT
 * ============================================================================
 */

test(
  "V8-29 Handoff: Runtime Content identity is exactly preserved into Handoff",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    assert.equal(
      runtime.content.id,
      handoff.contentId,
      "V8_29_RUNTIME_CONTENT_MUST_EQUAL_HANDOFF_CONTENT",
    );

    assert.equal(
      runtime.content.decisionId,
      handoff.decisionId,
      "V8_29_CONTENT_DECISION_BINDING_MUST_SURVIVE_HANDOFF",
    );
  },
);

/*
 * ============================================================================
 * V8-29.10
 * RUNTIME CONTENT == PROJECTION CONTENT
 * ============================================================================
 */

test(
  "V8-29 Handoff: Projection identity is exactly bound to Runtime Content",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    assert.equal(
      projected.contentId,
      runtime.content.id,
      "V8_29_PROJECTION_CONTENT_MUST_EQUAL_RUNTIME_CONTENT",
    );

    assert.equal(
      projected.decisionId,
      runtime.decisionId,
      "V8_29_PROJECTION_DECISION_MUST_EQUAL_RUNTIME_DECISION",
    );

    assert.ok(
      projected.projectionId,
      "V8_29_PROJECTION_ID_MUST_EXIST",
    );

    assert.ok(
      projected.fingerprint,
      "V8_29_PROJECTION_FINGERPRINT_MUST_EXIST",
    );

    assert.match(
      String(
        projected.fingerprint,
      ),
      /^[a-f0-9]{64}$/i,
      "V8_29_PROJECTION_FINGERPRINT_MUST_BE_SHA256",
    );
  },
);

/*
 * ============================================================================
 * V8-29.11
 * PROJECTION == HANDOFF
 * ============================================================================
 */

test(
  "V8-29 Handoff: Projection identity and fingerprint are exactly preserved",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    assert.equal(
      projected.projectionId,
      handoff.projectionId,
      "V8_29_PROJECTION_ID_MUST_EQUAL_HANDOFF_PROJECTION",
    );

    assert.equal(
      projected.contentId,
      handoff.contentId,
      "V8_29_PROJECTION_CONTENT_MUST_EQUAL_HANDOFF_CONTENT",
    );

    assert.equal(
      projected.decisionId,
      handoff.decisionId,
      "V8_29_PROJECTION_DECISION_MUST_EQUAL_HANDOFF_DECISION",
    );

    assert.equal(
      String(
        projected.fingerprint,
      ),
      handoff.projectionFingerprint,
      "V8_29_PROJECTION_FINGERPRINT_MUST_EQUAL_HANDOFF",
    );
  },
);

/*
 * ============================================================================
 * V8-29.12
 * HANDOFF FINGERPRINT RECOMPUTATION
 * ============================================================================
 *
 * The persisted Handoff fingerprint must not be trusted merely because it
 * exists.
 *
 * It must be reproducible from the exact canonical payload.
 * ============================================================================
 */

test(
  "V8-29 Handoff: Handoff fingerprint is independently reproducible",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    const {
      fingerprint,
      ...payload
    } =
      handoff;

    const recomputed =
      sha256Text(
        canonicalJson(
          payload,
        ),
      );

    assert.equal(
      recomputed,
      fingerprint,
      "V8_29_HANDOFF_FINGERPRINT_RECOMPUTATION_MISMATCH",
    );
  },
);

/*
 * ============================================================================
 * V8-29.13
 * COMPLETE RUNTIME → HANDOFF IDENTITY CLOSURE
 * ============================================================================
 */

test(
  "V8-29 Handoff: complete Runtime → Content → Projection → Handoff identity is closed",
  async () => {
    const {
      store,
      runtime,
      projected,
      compiled,
      pageFetcher,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    assert.equal(
      pageFetcher.calls.length,
      1,
      "V8_29_HANDOFF_TEST_MUST_HAVE_ONE_DETERMINISTIC_FETCH",
    );

    assert.equal(
      runtime.content.id,
      compiled.content.id,
      "V8_29_RUNTIME_CONTENT_MUST_EQUAL_RECOMPILED_CONTENT",
    );

    assert.equal(
      runtime.content.decisionId,
      compiled.content.decisionId,
      "V8_29_RUNTIME_CONTENT_DECISION_MUST_EQUAL_COMPILED_CONTENT_DECISION",
    );

    assert.equal(
      compiled.content.id,
      projected.contentId,
      "V8_29_COMPILED_CONTENT_MUST_EQUAL_PROJECTION_CONTENT",
    );

    assert.equal(
      projected.contentId,
      handoff.contentId,
      "V8_29_PROJECTION_CONTENT_MUST_EQUAL_HANDOFF_CONTENT",
    );

    assert.equal(
      runtime.decisionId,
      projected.decisionId,
      "V8_29_RUNTIME_DECISION_MUST_EQUAL_PROJECTION_DECISION",
    );

    assert.equal(
      projected.decisionId,
      handoff.decisionId,
      "V8_29_PROJECTION_DECISION_MUST_EQUAL_HANDOFF_DECISION",
    );

    assert.equal(
      projected.projectionId,
      handoff.projectionId,
      "V8_29_PROJECTION_ID_MUST_EQUAL_HANDOFF_PROJECTION",
    );

    assert.equal(
      String(
        projected.fingerprint,
      ),
      handoff.projectionFingerprint,
      "V8_29_PROJECTION_FINGERPRINT_MUST_EQUAL_HANDOFF_FINGERPRINT",
    );

    assert.equal(
      handoff.schema,
      HANDOFF_SCHEMA,
      "V8_29_HANDOFF_SCHEMA_INVALID",
    );

    assert.match(
      handoff.fingerprint,
      /^[a-f0-9]{64}$/,
      "V8_29_HANDOFF_FINGERPRINT_INVALID",
    );

    assert.equal(
      store.get(
        "DECISION",
        runtime.decisionId,
      )?.aggregateId,
      runtime.decisionId,
      "V8_29_DECISION_MUST_REMAIN_PERSISTED",
    );

    assert.equal(
      store.get(
        "PROJECTION",
        projected.projectionId,
      )?.aggregateId,
      projected.projectionId,
      "V8_29_PROJECTION_MUST_REMAIN_PERSISTED",
    );

    assert.doesNotThrow(
      () =>
        store.verifyChain(),
      "V8_29_FOUNDATION_CHAIN_MUST_REMAIN_VALID",
    );
  },
);

/*
 * ============================================================================
 * V8-29.14
 * CONSUME_EXISTING MUST NOT INVOKE SECOND PUBLICATION GATE
 * ============================================================================
 *
 * This is a source-level contract test for the production build orchestrator.
 *
 * The GENERATE branch is allowed to invoke:
 *
 *   scripts/v8-final-publication-gate.mjs
 *
 * The CONSUME_EXISTING branch is NOT allowed to invoke it.
 *
 * This directly guards the duplicate-acquisition failure mode previously
 * discovered in the Final production closure.
 * ============================================================================
 */

test(
  "V8-29 Handoff: CONSUME_EXISTING production path cannot invoke a second Publication Gate",
  () => {
    const root =
      process.cwd();

    const orchestratorPath =
      path.join(
        root,
        "build-orchestrator.mjs",
      );

    assert.ok(
      fs.existsSync(
        orchestratorPath,
      ),
      `V8_29_BUILD_ORCHESTRATOR_MISSING:${orchestratorPath}`,
    );

    const source =
      fs.readFileSync(
        orchestratorPath,
        "utf8",
      );

    const consumeMarker =
      'publicationHandoffMode ===\n    "CONSUME_EXISTING"';

    const consumeStart =
      source.indexOf(
        consumeMarker,
      );

    assert.notEqual(
      consumeStart,
      -1,
      "V8_29_CONSUME_EXISTING_BRANCH_MUST_EXIST",
    );

    const branchEnd =
      source.indexOf(
        "\n  } else {",
        consumeStart,
      );

    assert.notEqual(
      branchEnd,
      -1,
      "V8_29_CONSUME_EXISTING_BRANCH_BOUNDARY_MUST_EXIST",
    );

    const consumeBranch =
      source.slice(
        consumeStart,
        branchEnd,
      );

    assert.doesNotMatch(
      consumeBranch,
      /runCommand\s*\(\s*["'`]node\s+scripts\/v8-final-publication-gate\.mjs/,
      "V8_29_CONSUME_EXISTING_MUST_NOT_EXECUTE_FINAL_PUBLICATION_GATE",
    );

    assert.doesNotMatch(
      consumeBranch,
      /v8-final-publication-gate\.mjs/,
      "V8_29_CONSUME_EXISTING_MUST_NOT_REFERENCE_PUBLICATION_GATE_EXECUTION",
    );

    assert.match(
      consumeBranch,
      /v8-real-publication-handoff\.json/,
      "V8_29_CONSUME_EXISTING_MUST_READ_EXISTING_HANDOFF",
    );

    assert.match(
      consumeBranch,
      /handoff\.fingerprint/,
      "V8_29_CONSUME_EXISTING_MUST_VALIDATE_HANDOFF_FINGERPRINT",
    );

    assert.match(
      consumeBranch,
      /no second Internet acquisition was executed/,
      "V8_29_CONSUME_EXISTING_MUST_EXPLICITLY_DECLARE_NO_SECOND_ACQUISITION",
    );
  },
);

/*
 * ============================================================================
 * V8-29.15
 * Handoff PAGE SET MUST PRESERVE THE SAME CORE IDENTITY
 * ============================================================================
 */

test(
  "V8-29 Handoff: every publication page preserves Content, Decision and Projection identity",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    assert.equal(
      handoff.pages.length,
      3,
      "V8_29_HANDOFF_PAGE_COUNT_MUST_BE_THREE",
    );

    const locales =
      handoff.pages.map(
        (page) =>
          page.locale,
      );

    assert.deepEqual(
      locales,
      [
        "de",
        "en",
        "fr",
      ],
      "V8_29_HANDOFF_PAGE_LOCALES_MUST_BE_DETERMINISTICALLY_SORTED",
    );

    for (
      const page of handoff.pages
    ) {
      assert.equal(
        page.contentId,
        runtime.content.id,
        `V8_29_PAGE_CONTENT_ID_MISMATCH:${page.locale}`,
      );

      assert.equal(
        page.decisionId,
        runtime.decisionId,
        `V8_29_PAGE_DECISION_ID_MISMATCH:${page.locale}`,
      );

      assert.equal(
        page.projectionId,
        projected.projectionId,
        `V8_29_PAGE_PROJECTION_ID_MISMATCH:${page.locale}`,
      );

      assert.equal(
        page.projectionFingerprint,
        String(
          projected.fingerprint,
        ),
        `V8_29_PAGE_PROJECTION_FINGERPRINT_MISMATCH:${page.locale}`,
      );

      assert.equal(
        page.body,
        runtime.content.body,
        `V8_29_PAGE_BODY_MISMATCH:${page.locale}`,
      );

      assert.ok(
        Array.isArray(
          page.alternates,
        ),
        `V8_29_PAGE_ALTERNATES_MISSING:${page.locale}`,
      );

      assert.equal(
        page.alternates.length,
        3,
        `V8_29_PAGE_ALTERNATE_CARDINALITY_INVALID:${page.locale}`,
      );
    }
  },
);

/*
 * ============================================================================
 * V8-29.16
 * MUTATION MUST BREAK THE HANDOFF FINGERPRINT
 * ============================================================================
 *
 * A valid Handoff is immutable by identity.
 *
 * Changing a canonical payload field must therefore produce a different
 * fingerprint.
 * ============================================================================
 */

test(
  "V8-29 Handoff: canonical payload mutation changes Handoff fingerprint",
  async () => {
    const {
      runtime,
      projected,
    } =
      await executeTruthToProjection();

    const handoff =
      createCanonicalHandoff({
        content:
          runtime.content,

        decisionId:
          runtime.decisionId,

        projectionId:
          projected.projectionId,

        projectionFingerprint:
          projected.fingerprint,

        scopeId:
          runtime.scopeId,

        contextId:
          runtime.contextId,
      });

    const {
      fingerprint,
      ...payload
    } =
      handoff;

    const mutatedPayload =
      {
        ...payload,

        contentId:
          `${payload.contentId}:MUTATED`,
      };

    const mutatedFingerprint =
      sha256Text(
        canonicalJson(
          mutatedPayload,
        ),
      );

    assert.notEqual(
      mutatedFingerprint,
      fingerprint,
      "V8_29_MUTATING_HANDOFF_PAYLOAD_MUST_CHANGE_FINGERPRINT",
    );
  },
);

/*
 * ============================================================================
 * FINAL CONTRACT SUMMARY
 * ============================================================================
 *
 * The tests above establish:
 *
 *   ONE runtime
 *      ↓
 *   ONE Decision
 *      ↓
 *   ONE Content
 *      ↓
 *   ONE Projection
 *      ↓
 *   ONE Handoff
 *
 * with:
 *
 *   Decision identity preserved
 *   Content identity preserved
 *   Projection identity preserved
 *   Projection fingerprint preserved
 *   Handoff fingerprint reproducible
 *   Page identity preserved
 *   CONSUME_EXISTING cannot invoke a second Publication Gate
 *
 * This is the second V8-29 truth boundary.
 * ============================================================================
 */