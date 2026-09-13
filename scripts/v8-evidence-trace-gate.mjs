import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  contentFingerprint,
} from "../.v8-build/src/v8/foundation/hash.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  TavilySearchProvider,
} from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";

import {
  evidenceId,
} from "../.v8-build/src/v8/domain/primitives.js";

import {
  runV8ArticleRuntime,
} from "../.v8-build/src/v8/runtime/article-runtime.js";


const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_EVIDENCE_TRACE_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}


const opportunity = {
  keyword: {
    keyword:
      "plastic injection molding wall thickness",
    normalized:
      "plastic injection molding wall thickness",
    source:
      "SEED",
    intent:
      "INFORMATIONAL",
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
    "V8 evidence trace gate real Internet source",
  ],
};


const store =
  new InMemoryFoundationStore();


const searchProvider =
  new TavilySearchProvider(
    apiKey,
    "https://api.tavily.com/search",
    "v8-evidence-trace-gate",
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
      id:
        "v8-evidence-trace-gate",
      role:
        "SYSTEM",
    },

    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId:
        "v8-evidence-trace-gate",
    },

    scope: {
      id:
        "scope:v8:evidence-trace-gate",

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
        "context:v8:evidence-trace-gate",

      purpose:
        "Trace real Internet source content through immutable Snapshot and Evidence into Claims.",

      variables: {
        sourceMode:
          "REAL_INTERNET",

        evidencePolicy:
          "VERIFIED_ONLY",

        tracePolicy:
          "SNAPSHOT_EXCERPT_EXACT_MATCH",

        contentPolicy:
          "EVIDENCE_BACKED",
      },
    },

    problem: {
      id:
        "problem:v8:evidence-trace-gate",

      question:
        "Can every Evidence-backed claim be traced to exact content captured from a real Internet source?",

      constraints: [
        "Use real Internet-acquired sources only.",
        "Every Evidence record must reference a persisted Snapshot.",
        "Every Evidence excerpt must exist in the persisted Snapshot payload.",
        "Every Evidence hash must match the immutable Snapshot content and Evidence fields.",
        "Every Claim must reference at least one Evidence record.",
        "Only VERIFIED Evidence may produce Claims.",
        "Only VERIFIED Claims may produce Knowledge.",
        "Decision must be APPROVED.",
      ],
    },

    title:
      "V8 Evidence Trace Gate",
  });


/*
 * --------------------------------------------------------------------------
 * Gate 0
 * Real Internet acquisition exists.
 * --------------------------------------------------------------------------
 */

assert.ok(
  result.acquisition,
  "V8_EVIDENCE_TRACE_ACQUISITION_MISSING",
);

assert.ok(
  result.acquisition.acquisitions.length > 0,
  "V8_EVIDENCE_TRACE_ACQUISITION_EMPTY",
);


/*
 * --------------------------------------------------------------------------
 * Build latest Foundation record maps.
 *
 * auditTrail() is immutable history, therefore historical states such as:
 *
 *   INGESTED
 *       ↓
 *   VERIFIED
 *
 * must not be interpreted as independent current states.
 * --------------------------------------------------------------------------
 */

function latestRecordsByAggregate(
  aggregateType,
) {
  const latest =
    new Map();

  for (
    const record of
      store
        .auditTrail()
        .filter(
          (item) =>
            item.aggregateType ===
            aggregateType,
        )
  ) {
    const existing =
      latest.get(
        record.aggregateId,
      );

    if (
      existing === undefined ||
      record.version >
        existing.version
    ) {
      latest.set(
        record.aggregateId,
        record,
      );
    }
  }

  return latest;
}


const latestSourceRecords =
  latestRecordsByAggregate(
    "SOURCE",
  );

const latestSnapshotRecords =
  latestRecordsByAggregate(
    "SNAPSHOT",
  );

const latestEvidenceRecords =
  latestRecordsByAggregate(
    "EVIDENCE",
  );

const latestClaimRecords =
  latestRecordsByAggregate(
    "CLAIM",
  );

