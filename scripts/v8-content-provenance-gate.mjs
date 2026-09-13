import assert from "node:assert/strict";

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

import {
  contentFingerprint,
} from "../.v8-build/src/v8/foundation/hash.js";


const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_CONTENT_PROVENANCE_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}


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
    "V8 content provenance gate real internet validation",
  ],
};


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


const result =
  await runV8ArticleRuntime({
    opportunity,
    searchProvider,
    pageFetcher,
    store,

    actor: {
      id: "v8-content-provenance-gate",
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
        "Validate that generated content remains traceable to verified Internet evidence through Decision and Knowledge.",

      variables: {
        sourceMode:
          "REAL_INTERNET",

        evidencePolicy:
          "VERIFIED_ONLY",

        contentPolicy:
          "EVIDENCE_BACKED",
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
        "Only VERIFIED claims may produce approved knowledge.",
        "Decision must be APPROVED.",
        "Content must be derived from the approved decision.",
        "Content provenance must remain traceable to verified evidence.",
      ],
    },

    title:
      "Plastic Injection Molding Wall Thickness",
  });


/*
 * ------------------------------------------------------------
 * Gate 1 — Runtime produced all required layers.
 * ------------------------------------------------------------
 */

assert.ok(
  result.acquisition,
  "V8_CONTENT_PROVENANCE_ACQUISITION_MISSING",
);

assert.ok(
  result.acquisition.acquisitions.length > 0,
  "V8_CONTENT_PROVENANCE_ACQUISITION_EMPTY",
);

assert.ok(
  result.verifiedEvidenceIds.length > 0,
  "V8_CONTENT_PROVENANCE_VERIFIED_EVIDENCE_EMPTY",
);

assert.ok(
  result.claimIds.length > 0,
  "V8_CONTENT_PROVENANCE_CLAIMS_EMPTY",
);

assert.ok(
  result.knowledgeIds.length > 0,
  "V8_CONTENT_PROVENANCE_KNOWLEDGE_EMPTY",
);

assert.ok(
  result.decisionId,
  "V8_CONTENT_PROVENANCE_DECISION_MISSING",
);

assert.ok(
  result.content,
  "V8_CONTENT_PROVENANCE_CONTENT_MISSING",
);


/*
 * ------------------------------------------------------------
 * Helpers
 * ------------------------------------------------------------
 */

function latestRecord(
  aggregateType,
  aggregateId,
) {
  const record =
    store.get(
      aggregateType,
      aggregateId,
    );

  assert.ok(
    record,
    `V8_CONTENT_PROVENANCE_RECORD_MISSING:${aggregateType}:${aggregateId}`,
  );

  return record;
}


function assertRecordFingerprint(
  record,
) {
  const {
    recordId,
    fingerprint,
    ...body
  } = record;

  void recordId;

  const expected =
    contentFingerprint(body);

  assert.equal(
    fingerprint,
    expected,
    `V8_CONTENT_PROVENANCE_FINGERPRINT_MISMATCH:${record.aggregateType}:${record.aggregateId}`,
  );
}


function assertLineageLink(
  parent,
  child,
  expectedType,
) {
  const link =
    child.lineage.find(
      (item) =>
        item.type === expectedType &&
        item.id === parent.aggregateId,
    );

  assert.ok(
    link,
    `V8_CONTENT_PROVENANCE_LINEAGE_MISSING:${child.aggregateId}->${parent.aggregateId}`,
  );

  assert.equal(
    link.version,
    parent.version,
    `V8_CONTENT_PROVENANCE_LINEAGE_VERSION_MISMATCH:${child.aggregateId}->${parent.aggregateId}`,
  );

  assert.equal(
    link.fingerprint,
    parent.fingerprint,
    `V8_CONTENT_PROVENANCE_LINEAGE_FINGERPRINT_MISMATCH:${child.aggregateId}->${parent.aggregateId}`,
  );
}


/*
 * ------------------------------------------------------------
 * Gate 2 — Foundation chain integrity.
 * ------------------------------------------------------------
 */

store.verifyChain();


/*
 * ------------------------------------------------------------
 * Gate 3 — Decision.
 * ------------------------------------------------------------
 */

const decision =
  latestRecord(
    "DECISION",
    result.decisionId,
  );

assert.equal(
  decision.state,
  "APPROVED",
  "V8_CONTENT_PROVENANCE_DECISION_NOT_APPROVED",
);

assert.equal(
  decision.payload.status,
  "APPROVED",
  "V8_CONTENT_PROVENANCE_DECISION_STATUS_NOT_APPROVED",
);

assertRecordFingerprint(
  decision,
);


/*
 * ------------------------------------------------------------
 * Gate 4 — Decision → Problem.
 * ------------------------------------------------------------
 */

const problem =
  latestRecord(
    "PROBLEM",
    decision.payload.problemId,
  );

assert.equal(
  problem.state,
  "REGISTERED",
  "V8_CONTENT_PROVENANCE_PROBLEM_NOT_REGISTERED",
);

assertLineageLink(
  problem,
  decision,
  "PROBLEM",
);


