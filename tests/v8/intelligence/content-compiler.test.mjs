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

import {
  EvidenceBoundContentCompiler,
} from "../../../.v8-build/src/v8/intelligence/content-compiler/index.js";

const actor = {
  id: "content-compiler-test",
  role: "SYSTEM",
};

const auditor = {
  id: "content-compiler-auditor",
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
        "https://example.test/content-compiler",
      access:
        "PAYLOAD_ALLOWED",
      title:
        "Content Compiler Test Source",
      version: "1",
      publisher:
        "NEXMOLD Test Authority",
      authority:
        "ENGINEERING_REFERENCE",
      canonicalUrl:
        "https://example.test/content-compiler",
      retrievedAt:
        "2026-09-22T00:00:00.000Z",
      documentHash:
        contentFingerprint(
          content,
        ),
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
          "evidence:content-compiler:1",
        sourceId:
          source.id,
        locator:
          "content-compiler:p1",
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
        "claim:content-compiler:1",
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
        "knowledge:content-compiler:1",
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
        "scope:content-compiler:1",
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
        "context:content-compiler:1",
      scopeId:
        scope.id,
      purpose:
        "Content compiler test",
      variables: {},
    });

  service.registerContext(
    context,
    actor,
  );

  const problem =
    createProblem({
      id:
        "problem:content-compiler:1",
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
        "decision:content-compiler:1",
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
    service,
    scopeId:
      scope.id,
    contextId:
      context.id,
    decisionId:
      decision.id,
    knowledgeId:
      persistedKnowledge.aggregateId,
    claimId:
      persistedClaim.aggregateId,
    evidenceId:
      evidence.aggregateId,
  };
}

function createPlan(
  fixture,
) {
  const planner =
    new ArticleIntelligencePlanner(
      fixture.store,
    );

  return planner.plan({
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
}

test(
  "V8 Content Compiler produces evidence-bound section provenance",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    const draft =
      compiler.compile({
        plan,
        title:
          "Plastic Injection Molding Wall Thickness",
        primaryKeyword:
          "plastic injection molding wall thickness",
      });

    assert.equal(
      draft.title,
      "Plastic Injection Molding Wall Thickness",
    );

    assert.equal(
      draft.sections.length,
      1,
    );

    assert.deepEqual(
      draft.sections[0].knowledgeIds,
      [fixture.knowledgeId],
    );

    assert.deepEqual(
      draft.sections[0].claimIds,
      [fixture.claimId],
    );

    assert.deepEqual(
      draft.sections[0].evidenceIds,
      [fixture.evidenceId],
    );

    assert.match(
      draft.sections[0].body,
      /Wall thickness selection depends on material/,
    );

    assert.match(
      draft.sections[0].body,
      /Wall thickness is a multi-variable engineering decision/,
    );

    assert.match(
      draft.sections[0].body,
      /Wall thickness should be selected with material/,
    );

    assert.deepEqual(
      draft.claims,
      [
        "Wall thickness is a multi-variable engineering decision.",
      ],
    );

    assert.equal(
      draft.evidence.length,
      1,
    );

    assert.equal(
      draft.evidence[0].excerpt,
      "Wall thickness should be selected with material, flow, cooling, and structural requirements in mind.",
    );
  },
);

test(
  "V8 Content Compiler rejects a section with unrelated claim injection",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    const invalidPlan = {
      ...plan,
      sections: [
        {
          ...plan.sections[0],
          claimIds: [
            ...plan.sections[0].claimIds,
            "claim:injected",
          ],
        },
      ],
    };

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    assert.throws(
      () =>
        compiler.compile({
          plan: invalidPlan,
          title:
            "Plastic Injection Molding Wall Thickness",
          primaryKeyword:
            "plastic injection molding wall thickness",
        }),
      /V8_INTELLIGENCE_COMPILER_UNRELATED_CLAIM/,
    );
  },
);

test(
  "V8 Content Compiler rejects a section with unrelated evidence injection",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    const invalidPlan = {
      ...plan,
      sections: [
        {
          ...plan.sections[0],
          evidenceIds: [
            ...plan.sections[0].evidenceIds,
            "evidence:injected",
          ],
        },
      ],
    };

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    assert.throws(
      () =>
        compiler.compile({
          plan: invalidPlan,
          title:
            "Plastic Injection Molding Wall Thickness",
          primaryKeyword:
            "plastic injection molding wall thickness",
        }),
      /V8_INTELLIGENCE_COMPILER_UNRELATED_EVIDENCE/,
    );
  },
);

test(
  "V8 Content Compiler rejects missing evidence closure",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    const invalidPlan = {
      ...plan,
      sections: [
        {
          ...plan.sections[0],
          evidenceIds: [],
        },
      ],
    };

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    assert.throws(
      () =>
        compiler.compile({
          plan: invalidPlan,
          title:
            "Plastic Injection Molding Wall Thickness",
          primaryKeyword:
            "plastic injection molding wall thickness",
        }),
      /V8_INTELLIGENCE_COMPILER_SECTION_NO_EVIDENCE/,
    );
  },
);

test(
  "V8 Content Compiler rejects non-verified knowledge",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    fixture.store.append({
      aggregateType:
        "KNOWLEDGE",
      aggregateId:
        fixture.knowledgeId,
      version: 2,
      state:
        "REJECTED",
      payload: {
        proposition:
          "Rejected wall thickness proposition.",
        claimIds: [
          fixture.claimId,
        ],
      },
      lineage: [],
      actor: auditor,
      reason:
        "content compiler negative test",
    });

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    assert.throws(
      () =>
        compiler.compile({
          plan,
          title:
            "Plastic Injection Molding Wall Thickness",
          primaryKeyword:
            "plastic injection molding wall thickness",
        }),
      /V8_INTELLIGENCE_COMPILER_KNOWLEDGE_NOT_VERIFIED/,
    );
  },
);

test(
  "V8 Content Compiler output is deterministic",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    const input = {
      plan,
      title:
        "Plastic Injection Molding Wall Thickness",
      primaryKeyword:
        "plastic injection molding wall thickness",
      description:
        "Evidence-backed wall thickness guidance.",
    };

    const first =
      compiler.compile(
        input,
      );

    const second =
      compiler.compile(
        input,
      );

    assert.deepEqual(
      second,
      first,
    );
  },
);

test(
  "V8 Content Compiler does not expose arbitrary facts injection",
  () => {
    const fixture =
      createFixture();

    const plan =
      createPlan(
        fixture,
      );

    const compiler =
      new EvidenceBoundContentCompiler(
        fixture.store,
      );

    const draft =
      compiler.compile({
        plan,
        title:
          "Plastic Injection Molding Wall Thickness",
        primaryKeyword:
          "plastic injection molding wall thickness",
      });

    assert.equal(
      Object.prototype.hasOwnProperty.call(
        draft,
        "facts",
      ),
      false,
    );

    assert.equal(
      draft.claims.includes(
        "Arbitrary unsupported fact.",
      ),
      false,
    );

    assert.equal(
      draft.evidence.length,
      1,
    );
  },
);