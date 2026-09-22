import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
  createSource,
  createScope,
  createContext,
  createProblem,
  createDecision,
  createClaim,
  createKnowledge,
  contentFingerprint,
} from "../../../.v8-build/src/v8/index.js";

import {
  ArticleIntelligencePlanner,
} from "../../../.v8-build/src/v8/intelligence/article-intelligence/index.js";

const actor = {
  id: "article-intelligence-test",
  role: "SYSTEM",
};

const auditor = {
  id: "article-intelligence-auditor",
  role: "AUDITOR",
};

function createFixture() {
  const store =
    new InMemoryFoundationStore();

  const service =
    new FoundationService(store);

  const content =
    "Wall thickness should be selected with material, flow, cooling, and structural requirements in mind.";

  const source =
    createSource({
      kind: "PUBLIC_WEB",
      locator:
        "https://example.test/article-intelligence",
      access:
        "PAYLOAD_ALLOWED",
      title:
        "Article Intelligence Test Source",
      version: "1",
      publisher:
        "NEXMOLD Test Authority",
      authority:
        "ENGINEERING_REFERENCE",
      canonicalUrl:
        "https://example.test/article-intelligence",
      retrievedAt:
        "2026-09-22T00:00:00.000Z",
      documentHash:
        contentFingerprint(content),
    });

  service.registerSource(
    source,
    actor,
  );

  const snapshot =
    service.captureSnapshot(
      {
        source,
        capturedAt:
          "2026-09-22T00:00:00.000Z",
        locator:
          source.locator,
        content,
        metadataOnly: false,
      },
      actor,
    );

  service.sealSnapshot(
    snapshot.aggregateId,
    actor,
  );

  const evidence =
    service.ingestEvidence(
      {
        id:
          "evidence:article-intelligence:1",
        sourceId:
          source.id,
        locator:
          "article-intelligence:p1",
        excerpt:
          content,
        ingestion:
          "INGESTED",
        capturedAt:
          snapshot.recordedAt,
        snapshotId:
          snapshot.aggregateId,
      },
      actor,
    );

  service.verifyEvidence(
    evidence.aggregateId,
    auditor,
  );

  const claim =
    createClaim({
      id:
        "claim:article-intelligence:1",
      statement:
        "Wall thickness is a multi-variable engineering decision.",
      evidenceIds: [
        evidence.aggregateId,
      ],
      status:
        "VERIFIED",
      epistemicLevel:
        "ENGINEERING_INFERENCE",
      confidence:
        "HIGH",
    });

  const persistedClaim =
    service.createClaim(
      claim,
      auditor,
    );

  const knowledge =
    createKnowledge({
      id:
        "knowledge:article-intelligence:1",
      proposition:
        "Wall thickness selection depends on material, flow, cooling, and structural requirements.",
      claimIds: [
        persistedClaim.aggregateId,
      ],
      status:
        "APPROVED",
    });

  const persistedKnowledge =
    service.createKnowledge(
      knowledge,
      auditor,
    );

  const scope =
    createScope({
      id:
        "scope:article-intelligence:1",
      geography:
        "GLOBAL",
      industries: [
        "PLASTIC_INJECTION_MOLDING",
      ],
      languages: [
        "en",
      ],
    });

  service.registerScope(
    scope,
    actor,
  );

  const context =
    createContext({
      id:
        "context:article-intelligence:1",
      scopeId:
        scope.id,
      purpose:
        "Article intelligence test",
      variables: {},
    });

  service.registerContext(
    context,
    actor,
  );

  const problem =
    createProblem({
      id:
        "problem:article-intelligence:1",
      contextId:
        context.id,
      question:
        "What evidence-backed information can be stated about wall thickness?",
      constraints: [
        "VERIFIED evidence only",
      ],
    });

  service.registerProblem(
    problem,
    actor,
  );

  const decision =
    createDecision({
      id:
        "decision:article-intelligence:1",
      problemId:
        problem.id,
      knowledgeIds: [
        persistedKnowledge.aggregateId,
      ],
      outcome:
        "State only evidence-backed wall-thickness guidance within the approved scope.",
      status:
        "APPROVED",
    });

  service.createDecision(
    decision,
    scope.id,
    context.id,
    actor,
  );

  return {
    store,
    scopeId:
      scope.id,
    contextId:
      context.id,
    decisionId:
      decision.id,
    knowledgeId:
      persistedKnowledge.aggregateId,
  };
}

test(
  "V8 Article Intelligence builds a section evidence closure from an approved decision",
  () => {
    const fixture =
      createFixture();

    const planner =
      new ArticleIntelligencePlanner(
        fixture.store,
      );

    const plan =
      planner.plan({
        decisionId:
          fixture.decisionId,
        scopeId:
          fixture.scopeId,
        contextId:
          fixture.contextId,
        sections: [
          {
            sectionId:
              "definition",
            heading:
              "Definition and scope",
            knowledgeIds: [
              fixture.knowledgeId,
            ],
          },
        ],
      });

    assert.equal(
      plan.decisionId,
      fixture.decisionId,
    );

    assert.equal(
      plan.sections.length,
      1,
    );

    assert.deepEqual(
      plan.sections[0].knowledgeIds,
      [fixture.knowledgeId],
    );

    assert.deepEqual(
      plan.sections[0].claimIds,
      [
        "claim:article-intelligence:1",
      ],
    );

    assert.deepEqual(
      plan.sections[0].evidenceIds,
      [
        "evidence:article-intelligence:1",
      ],
    );

    assert.doesNotThrow(
      () =>
        fixture.store.verifyChain(),
    );
  },
);

test(
  "V8 Article Intelligence blocks knowledge outside the approved decision",
  () => {
    const fixture =
      createFixture();

    const planner =
      new ArticleIntelligencePlanner(
        fixture.store,
      );

    assert.throws(
      () =>
        planner.plan({
          decisionId:
            fixture.decisionId,
          scopeId:
            fixture.scopeId,
          contextId:
            fixture.contextId,
          sections: [
            {
              sectionId:
                "failure-modes",
              heading:
                "Failure modes",
              knowledgeIds: [
                "knowledge:not-in-decision",
              ],
            },
          ],
        }),
      /V8_ARTICLE_SECTION_KNOWLEDGE_OUTSIDE_DECISION/,
    );
  },
);