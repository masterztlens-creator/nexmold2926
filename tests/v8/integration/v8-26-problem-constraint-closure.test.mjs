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

const store =
  new InMemoryFoundationStore();

const foundation =
  new FoundationService(store);

const actor = {
  id: "v8-26-test",
  role: "SYSTEM",
};

const scope = createScope({
  id: "scope:v8-26:eu",
  geography: "EU",
  industries: [
    "Injection Molding",
  ],
  languages: ["en"],
});

foundation.registerScope(
  scope,
  actor,
  "V8-26 scope test",
);

const context = createContext({
  id: "context:v8-26:industrial",
  scopeId: scope.id,
  purpose:
    "industrial applicability",
  variables: {
    productType:
      "injection-molded-part",
    market: "EU",
  },
});

foundation.registerContext(
  context,
  actor,
  "V8-26 context test",
);

const knowledge = store.append({
  aggregateType: "KNOWLEDGE",
  aggregateId:
    "knowledge:v8-26:verified",
  version: 1,
  state: "VERIFIED",
  payload: {
    proposition:
      "Verified V8-26 proposition.",
    claimIds: [
      "claim:v8-26",
    ],
  },
  lineage: [],
  actor,
  reason:
    "V8-26 test knowledge",
});

const problem = createProblem({
  id: "problem:v8-26:test",
  contextId: context.id,
  question:
    "Which governed decision is permitted?",
  constraints: [
    "Use verified knowledge only",
  ],
});

const problemRecord =
  foundation.registerProblem(
    problem,
    actor,
    "V8-26 problem test",
  );

const decision = createDecision({
  id: "decision:v8-26:test",
  problemId: problem.id,
  knowledgeIds: [
    knowledge.aggregateId,
  ],
  outcome:
    "Proceed under the verified applicability context.",
  status: "APPROVED",
});

const decisionRecord =
  foundation.createDecision(
    decision,
    scope.id,
    context.id,
    actor,
    "V8-26 decision test",
  );

assert.equal(
  decisionRecord.state,
  "APPROVED",
);

assert.equal(
  decisionRecord.lineage.some(
    (link) =>
      link.type === "PROBLEM" &&
      link.id === problemRecord.aggregateId &&
      link.version === problemRecord.version &&
      link.fingerprint === problemRecord.fingerprint,
  ),
  true,
);

const validator =
  new DecisionValidator(store);

const valid =
  validator.validate({
    decisionId:
      decisionRecord.aggregateId,
    scopeId: scope.id,
    contextId: context.id,
  });

assert.equal(
  valid.valid,
  true,
);

assert.deepEqual(
  valid.reasons,
  [],
);

validator.assert({
  decisionId:
    decisionRecord.aggregateId,
  scopeId: scope.id,
  contextId: context.id,
});

/*
 * BLOCK:
 * The Decision is projected with a missing
 * Problem lineage link.
 *
 * This simulates a Decision whose reference to
 * the Problem exists, but whose semantic closure
 * to the exact Problem record has been dropped.
 */
const originalGet =
  store.get.bind(store);

const missingProblemLineageStore = {
  append:
    store.append.bind(store),

  get(type, id, version) {
    const record =
      originalGet(
        type,
        id,
        version,
      );

    if (
      type === "DECISION" &&
      id ===
        decisionRecord.aggregateId &&
      record
    ) {
      return {
        ...record,
        lineage:
          record.lineage.filter(
            (link) =>
              link.type !==
              "PROBLEM",
          ),
      };
    }

    return record;
  },

  history:
    store.history.bind(store),

  auditTrail:
    store.auditTrail.bind(store),

  verifyChain:
    store.verifyChain.bind(store),
};

const missingLineageValidator =
  new DecisionValidator(
    missingProblemLineageStore,
  );

const missingLineage =
  missingLineageValidator.validate({
    decisionId:
      decisionRecord.aggregateId,
    scopeId: scope.id,
    contextId: context.id,
  });

assert.equal(
  missingLineage.valid,
  false,
);

assert.equal(
  missingLineage.reasons.some(
    (reason) =>
      reason.includes(
        "V8_PROBLEM_CONSTRAINT_LINEAGE_MISSING",
      ),
  ),
  true,
);

/*
 * BLOCK:
 * The Decision is projected with a stale
 * Problem fingerprint.
 *
 * The Decision still points at the same Problem
 * identity, but no longer proves exact semantic
 * closure to the persisted Problem payload.
 */
const staleFingerprintStore = {
  append:
    store.append.bind(store),

  get(type, id, version) {
    const record =
      originalGet(
        type,
        id,
        version,
      );

    if (
      type === "DECISION" &&
      id ===
        decisionRecord.aggregateId &&
      record
    ) {
      return {
        ...record,
        lineage:
          record.lineage.map(
            (link) =>
              link.type ===
                "PROBLEM"
                ? {
                    ...link,
                    fingerprint:
                      "stale-problem-fingerprint",
                  }
                : link,
          ),
      };
    }

    return record;
  },

  history:
    store.history.bind(store),

  auditTrail:
    store.auditTrail.bind(store),

  verifyChain:
    store.verifyChain.bind(store),
};

const staleFingerprintValidator =
  new DecisionValidator(
    staleFingerprintStore,
  );

const staleFingerprint =
  staleFingerprintValidator.validate({
    decisionId:
      decisionRecord.aggregateId,
    scopeId: scope.id,
    contextId: context.id,
  });

assert.equal(
  staleFingerprint.valid,
  false,
);

assert.equal(
  staleFingerprint.reasons.some(
    (reason) =>
      reason.includes(
        "V8_PROBLEM_CONSTRAINT_FINGERPRINT_UNBOUND",
      ),
  ),
  true,
);

/*
 * BLOCK:
 * The Problem payload is tampered in the
 * validation projection.
 *
 * The persisted fingerprint remains unchanged,
 * therefore the gate must reject the altered
 * constraint payload.
 */
const tamperedProblemStore = {
  append:
    store.append.bind(store),

  get(type, id, version) {
    const record =
      originalGet(
        type,
        id,
        version,
      );

    if (
      type === "PROBLEM" &&
      id === problemRecord.aggregateId &&
      record
    ) {
      return {
        ...record,
        payload: {
          ...record.payload,
          constraints: [
            "Constraint silently replaced",
          ],
        },
      };
    }

    return record;
  },

  history:
    store.history.bind(store),

  auditTrail:
    store.auditTrail.bind(store),

  verifyChain:
    store.verifyChain.bind(store),
};

const tamperedProblemValidator =
  new DecisionValidator(
    tamperedProblemStore,
  );

const tamperedProblem =
  tamperedProblemValidator.validate({
    decisionId:
      decisionRecord.aggregateId,
    scopeId: scope.id,
    contextId: context.id,
  });

assert.equal(
  tamperedProblem.valid,
  false,
);

assert.equal(
  tamperedProblem.reasons.some(
    (reason) =>
      reason.includes(
        "V8_PROBLEM_CONSTRAINT_FINGERPRINT_MISMATCH",
      ),
  ),
  true,
);

/*
 * Foundation history itself must remain valid.
 */
store.verifyChain();

console.log(
  "V8-26 Problem Constraint Closure PASS",
);