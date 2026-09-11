import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  FoundationService,
  InMemoryFoundationStore,
  createSource,
  createClaim,
  createKnowledge,
  createScope,
  createContext,
  createProblem,
  createDecision,
} from "../../../.v8-build/src/v8/index.js";

import { DecisionValidator } from "../../../.v8-build/src/v8/decision-validation/index.js";

const actor = {
  id: "truth-chain-test",
  role: "SYSTEM",
};

const auditor = {
  id: "truth-chain-auditor",
  role: "AUDITOR",
};

function fixtureHash(content) {
  return createHash("sha256")
    .update(JSON.stringify(content), "utf8")
    .digest("hex");
}

test(
  "V8 Truth Chain closes Evidence → Claim → Knowledge → Decision through persistence/readback",
  () => {
    const store = new InMemoryFoundationStore();
    const svc = new FoundationService(store);

    /*
     * ------------------------------------------------------------
     * 1. SOURCE
     * ------------------------------------------------------------
     */

    const content =
      "Draft angle must be sufficient for reliable part ejection.";

    const source = createSource({
      kind: "PUBLIC_WEB",
      locator: "https://example.test/draft-angle",
      access: "PAYLOAD_ALLOWED",
      title: "Draft Angle Engineering Reference",
      version: "1",
      publisher: "NEXMOLD Test Authority",
      authority: "ENGINEERING_REFERENCE",
      canonicalUrl: "https://example.test/draft-angle",
      retrievedAt: "2026-09-10T00:00:00.000Z",
      documentHash: fixtureHash(content),
    });

    svc.registerSource(source, actor);

    /*
     * ------------------------------------------------------------
     * 2. SNAPSHOT
     * ------------------------------------------------------------
     */

    const snapshot = svc.captureSnapshot(
      {
        source,
        capturedAt: "2026-09-10T00:00:00.000Z",
        locator: source.locator,
        content,
        metadataOnly: false,
      },
      actor,
    );

    svc.sealSnapshot(snapshot.aggregateId, actor);

    /*
     * ------------------------------------------------------------
     * 3. EVIDENCE
     * ------------------------------------------------------------
     */

    const evidence = svc.ingestEvidence(
      {
        id: "evidence:truth-chain:1",
        sourceId: source.id,
        locator: "draft-angle:p1",
        excerpt: content,
        ingestion: "INGESTED",
        capturedAt: snapshot.recordedAt,
        snapshotId: snapshot.aggregateId,
      },
      actor,
    );

    /*
     * ------------------------------------------------------------
     * 4. VERIFIED EVIDENCE
     * ------------------------------------------------------------
     */

    svc.verifyEvidence(evidence.aggregateId, auditor);

    /*
     * ------------------------------------------------------------
     * 5. CLAIM
     *
     * Explicit closure:
     * Claim.evidenceIds -> Evidence
     * ------------------------------------------------------------
     */

    const claim = svc.createClaim(
      createClaim({
        id: "claim:truth-chain:1",
        statement:
          "Draft angle is required for reliable part ejection.",
        evidenceIds: [evidence.aggregateId],
        status: "VERIFIED",
        fingerprint: "ignored",
        epistemicLevel: "ENGINEERING_INFERENCE",
        confidence: "HIGH",
      }),
      auditor,
    );

    /*
     * ------------------------------------------------------------
     * 6. KNOWLEDGE
     *
     * Explicit closure:
     * Knowledge.claimIds -> Claim
     * ------------------------------------------------------------
     */

    const knowledge = svc.createKnowledge(
      createKnowledge({
        id: "knowledge:truth-chain:1",
        proposition:
          "Reliable part ejection requires adequate draft angle.",
        claimIds: [claim.aggregateId],
        status: "APPROVED",
        fingerprint: "ignored",
      }),
      actor,
    );

    /*
     * ------------------------------------------------------------
     * 7. SCOPE
     * ------------------------------------------------------------
     */

    const scope = svc.registerScope(
      createScope({
        id: "scope:truth-chain:1",
        geography: "GLOBAL",
        industries: ["INJECTION_MOLDING"],
        languages: ["en"],
      }),
      actor,
    );

    /*
     * ------------------------------------------------------------
     * 8. CONTEXT
     *
     * Explicit closure:
     * Context.scopeId -> Scope
     * ------------------------------------------------------------
     */

    const context = svc.registerContext(
      createContext({
        id: "context:truth-chain:1",
        scopeId: scope.aggregateId,
        purpose:
          "Evaluate draft-angle applicability for injection molding.",
        variables: {
          process: "injection-molding",
        },
      }),
      actor,
    );

    /*
     * ------------------------------------------------------------
     * 9. PROBLEM
     *
     * Explicit closure:
     * Problem.contextId -> Context
     * ------------------------------------------------------------
     */

    const problem = svc.registerProblem(
      createProblem({
        id: "problem:truth-chain:1",
        contextId: context.aggregateId,
        question:
          "Is the knowledge applicable to this injection-molding context?",
        constraints: [
          "Use only verified knowledge.",
        ],
      }),
      actor,
    );

    /*
     * ------------------------------------------------------------
     * 10. DECISION
     *
     * Explicit closure:
     * Decision.problemId -> Problem
     * Decision.knowledgeIds -> Knowledge
     * Decision scope/context -> Scope/Context
     * ------------------------------------------------------------
     */

    const decision = svc.createDecision(
      createDecision({
        id: "decision:truth-chain:1",
        problemId: problem.aggregateId,
        knowledgeIds: [knowledge.aggregateId],
        outcome:
          "Use adequate draft angle for reliable part ejection.",
        status: "APPROVED",
        fingerprint: "ignored",
      }),
      scope.aggregateId,
      context.aggregateId,
      actor,
    );

    /*
     * ------------------------------------------------------------
     * 11. FOUNDATION PERSISTENCE / READBACK
     *
     * Read every aggregate back from the actual Foundation Store.
     * ------------------------------------------------------------
     */

    const decisionRecord = store.get(
      "DECISION",
      decision.aggregateId,
    );

    const problemRecord = store.get(
      "PROBLEM",
      problem.aggregateId,
    );

    const contextRecord = store.get(
      "CONTEXT",
      context.aggregateId,
    );

    const scopeRecord = store.get(
      "SCOPE",
      scope.aggregateId,
    );

    const knowledgeRecord = store.get(
      "KNOWLEDGE",
      knowledge.aggregateId,
    );

    const claimRecord = store.get(
      "CLAIM",
      claim.aggregateId,
    );

    const evidenceRecord = store.get(
      "EVIDENCE",
      evidence.aggregateId,
    );

    /*
     * ------------------------------------------------------------
     * 12. EXISTENCE CLOSURE
     * ------------------------------------------------------------
     */

    assert.ok(evidenceRecord);
    assert.ok(claimRecord);
    assert.ok(knowledgeRecord);
    assert.ok(scopeRecord);
    assert.ok(contextRecord);
    assert.ok(problemRecord);
    assert.ok(decisionRecord);

    /*
     * ------------------------------------------------------------
     * 13. REFERENCE CLOSURE
     *
     * Verify that the relationships actually persisted.
     * ------------------------------------------------------------
     */

    assert.deepEqual(
      claimRecord.payload.evidenceIds,
      [evidence.aggregateId],
    );

    assert.deepEqual(
      knowledgeRecord.payload.claimIds,
      [claim.aggregateId],
    );

    assert.equal(
      contextRecord.payload.scopeId,
      scope.aggregateId,
    );

    assert.equal(
      problemRecord.payload.contextId,
      context.aggregateId,
    );

    assert.equal(
      decisionRecord.payload.problemId,
      problem.aggregateId,
    );

    assert.deepEqual(
      decisionRecord.payload.knowledgeIds,
      [knowledge.aggregateId],
    );

    /*
     * ------------------------------------------------------------
     * 14. DECISION VALIDATOR
     *
     * This is the critical semantic closure:
     *
     * Decision
     *   -> Problem
     *      -> Context
     *         -> Scope
     *   -> Knowledge
     *      -> Claim
     *         -> Evidence
     * ------------------------------------------------------------
     */

    const validation = new DecisionValidator(store).validate({
      decisionId: decision.aggregateId,
      scopeId: scope.aggregateId,
      contextId: context.aggregateId,
    });

    assert.equal(
      validation.valid,
      true,
    );

    assert.deepEqual(
      validation.reasons,
      [],
    );

    /*
     * ------------------------------------------------------------
     * 15. FOUNDATION CHAIN INTEGRITY
     *
     * Final cryptographic/history-chain verification.
     * ------------------------------------------------------------
     */

    assert.doesNotThrow(() => {
      store.verifyChain();
    });
  },
);