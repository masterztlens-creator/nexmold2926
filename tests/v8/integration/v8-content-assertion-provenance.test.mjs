import test from "node:test";
import assert from "node:assert/strict";

import {
  FoundationService,
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/index.js";

import {
  ContentCompiler,
} from "../../../.v8-build/src/v8/content-compiler/index.js";

import {
  contentFingerprint,
} from "../../../.v8-build/src/v8/foundation/hash.js";

const actor = {
  id: "v8-content-provenance-test",
  role: "SYSTEM",
};

const auditor = {
  id: "v8-content-provenance-auditor",
  role: "AUDITOR",
};

function buildFixture() {
  const store =
    new InMemoryFoundationStore();

  const service =
    new FoundationService(
      store,
    );

  const scope =
    service.registerScope(
      {
        id:
          "scope:v8-content-provenance",
        geography:
          "GLOBAL",
        industries: [
          "PLASTIC_INJECTION_MOLDING",
        ],
        languages: [
          "en",
        ],
      },
      actor,
    );

  const context =
    service.registerContext(
      {
        id:
          "context:v8-content-provenance",
        scopeId:
          scope.aggregateId,
        purpose:
          "Content assertion provenance test",
        variables: {
          environment:
            "production",
        },
      },
      actor,
    );

  const sourceContent =
    "Wall thickness selection depends on material and process conditions.";

  const sourceRecord =
    service.registerSource(
      {
        id:
          "source:v8-content-provenance",
        kind:
          "PUBLIC_WEB",
        locator:
          "https://example.test/wall-thickness",
        access:
          "PAYLOAD_ALLOWED",
        title:
          "Wall Thickness Engineering Reference",
        version:
          "1",
        publisher:
          "V8 Test Authority",
        authority:
          "ENGINEERING_REFERENCE",
        canonicalUrl:
          "https://example.test/wall-thickness",
        retrievedAt:
          "2026-10-01T00:00:00.000Z",
        documentHash:
          contentFingerprint(
            sourceContent,
          ),
      },
      actor,
    );

  const source =
    sourceRecord.payload;

  const snapshot =
    service.captureSnapshot(
      {
        source,
        capturedAt:
          "2026-10-01T00:00:00.000Z",
        locator:
          source.locator,
        content:
          sourceContent,
        metadataOnly:
          false,
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
          "evidence:v8-content-provenance",
        sourceId:
          source.id,
        snapshotId:
          snapshot.aggregateId,
        locator:
          "wall-thickness:p1",
        excerpt:
          sourceContent,
        ingestion:
          "INGESTED",
        capturedAt:
          snapshot.recordedAt,
      },
      actor,
    );

  service.verifyEvidence(
    evidence.aggregateId,
    auditor,
  );

  const claim =
    service.createClaim(
      {
        id:
          "claim:v8-content-provenance",
        statement:
          "Wall thickness selection depends on material and process conditions.",
        evidenceIds: [
          evidence.aggregateId,
        ],
        status:
          "VERIFIED",
        confidence:
          "HIGH",
        epistemicLevel:
          "ENGINEERING_INFERENCE",
      },
      auditor,
    );

  const knowledge =
    service.createKnowledge(
      {
        id:
          "knowledge:v8-content-provenance",
        proposition:
          "Wall thickness selection depends on material and process conditions.",
        claimIds: [
          claim.aggregateId,
        ],
        status:
          "APPROVED",
      },
      auditor,
    );

  const problem =
    service.registerProblem(
      {
        id:
          "problem:v8-content-provenance",
        contextId:
          context.aggregateId,
        question:
          "What should be considered when selecting wall thickness?",
        constraints: [
          "Use verified evidence only.",
        ],
      },
      actor,
    );

  const decision =
    service.createDecision(
      {
        id:
          "decision:v8-content-provenance",
        problemId:
          problem.aggregateId,
        knowledgeIds: [
          knowledge.aggregateId,
        ],
        outcome:
          "Compile only evidence-backed wall-thickness guidance.",
        status:
          "APPROVED",
        fingerprint:
          "",
      },
      scope.aggregateId,
      context.aggregateId,
      actor,
    );

  return {
    store,
    scope,
    context,
    problem,
    decision,
    knowledge,
    claim,
    evidence,
  };
}

test(
  "V8 Content assertion provenance closes Content → Knowledge → Claim → Evidence",
  () => {
    const fixture =
      buildFixture();

    const compiler =
      new ContentCompiler(
        fixture.store,
      );

    const compiled =
      compiler.compile({
        decisionId:
          fixture.decision.aggregateId,
        scopeId:
          fixture.scope.aggregateId,
        contextId:
          fixture.context.aggregateId,
        title:
          "Plastic Injection Molding Wall Thickness",
      });

    assert.ok(
      compiled.content.provenance.length >
        0,
    );

    assert.equal(
      compiled.content.provenance.length,
      compiled.content.body
        .split("\n")
        .map((line) =>
          line.trim(),
        )
        .filter(
          (line) =>
            line.length > 0 &&
            ![
              "Problem",
              "Decision",
              "Verified knowledge",
              "Context",
              "Constraints",
            ].includes(
              line,
            ),
        ).length,
    );

    for (
      const provenance of
        compiled.content.provenance
    ) {
      assert.ok(
        provenance.text.length >
          0,
      );

      assert.equal(
        provenance.fingerprint,
        contentFingerprint(
          provenance.text,
        ),
      );

      assert.ok(
        provenance.knowledgeIds.length >
          0,
      );

      assert.ok(
        provenance.claimIds.length >
          0,
      );

      assert.ok(
        provenance.evidenceIds.length >
          0,
      );

      for (
        const knowledgeId of
          provenance.knowledgeIds
      ) {
        const knowledge =
          fixture.store.get(
            "KNOWLEDGE",
            knowledgeId,
          );

        assert.ok(
          knowledge,
        );

        assert.equal(
          knowledge.state,
          "VERIFIED",
        );

        for (
          const claimId of
            knowledge.payload
              .claimIds
        ) {
          assert.ok(
            provenance.claimIds.includes(
              claimId,
            ),
          );
        }
      }

      for (
        const claimId of
          provenance.claimIds
      ) {
        const claim =
          fixture.store.get(
            "CLAIM",
            claimId,
          );

        assert.ok(
          claim,
        );

        assert.equal(
          claim.state,
          "VERIFIED",
        );

        assert.ok(
          claim.payload.evidenceIds.some(
            (evidenceId) =>
              provenance.evidenceIds.includes(
                evidenceId,
              ),
          ),
        );
      }

      for (
        const evidenceId of
          provenance.evidenceIds
      ) {
        const evidence =
          fixture.store.get(
            "EVIDENCE",
            evidenceId,
          );

        assert.ok(
          evidence,
        );

        assert.equal(
          evidence.state,
          "VERIFIED",
        );
      }
    }

    fixture.store.verifyChain();
  },
);

test(
  "V8 Content assertion provenance is deterministic",
  () => {
    const fixture =
      buildFixture();

    const compiler =
      new ContentCompiler(
        fixture.store,
      );

    const input = {
      decisionId:
        fixture.decision.aggregateId,
      scopeId:
        fixture.scope.aggregateId,
      contextId:
        fixture.context.aggregateId,
      title:
        "Deterministic Wall Thickness",
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
      second.content.provenance,
      first.content.provenance,
    );

    assert.equal(
      second.fingerprint,
      first.fingerprint,
    );

    assert.deepEqual(
      second.content,
      first.content,
    );
  },
);

test(
  "V8 Content provenance is fail-closed when an Evidence record disappears",
  () => {
    const fixture =
      buildFixture();

    const originalGet =
      fixture.store.get.bind(
        fixture.store,
      );

    const disappearingEvidenceStore =
      new Proxy(
        fixture.store,
        {
          get(
            target,
            property,
            receiver,
          ) {
            if (
              property ===
              "get"
            ) {
              return (
                type,
                id,
                version,
              ) => {
                if (
                  type ===
                    "EVIDENCE" &&
                  id ===
                    fixture.evidence
                      .aggregateId
                ) {
                  return null;
                }

                return originalGet(
                  type,
                  id,
                  version,
                );
              };
            }

            return Reflect.get(
              target,
              property,
              receiver,
            );
          },
        },
      );

    const compiler =
      new ContentCompiler(
        disappearingEvidenceStore,
      );

    assert.throws(
      () =>
        compiler.compile({
          decisionId:
            fixture.decision.aggregateId,
          scopeId:
            fixture.scope.aggregateId,
          contextId:
            fixture.context.aggregateId,
          title:
            "Blocked",
        }),
      /V8_CONTENT_COMPILER_EVIDENCE_NOT_VERIFIED|V8_CONTENT_COMPILER_EVIDENCE_NOT_FOUND/,
    );
  },
);