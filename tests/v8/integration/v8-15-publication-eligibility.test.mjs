import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  createDecision,
} from "../../../.v8-build/src/v8/domain/decision.js";

import {
  ContentCompiler,
} from "../../../.v8-build/src/v8/content-compiler/index.js";

import {
  PublicationEligibilityEvaluator,
} from "../../../.v8-build/src/v8/publication-eligibility/index.js";

import {
  contentFingerprint,
} from "../../../.v8-build/src/v8/foundation/hash.js";

const actor = {
  id: "v8-15-test",
  role: "SYSTEM",
};

const store = new InMemoryFoundationStore();
const foundation = new FoundationService(store);

const scope = foundation.registerScope(
  {
    id: "scope:v8-15",
    geography: "GLOBAL",
    industries: ["injection-molding"],
    languages: ["en"],
  },
  actor,
);

const context = foundation.registerContext(
  {
    id: "context:v8-15",
    scopeId: scope.aggregateId,
    purpose: "Publication eligibility validation",
    variables: {
      market: "B2B",
    },
  },
  actor,
);

const problem = foundation.registerProblem(
  {
    id: "problem:v8-15",
    contextId: context.aggregateId,
    question: "What manufacturing decision is supported?",
    constraints: ["Use verified knowledge only"],
  },
  actor,
);

const knowledge = store.append({
  aggregateType: "KNOWLEDGE",
  aggregateId: "knowledge:v8-15",
  version: 1,
  state: "VERIFIED",
  payload: {
    proposition:
      "Injection molding requires controlled process parameters.",
    claimIds: ["claim:v8-15"],
  },
  lineage: [],
  actor,
  reason: "V8-15 test fixture",
});

const decision = foundation.createDecision(
  createDecision({
    id: "decision:v8-15",
    problemId: problem.aggregateId,
    knowledgeIds: [knowledge.aggregateId],
    outcome:
      "Use controlled injection molding parameters.",
    status: "APPROVED",
  }),
  scope.aggregateId,
  context.aggregateId,
  actor,
);

const compiler = new ContentCompiler(store);

const compiled = compiler.compile({
  decisionId: decision.aggregateId,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
  title: "Injection Molding Process Decision",
});

const evaluator =
  new PublicationEligibilityEvaluator(store);

const eligible = evaluator.evaluate({
  compiled,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
});

assert.equal(eligible.eligible, true);
assert.equal(eligible.status, "ELIGIBLE");
assert.equal(
  eligible.decisionId,
  decision.aggregateId,
);
assert.equal(
  eligible.scopeId,
  scope.aggregateId,
);
assert.equal(
  eligible.contextId,
  context.aggregateId,
);
assert.equal(
  eligible.fingerprint,
  compiled.fingerprint,
);

assert.ok(
  eligible.lineage.some(
    (item) =>
      item.type === "DECISION" &&
      item.id === decision.aggregateId,
  ),
);

assert.ok(
  eligible.lineage.some(
    (item) =>
      item.type === "SCOPE" &&
      item.id === scope.aggregateId,
  ),
);

evaluator.assert({
  compiled,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
});

const tampered = {
  ...compiled,
  fingerprint: "tampered-fingerprint",
};

const tamperedResult = evaluator.evaluate({
  compiled: tampered,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
});

assert.equal(tamperedResult.eligible, false);
assert.equal(tamperedResult.status, "BLOCKED");
assert.ok(
  tamperedResult.reasons.includes(
    "CONTENT_FINGERPRINT_MISMATCH",
  ),
);

assert.throws(
  () =>
    evaluator.assert({
      compiled: tampered,
      scopeId: scope.aggregateId,
      contextId: context.aggregateId,
    }),
  /V8_PUBLICATION_ELIGIBILITY_BLOCKED/,
);

const wrongScope = evaluator.evaluate({
  compiled,
  scopeId: "scope:v8-15-wrong",
  contextId: context.aggregateId,
});

assert.equal(wrongScope.eligible, false);
assert.equal(wrongScope.status, "BLOCKED");

assert.ok(
  wrongScope.reasons.includes("SCOPE_NOT_FOUND") ||
    wrongScope.reasons.includes(
      "CONTEXT_SCOPE_MISMATCH",
    ),
);

const brokenDecisionFingerprint = contentFingerprint({
  problemId: decision.payload.problemId,
  knowledgeIds: decision.payload.knowledgeIds,
  outcome: decision.payload.outcome,
  status: "APPROVED",
});

const tamperedDecision = store.append({
  aggregateType: "DECISION",
  aggregateId: "decision:v8-15-tampered",
  version: 1,
  state: "APPROVED",
  payload: {
    ...decision.payload,
    fingerprint: `${brokenDecisionFingerprint}-tampered`,
  },
  lineage: decision.lineage,
  actor,
  reason: "V8-15 tamper fixture",
});

const tamperedDecisionCompiled = {
  ...compiled,
  content: {
    ...compiled.content,
    decisionId: tamperedDecision.aggregateId,
  },
  decision: tamperedDecision,
};

const tamperedDecisionResult = evaluator.evaluate({
  compiled: tamperedDecisionCompiled,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
});

assert.equal(
  tamperedDecisionResult.eligible,
  false,
);

assert.ok(
  tamperedDecisionResult.reasons.includes(
    "DECISION_FINGERPRINT_MISMATCH",
  ),
);

store.verifyChain();

console.log(
  "V8-15 Publication Eligibility PASS",
);