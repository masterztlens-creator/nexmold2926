import assert from "node:assert/strict";
import { InMemoryFoundationStore } from "../../../.v8-build/src/v8/foundation/store.js";
import { FoundationService } from "../../../.v8-build/src/v8/foundation/service.js";
import { createScope } from "../../../.v8-build/src/v8/domain/scope.js";
import { createContext } from "../../../.v8-build/src/v8/domain/context.js";
import { ApplicabilityEngine } from "../../../.v8-build/src/v8/applicability/engine.js";
const actor = { id: "v8-11b-test", role: "SYSTEM" };
function appendKnowledge(store, id, state = "VERIFIED") {
  return store.append({
    aggregateType: "KNOWLEDGE",
    aggregateId: id,
    version: 1,
    state,
    payload: {
      proposition: "Injection molding draft angle is applicable to the defined context.",
      claimIds: ["claim:test:v8-11b"],
    },
    lineage: [],
    actor,
    reason: "V8-11B test knowledge",
  });
}
const store = new InMemoryFoundationStore();
const foundation = new FoundationService(store);
const scope = createScope({
  id: "scope:eu:injection-molding:en",
  geography: "EU",
  industries: ["Injection Molding"],
  languages: ["en"],
});
foundation.registerScope(scope, actor, "V8-11B test scope");
const context = createContext({
  id: "context:eu:industrial-applicability",
  scopeId: scope.id,
  purpose: "industrial applicability",
  variables: {
    productType: "injection molded part",
    market: "EU",
  },
});
foundation.registerContext(
  context,
  actor,
  "V8-11B test context",
);
const knowledge = appendKnowledge(
  store,
  "knowledge:v8-11b:verified",
);
const engine = new ApplicabilityEngine(store);
const applicable = engine.evaluate({
  knowledgeId: knowledge.aggregateId,
  scopeId: scope.id,
  contextId: context.id,
});
assert.equal(applicable.applicable, true);
assert.deepEqual(applicable.reasons, []);
assert.deepEqual(
  applicable.lineage.map((x) => x.type),
  ["KNOWLEDGE", "SCOPE", "CONTEXT"],
);
assert.equal(applicable.lineage[0].id, knowledge.aggregateId);
assert.equal(applicable.lineage[1].id, scope.id);
assert.equal(applicable.lineage[2].id, context.id);
const missingKnowledge = engine.evaluate({
  knowledgeId: "knowledge:v8-11b:missing",
  scopeId: scope.id,
  contextId: context.id,
});
assert.equal(missingKnowledge.applicable, false);
assert.ok(missingKnowledge.reasons.includes("KNOWLEDGE_NOT_FOUND"));
appendKnowledge(
  store,
  "knowledge:v8-11b:proposed",
  "PROPOSED",
);
const unverifiedKnowledge = engine.evaluate({
  knowledgeId: "knowledge:v8-11b:proposed",
  scopeId: scope.id,
  contextId: context.id,
});
assert.equal(unverifiedKnowledge.applicable, false);
assert.ok(
  unverifiedKnowledge.reasons.includes("KNOWLEDGE_NOT_VERIFIED"),
);
const missingScope = engine.evaluate({
  knowledgeId: knowledge.aggregateId,
  scopeId: "scope:v8-11b:missing",
  contextId: context.id,
});
assert.equal(missingScope.applicable, false);
assert.ok(missingScope.reasons.includes("SCOPE_NOT_FOUND"));
const missingContext = engine.evaluate({
  knowledgeId: knowledge.aggregateId,
  scopeId: scope.id,
  contextId: "context:v8-11b:missing",
});
assert.equal(missingContext.applicable, false);
assert.ok(missingContext.reasons.includes("CONTEXT_NOT_FOUND"));
const otherScope = createScope({
  id: "scope:us:injection-molding:en",
  geography: "US",
  industries: ["Injection Molding"],
  languages: ["en"],
});
foundation.registerScope(
  otherScope,
  actor,
  "V8-11B mismatch scope",
);
const mismatch = engine.evaluate({
  knowledgeId: knowledge.aggregateId,
  scopeId: otherScope.id,
  contextId: context.id,
});
assert.equal(mismatch.applicable, false);
assert.ok(
  mismatch.reasons.includes("CONTEXT_SCOPE_MISMATCH"),
);
assert.throws(
  () =>
    engine.assert({
      knowledgeId: "knowledge:v8-11b:missing",
      scopeId: scope.id,
      contextId: context.id,
    }),
  /V8_APPLICABILITY_BLOCKED/,
);
store.verifyChain();
console.log("V8-11B Applicability PASS");