const latestKnowledgeRecords =
  latestRecordsByAggregate(
    "KNOWLEDGE",
  );

const latestDecisionRecords =
  latestRecordsByAggregate(
    "DECISION",
  );


/*
 * --------------------------------------------------------------------------
 * Gate 1
 * Source records exist.
 * --------------------------------------------------------------------------
 */

assert.ok(
  latestSourceRecords.size > 0,
  "V8_EVIDENCE_TRACE_SOURCE_EMPTY",
);


/*
 * --------------------------------------------------------------------------
 * Gate 2
 * Snapshot records exist and are SEALED.
 * --------------------------------------------------------------------------
 */

assert.ok(
  latestSnapshotRecords.size > 0,
  "V8_EVIDENCE_TRACE_SNAPSHOT_EMPTY",
);

for (
  const snapshotRecord of
    latestSnapshotRecords.values()
) {
  assert.equal(
    snapshotRecord.state,
    "SEALED",
    `Snapshot ${snapshotRecord.aggregateId} is not SEALED.`,
  );

  assert.ok(
    snapshotRecord.payload,
    `Snapshot ${snapshotRecord.aggregateId} payload is missing.`,
  );

  assert.equal(
    snapshotRecord.payload.metadataOnly,
    false,
    `Snapshot ${snapshotRecord.aggregateId} unexpectedly contains metadata-only payload.`,
  );

  assert.ok(
    typeof snapshotRecord.payload.payload ===
      "string" &&
      snapshotRecord.payload.payload.length > 0,
    `Snapshot ${snapshotRecord.aggregateId} has no captured Internet payload.`,
  );
}


/*
 * --------------------------------------------------------------------------
 * Gate 3
 * Every runtime Evidence ID has a Foundation record.
 * --------------------------------------------------------------------------
 */

assert.ok(
  result.verifiedEvidenceIds.length > 0,
  "V8_EVIDENCE_TRACE_VERIFIED_EVIDENCE_EMPTY",
);

assert.equal(
  latestEvidenceRecords.size,
  result.verifiedEvidenceIds.length,
  "V8_EVIDENCE_TRACE_EVIDENCE_COUNT_MISMATCH",
);


/*
 * --------------------------------------------------------------------------
 * Gate 4
 * Evidence must be VERIFIED.
 * --------------------------------------------------------------------------
 */

for (
  const evidenceIdValue of
    result.verifiedEvidenceIds
) {
  const evidenceRecord =
    latestEvidenceRecords.get(
      evidenceIdValue,
    );

  assert.ok(
    evidenceRecord,
    `Evidence ${evidenceIdValue} has no latest Foundation record.`,
  );

  assert.equal(
    evidenceRecord.state,
    "VERIFIED",
    `Evidence ${evidenceIdValue} latest state is not VERIFIED.`,
  );

  assert.equal(
    evidenceRecord.payload.verificationStatus,
    "VERIFIED",
    `Evidence ${evidenceIdValue} payload verificationStatus is not VERIFIED.`,
  );
}


/*
 * --------------------------------------------------------------------------
 * Gate 5
 * Evidence → Snapshot identity.
 *
 * Every Evidence must reference the exact Snapshot used by the acquisition
 * record that produced it.
 * --------------------------------------------------------------------------
 */

const acquisitionBySnapshotId =
  new Map();

for (
  const acquisitionRecord of
    result.acquisition.acquisitions
) {
  acquisitionBySnapshotId.set(
    acquisitionRecord.acquisition.snapshotId,
    acquisitionRecord,
  );
}


