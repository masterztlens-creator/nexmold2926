import assert from "node:assert/strict";

import {
  createHash,
} from "node:crypto";

import {
  contentFingerprint,
} from "../.v8-build/src/v8/foundation/hash.js";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  TavilySearchProvider,
} from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";

import {
  runV8ArticleRuntime,
} from "../.v8-build/src/v8/runtime/article-runtime.js";

function sha256(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function assertEqual(
  actual,
  expected,
  message,
) {
  assert.equal(
    actual,
    expected,
    `${message}\nactual=${String(actual)}\nexpected=${String(expected)}`,
  );
}

function assertTruthy(
  value,
  message,
) {
  assert.ok(
    value,
    message,
  );
}

function getLineage(record) {
  assertTruthy(
    record,
    "V8_CONTENT_PROVENANCE_RECORD_MISSING",
  );

  assert.ok(
    Array.isArray(record.lineage),
    `V8_CONTENT_PROVENANCE_LINEAGE_NOT_ARRAY:${record.id ?? record.aggregateId ?? "unknown"}`,
  );

  return record.lineage;
}

function assertLineageLink(
  parent,
  child,
  expectedType,
) {
  const lineage = getLineage(child);

  const parentId =
    parent.id ??
    parent.aggregateId;

  const link = lineage.find(
    (entry) =>
      entry.type === expectedType &&
      entry.id === parentId,
  );

  assertTruthy(
    link,
    [
      "V8_CONTENT_PROVENANCE_LINEAGE_MISSING:",
      `${expectedType}:${parentId}`,
      "->",
      child.id ??
        child.aggregateId ??
        "unknown",
    ].join(" "),
  );

  assertEqual(
    link.fingerprint,
    parent.fingerprint,
    `V8_CONTENT_PROVENANCE_LINEAGE_FINGERPRINT_MISMATCH:${expectedType}:${parentId}->${child.id ?? child.aggregateId ?? "unknown"}`,
  );
}

function assertRecordFingerprint(record) {
  assertTruthy(
    record.fingerprint,
    `V8_CONTENT_PROVENANCE_FINGERPRINT_MISSING:${record.id ?? record.aggregateId ?? "unknown"}`,
  );

  assertEqual(
    typeof record.fingerprint,
    "string",
    `V8_CONTENT_PROVENANCE_FINGERPRINT_TYPE:${record.id ?? record.aggregateId ?? "unknown"}`,
  );
}

function getRequiredRecord(
  store,
  id,
  type,
) {
  assertTruthy(
    id,
    `V8_CONTENT_PROVENANCE_ID_MISSING:${type}`,
  );

  const record = store.get(
    type,
    id,
  );

  assertTruthy(
    record,
    `V8_CONTENT_PROVENANCE_RECORD_NOT_FOUND:${type}:${id}`,
  );

  return record;
}

const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_CONTENT_PROVENANCE_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}

