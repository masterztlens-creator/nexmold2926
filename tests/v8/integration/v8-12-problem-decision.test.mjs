import assert from "node:assert/strict";
import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";
import {
  FoundationService,
} from "../../../.v8-build/src/v8/foundation/service.js";
import {
  createScope,
} from "../../../.v8-build/src/v8/domain/scope.js";
import {
  createContext,
} from "../../../.v8-build/src/v8/domain/context.js";
import {
  createProblem,
} from "../../../.v8-build/src/v8/domain/problem.js";
import {
  createDecision,
} from "../../../.v8-build/src/v8/domain/decision.js";
import {
  ApplicabilityEngine,
} from "../../../.v8-build/src/v8/applicability/engine.js";
const store = new InMemoryFoundationStore();
const foundation = new FoundationService(store);
const actor = {
  id: "v8-12-test",
  role: "SYSTEM",
};
const scope = createScope({
  id: "scope:v8-12:eu",
  geography: "EU",
  industries: ["Injection Molding"],
  languages: ["en"],
});
foundation.registerScope(
  scope,
  actor,
  "V8-12 scope test",
);
const context = createContext({
  id: "context:v8-12:industrial",
  scopeId: scope.id,
  purpose: "industrial applicability",
  variables: {
    productType: "injection-molded-part",
    market: "EU",
  },
});
foundation.registerContext(
  context,
  actor,
  "V8-12 context test",
);
const knowledge = store.append({
  aggregateType: "KNOWLEDGE",
  aggregateId: "knowledge:v8-12:verified",
  version: 1,
  state: "VERIFIED",
  payload: {
    proposition: "Verified V8-12 proposition.",
    claimIds: ["claim:v8-12"],
  },
  lineage: [],
  actor,
  reason: "V8-12 test knowledge",
});
assert.equal(
  knowledge.state,
  "VERIFIED",
);
const problem = createProblem({
  id: "problem:v8-12:test",
  contextId: context.id,
  question: "Which governed decision is permitted?",
  constraints: [
    "Use verified knowledge only",
  ],
});
const problemRecord = foundation.registerProblem(
  problem,
  actor,
  "V8-12 problem test",
);
assert.equal(
  problemRecord.aggregateType,
  "PROBLEM",
);
assert.equal(
  problemRecord.state,
  "REGISTERED",
);
const applicability =
  new ApplicabilityEngine(store);
const applicabilityResult =
  applicability.evaluate({
    knowledgeId: knowledge.aggregateId,
    scopeId: scope.id,
    contextId: context.id,
  });
assert.equal(
  applicabilityResult.applicable,
  true,
);
const decision = createDecision({
  id: "decision:v8-12:test",
  problemId: problem.id,
  knowledgeIds: [knowledge.aggregateId],
  outcome: "Proceed under the verified applicability context.",
  status: "APPROVED",
});
const decisionRecord =
  foundation.createDecision(
    decision,
    scope.id,
    context.id,
    actor,
    "V8-12 decision test",
  );
assert.equal(
  decisionRecord.aggregateType,
  "DECISION",
);
assert.equal(
  decisionRecord.state,
  "APPROVED",
);
assert.equal(
  decisionRecord.payload.status,
  "APPROVED",
);
assert.equal(
  decisionRecord.payload.problemId,
  problem.id,
);
assert.deepEqual(
  decisionRecord.payload.knowledgeIds,
  [knowledge.aggregateId],
);
const lineageTypes =
  decisionRecord.lineage.map(
    (item) => item.type,
  );
assert.equal(
  lineageTypes.includes("PROBLEM"),
  true,
);
assert.equal(
  lineageTypes.includes("KNOWLEDGE"),
  true,
);
assert.equal(
  lineageTypes.includes("CONTEXT"),
  true,
);
assert.equal(
  lineageTypes.includes("SCOPE"),
  true,
);
assert.throws(
  () =>
    foundation.createDecision(
      createDecision({
        id: "decision:v8-12:blocked",
        problemId: problem.id,
        knowledgeIds: [
          "knowledge:v8-12:missing",
        ],
        outcome: "Must be blocked.",
        status: "APPROVED",
      }),
      scope.id,
      context.id,
      actor,
      "V8-12 blocked knowledge test",
    ),
  /V8_APPLICABILITY_BLOCKED/,
);
assert.throws(
  () =>
    foundation.registerProblem(
      createProblem({
        id: "problem:v8-12:no-context",
        contextId: "context:v8-12:missing",
        question: "This must fail.",
        constraints: [],
      }),
      actor,
      "V8-12 missing context test",
    ),
  /V8_FOUNDATION_PROBLEM_CONTEXT_NOT_REGISTERED/,
);
const otherScope = createScope({
  id: "scope:v8-12:other",
  geography: "US",
  industries: ["Injection Molding"],
  languages: ["en"],
});
foundation.registerScope(
  otherScope,
  actor,
  "V8-12 second scope test",
);
assert.throws(
  () =>
    foundation.createDecision(
      decision,
      otherScope.id,
      context.id,
      actor,
      "V8-12 scope mismatch test",
    ),
  /V8_FOUNDATION_DECISION_SCOPE_MISMATCH/,
);
store.verifyChain();
console.log(
  "V8-12 Problem/Decision PASS",
);