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
  DecisionValidator,
} from "../../../.v8-build/src/v8/decision-validation/validator.js";

const store = new InMemoryFoundationStore();
const foundation = new FoundationService(store);

const actor = {
  id: "v8-13-test",
  role: "SYSTEM",
};

const scope = createScope({
  id: "scope:v8-13:eu",
  geography: "EU",
  industries: ["Injection Molding"],
  languages: ["en"],
});

foundation.registerScope(
  scope,
  actor,
  "V8-13 scope test",
);

const context = createContext({
  id: "context:v8-13:industrial",
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
  "V8-13 context test",
);

const knowledge = store.append({
  aggregateType: "KNOWLEDGE",
  aggregateId: "knowledge:v8-13:verified",
  version: 1,
  state: "VERIFIED",
  payload: {
    proposition: "Verified V8-13 proposition.",
    claimIds: ["claim:v8-13"],
  },
  lineage: [],
  actor,
  reason: "V8-13 test knowledge",
});

const problem = createProblem({
  id: "problem:v8-13:test",
  contextId: context.id,
  question: "Which governed decision is valid?",
  constraints: [
    "Use verified knowledge only",
  ],
});

foundation.registerProblem(
  problem,
  actor,
  "V8-13 problem test",
);

const decision = createDecision({
  id: "decision:v8-13:test",
  problemId: problem.id,
  knowledgeIds: [knowledge.aggregateId],
  outcome: "Proceed under the verified applicability context.",
  status: "APPROVED",
});

const decisionRecord = foundation.createDecision(
  decision,
  scope.id,
  context.id,
  actor,
  "V8-13 decision test",
);

assert.equal(
  decisionRecord.state,
  "APPROVED",
);

const validator = new DecisionValidator(store);

/*
 * PASS:
 * complete Decision → Problem → Context → Scope
 * plus VERIFIED Knowledge and Applicability.
 */
const valid = validator.validate({
  decisionId: decisionRecord.aggregateId,
  scopeId: scope.id,
  contextId: context.id,
});

assert.equal(valid.valid, true);
assert.deepEqual(valid.reasons, []);

const lineageTypes = valid.lineage.map(
  (item) => item.type,
);

assert.equal(
  lineageTypes.includes("DECISION"),
  true,
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

validator.assert({
  decisionId: decisionRecord.aggregateId,
  scopeId: scope.id,
  contextId: context.id,
});

/*
 * BLOCK:
 * Decision fingerprint tampering.
 *
 * The underlying Foundation record remains unchanged;
 * the validator receives a tampered projection.
 */
const originalGet = store.get.bind(store);

const tamperedStore = {
  append: store.append.bind(store),
  get(type, id, version) {
    const record = originalGet(type, id, version);

    if (
      type === "DECISION" &&
      id === decisionRecord.aggregateId &&
      record
    ) {
      return {
        ...record,
        payload: {
          ...record.payload,
          outcome: "Tampered outcome.",
        },
      };
    }

    return record;
  },
  history: store.history.bind(store),
  auditTrail: store.auditTrail.bind(store),
  verifyChain: store.verifyChain.bind(store),
};

const tamperedValidator = new DecisionValidator(
  tamperedStore,
);

const tampered = tamperedValidator.validate({
  decisionId: decisionRecord.aggregateId,
  scopeId: scope.id,
  contextId: context.id,
});

assert.equal(tampered.valid, false);

assert.equal(
  tampered.reasons.includes(
    "DECISION_FINGERPRINT_MISMATCH",
  ),
  true,
);

assert.throws(
  () =>
    tamperedValidator.assert({
      decisionId: decisionRecord.aggregateId,
      scopeId: scope.id,
      contextId: context.id,
    }),
  /V8_DECISION_VALIDATION_FAILED/,
);

/*
 * BLOCK:
 * wrong Scope.
 */
const otherScope = createScope({
  id: "scope:v8-13:other",
  geography: "US",
  industries: ["Injection Molding"],
  languages: ["en"],
});

foundation.registerScope(
  otherScope,
  actor,
  "V8-13 second scope test",
);

const wrongScope = validator.validate({
  decisionId: decisionRecord.aggregateId,
  scopeId: otherScope.id,
  contextId: context.id,
});

assert.equal(wrongScope.valid, false);

assert.equal(
  wrongScope.reasons.includes(
    "CONTEXT_SCOPE_MISMATCH",
  ),
  true,
);

/*
 * BLOCK:
 * missing Decision.
 */
const missing = validator.validate({
  decisionId: "decision:v8-13:missing",
  scopeId: scope.id,
  contextId: context.id,
});

assert.equal(missing.valid, false);

assert.deepEqual(
  missing.reasons,
  ["DECISION_NOT_FOUND"],
);

/*
 * BLOCK:
 * missing Knowledge / Applicability failure.
 *
 * The Foundation createDecision() boundary already prevents
 * this from becoming a real approved Decision. We verify that
 * the validation boundary independently rejects the same shape.
 */
const missingKnowledgeStore = {
  append: store.append.bind(store),
  get(type, id, version) {
    if (
      type === "DECISION" &&
      id === decisionRecord.aggregateId
    ) {
      return {
        ...decisionRecord,
        payload: {
          ...decisionRecord.payload,
          knowledgeIds: [
            "knowledge:v8-13:missing",
          ],
          fingerprint: decisionRecord.payload.fingerprint,
        },
      };
    }

    return originalGet(type, id, version);
  },
  history: store.history.bind(store),
  auditTrail: store.auditTrail.bind(store),
  verifyChain: store.verifyChain.bind(store),
};

const missingKnowledgeValidator =
  new DecisionValidator(
    missingKnowledgeStore,
  );

const missingKnowledge =
  missingKnowledgeValidator.validate({
    decisionId: decisionRecord.aggregateId,
    scopeId: scope.id,
    contextId: context.id,
  });

assert.equal(
  missingKnowledge.valid,
  false,
);

assert.equal(
  missingKnowledge.reasons.some(
    (reason) =>
      reason.startsWith("KNOWLEDGE_NOT_FOUND:"),
  ),
  true,
);

/*
 * Foundation history must remain valid.
 */
store.verifyChain();

console.log(
  "V8-13 Decision Validation PASS",
);