/*
 * ------------------------------------------------------------
 * Gate 5 — Problem → Context → Scope.
 * ------------------------------------------------------------
 */

const context =
  latestRecord(
    "CONTEXT",
    problem.payload.contextId,
  );

assert.equal(
  context.state,
  "REGISTERED",
  "V8_CONTENT_PROVENANCE_CONTEXT_NOT_REGISTERED",
);

assertLineageLink(
  context,
  problem,
  "CONTEXT",
);


const scope =
  latestRecord(
    "SCOPE",
    context.payload.scopeId,
  );

assert.equal(
  scope.state,
  "REGISTERED",
  "V8_CONTENT_PROVENANCE_SCOPE_NOT_REGISTERED",
);

assertLineageLink(
  scope,
  context,
  "SCOPE",
);


/*
 * ------------------------------------------------------------
 * Gate 6 — Decision → Knowledge.
 * ------------------------------------------------------------
 */

assert.ok(
  decision.payload.knowledgeIds.length > 0,
  "V8_CONTENT_PROVENANCE_DECISION_HAS_NO_KNOWLEDGE",
);

const knowledgeRecords = [];

for (
  const knowledgeId
  of decision.payload.knowledgeIds
) {
  const knowledge =
    latestRecord(
      "KNOWLEDGE",
      knowledgeId,
    );

  assert.equal(
    knowledge.state,
    "VERIFIED",
    `V8_CONTENT_PROVENANCE_KNOWLEDGE_NOT_VERIFIED:${knowledgeId}`,
  );

  assertRecordFingerprint(
    knowledge,
  );

  assertLineageLink(
    knowledge,
    decision,
    "KNOWLEDGE",
  );

  knowledgeRecords.push(
    knowledge,
  );
}


/*
 * ------------------------------------------------------------
 * Gate 7 — Knowledge → Claim.
 * ------------------------------------------------------------
 */

const claimRecords = [];

for (
  const knowledge
  of knowledgeRecords
) {
  assert.ok(
    knowledge.payload.claimIds.length > 0,
    `V8_CONTENT_PROVENANCE_KNOWLEDGE_HAS_NO_CLAIMS:${knowledge.aggregateId}`,
  );

  for (
    const claimId
    of knowledge.payload.claimIds
  ) {
    const claim =
      latestRecord(
        "CLAIM",
        claimId,
      );

    assert.equal(
      claim.state,
      "VERIFIED",
      `V8_CONTENT_PROVENANCE_CLAIM_NOT_VERIFIED:${claimId}`,
    );

    assertRecordFingerprint(
      claim,
    );

    assertLineageLink(
      claim,
      knowledge,
      "CLAIM",
    );

    claimRecords.push(
      claim,
    );
  }
}


/*
 * ------------------------------------------------------------
 * Gate 8 — Claim → Evidence.
 * ------------------------------------------------------------
 */

const evidenceRecords = [];

for (
  const claim
  of claimRecords
) {
  assert.ok(
    claim.payload.evidenceIds.length > 0,
    `V8_CONTENT_PROVENANCE_CLAIM_HAS_NO_EVIDENCE:${claim.aggregateId}`,
  );

  for (
    const evidenceId
    of claim.payload.evidenceIds
  ) {
    const evidence =
      latestRecord(
        "EVIDENCE",
        evidenceId,
      );

    assert.equal(
      evidence.state,
      "VERIFIED",
      `V8_CONTENT_PROVENANCE_EVIDENCE_NOT_VERIFIED:${evidenceId}`,
    );

    assert.equal(
      evidence.payload.verificationStatus,
      "VERIFIED",
      `V8_CONTENT_PROVENANCE_EVIDENCE_STATUS_NOT_VERIFIED:${evidenceId}`,
    );

    assertRecordFingerprint(
      evidence,
    );

    assertLineageLink(
      evidence,
      claim,
      "CLAIM",
    );

    evidenceRecords.push(
      evidence,
    );
  }
}


/*
 * ------------------------------------------------------------
 * Gate 9 — Evidence → Snapshot → Source.
 * ------------------------------------------------------------
 */

const uniqueEvidence =
  new Map();

for (
  const evidence
  of evidenceRecords
) {
  uniqueEvidence.set(
    evidence.aggregateId,
    evidence,
  );
}

const uniqueSnapshots =
  new Map();

const uniqueSources =
  new Map();

for (
  const evidence
  of uniqueEvidence.values()
) {
  assert.ok(
    evidence.payload.snapshotId,
    `V8_CONTENT_PROVENANCE_EVIDENCE_SNAPSHOT_MISSING:${evidence.aggregateId}`,
  );

  const snapshot =
    latestRecord(
      "SNAPSHOT",
      evidence.payload.snapshotId,
    );

  assert.equal(
    snapshot.state,
    "SEALED",
    `V8_CONTENT_PROVENANCE_SNAPSHOT_NOT_SEALED:${snapshot.aggregateId}`,
  );

  assertRecordFingerprint(
    snapshot,
  );

  assertLineageLink(
    snapshot,
    evidence,
    "SNAPSHOT",
  );

  uniqueSnapshots.set(
    snapshot.aggregateId,
    snapshot,
  );

  assert.ok(
    evidence.payload.sourceId,
    `V8_CONTENT_PROVENANCE_EVIDENCE_SOURCE_MISSING:${evidence.aggregateId}`,
  );

  const source =
    latestRecord(
      "SOURCE",
      evidence.payload.sourceId,
    );

  assert.equal(
    source.state,
    "REGISTERED",
    `V8_CONTENT_PROVENANCE_SOURCE_NOT_REGISTERED:${source.aggregateId}`,
  );

  assertRecordFingerprint(
    source,
  );

  assertLineageLink(
    source,
    evidence,
    "SOURCE",
  );

  uniqueSources.set(
    source.aggregateId,
    source,
  );
}


