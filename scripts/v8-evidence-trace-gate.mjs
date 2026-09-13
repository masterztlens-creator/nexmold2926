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


/*
 * ============================================================================
 * V8-11 REAL INTERNET EVIDENCE TRACE GATE
 *
 * Required chain:
 *
 * REAL INTERNET
 *      ↓
 * SOURCE
 *      ↓
 * SNAPSHOT
 *      ↓
 * EVIDENCE
 *      ↓
 * CLAIM
 *      ↓
 * KNOWLEDGE
 *      ↓
 * DECISION
 *      ↓
 * verifyChain()
 *
 * Core invariant:
 *
 * Content is disposable.
 * Truth is durable.
 *
 * This gate proves that the durable Evidence layer can be traced back to
 * immutable Snapshot content acquired from the real Internet.
 *
 * IMPORTANT:
 * - Do not use fixtures.
 * - Do not use synthetic source records.
 * - Do not bypass acquisition.
 * - Do not modify V8 foundation/domain/acquisition code.
 * ============================================================================
 */


/*
 * ============================================================================
 * Configuration
 * ============================================================================
 */

const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_EVIDENCE_TRACE_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}


/*
 * ============================================================================
 * Real Internet research opportunity
 * ============================================================================
 */

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


/*
 * ============================================================================
 * Runtime infrastructure
 * ============================================================================
 */

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


/*
 * ============================================================================
 * Run the real V8 article runtime.
 * ============================================================================
 */

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
        "Every Evidence excerpt must exist in the persisted Snapshot-derived text projection.",
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
 * ============================================================================
 * Gate 0
 *
 * Real Internet acquisition exists.
 * ============================================================================
 */

assert.ok(
  result.acquisition,
  "V8_EVIDENCE_TRACE_ACQUISITION_MISSING",
);

assert.ok(
  Array.isArray(
    result.acquisition.acquisitions,
  ),
  "V8_EVIDENCE_TRACE_ACQUISITIONS_NOT_ARRAY",
);

assert.ok(
  result.acquisition.acquisitions.length > 0,
  "V8_EVIDENCE_TRACE_ACQUISITION_EMPTY",
);


/*
 * ============================================================================
 * Helper
 *
 * Foundation auditTrail() is immutable history.
 *
 * We must resolve the latest record for each aggregate rather than treating
 * every historical version as a current record.
 * ============================================================================
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


/*
 * ============================================================================
 * Latest aggregate maps
 * ============================================================================
 */

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
 * ============================================================================
 * Gate 1
 *
 * Source records exist.
 * ============================================================================
 */

assert.ok(
  latestSourceRecords.size > 0,
  "V8_EVIDENCE_TRACE_SOURCE_EMPTY",
);


/*
 * ============================================================================
 * Gate 2
 *
 * Snapshots exist and are immutable SEALED snapshots containing the actual
 * Internet payload.
 * ============================================================================
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
 * ============================================================================
 * Gate 3
 *
 * Runtime verified Evidence must exist and must be persisted.
 * ============================================================================
 */

assert.ok(
  Array.isArray(
    result.verifiedEvidenceIds,
  ),
  "V8_EVIDENCE_TRACE_VERIFIED_EVIDENCE_IDS_NOT_ARRAY",
);

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
 * ============================================================================
 * Gate 4
 *
 * Every runtime Evidence must be VERIFIED.
 * ============================================================================
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
 * ============================================================================
 * Gate 5
 *
 * Evidence → Snapshot identity.
 * ============================================================================
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
 * ============================================================================
 * Gate 6
 *
 * Evidence source identity must match Snapshot source identity and the Source
 * aggregate must exist.
 * ============================================================================
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
 * ============================================================================
 * Snapshot text projection
 *
 * Snapshot payload is HTML.
 *
 * Evidence excerpt is generated from the HTML text projection:
 *
 *   - remove script
 *   - remove style
 *   - remove noscript
 *   - remove HTML tags
 *   - decode common HTML entities
 *   - normalize whitespace
 *
 * Therefore:
 *
 * Evidence.excerpt ∈ textProjection(Snapshot.payload.payload)
 *
 * NOT:
 *
 * Evidence.excerpt ∈ raw HTML
 * ============================================================================
 */

