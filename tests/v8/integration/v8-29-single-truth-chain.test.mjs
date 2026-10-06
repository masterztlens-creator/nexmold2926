import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

import {
  runV8ArticleRuntime,
} from "../../../.v8-build/src/v8/runtime/article-runtime.js";

/*
 * ============================================================================
 * NEXMOLD V8-29
 * SINGLE TRUTH CHAIN / NO DUPLICATE DECISION CONTRACT
 * ============================================================================
 *
 * Contract:
 *
 *   ONE Publication Runtime
 *          │
 *          ├── Acquisition
 *          │
 *          ├── Verified Evidence
 *          │
 *          ├── Claim
 *          │
 *          ├── Knowledge
 *          │
 *          ├── Decision
 *          │
 *          └── Content
 *
 * MUST NOT silently create a second Decision inside the same Foundation
 * execution.
 *
 * This test intentionally audits the actual Foundation Store rather than
 * trusting runtime log output.
 *
 * V8-29 does NOT require:
 *
 *   - a second Internet acquisition
 *   - a second publication gate
 *   - production code modification
 *   - a third-party search provider
 *
 * It executes the actual Article Runtime against a deterministic PageFetcher
 * implementation and then audits the immutable Foundation audit trail.
 *
 * Important:
 *
 * Acquisition may persist a complete Evidence inventory containing more than
 * one Evidence record. That is valid.
 *
 * Runtime Truth Production, however, selects at most one canonical
 * topic-relevant Evidence record per acquisition.
 *
 * Therefore this test distinguishes:
 *
 *   persisted Evidence inventory
 *        from
 *   selected runtime Evidence
 *
 * and only requires the latter to be exactly one for this one-acquisition
 * execution.
 * ============================================================================
 */

const TEST_URL =
  "https://example.test/plastic-injection-molding-wall-thickness";

const FIXED_FETCHED_AT =
  "2026-10-06T00:00:00.000Z";

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
 * --------------------------------------------------------------------------
 * Deterministic PageFetcher
 * --------------------------------------------------------------------------
 *
 * The runtime itself remains the production Article Runtime.
 *
 * Only the network boundary is replaced with a deterministic fixture so the
 * V8-29 contract test does not depend on Internet availability.
 * --------------------------------------------------------------------------
 */

class DeterministicPageFetcher {
  constructor() {
    this.calls = [];
  }

