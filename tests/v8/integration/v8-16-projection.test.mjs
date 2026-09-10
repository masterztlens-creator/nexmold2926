import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  ContentCompiler,
} from "../../../.v8-build/src/v8/content-compiler/index.js";

import {
  PublicationEligibilityEvaluator,
} from "../../../.v8-build/src/v8/publication-eligibility/index.js";

import {
  ProjectionProjector,
} from "../../../.v8-build/src/v8/projection/index.js";

import {
  createKnowledge,
} from "../../../.v8-build/src/v8/domain/knowledge.js";

import {
  contentFingerprint,
} from "../../../.v8-build/src/v8/foundation/hash.js";

const actor = {
  id: "v8-16-test",
  role: "SYSTEM",
};

const store = new InMemoryFoundationStore();
const foundation = new FoundationService(store);

const scope = foundation.registerScope(
  {
    id: "scope:v8-16",
    geography: "GLOBAL",
    industries: ["MANUFACTURING"],
    languages: ["en"],
  },
  actor,
);

const context = foundation.registerContext(
  {
    id: "context:v8-16",
    scopeId: scope.aggregateId,
    purpose: "projection test",
    variables: {
      market: "industrial",
    },
  },
  actor,
);

const knowledge = createKnowledge({
  id: "knowledge:v8-16",
  proposition: "Injection molding requires controlled process conditions.",
  claimIds: ["claim:v8-16"],
  status: "APPROVED",
});

store.append({
  aggregateType: "KNOWLEDGE",
  aggregateId: knowledge.id,
  version: 1,
  state: "VERIFIED",
  payload: {
    proposition: knowledge.proposition,
    claimIds: knowledge.claimIds,
  },
  lineage: [],
  actor,
  reason: "V8-16 verified knowledge fixture",
});

const problem = foundation.registerProblem(
  {
    id: "problem:v8-16",
    contextId: context.aggregateId,
    question: "What process condition should be maintained?",
    constraints: ["Use verified knowledge only."],
  },
  actor,
);

const decision = foundation.createDecision(
  {
    id: "decision:v8-16",
    problemId: problem.aggregateId,
    knowledgeIds: [knowledge.id],
    outcome: "Maintain controlled process conditions.",
    status: "APPROVED",
    fingerprint: contentFingerprint({
      problemId: problem.aggregateId,
      knowledgeIds: [knowledge.id],
      outcome: "Maintain controlled process conditions.",
      status: "APPROVED",
    }),
  },
  scope.aggregateId,
  context.aggregateId,
  actor,
);

const compiler = new ContentCompiler(store);

const compiled = compiler.compile({
  decisionId: decision.aggregateId,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
  title: "Injection Molding Process Conditions",
});

const eligibility =
  new PublicationEligibilityEvaluator(store).evaluate({
    compiled,
    scopeId: scope.aggregateId,
    contextId: context.aggregateId,
  });

assert.equal(eligibility.status, "ELIGIBLE");
assert.equal(eligibility.eligible, true);

const projector = new ProjectionProjector(store);

const result = projector.project({
  compiled,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
});

assert.equal(
  result.projected.contentId,
  compiled.content.id,
);

assert.equal(
  result.projected.decisionId,
  decision.aggregateId,
);

assert.equal(
  result.projected.title,
  compiled.content.title,
);

assert.equal(
  result.projected.body,
  compiled.content.body,
);

assert.ok(result.projected.fingerprint.length > 0);
assert.ok(result.projected.lineage.length > 0);

const storedProjection = store.get(
  "PROJECTION",
  result.projected.projectionId,
);

assert.ok(storedProjection);
assert.equal(
  storedProjection.state,
  "REGISTERED",
);

assert.equal(
  storedProjection.payload.sourceFingerprint,
  compiled.fingerprint,
);

assert.equal(
  storedProjection.payload.scopeId,
  scope.aggregateId,
);

assert.equal(
  storedProjection.payload.contextId,
  context.aggregateId,
);

const second = projector.project({
  compiled,
  scopeId: scope.aggregateId,
  contextId: context.aggregateId,
});

assert.equal(
  second.projected.projectionId,
  result.projected.projectionId,
);

assert.equal(
  second.projected.fingerprint,
  result.projected.fingerprint,
);

assert.throws(
  () =>
    projector.project({
      compiled: {
        ...compiled,
        fingerprint: "tampered",
      },
      scopeId: scope.aggregateId,
      contextId: context.aggregateId,
    }),
  /V8_PROJECTION_SOURCE_FINGERPRINT_MISMATCH|V8_PROJECTION_PUBLICATION_NOT_ELIGIBLE/,
);

assert.throws(
  () =>
    projector.project({
      compiled,
      scopeId: "scope:v8-16-missing",
      contextId: context.aggregateId,
    }),
  /V8_PROJECTION_PUBLICATION_NOT_ELIGIBLE/,
);

const projectionHistory =
  store.history(
    "PROJECTION",
    result.projected.projectionId,
  );

assert.equal(projectionHistory.length, 1);

store.verifyChain();

console.log("V8-16 Projection PASS");