function snapshotTextProjection(
  html,
) {
  return html
    .replace(
      /<script[\s\S]*?<\/script>/gi,
      " ",
    )
    .replace(
      /<style[\s\S]*?<\/style>/gi,
      " ",
    )
    .replace(
      /<noscript[\s\S]*?<\/noscript>/gi,
      " ",
    )
    .replace(
      /<[^>]+>/g,
      " ",
    )
    .replace(
      /&nbsp;/gi,
      " ",
    )
    .replace(
      /&amp;/gi,
      "&",
    )
    .replace(
      /&lt;/gi,
      "<",
    )
    .replace(
      /&gt;/gi,
      ">",
    )
    .replace(
      /&#39;/gi,
      "'",
    )
    .replace(
      /&quot;/gi,
      '"',
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim();
}


/*
 * ============================================================================
 * Gate 7
 *
 * Evidence excerpt must exist in the immutable Snapshot-derived text
 * projection.
 * ============================================================================
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
    `Snapshot ${evidence.snapshotId} has no captured payload.`,
  );

  const snapshotText =
    snapshotTextProjection(
      snapshotPayload,
    );

  assert.ok(
    snapshotText.length > 0,
    `Snapshot ${evidence.snapshotId} text projection is empty.`,
  );

  assert.ok(
    typeof evidence.excerpt ===
      "string" &&
      evidence.excerpt.trim().length > 0,
    `Evidence ${evidenceRecord.aggregateId} excerpt is empty.`,
  );

  assert.ok(
    snapshotText.includes(
      evidence.excerpt,
    ),
    [
      `Evidence ${evidenceRecord.aggregateId} excerpt is not present in the Snapshot-derived text projection.`,
      `Evidence locator: ${evidence.locator}`,
      `Evidence excerpt length: ${evidence.excerpt.length}`,
      `Snapshot payload length: ${snapshotPayload.length}`,
      `Snapshot text projection length: ${snapshotText.length}`,
    ].join("\n"),
  );

  exactExcerptMatches += 1;
}


/*
 * ============================================================================
 * Gate 8
 *
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
 * ============================================================================
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
 * ============================================================================
 * Gate 9
 *
 * Evidence aggregate identity must be reproducible.
 * ============================================================================
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

  const expectedEvidenceId =
    evidenceId(
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
      }),
    ).toString();

  assert.equal(
    evidenceRecord.aggregateId,
    expectedEvidenceId,
    `Evidence aggregate identity mismatch for ${evidenceRecord.aggregateId}.`,
  );
}


/*
 * ============================================================================
 * Gate 10
 *
 * Every Claim must reference at least one persisted Evidence record.
 * ============================================================================
 */

assert.ok(
  Array.isArray(
    result.claimIds,
  ),
  "V8_EVIDENCE_TRACE_CLAIM_IDS_NOT_ARRAY",
);

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
    `Claim ${claimId} has no Evidence references.`,
  );

  for (
    const referencedEvidenceId of
      claim.evidenceIds
  ) {
    assert.ok(
      latestEvidenceRecords.has(
        referencedEvidenceId,
      ),
      `Claim ${claimId} references missing Evidence ${referencedEvidenceId}.`,
    );

    const referencedEvidence =
      latestEvidenceRecords.get(
        referencedEvidenceId,
      );

    assert.equal(
      referencedEvidence?.state,
      "VERIFIED",
      `Claim ${claimId} references Evidence ${referencedEvidenceId} which is not VERIFIED.`,
    );
  }
}


/*
 * ============================================================================
 * Gate 11
 *
 * Every Knowledge record must reference at least one Claim.
 * ============================================================================
 */

assert.ok(
  Array.isArray(
    result.knowledgeIds,
  ),
  "V8_EVIDENCE_TRACE_KNOWLEDGE_IDS_NOT_ARRAY",
);

assert.ok(
  result.knowledgeIds.length > 0,
  "V8_EVIDENCE_TRACE_KNOWLEDGE_EMPTY",
);

assert.ok(
  latestKnowledgeRecords.size > 0,
  "V8_EVIDENCE_TRACE_KNOWLEDGE_NOT_PERSISTED",
);