for (
  const evidenceRecord of
    latestEvidenceRecords.values()
) {
  const evidence =
    evidenceRecord.payload;

  assert.ok(
    typeof evidence.snapshotId ===
      "string" &&
      evidence.snapshotId.length > 0,
    `Evidence ${evidenceRecord.aggregateId} has no snapshotId.`,
  );

  const snapshotRecord =
    latestSnapshotRecords.get(
      evidence.snapshotId,
    );

  assert.ok(
    snapshotRecord,
    `Evidence ${evidenceRecord.aggregateId} references missing Snapshot ${evidence.snapshotId}.`,
  );

  assert.equal(
    snapshotRecord.state,
    "SEALED",
    `Evidence ${evidenceRecord.aggregateId} references Snapshot ${evidence.snapshotId} which is not SEALED.`,
  );

  const acquisitionRecord =
    acquisitionBySnapshotId.get(
      evidence.snapshotId,
    );

  assert.ok(
    acquisitionRecord,
    `Evidence ${evidenceRecord.aggregateId} Snapshot ${evidence.snapshotId} is not present in runtime acquisition results.`,
  );

  assert.equal(
    acquisitionRecord.acquisition.snapshotId,
    evidence.snapshotId,
    `Evidence ${evidenceRecord.aggregateId} Snapshot identity mismatch.`,
  );
}


/*
 * --------------------------------------------------------------------------
 * Gate 6
 * Evidence source identity must match Snapshot source identity.
 * --------------------------------------------------------------------------
 */

for (
  const evidenceRecord of
    latestEvidenceRecords.values()
) {
  const evidence =
    evidenceRecord.payload;

  const snapshotRecord =
    latestSnapshotRecords.get(
      evidence.snapshotId,
    );

  assert.ok(
    snapshotRecord,
    `Evidence ${evidenceRecord.aggregateId} Snapshot is missing.`,
  );

  assert.equal(
    String(evidence.sourceId),
    String(snapshotRecord.payload.sourceId),
    `Evidence ${evidenceRecord.aggregateId} sourceId does not match Snapshot sourceId.`,
  );

  const sourceRecord =
    latestSourceRecords.get(
      String(evidence.sourceId),
    );

  assert.ok(
    sourceRecord,
    `Evidence ${evidenceRecord.aggregateId} references missing Source ${String(evidence.sourceId)}.`,
  );
}


/*
 * --------------------------------------------------------------------------
 * Gate 7
 * Exact Evidence excerpt must exist in the immutable Snapshot payload.
 *
 * This is the core traceability test:
 *
 *     REAL INTERNET
 *          ↓
 *       SNAPSHOT
 *          ↓
 *       EVIDENCE
 *
 * Evidence is not allowed to become detached from captured source content.
 * --------------------------------------------------------------------------
 */

let exactExcerptMatches =
  0;

for (
  const evidenceRecord of
    latestEvidenceRecords.values()
) {
  const evidence =
    evidenceRecord.payload;

  const snapshotRecord =
    latestSnapshotRecords.get(
      evidence.snapshotId,
    );

  assert.ok(
    snapshotRecord,
    `Evidence ${evidenceRecord.aggregateId} Snapshot is missing.`,
  );

  const snapshotPayload =
    snapshotRecord.payload.payload;

  assert.ok(
    typeof snapshotPayload ===
      "string" &&
      snapshotPayload.length > 0,
    `Snapshot ${evidence.snapshotId} has no text payload.`,
  );

  assert.ok(
    evidence.excerpt.trim().length > 0,
    `Evidence ${evidenceRecord.aggregateId} excerpt is empty.`,
  );

  assert.ok(
    snapshotPayload.includes(
      evidence.excerpt,
    ),
    [
      `Evidence ${evidenceRecord.aggregateId} excerpt is not present in Snapshot ${evidence.snapshotId}.`,
      `Evidence locator: ${evidence.locator}`,
      `Evidence excerpt length: ${evidence.excerpt.length}`,
      `Snapshot payload length: ${snapshotPayload.length}`,
    ].join("\n"),
  );

  exactExcerptMatches += 1;
}


/*
 * --------------------------------------------------------------------------
 * Gate 8
 * Evidence hash must reproduce exactly from:
 *
 *   source
 *   snapshotId
 *   snapshotContentHash
 *   locator
 *   excerpt
 *   parameter
 *   value
 *   unit
 *
 * This mirrors evidence-builder.ts.
 * --------------------------------------------------------------------------
 */

let evidenceHashMatches =
  0;

