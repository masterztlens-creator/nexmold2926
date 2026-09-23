import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  ApplicabilityEngine,
} from "../../../.v8-build/src/v8/applicability/index.js";

import {
  createClaim,
  createKnowledge,
  createScope,
  createContext,
} from "../../../.v8-build/src/v8/domain/index.js";

const ACTOR = {
  id: "v8-25-applicability-test",
  role: "SYSTEM",
};

const AUDITOR = {
  id: "v8-25-applicability-auditor",
  role: "AUDITOR",
};

function createKnowledgeFixture() {
  const store = new InMemoryFoundationStore();
  const service = new FoundationService(store);

  const claim = createClaim({
    id: "claim:v8-25:conditioned",
    statement:
      "For ABS material at 23 C in injection molding, a 2.5 mm wall thickness is recommended.",
    evidenceIds: [],
    status: "VERIFIED",
    fingerprint: "ignored",
    scope: "injection molding",
    conditions: [
      "ABS",
      "23 C",
    ],
    units: [
      "mm",
    ],
    isUniversal: false,
  });

  /*
   * The applicability test does not need to exercise the
   * Evidence → Claim gate again.
   *
   * Persist a verified Claim fixture directly because this
   * test is specifically about Knowledge → Applicability.
   */
  store.append({
    aggregateType: "CLAIM",
    aggregateId: claim.id,
    version: 1,
    state: "VERIFIED",
    payload: {
      statement: claim.statement,
      evidenceIds: [],
      scope: claim.scope,
      conditions: claim.conditions,
      units: claim.units,
      isUniversal: claim.isUniversal,
    },
    lineage: [],
    actor: AUDITOR,
    reason: "V8-25 applicability fixture",
  });

  const knowledge = service.createKnowledge(
    createKnowledge({
      id: "knowledge:v8-25:conditioned",
      proposition:
        "For ABS material at 23 C in injection molding, a 2.5 mm wall thickness is recommended.",
      claimIds: [
        claim.id,
      ],
      status: "APPROVED",
      fingerprint: "ignored",
      scope: "injection molding",
      conditions: [
        "ABS",
        "23 C",
      ],
      units: [
        "mm",
      ],
      isUniversal: false,
    }),
    AUDITOR,
  );

  const scope = service.registerScope(
    createScope({
      id: "scope:v8-25:injection-molding",
      geography: "GLOBAL",
      industries: [
        "INJECTION_MOLDING",
      ],
      languages: [
        "en",
      ],
    }),
    ACTOR,
  );

  const context = service.registerContext(
    createContext({
      id: "context:v8-25:mismatched",
      scopeId: scope.aggregateId,
      purpose:
        "Evaluate conditioned injection-molding knowledge.",
      variables: {
        materialGrade: "PA66",
        testCondition: "180 C",
        unit: "inch",
      },
    }),
    ACTOR,
  );

  return {
    store,
    knowledge,
    scope,
    context,
  };
}

test(
  "V8-25 RED: ApplicabilityEngine currently ignores Knowledge applicability constraints",
  () => {
    const {
      store,
      knowledge,
      scope,
      context,
    } = createKnowledgeFixture();

    const engine = new ApplicabilityEngine(store);

    const result = engine.evaluate({
      knowledgeId: knowledge.aggregateId,
      scopeId: scope.aggregateId,
      contextId: context.aggregateId,
    });

    /*
     * This assertion intentionally describes the required
     * V8-25 semantic contract.
     *
     * The current implementation is expected to FAIL here
     * because it does not evaluate:
     *
     *   Knowledge.conditions
     *   Knowledge.units
     *
     * against Context.variables.
     */
    assert.equal(
      result.applicable,
      false,
      "Conditioned Knowledge must not be applicable to a Context whose variables do not satisfy its constraints.",
    );

    assert.ok(
      result.reasons.some(
        (reason) =>
          reason.startsWith(
            "KNOWLEDGE_CONDITION",
          ) ||
          reason.startsWith(
            "KNOWLEDGE_UNIT",
          ),
      ),
      "Applicability failure must explain which Knowledge constraint blocked applicability.",
    );

    store.verifyChain();
  },
);