for (
  const knowledgeId of
    result.knowledgeIds
) {
  const knowledgeRecord =
    latestKnowledgeRecords.get(
      knowledgeId,
    );

  assert.ok(
    knowledgeRecord,
    `Knowledge ${knowledgeId} has no latest Foundation record.`,
  );

  assert.equal(
    knowledgeRecord.state,
    "VERIFIED",
    `Knowledge ${knowledgeId} latest state is not VERIFIED.`,
  );

  const knowledge =
    knowledgeRecord.payload;

  assert.ok(
    Array.isArray(
      knowledge.claimIds,
    ),
    `Knowledge ${knowledgeId} claimIds is not an array.`,
  );

  assert.ok(
    knowledge.claimIds.length > 0,
    `Knowledge ${knowledgeId} has no Claim references.`,
  );

  for (
    const referencedClaimId of
      knowledge.claimIds
  ) {
    assert.ok(
      latestClaimRecords.has(
        referencedClaimId,
      ),
      `Knowledge ${knowledgeId} references missing Claim ${referencedClaimId}.`,
    );

    const referencedClaim =
      latestClaimRecords.get(
        referencedClaimId,
      );

    assert.equal(
      referencedClaim?.state,
      "VERIFIED",
      `Knowledge ${knowledgeId} references Claim ${referencedClaimId} which is not VERIFIED.`,
    );
  }
}


/*
 * ============================================================================
 * Gate 12
 *
 * Decision must:
 *
 *   - exist
 *   - be persisted
 *   - be APPROVED
 *   - reference Knowledge
 * ============================================================================
 */

assert.ok(
  result.decisionId,
  "V8_EVIDENCE_TRACE_DECISION_ID_MISSING",
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
  `Decision ${result.decisionId} latest Foundation state is not APPROVED.`,
);

const decision =
  decisionRecord.payload;

assert.equal(
  decision.status,
  "APPROVED",
  `Decision ${result.decisionId} payload status is not APPROVED.`,
);

assert.ok(
  Array.isArray(
    decision.knowledgeIds,
  ),
  `Decision ${result.decisionId} knowledgeIds is not an array.`,
);

assert.ok(
  decision.knowledgeIds.length > 0,
  `Decision ${result.decisionId} has no Knowledge references.`,
);

for (
  const referencedKnowledgeId of
    decision.knowledgeIds
) {
  assert.ok(
    latestKnowledgeRecords.has(
      referencedKnowledgeId,
    ),
    `Decision ${result.decisionId} references missing Knowledge ${referencedKnowledgeId}.`,
  );

  const referencedKnowledge =
    latestKnowledgeRecords.get(
      referencedKnowledgeId,
    );

  assert.equal(
    referencedKnowledge?.state,
    "VERIFIED",
    `Decision ${result.decisionId} references Knowledge ${referencedKnowledgeId} which is not VERIFIED.`,
  );
}


/*
 * ============================================================================
 * Gate 13
 *
 * Foundation immutable chain must verify.
 *
 * IMPORTANT:
 *
 * InMemoryFoundationStore.verifyChain() returns void.
 *
 * Success condition:
 *   - verifyChain() completes without throwing.
 *
 * Failure condition:
 *   - verifyChain() throws V8_FOUNDATION_CHAIN_BROKEN or
 *     V8_FOUNDATION_FINGERPRINT_MISMATCH.
 *
 * DO NOT assert a return value here.
 * ============================================================================
 */

store.verifyChain();


/*
 * ============================================================================
 * Gate 14
 *
 * Runtime fingerprint must exist.
 * ============================================================================
 */

assert.ok(
  typeof result.fingerprint ===
    "string" &&
    result.fingerprint.length > 0,
  "V8_EVIDENCE_TRACE_RUNTIME_FINGERPRINT_MISSING",
);


/*
 * ============================================================================
 * Final metrics
 * ============================================================================
 */

const acquired =
  result.acquisition.acquisitions.length;

const snapshots =
  latestSnapshotRecords.size;

const verifiedEvidence =
  result.verifiedEvidenceIds.length;

const claims =
  result.claimIds.length;

const knowledge =
  result.knowledgeIds.length;


/*
 * ============================================================================
 * PASS
 * ============================================================================
 */

console.log(
  "[NEXMOLD][V8-EVIDENCE-TRACE] REAL INTERNET EVIDENCE TRACE GATE PASS",
);

console.log(
  `[V8-EVIDENCE-TRACE] acquired=${acquired}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] snapshots=${snapshots}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] verifiedEvidence=${verifiedEvidence}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] exactExcerptMatches=${exactExcerptMatches}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] evidenceHashMatches=${evidenceHashMatches}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] claims=${claims}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] knowledge=${knowledge}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] decision=${result.decisionId}`,
);

console.log(
  `[V8-EVIDENCE-TRACE] decisionState=${decisionRecord.state}`,
);

console.log(
  "[V8-EVIDENCE-TRACE] chainValid=true",
);

console.log(
  `[V8-EVIDENCE-TRACE] fingerprint=${result.fingerprint}`,
);