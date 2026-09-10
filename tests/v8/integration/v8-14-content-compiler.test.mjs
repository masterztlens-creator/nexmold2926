import assert from "node:assert/strict";
import test from "node:test";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  ContentCompiler,
} from "../../../.v8-build/src/v8/content-compiler/index.js";

import {
  contentFingerprint,
} from "../../../.v8-build/src/v8/foundation/hash.js";

const actor = {
  id: "v8-14-test",
  role: "SYSTEM",
};

function buildFixture() {
  const store = new InMemoryFoundationStore();
  const foundation = new FoundationService(store);

  const scope = foundation.registerScope(
    {
      id: "scope:v8-14",
      geography: "GLOBAL",
      industries: ["MANUFACTURING"],
      languages: ["en"],
    },
    actor,
  );

  const context = foundation.registerContext(
    {
      id: "context:v8-14",
      scopeId: scope.aggregateId,
      purpose: "V8-14 deterministic compilation test",
      variables: {
        environment: "production",
      },
    },
    actor,
  );

  const knowledge = store.append({
    aggregateType: "KNOWLEDGE",
    aggregateId: "knowledge:v8-14",
    version: 1,
    state: "VERIFIED",
    payload: {
      proposition:
        "Verified manufacturing knowledge.",
      claimIds: ["claim:v8-14"],
    },
    lineage: [],
    actor,
    reason: "v8-14 verified knowledge fixture",
  });

  const problem = foundation.registerProblem(
    {
      id: "problem:v8-14",
      contextId: context.aggregateId,
      question:
        "What decision should be applied to this manufacturing context?",
      constraints: [
        "Use verified knowledge only.",
        "Remain within the registered scope.",
      ],
    },
    actor,
  );

  const decision = foundation.createDecision(
    {
      id: "decision:v8-14",
      problemId: problem.aggregateId,
      knowledgeIds: [knowledge.aggregateId],
      outcome:
        "Apply the verified manufacturing decision.",
      status: "APPROVED",
      fingerprint: "",
    },
    scope.aggregateId,
    context.aggregateId,
    actor,
  );

  return {
    store,
    foundation,
    scope,
    context,
    problem,
    knowledge,
    decision,
  };
}

test("V8-14 Content Compiler PASS", () => {
  const fixture = buildFixture();

  const compiler =
    new ContentCompiler(fixture.store);

  const result = compiler.compile({
    decisionId: fixture.decision.aggregateId,
    scopeId: fixture.scope.aggregateId,
    contextId: fixture.context.aggregateId,
    title: "Verified Manufacturing Decision",
  });

  assert.equal(result.content.decisionId, fixture.decision.aggregateId);
  assert.equal(
    result.content.title,
    "Verified Manufacturing Decision",
  );

  assert.match(
    result.content.body,
    /Problem/,
  );

  assert.match(
    result.content.body,
    /Decision/,
  );

  assert.match(
    result.content.body,
    /Verified knowledge/,
  );

  assert.match(
    result.content.body,
    /Verified manufacturing knowledge/,
  );

  assert.equal(
    result.lineage.some(
      (item) =>
        item.type === "DECISION" &&
        item.id === fixture.decision.aggregateId,
    ),
    true,
  );

  assert.equal(
    result.lineage.some(
      (item) =>
        item.type === "PROBLEM" &&
        item.id === fixture.problem.aggregateId,
    ),
    true,
  );

  assert.equal(
    result.lineage.some(
      (item) =>
        item.type === "CONTEXT" &&
        item.id === fixture.context.aggregateId,
    ),
    true,
  );

  assert.equal(
    result.lineage.some(
      (item) =>
        item.type === "KNOWLEDGE" &&
        item.id === fixture.knowledge.aggregateId,
    ),
    true,
  );

  fixture.store.verifyChain();
});

test("V8-14 deterministic output PASS", () => {
  const fixture = buildFixture();

  const compiler =
    new ContentCompiler(fixture.store);

  const input = {
    decisionId: fixture.decision.aggregateId,
    scopeId: fixture.scope.aggregateId,
    contextId: fixture.context.aggregateId,
    title: "Deterministic Content",
  };

  const first = compiler.compile(input);
  const second = compiler.compile(input);

  assert.deepEqual(
    first.content,
    second.content,
  );

  assert.equal(
    first.fingerprint,
    second.fingerprint,
  );

  assert.deepEqual(
    first.lineage,
    second.lineage,
  );
});

test("V8-14 BLOCKS wrong scope", () => {
  const fixture = buildFixture();

  const compiler =
    new ContentCompiler(fixture.store);

  assert.throws(
    () =>
      compiler.compile({
        decisionId: fixture.decision.aggregateId,
        scopeId: "scope:wrong",
        contextId: fixture.context.aggregateId,
        title: "Blocked",
      }),
    /V8_DECISION_VALIDATION_FAILED/,
  );
});

test("V8-14 BLOCKS wrong context", () => {
  const fixture = buildFixture();

  const compiler =
    new ContentCompiler(fixture.store);

  assert.throws(
    () =>
      compiler.compile({
        decisionId: fixture.decision.aggregateId,
        scopeId: fixture.scope.aggregateId,
        contextId: "context:wrong",
        title: "Blocked",
      }),
    /V8_CONTENT_COMPILER_CONTEXT_MISMATCH/,
  );
});

test("V8-14 BLOCKS unverified knowledge", () => {
  const fixture = buildFixture();

  const unverifiedKnowledge = fixture.store.append({
    aggregateType: "KNOWLEDGE",
    aggregateId: "knowledge:v8-14-unverified",
    version: 1,
    state: "REQUIRES_REVIEW",
    payload: {
      proposition:
        "Unverified manufacturing knowledge.",
      claimIds: ["claim:v8-14-unverified"],
    },
    lineage: [],
    actor,
    reason: "v8-14 unverified knowledge fixture",
  });

  const unverifiedDecisionPayload = {
    problemId: fixture.problem.aggregateId,
    knowledgeIds: [unverifiedKnowledge.aggregateId],
    outcome:
      "Apply the unverified manufacturing decision.",
    status: "APPROVED",
  };

  const unverifiedDecision = fixture.store.append({
    aggregateType: "DECISION",
    aggregateId: "decision:v8-14-unverified",
    version: 1,
    state: "APPROVED",
    payload: {
      ...unverifiedDecisionPayload,
      fingerprint: contentFingerprint(
        unverifiedDecisionPayload,
      ),
    },
    lineage: [],
    actor,
    reason: "v8-14 unverified decision fixture",
  });

  const compiler =
    new ContentCompiler(fixture.store);

  assert.throws(
    () =>
      compiler.compile({
        decisionId: unverifiedDecision.aggregateId,
        scopeId: fixture.scope.aggregateId,
        contextId: fixture.context.aggregateId,
        title: "Blocked",
      }),
    /V8_DECISION_VALIDATION_FAILED/,
  );

  fixture.store.verifyChain();
});