  async fetch(
    url,
  ) {
    this.calls.push(url);

    return {
      requestedUrl:
        url,

      finalUrl:
        TEST_URL,

      redirectChain:
        [url],

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
 * --------------------------------------------------------------------------
 * Test Opportunity
 * --------------------------------------------------------------------------
 */

const opportunity = Object.freeze({
  keyword: Object.freeze({
    keyword:
      "plastic injection molding wall thickness",

    normalized:
      "plastic injection molding wall thickness",

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
      "Deterministic V8-29 Article Runtime contract fixture.",
      "Engineering information relevant to injection molding wall thickness.",
      "Requires evidence-backed publication lineage.",
    ]),
});

/*
 * --------------------------------------------------------------------------
 * Runtime execution
 * --------------------------------------------------------------------------
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
          "v8-29-single-truth-chain-test",

        role:
          "SYSTEM",
      },

      scope: {
        id:
          "scope:v8-29:injection-molding",

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
          "context:v8-29:injection-molding",

        purpose:
          "Deterministic V8-29 Single Truth Chain contract verification.",

        variables:
          {
            subject:
              "plastic injection molding wall thickness",

            audience:
              "manufacturing engineers",

            application:
              "plastic injection molding",
          },
      },

      problem: {
        id:
          "problem:v8-29:plastic-injection-molding-wall-thickness",

        question:
          "Determine applicable engineering guidance for plastic injection molding wall thickness.",

        constraints:
          [
            "Use verified evidence.",
            "Do not create unsupported universal rules.",
            "Preserve exact Decision lineage through Content.",
          ],
      },

      title:
        "Plastic Injection Molding Wall Thickness",

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
                "V8-29 deterministic test seed.",
            }),
          ],

        actorId:
          "v8-29-single-truth-chain-test",
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
 * V8-29.1
 * ONE RUNTIME EXECUTION MUST PRODUCE ONE SELECTED TRUTH CHAIN
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: one runtime produces exactly one selected Evidence, Claim, Knowledge, Decision and Content chain",
  async () => {
    const {
      store,
      runtime,
      pageFetcher,
    } =
      await executeRuntime();

    /*
     * One successful acquisition is intentional.
     */
    assert.equal(
      runtime.acquisition.acquisitions.length,
      1,
      "V8_29_ACQUISITION_COUNT_MUST_BE_ONE",
    );

    /*
     * The Article Runtime selects at most one canonical topic-relevant
     * Evidence record per acquisition.
     */
    assert.equal(
      runtime.verifiedEvidenceIds.length,
      1,
      "V8_29_SELECTED_VERIFIED_EVIDENCE_COUNT_MUST_BE_ONE",
    );

    /*
     * One selected Evidence produces one admissible Claim in this
     * deterministic runtime.
     */
    assert.equal(
      runtime.claimIds.length,
      1,
      "V8_29_CLAIM_COUNT_MUST_BE_ONE",
    );

    /*
     * One Claim produces one Knowledge record.
     */
    assert.equal(
      runtime.knowledgeIds.length,
      1,
      "V8_29_KNOWLEDGE_COUNT_MUST_BE_ONE",
    );

    /*
     * The runtime must expose exactly one Decision identity.
     */
    assert.ok(
      runtime.decisionId,
      "V8_29_DECISION_ID_MUST_EXIST",
    );

    /*
     * Content must exist and remain bound to the Decision.
     */
    assert.ok(
      runtime.content,
      "V8_29_CONTENT_MUST_EXIST",
    );

    assert.equal(
      runtime.content.decisionId,
      runtime.decisionId,
      "V8_29_CONTENT_MUST_REFERENCE_RUNTIME_DECISION",
    );

    /*
     * The deterministic fetcher must actually have been used.
     *
     * This proves the test is exercising the Article Runtime acquisition
     * boundary rather than constructing a synthetic Foundation chain by hand.
     */
    assert.ok(
      pageFetcher.calls.length >= 1,
      "V8_29_PAGE_FETCHER_MUST_BE_USED",
    );
  },
);

/*
 * ============================================================================
 * V8-29.2
 * FOUNDATION AUDIT TRAIL MUST CONTAIN EXACTLY ONE DECISION AGGREGATE
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: Foundation audit trail contains exactly one Decision aggregate",
  async () => {
    const {
      store,
      runtime,
    } =
      await executeRuntime();

    const auditTrail =
      store.auditTrail();

    const decisions =
      auditTrail.filter(
        (record) =>
          record.aggregateType ===
          "DECISION",
      );

    assert.equal(
      decisions.length,
      1,
      "V8_29_FOUNDATION_MUST_CONTAIN_EXACTLY_ONE_DECISION",
    );

    const decision =
      decisions[0];

    assert.equal(
      decision.aggregateId,
      runtime.decisionId,
      "V8_29_FOUNDATION_DECISION_MUST_MATCH_RUNTIME_DECISION",
    );

    assert.equal(
      decision.version,
      1,
      "V8_29_DECISION_MUST_HAVE_SINGLE_INITIAL_VERSION",
    );

    assert.equal(
      decision.state,
      "APPROVED",
      "V8_29_DECISION_MUST_BE_APPROVED",
    );

    assert.equal(
      decision.previousFingerprint,
      null,
      "V8_29_FIRST_DECISION_RECORD_MUST_HAVE_NO_PREVIOUS_FINGERPRINT",
    );
  },
);

/*
 * ============================================================================
 * V8-29.3
 * DECISION -> KNOWLEDGE LINEAGE
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: Decision references the exact runtime Knowledge set",
  async () => {
    const {
      store,
      runtime,
    } =
      await executeRuntime();

    const decision =
      store.get(
        "DECISION",
        runtime.decisionId,
      );

    assert.ok(
      decision,
      "V8_29_DECISION_RECORD_MUST_EXIST",
    );

    assert.deepEqual(
      decision.payload.knowledgeIds,
      runtime.knowledgeIds,
      "V8_29_DECISION_KNOWLEDGE_LINEAGE_MISMATCH",
    );
  },
);

/*
 * ============================================================================
 * V8-29.4
 * CONTENT -> DECISION LINEAGE
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: Content remains bound to the unique Decision",
  async () => {
    const {
      store,
      runtime,
    } =
      await executeRuntime();

    const decisions =
      store
        .auditTrail()
        .filter(
          (record) =>
            record.aggregateType ===
            "DECISION",
        );

    assert.equal(
      decisions.length,
      1,
      "V8_29_CONTENT_LINEAGE_REQUIRES_ONE_DECISION",
    );

    assert.equal(
      runtime.content.decisionId,
      decisions[0].aggregateId,
      "V8_29_CONTENT_DECISION_LINEAGE_BROKEN",
    );

    assert.ok(
      runtime.content.provenance.length > 0,
      "V8_29_CONTENT_PROVENANCE_MUST_EXIST",
    );
  },
);

/*
 * ============================================================================
 * V8-29.5
 * FOUNDATION CHAIN INTEGRITY
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: Foundation immutable chain verifies successfully",
  async () => {
    const {
      store,
    } =
      await executeRuntime();

    assert.doesNotThrow(
      () =>
        store.verifyChain(),
      "V8_29_FOUNDATION_CHAIN_MUST_VERIFY",
    );
  },
);

/*
 * ============================================================================
 * V8-29.6
 * NO SECOND DECISION CAN APPEAR WITHOUT A SECOND RUNTIME EXECUTION
 * ============================================================================
 *
 * This is intentionally a structural negative assertion.
 *
 * A single Article Runtime execution is allowed to create one Decision.
 *
 * If a future implementation accidentally invokes Decision creation twice
 * inside the same execution, the Foundation audit trail will contain:
 *
 *   DECISION × 2
 *
 * and this contract fails.
 *
 * The test does not artificially append a second Decision because that would
 * test the Foundation Store's append contract rather than the Article Runtime
 * Single Truth Chain.
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: one Article Runtime execution cannot silently accumulate a second Decision",
  async () => {
    const {
      store,
      runtime,
    } =
      await executeRuntime();

    const auditTrail =
      store.auditTrail();

    const decisionIds =
      auditTrail
        .filter(
          (record) =>
            record.aggregateType ===
            "DECISION",
        )
        .map(
          (record) =>
            record.aggregateId,
        );

    assert.equal(
      new Set(decisionIds).size,
      1,
      "V8_29_DECISION_ID_SET_MUST_HAVE_CARDINALITY_ONE",
    );

    assert.equal(
      decisionIds[0],
      runtime.decisionId,
      "V8_29_UNIQUE_DECISION_ID_MUST_MATCH_RUNTIME",
    );

    assert.equal(
      decisionIds.length,
      1,
      "V8_29_SINGLE_RUNTIME_MUST_NOT_CREATE_SECOND_DECISION",
    );
  },
);

/*
 * ============================================================================
 * V8-29.7
 * COMPLETE SELECTED TRUTH CHAIN IDENTITY
 * ============================================================================
 */

test(
  "V8-29 Single Truth Chain: selected Evidence -> Claim -> Knowledge -> Decision -> Content identity is closed",
  async () => {
    const {
      store,
      runtime,
    } =
      await executeRuntime();

    const claimRecords =
      runtime.claimIds.map(
        (id) =>
          store.get(
            "CLAIM",
            id,
          ),
      );

    const knowledgeRecords =
      runtime.knowledgeIds.map(
        (id) =>
          store.get(
            "KNOWLEDGE",
            id,
          ),
      );

    assert.equal(
      claimRecords.length,
      1,
      "V8_29_CLAIM_RECORD_CARDINALITY_INVALID",
    );

    assert.ok(
      claimRecords[0],
      "V8_29_CLAIM_RECORD_MISSING",
    );

    assert.equal(
      knowledgeRecords.length,
      1,
      "V8_29_KNOWLEDGE_RECORD_CARDINALITY_INVALID",
    );

    assert.ok(
      knowledgeRecords[0],
      "V8_29_KNOWLEDGE_RECORD_MISSING",
    );

    assert.deepEqual(
      knowledgeRecords[0].payload.claimIds,
      runtime.claimIds,
      "V8_29_KNOWLEDGE_CLAIM_LINEAGE_MISMATCH",
    );

    assert.deepEqual(
      claimRecords[0].payload.evidenceIds,
      runtime.verifiedEvidenceIds,
      "V8_29_CLAIM_EVIDENCE_LINEAGE_MISMATCH",
    );

    const decision =
      store.get(
        "DECISION",
        runtime.decisionId,
      );

    assert.ok(
      decision,
      "V8_29_DECISION_RECORD_MISSING",
    );

    assert.deepEqual(
      decision.payload.knowledgeIds,
      runtime.knowledgeIds,
      "V8_29_DECISION_KNOWLEDGE_LINEAGE_MISMATCH",
    );

    assert.equal(
      runtime.content.decisionId,
      decision.aggregateId,
      "V8_29_CONTENT_DECISION_LINEAGE_MISMATCH",
    );
  },
);