async function main() {
  const store =
    new InMemoryFoundationStore();

  const searchProvider =
    new TavilySearchProvider(
      apiKey,
      "https://api.tavily.com/search",
      "v8-content-provenance-gate",
    );

  const pageFetcher =
    new HttpPageFetcher({
      timeoutMs: 20000,
      maxBytes: 5000000,
    });

  const opportunity = {
    keyword: {
      keyword:
        "plastic injection molding wall thickness",

      normalized:
        "plastic injection molding wall thickness",

      source: "SEED",

      intent: "INFORMATIONAL",

      terms: [
        "wall thickness",
        "injection molding",
      ],
    },

    score: 0.9,

    demand: 0.8,

    relevance: 1,

    competition: 0.3,

    authorityGap: 0.7,

    conversionPotential: 0.6,

    reasons: [
      "V8 content provenance gate",
      "REAL_INTERNET source traceability",
    ],
  };

  const result =
    await runV8ArticleRuntime({
      opportunity,

      searchProvider,

      pageFetcher,

      store,

      actor: {
        id:
          "v8-content-provenance-gate",
        role: "SYSTEM",
      },

      acquisition: {
        maxQueries: 1,
        maxCandidates: 3,
        actorId:
          "v8-content-provenance-gate",
      },

      scope: {
        id:
          "scope:v8:content-provenance-gate",

        geography:
          "GLOBAL",

        industries: [
          "PLASTIC_INJECTION_MOLDING",
        ],

        languages: [
          "en",
        ],
      },

      context: {
        id:
          "context:v8:content-provenance-gate",

        purpose:
          "Prove that generated content remains traceable to verified Internet evidence.",

        variables: {
          sourceMode:
            "REAL_INTERNET",

          evidencePolicy:
            "VERIFIED_ONLY",

          contentPolicy:
            "EVIDENCE_BACKED",

          provenancePolicy:
            "FULL_CHAIN",
        },
      },

      problem: {
        id:
          "problem:v8:content-provenance-gate",

        question:
          "What evidence-backed information can be stated about plastic injection molding wall thickness?",

        constraints: [
          "Use real Internet-acquired evidence only.",
          "Only VERIFIED evidence may produce claims.",
          "Only VERIFIED claims may produce knowledge.",
          "Decision must be APPROVED.",
          "Content must be derived from the approved decision.",
          "Every published content assertion must remain traceable to Internet evidence.",
        ],
      },

      title:
        "Plastic Injection Molding Wall Thickness",
    });

  assertTruthy(
    result,
    "V8_CONTENT_PROVENANCE_RUNTIME_RESULT_MISSING",
  );

  assertTruthy(
    result.content,
    "V8_CONTENT_PROVENANCE_CONTENT_MISSING",
  );

  assertTruthy(
    result.decisionId,
    "V8_CONTENT_PROVENANCE_DECISION_ID_MISSING",
  );

  assertTruthy(
    result.problemId,
    "V8_CONTENT_PROVENANCE_PROBLEM_ID_MISSING",
  );

  assertTruthy(
    result.contextId,
    "V8_CONTENT_PROVENANCE_CONTEXT_ID_MISSING",
  );

  assertTruthy(
    result.scopeId,
    "V8_CONTENT_PROVENANCE_SCOPE_ID_MISSING",
  );

  assert.ok(
    Array.isArray(result.knowledgeIds),
    "V8_CONTENT_PROVENANCE_KNOWLEDGE_IDS_NOT_ARRAY",
  );

  assert.ok(
    result.knowledgeIds.length > 0,
    "V8_CONTENT_PROVENANCE_KNOWLEDGE_IDS_EMPTY",
  );

  assert.ok(
    Array.isArray(result.claimIds),
    "V8_CONTENT_PROVENANCE_CLAIM_IDS_NOT_ARRAY",
  );

  assert.ok(
    result.claimIds.length > 0,
    "V8_CONTENT_PROVENANCE_CLAIM_IDS_EMPTY",
  );

  assert.ok(
    Array.isArray(result.verifiedEvidenceIds),
    "V8_CONTENT_PROVENANCE_EVIDENCE_IDS_NOT_ARRAY",
  );

  assert.ok(
    result.verifiedEvidenceIds.length > 0,
    "V8_CONTENT_PROVENANCE_EVIDENCE_IDS_EMPTY",
  );

  assertTruthy(
    result.acquisition,
    "V8_CONTENT_PROVENANCE_ACQUISITION_MISSING",
  );

  assert.ok(
    Array.isArray(
      result.acquisition.acquisitions,
    ),
    "V8_CONTENT_PROVENANCE_ACQUISITION_LIST_NOT_ARRAY",
  );

  assert.ok(
    result.acquisition.acquisitions.length > 0,
    "V8_CONTENT_PROVENANCE_ACQUISITION_EMPTY",
  );

  /*
   * Gate 1
   *
   * Content itself is a domain object.
   * It does NOT carry FoundationRecord.fingerprint.
   *
   * ContentCompiler calculates its immutable content
   * fingerprint from:
   *
   *   decisionId
   *   scopeId
   *   contextId
   *   title
   *   body
   *
   * Recalculate the exact same fingerprint here.
   */

  const content =
    result.content;

  assertTruthy(
    content.id,
    "V8_CONTENT_PROVENANCE_CONTENT_ID_MISSING",
  );

  assertTruthy(
    content.decisionId,
    "V8_CONTENT_PROVENANCE_CONTENT_DECISION_ID_MISSING",
  );

  assertTruthy(
    content.title,
    "V8_CONTENT_PROVENANCE_CONTENT_TITLE_MISSING",
  );

  assertTruthy(
    content.body,
    "V8_CONTENT_PROVENANCE_CONTENT_BODY_MISSING",
  );

  const expectedContentFingerprint =
    contentFingerprint({
      decisionId:
        content.decisionId,

      scopeId:
        result.scopeId,

      contextId:
        result.contextId,

      title:
        content.title,

      body:
        content.body,
    });

  assertEqual(
    expectedContentFingerprint.length,
    64,
    "V8_CONTENT_PROVENANCE_CONTENT_FINGERPRINT_LENGTH",
  );

  /*
   * Gate 2
   *
   * Content -> Decision
   *
   * Content is not a FoundationRecord and therefore
   * has no lineage array.
   *
   * The authoritative Content -> Decision relation
   * is Content.decisionId.
   */

  const decision =
    getRequiredRecord(
      store,
      result.decisionId,
      "DECISION",
    );

  assertEqual(
    content.decisionId,
    decision.aggregateId,
    "V8_CONTENT_PROVENANCE_CONTENT_DECISION_MISMATCH",
  );

  /*
   * Gate 3
   *
   * Decision -> Problem
   */

  const problem =
    getRequiredRecord(
      store,
      result.problemId,
      "PROBLEM",
    );

  assertLineageLink(
    problem,
    decision,
    "PROBLEM",
  );

  /*
   * Gate 4
   *
   * Decision -> Context
   */

  const context =
    getRequiredRecord(
      store,
      result.contextId,
      "CONTEXT",
    );

  assertLineageLink(
    context,
    decision,
    "CONTEXT",
  );

  /*
   * Gate 5
   *
   * Context -> Scope
   */

  const scope =
    getRequiredRecord(
      store,
      result.scopeId,
      "SCOPE",
    );

  assertLineageLink(
    scope,
    context,
    "SCOPE",
  );

  /*
   * Gate 6
   *
   * Decision -> Knowledge
   */

  const decisionPayload =
    decision.payload;

  assertTruthy(
    decisionPayload,
    `V8_CONTENT_PROVENANCE_DECISION_PAYLOAD_MISSING:${decision.id ?? decision.aggregateId}`,
  );

  assert.ok(
    Array.isArray(
      decisionPayload.knowledgeIds,
    ),
    `V8_CONTENT_PROVENANCE_DECISION_KNOWLEDGE_IDS_NOT_ARRAY:${decision.id ?? decision.aggregateId}`,
  );

  for (
    const knowledgeId
    of result.knowledgeIds
  ) {
    assert.ok(
      decisionPayload.knowledgeIds.includes(
        knowledgeId,
      ),
      [
        "V8_CONTENT_PROVENANCE_DECISION_KNOWLEDGE_LINK_MISSING:",
        decision.aggregateId,
        "->",
        knowledgeId,
      ].join(" "),
    );
  }

  /*
   * Gate 7
   *
   * Knowledge -> Claim
   */

  for (
    const knowledgeId
    of result.knowledgeIds
  ) {
    const knowledge =
      getRequiredRecord(
        store,
        knowledgeId,
        "KNOWLEDGE",
      );

    assertRecordFingerprint(
      knowledge,
    );

    const knowledgePayload =
      knowledge.payload;

    assertTruthy(
      knowledgePayload,
      `V8_CONTENT_PROVENANCE_KNOWLEDGE_PAYLOAD_MISSING:${knowledge.aggregateId}`,
    );

    assert.ok(
      Array.isArray(
        knowledgePayload.claimIds,
      ),
      `V8_CONTENT_PROVENANCE_KNOWLEDGE_CLAIM_IDS_NOT_ARRAY:${knowledge.aggregateId}`,
    );

    assert.ok(
      knowledgePayload.claimIds.length > 0,
      `V8_CONTENT_PROVENANCE_KNOWLEDGE_CLAIM_IDS_EMPTY:${knowledge.aggregateId}`,
    );

    for (
      const claimId
      of knowledgePayload.claimIds
    ) {
      assert.ok(
        result.claimIds.includes(
          claimId,
        ),
        [
          "V8_CONTENT_PROVENANCE_KNOWLEDGE_CLAIM_NOT_IN_RUNTIME:",
          knowledge.aggregateId,
          "->",
          claimId,
        ].join(" "),
      );

      const claim =
        getRequiredRecord(
          store,
          claimId,
          "CLAIM",
        );

      assertLineageLink(
        claim,
        knowledge,
        "CLAIM",
      );
    }
  }

  /*
   * Gate 8
   *
   * Claim -> Evidence
   */

  for (
    const claimId
    of result.claimIds
  ) {
    const claim =
      getRequiredRecord(
        store,
        claimId,
        "CLAIM",
      );

    assertRecordFingerprint(
      claim,
    );

    const claimPayload =
      claim.payload;

    assertTruthy(
      claimPayload,
      `V8_CONTENT_PROVENANCE_CLAIM_PAYLOAD_MISSING:${claim.aggregateId}`,
    );

    assert.ok(
      Array.isArray(
        claimPayload.evidenceIds,
      ),
      `V8_CONTENT_PROVENANCE_CLAIM_EVIDENCE_IDS_NOT_ARRAY:${claim.aggregateId}`,
    );

    assert.ok(
      claimPayload.evidenceIds.length > 0,
      `V8_CONTENT_PROVENANCE_CLAIM_EVIDENCE_IDS_EMPTY:${claim.aggregateId}`,
    );

    for (
      const evidenceId
      of claimPayload.evidenceIds
    ) {
      assert.ok(
        result.verifiedEvidenceIds.includes(
          evidenceId,
        ),
        [
          "V8_CONTENT_PROVENANCE_CLAIM_EVIDENCE_NOT_IN_RUNTIME:",
          claim.aggregateId,
          "->",
          evidenceId,
        ].join(" "),
      );

      const evidence =
        getRequiredRecord(
          store,
          evidenceId,
          "EVIDENCE",
        );

      assertLineageLink(
        evidence,
        claim,
        "EVIDENCE",
      );
    }
  }

  /*
   * Gate 9
   *
   * Evidence -> Snapshot
   */

  for (
    const evidenceId
    of result.verifiedEvidenceIds
  ) {
    const evidence =
      getRequiredRecord(
        store,
        evidenceId,
        "EVIDENCE",
      );

    assertRecordFingerprint(
      evidence,
    );

    const evidencePayload =
      evidence.payload;

    assertTruthy(
      evidencePayload,
      `V8_CONTENT_PROVENANCE_EVIDENCE_PAYLOAD_MISSING:${evidence.aggregateId}`,
    );

    assertTruthy(
      evidencePayload.snapshotId,
      `V8_CONTENT_PROVENANCE_EVIDENCE_SNAPSHOT_ID_MISSING:${evidence.aggregateId}`,
    );

    const snapshot =
      getRequiredRecord(
        store,
        evidencePayload.snapshotId,
        "SNAPSHOT",
      );

    assertRecordFingerprint(
      snapshot,
    );

    assertLineageLink(
      snapshot,
      evidence,
      "SNAPSHOT",
    );
  }

  /*
   * Gate 10
   *
   * Snapshot -> Internet Source
   */

  for (
    const evidenceId
    of result.verifiedEvidenceIds
  ) {
    const evidence =
      getRequiredRecord(
        store,
        evidenceId,
        "EVIDENCE",
      );

    const evidencePayload =
      evidence.payload;

    const snapshot =
      getRequiredRecord(
        store,
        evidencePayload.snapshotId,
        "SNAPSHOT",
      );

    assertTruthy(
      snapshot.payload,
      `V8_CONTENT_PROVENANCE_SNAPSHOT_PAYLOAD_MISSING:${snapshot.aggregateId}`,
    );

    assertTruthy(
      snapshot.payload.sourceId,
      `V8_CONTENT_PROVENANCE_SNAPSHOT_SOURCE_ID_MISSING:${snapshot.aggregateId}`,
    );

    const source =
      getRequiredRecord(
        store,
        snapshot.payload.sourceId,
        "SOURCE",
      );

    assertRecordFingerprint(
      source,
    );

    assertLineageLink(
      source,
      snapshot,
      "SOURCE",
    );
  }

  /*
   * Gate 11
   *
   * Every acquired Internet page must correspond
   * to a persisted Source/Snapshot/Evidence chain.
   */

  for (
    const acquisition
    of result.acquisition.acquisitions
  ) {
    assertTruthy(
      acquisition,
      "V8_CONTENT_PROVENANCE_ACQUISITION_RECORD_MISSING",
    );

    assertTruthy(
      acquisition.acquisition,
      "V8_CONTENT_PROVENANCE_ACQUISITION_PAYLOAD_MISSING",
    );

    const acquisitionPayload =
      acquisition.acquisition;

    assertTruthy(
      acquisitionPayload.sourceId,
      "V8_CONTENT_PROVENANCE_ACQUISITION_SOURCE_ID_MISSING",
    );

    assertTruthy(
      acquisitionPayload.snapshotId,
      "V8_CONTENT_PROVENANCE_ACQUISITION_SNAPSHOT_ID_MISSING",
    );

    const source =
      getRequiredRecord(
        store,
        acquisitionPayload.sourceId,
        "SOURCE",
      );

    const snapshot =
      getRequiredRecord(
        store,
        acquisitionPayload.snapshotId,
        "SNAPSHOT",
      );

    assertEqual(
      snapshot.payload.sourceId,
      source.aggregateId,
      `V8_CONTENT_PROVENANCE_SOURCE_SNAPSHOT_ID_MISMATCH:${snapshot.aggregateId}`,
    );

    const matchingEvidence =
      result.verifiedEvidenceIds
        .map((id) =>
          getRequiredRecord(
            store,
            id,
            "EVIDENCE",
          ),
        )
        .filter(
          (evidence) =>
            evidence.payload.snapshotId ===
            snapshot.aggregateId,
        );

    assert.ok(
      matchingEvidence.length > 0,
      [
        "V8_CONTENT_PROVENANCE_NO_EVIDENCE_FOR_SNAPSHOT:",
        snapshot.aggregateId,
      ].join(" "),
    );
  }

  /*
   * Gate 12
   *
   * Content -> Knowledge
   *
   * Content itself does not expose Foundation lineage.
   * ContentCompiler's lineage is available internally but
   * ArticleRuntimeResult currently exposes only compiled.content.
   *
   * Therefore the authoritative persisted route here is:
   *
   *   Content
   *      -> Decision
   *      -> Knowledge
   *
   * Gate 6 already establishes Decision -> Knowledge.
   *
   * We additionally verify that the complete runtime
   * Knowledge set is exactly the Decision Knowledge set.
   */

  assertEqual(
    decisionPayload.knowledgeIds.length,
    result.knowledgeIds.length,
    "V8_CONTENT_PROVENANCE_CONTENT_KNOWLEDGE_COUNT_MISMATCH",
  );

  for (
    const knowledgeId
    of result.knowledgeIds
  ) {
    assert.ok(
      decisionPayload.knowledgeIds.includes(
        knowledgeId,
      ),
      [
        "V8_CONTENT_PROVENANCE_CONTENT_KNOWLEDGE_LINK_MISSING:",
        content.id,
        "->",
        knowledgeId,
      ].join(" "),
    );

    const knowledge =
      getRequiredRecord(
        store,
        knowledgeId,
        "KNOWLEDGE",
      );

    assertEqual(
      knowledge.state,
      "VERIFIED",
      `V8_CONTENT_PROVENANCE_CONTENT_KNOWLEDGE_NOT_VERIFIED:${knowledgeId}`,
    );
  }

  /*
   * Gate 13
   *
   * Foundation chain verification.
   *
   * verifyChain() returns void.
   * Success means it completes without throwing.
   */

  store.verifyChain();

  /*
   * Gate 14
   *
   * Detached tamper detection.
   */

  const tamperTarget =
    getRequiredRecord(
      store,
      result.claimIds[0],
      "CLAIM",
    );

  const originalFingerprint =
    tamperTarget.fingerprint;

  const tampered =
    {
      ...tamperTarget,

      fingerprint:
        sha256(
          JSON.stringify({
            ...tamperTarget,

            payload: {
              ...tamperTarget.payload,

              proposition:
                `${tamperTarget.payload.proposition ?? ""} [TAMPERED]`,
            },
          }),
        ),
    };

  assert.notEqual(
    tampered.fingerprint,
    originalFingerprint,
    "V8_CONTENT_PROVENANCE_TAMPER_NOT_DETECTED",
  );

  console.log(
    "[NEXMOLD][V8-CONTENT-PROVENANCE] REAL INTERNET CONTENT PROVENANCE GATE PASS",
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] acquired=${result.acquisition.acquisitions.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] claims=${result.claimIds.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] knowledge=${result.knowledgeIds.length}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] scope=${result.scopeId}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] context=${result.contextId}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] problem=${result.problemId}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] decision=${result.decisionId}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] content=${content.id}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] contentFingerprint=${expectedContentFingerprint}`,
  );

  console.log(
    `[V8-CONTENT-PROVENANCE] runtimeFingerprint=${result.fingerprint}`,
  );
}

await main();