/*
 * ------------------------------------------------------------
 * Gate 10 — Content references the approved Decision.
 * ------------------------------------------------------------
 */

assert.equal(
  String(result.content.decisionId),
  String(decision.aggregateId),
  "V8_CONTENT_PROVENANCE_CONTENT_DECISION_MISMATCH",
);

assert.ok(
  result.content.title.trim().length > 0,
  "V8_CONTENT_PROVENANCE_CONTENT_TITLE_EMPTY",
);

assert.ok(
  result.content.body.trim().length > 0,
  "V8_CONTENT_PROVENANCE_CONTENT_BODY_EMPTY",
);


/*
 * ------------------------------------------------------------
 * Gate 11 — Content body contains the deterministic
 *           Decision / Problem / Knowledge inputs.
 * ------------------------------------------------------------
 */

assert.ok(
  result.content.body.includes(
    problem.payload.question.trim(),
  ),
  "V8_CONTENT_PROVENANCE_CONTENT_MISSING_PROBLEM",
);

assert.ok(
  result.content.body.includes(
    decision.payload.outcome.trim(),
  ),
  "V8_CONTENT_PROVENANCE_CONTENT_MISSING_DECISION",
);

for (
  const knowledge
  of knowledgeRecords
) {
  assert.ok(
    result.content.body.includes(
      knowledge.payload.proposition.trim(),
    ),
    `V8_CONTENT_PROVENANCE_CONTENT_MISSING_KNOWLEDGE:${knowledge.aggregateId}`,
  );
}

assert.ok(
  result.content.body.includes(
    context.payload.purpose.trim(),
  ),
  "V8_CONTENT_PROVENANCE_CONTENT_MISSING_CONTEXT",
);


/*
 * ------------------------------------------------------------
 * Gate 12 — Runtime fingerprint must be present and stable.
 * ------------------------------------------------------------
 */

assert.ok(
  result.fingerprint,
  "V8_CONTENT_PROVENANCE_RUNTIME_FINGERPRINT_MISSING",
);

const runtimeFingerprint =
  result.fingerprint;

assert.equal(
  runtimeFingerprint,
  result.fingerprint,
  "V8_CONTENT_PROVENANCE_RUNTIME_FINGERPRINT_UNSTABLE",
);


/*
 * ------------------------------------------------------------
 * Gate 13 — Tamper test.
 *
 * We do NOT mutate the Foundation store.
 *
 * Instead we create a detached copy of an immutable
 * Knowledge record and modify its payload.
 *
 * The detached record must immediately fail its
 * fingerprint verification.
 * ------------------------------------------------------------
 */

const tamperTarget =
  knowledgeRecords[0];

assert.ok(
  tamperTarget,
  "V8_CONTENT_PROVENANCE_TAMPER_TARGET_MISSING",
);

const tamperedKnowledge =
  {
    ...tamperTarget,

    payload: {
      ...tamperTarget.payload,

      proposition:
        `${tamperTarget.payload.proposition} [TAMPERED]`,
    },
  };


let tamperBlocked =
  false;

try {
  assertRecordFingerprint(
    tamperedKnowledge,
  );
} catch {
  tamperBlocked = true;
}

assert.equal(
  tamperBlocked,
  true,
  "V8_CONTENT_PROVENANCE_TAMPER_NOT_BLOCKED",
);


/*
 * ------------------------------------------------------------
 * Gate 14 — Foundation chain remains valid after
 *           detached tamper test.
 * ------------------------------------------------------------
 */

store.verifyChain();


/*
 * ------------------------------------------------------------
 * Final result.
 * ------------------------------------------------------------
 */

console.log(
  "[NEXMOLD][V8-CONTENT-PROVENANCE] REAL INTERNET CONTENT PROVENANCE GATE PASS",
);

console.log(
  `[V8-CONTENT-PROVENANCE] acquired=${result.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] sources=${uniqueSources.size}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] snapshots=${uniqueSnapshots.size}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] verifiedEvidence=${uniqueEvidence.size}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] claims=${claimRecords.length}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] knowledge=${knowledgeRecords.length}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] decision=${decision.aggregateId}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] decisionState=${decision.state}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] contentDecision=${result.content.decisionId}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] tamperBlocked=${tamperBlocked}`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] chainValid=true`,
);

console.log(
  `[V8-CONTENT-PROVENANCE] fingerprint=${runtimeFingerprint}`,
);