for (
  const evidenceRecord of
    latestEvidenceRecords.values()
) {
  const evidence =
    evidenceRecord.payload;

  const snapshotRecord =
    latestSnapshotRecords.get(
      evidence.snapshotId,
    );

  assert.ok(
    snapshotRecord,
    `Evidence ${evidenceRecord.aggregateId} Snapshot is missing.`,
  );

  const expectedHash =
    contentFingerprint({
      source:
        String(evidence.sourceId),

      snapshotId:
        evidence.snapshotId,

      snapshotContentHash:
        snapshotRecord.payload.contentHash,

      locator:
        evidence.locator,

      excerpt:
        evidence.excerpt,

      parameter:
        evidence.parameter,

      value:
        evidence.value,

      unit:
        evidence.unit,
    });

  assert.equal(
    evidence.evidenceHash,
    expectedHash,
    `Evidence ${evidenceRecord.aggregateId} evidenceHash does not match its immutable Snapshot and Evidence fields.`,
  );

  evidenceHashMatches += 1;
}


/*
 * --------------------------------------------------------------------------
 * Gate 9
 * Runtime Evidence IDs must be reproducible from the persisted Evidence
 * identity inputs.
 *
 * This additionally verifies that the Evidence aggregate itself has not
 * drifted away from the identity returned by the runtime.
 * --------------------------------------------------------------------------
 */

for (
  const evidenceRecord of
    latestEvidenceRecords.values()
) {
  const evidence =
    evidenceRecord.payload;

  const expectedEvidenceId =
    evidenceId(
      contentFingerprint({
        source:
          String(evidence.sourceId),

        snapshotId:
          evidence.snapshotId,

        snapshotContentHash:
          latestSnapshotRecords.get(
            evidence.snapshotId,
          )?.payload.contentHash,

        locator:
          evidence.locator,

        excerpt:
          evidence.excerpt,

        parameter:
          evidence.parameter,

        value:
          evidence.value,

        unit:
          evidence.unit,
      }),
    ).toString();

  assert.equal(
    evidenceRecord.aggregateId,
    expectedEvidenceId,
    `Evidence aggregate identity mismatch for ${evidenceRecord.aggregateId}.`,
  );
}


/*
 * --------------------------------------------------------------------------
 * Gate 10
 * Every Claim must reference at least one Evidence record.
 * --------------------------------------------------------------------------
 */

assert.ok(
  result.claimIds.length > 0,
  "V8_EVIDENCE_TRACE_CLAIMS_EMPTY",
);

assert.ok(
  latestClaimRecords.size > 0,
  "V8_EVIDENCE_TRACE_CLAIMS_NOT_PERSISTED",
);


for (
  const claimId of
    result.claimIds
) {
  const claimRecord =
    latestClaimRecords.get(
      claimId,
    );

  assert.ok(
    claimRecord,
    `Claim ${claimId} has no latest Foundation record.`,
  );

  assert.equal(
    claimRecord.state,
    "VERIFIED",
    `Claim ${claimId} latest state is not VERIFIED.`,
  );

  const claim =
    claimRecord.payload;

  assert.ok(
    Array.isArray(
      claim.evidenceIds,
    ),
    `Claim ${claimId} evidenceIds is not an array.`,
  );

  assert.ok(
    claim.evidenceIds.length > 0,
    `Claim ${claimId} contains no Evidence references.`,
  );

  for (
    const referencedEvidenceId of
      claim.evidenceIds
  ) {
    const evidenceRecord =
      latestEvidenceRecords.get(
        String(
          referencedEvidenceId,
        ),
      );

    assert.ok(
      evidenceRecord,
      `Claim ${claimId} references missing Evidence ${String(referencedEvidenceId)}.`,
    );

    assert.equal(
      evidenceRecord.state,
      "VERIFIED",
      `Claim ${claimId} references Evidence ${String(referencedEvidenceId)} that is not VERIFIED.`,
    );
  }
}


/*
 * --------------------------------------------------------------------------
 * Gate 11
 * Every Knowledge record must reference Claims.
 * --------------------------------------------------------------------------
 */

