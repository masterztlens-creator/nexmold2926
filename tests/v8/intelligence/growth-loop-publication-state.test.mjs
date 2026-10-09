
import test from "node:test";
import assert from "node:assert/strict";

import {
  advanceGrowthLoop,
} from "../../../.v8-build/src/v8/intelligence/growth-loop/loop.js";

import {
  createGrowthState,
} from "../../../.v8-build/src/v8/intelligence/pipeline.js";

function createState(overrides = {}) {
  return createGrowthState({
    cycleId: "growth-cycle:publication-state-001",
    keywords: [],
    opportunities: [],
    ...overrides,
  });
}

function createDecision(overrides = {}) {
  return {
    nextOpportunities: [],
    publishCandidates: [
      "plastic injection molding wall thickness",
    ],
    blocked: [],
    ...overrides,
  };
}

function createReceipt(overrides = {}) {
  return {
    candidateId: "plastic injection molding wall thickness",
    slug: "plastic-injection-molding-wall-thickness",
    routeUrl:
      "https://www.nexmold.com/knowledge/plastic-injection-molding-wall-thickness/",
    artifactFingerprint: "sha256:verified-artifact-fingerprint",
    verifiedAt: "2026-10-09T00:00:00.000Z",
    state: "VERIFIED",
    ...overrides,
  };
}

test(
  "candidate selection alone never marks content as published",
  () => {
    const state = createState();
    const decision = createDecision();

    const next = advanceGrowthLoop(state, decision);

    assert.deepEqual(next.publishedSlugs, []);
    assert.deepEqual(
      next.publishedSlugs,
      state.publishedSlugs,
    );
  },
);

test(
  "an explicitly verified publication receipt confirms its candidate",
  () => {
    const state = createState();
    const decision = createDecision();

    const next = advanceGrowthLoop(
      state,
      decision,
      [createReceipt()],
    );

    assert.deepEqual(next.publishedSlugs, [
      "plastic injection molding wall thickness",
    ]);
  },
);

test(
  "a receipt for a candidate absent from the decision is rejected",
  () => {
    const state = createState();
    const decision = createDecision();

    assert.throws(
      () =>
        advanceGrowthLoop(
          state,
          decision,
          [
            createReceipt({
              candidateId: "unrelated candidate",
            }),
          ],
        ),
      /non-candidate/,
    );

    assert.deepEqual(state.publishedSlugs, []);
  },
);

test(
  "duplicate receipts for the same candidate are rejected",
  () => {
    const state = createState();
    const decision = createDecision();

    assert.throws(
      () =>
        advanceGrowthLoop(
          state,
          decision,
          [
            createReceipt(),
            createReceipt({
              artifactFingerprint: "sha256:another-fingerprint",
            }),
          ],
        ),
      /duplicate publication receipt/,
    );
  },
);

test(
  "a receipt with a non-verified state is rejected",
  () => {
    const state = createState();
    const decision = createDecision();

    assert.throws(
      () =>
        advanceGrowthLoop(
          state,
          decision,
          [
            createReceipt({
              state: "PUBLISHING",
            }),
          ],
        ),
      /must be VERIFIED/,
    );
  },
);

test(
  "a receipt without an artifact fingerprint is rejected",
  () => {
    const state = createState();
    const decision = createDecision();

    assert.throws(
      () =>
        advanceGrowthLoop(
          state,
          decision,
          [
            createReceipt({
              artifactFingerprint: " ",
            }),
          ],
        ),
      /artifactFingerprint/,
    );
  },
);

test(
  "a receipt with an invalid route URL is rejected",
  () => {
    const state = createState();
    const decision = createDecision();

    assert.throws(
      () =>
        advanceGrowthLoop(
          state,
          decision,
          [
            createReceipt({
              routeUrl: "not-a-valid-url",
            }),
          ],
        ),
      /absolute URL/,
    );
  },
);

test(
  "a receipt with an invalid verification timestamp is rejected",
  () => {
    const state = createState();
    const decision = createDecision();

    assert.throws(
      () =>
        advanceGrowthLoop(
          state,
          decision,
          [
            createReceipt({
              verifiedAt: "not-a-timestamp",
            }),
          ],
        ),
      /valid timestamp/,
    );
  },
);

test(
  "already published candidate IDs are not appended again",
  () => {
    const candidateId =
      "plastic injection molding wall thickness";

    const state = createState({
      publishedSlugs: [candidateId],
    });

    const decision = createDecision();

    const next = advanceGrowthLoop(
      state,
      decision,
      [createReceipt()],
    );

    assert.deepEqual(next.publishedSlugs, [candidateId]);
  },
);

test(
  "confirmed publication preserves blocked decisions",
  () => {
    const state = createState();

    const decision = createDecision({
      blocked: ["low-value-topic"],
    });

    const next = advanceGrowthLoop(
      state,
      decision,
      [createReceipt()],
    );

    assert.deepEqual(next.publishedSlugs, [
      "plastic injection molding wall thickness",
    ]);

    assert.deepEqual(next.blocked, ["low-value-topic"]);
  },
);