assert.ok(
  result.knowledgeIds.length > 0,
  "V8_EVIDENCE_TRACE_KNOWLEDGE_EMPTY",
);

assert.ok(
  latestKnowledgeRecords.size > 0,
  "V8_EVIDENCE_TRACE_KNOWLEDGE_NOT_PERSISTED",
);


for (
  const knowledgeIdValue of
    result.knowledgeIds
) {
  const knowledgeRecord =
    latestKnowledgeRecords.get(
      knowledgeIdValue,
    );

  assert.ok(
    knowledgeRecord,
    `Knowledge ${knowledgeIdValue} has no latest Foundation record.`,
  );

  assert.equal(
    knowledgeRecord.state,
    "VERIFIED",
    `Knowledge ${knowledgeIdValue} latest state is not VERIFIED.`,
  );

  const knowledge =
    knowledgeRecord.payload;

  assert.ok(
    Array.isArray(
      knowledge.claimIds,
    ),
    `Knowledge ${knowledgeIdValue} claimIds is not an array.`,
  );

  assert.ok(
    knowledge.claimIds.length > 0,
    `Knowledge ${knowledgeIdValue} contains no Claim references.`,
  );

  for (
    const referencedClaimId of
      knowledge.claimIds
  ) {
    const claimRecord =
      latestClaimRecords.get(
        String(
          referencedClaimId,
        ),
      );

    assert.ok(
      claimRecord,
      `Knowledge ${knowledgeIdValue} references missing Claim ${String(referencedClaimId)}.`,
    );

    assert.equal(
      claimRecord.state,
      "VERIFIED",
      `Knowledge ${knowledgeIdValue} references Claim ${String(referencedClaimId)} that is not VERIFIED.`,
    );
  }
}


/*
 * --------------------------------------------------------------------------
 * Gate 12
 * Decision must exist and be APPROVED.
 * --------------------------------------------------------------------------
 */

assert.ok(
  result.decisionId,
  "V8_EVIDENCE_TRACE_DECISION_MISSING",
);

const decisionRecord =
  latestDecisionRecords.get(
    result.decisionId,
  );

assert.ok(
  decisionRecord,
  `Decision ${result.decisionId} has no latest Foundation record.`,
);

assert.equal(
  decisionRecord.state,
  "APPROVED",
  `Decision ${result.decisionId} is not APPROVED.`,
);


/*
 * --------------------------------------------------------------------------
 * Gate 13
 * Decision must reference the Knowledge produced by this runtime.
 * --------------------------------------------------------------------------
 */

const decision =
  decisionRecord.payload;

assert.ok(
  Array.isArray(
    decision.knowledgeIds,
  ),
  "V8_EVIDENCE_TRACE_DECISION_KNOWLEDGE_IDS_INVALID",
);

for (
  const knowledgeIdValue of
    result.knowledgeIds
) {
  assert.ok(
    decision.knowledgeIds.includes(
      knowledgeIdValue,
    ),
    `Decision ${result.decisionId} does not reference Knowledge ${knowledgeIdValue}.`,
  );
}


/*
 * --------------------------------------------------------------------------
 * Gate 14
 * Final Foundation chain integrity.
 * --------------------------------------------------------------------------
 */

store.verifyChain();


/*
 * --------------------------------------------------------------------------
 * PASS
 * --------------------------------------------------------------------------
 */

console.log(
  "[NEXMOLD][V8-EVIDENCE-TRACE] REAL INTERNET EVIDENCE TRACE GATE PASS",
);

console.log(
  `[V8-EVIDENCE-TRACE] acquired=${result.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] sources=${latestSourceRecords.size}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] snapshots=${latestSnapshotRecords.size}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] exactExcerptMatches=${exactExcerptMatches}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] evidenceHashMatches=${evidenceHashMatches}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] claims=${result.claimIds.length}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] knowledge=${result.knowledgeIds.length}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] decision=${result.decisionId}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] decisionState=${decisionRecord.state}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] content=true`,
);

console.log(
  `[V8-EVIDENCE-TRACE] fingerprint=${result.fingerprint}`,
);