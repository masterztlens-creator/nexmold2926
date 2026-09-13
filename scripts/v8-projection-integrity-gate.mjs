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
  ContentCompiler,
} from "../.v8-build/src/v8/content-compiler/compiler.js";

import {
  PublicationEligibilityEvaluator,
} from "../.v8-build/src/v8/publication-eligibility/evaluator.js";

import {
  ProjectionProjector,
} from "../.v8-build/src/v8/projection/projector.js";

const apiKey = process.env.V8_SEARCH_API_KEY;

assert(
  typeof apiKey === "string" &&
    apiKey.trim().length > 0,
  "V8_PROJECTION_INTEGRITY_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
);

function assertString(value, message) {
  assert.equal(
    typeof value,
    "string",
    message,
  );

  assert(
    value.trim().length > 0,
    message,
  );
}

function assertArray(value, message) {
  assert(
    Array.isArray(value),
    message,
  );
}

function getRequiredRecord(
  store,
  type,
  id,
  message,
) {
  assertString(
    id,
    message ??
      `V8_PROJECTION_INTEGRITY_ID_MISSING:${type}`,
  );

  const record = store.get(
    type,
    id,
  );

  assert(
    record !== null,
    message ??
      `V8_PROJECTION_INTEGRITY_RECORD_NOT_FOUND:${type}:${id}`,
  );

  return record;
}

function hasLineage(
  lineage,
  target,
) {
  return lineage.some(
    (item) =>
      item.type === target.type &&
      item.id === target.id &&
      item.version === target.version &&
      item.fingerprint === target.fingerprint,
  );
}

function expectFailure(
  callback,
  expectedMessage,
) {
  assert.throws(
    callback,
    (error) => {
      assert(
        error instanceof Error,
        "V8_PROJECTION_INTEGRITY_TAMPER_ERROR_NOT_ERROR",
      );

      assert(
        error.message.includes(expectedMessage),
        `V8_PROJECTION_INTEGRITY_UNEXPECTED_TAMPER_ERROR:${error.message}`,
      );

      return true;
    },
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
    "V8-16 projection integrity real internet validation",
  ],
};

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    apiKey,
  );

const pageFetcher =
  new HttpPageFetcher({
    timeoutMs: 20_000,
    maxBytes: 5_000_000,
  });

const runtime =
  await runV8ArticleRuntime({
    opportunity,

    searchProvider,

    pageFetcher,

    store,

    actor: {
      id: "v8-projection-integrity-gate",
      role: "SYSTEM",
    },

    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId:
        "v8-projection-integrity-gate",
    },

    scope: {
      geography: "GLOBAL",

      industries: [
        "PLASTICS",
        "INJECTION_MOLDING",
      ],

      languages: [
        "en",
      ],
    },

    context: {
      purpose:
        "Validate Projection integrity from real Internet evidence.",

      variables: {
        source: "REAL_INTERNET",
        gate: "V8-16",
      },
    },

    problem: {
      question:
        "What wall thickness considerations should be evaluated for plastic injection molding?",

      constraints: [
        "Claims must be grounded in verified Internet evidence.",
        "Projection must originate from eligible Content.",
        "Projection identity must remain deterministic.",
      ],
    },

    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert(
  runtime.acquisition !== null &&
    runtime.acquisition !== undefined,
  "V8_PROJECTION_INTEGRITY_ACQUISITION_MISSING",
);

assertArray(
  runtime.acquisition.acquisitions,
  "V8_PROJECTION_INTEGRITY_ACQUISITIONS_INVALID",
);

assert(
  runtime.acquisition.acquisitions.length > 0,
  "V8_PROJECTION_INTEGRITY_ACQUISITION_EMPTY",
);

assertArray(
  runtime.verifiedEvidenceIds,
  "V8_PROJECTION_INTEGRITY_EVIDENCE_IDS_INVALID",
);

assert(
  runtime.verifiedEvidenceIds.length > 0,
  "V8_PROJECTION_INTEGRITY_VERIFIED_EVIDENCE_EMPTY",
);

assertArray(
  runtime.claimIds,
  "V8_PROJECTION_INTEGRITY_CLAIM_IDS_INVALID",
);

assert(
  runtime.claimIds.length > 0,
  "V8_PROJECTION_INTEGRITY_CLAIMS_EMPTY",
);

assertArray(
  runtime.knowledgeIds,
  "V8_PROJECTION_INTEGRITY_KNOWLEDGE_IDS_INVALID",
);

assert(
  runtime.knowledgeIds.length > 0,
  "V8_PROJECTION_INTEGRITY_KNOWLEDGE_EMPTY",
);

assertString(
  runtime.scopeId,
  "V8_PROJECTION_INTEGRITY_SCOPE_ID_INVALID",
);

assertString(
  runtime.contextId,
  "V8_PROJECTION_INTEGRITY_CONTEXT_ID_INVALID",
);

assertString(
  runtime.decisionId,
  "V8_PROJECTION_INTEGRITY_DECISION_ID_INVALID",
);

assert(
  runtime.content !== null &&
    runtime.content !== undefined,
  "V8_PROJECTION_INTEGRITY_CONTENT_MISSING",
);

const decision =
  getRequiredRecord(
    store,
    "DECISION",
    runtime.decisionId,
    "V8_PROJECTION_INTEGRITY_DECISION_NOT_FOUND",
  );

assert.equal(
  decision.state,
  "APPROVED",
  "V8_PROJECTION_INTEGRITY_DECISION_NOT_APPROVED",
);

const compiler =
  new ContentCompiler(store);

const compiled =
  compiler.compile({
    decisionId:
      runtime.decisionId,

    scopeId:
      runtime.scopeId,

    contextId:
      runtime.contextId,

    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert.equal(
  compiled.content.id,
  runtime.content.id,
  "V8_PROJECTION_INTEGRITY_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.decisionId,
  runtime.decisionId,
  "V8_PROJECTION_INTEGRITY_CONTENT_DECISION_MISMATCH",
);

assert.equal(
  compiled.content.title,
  runtime.content.title,
  "V8_PROJECTION_INTEGRITY_CONTENT_TITLE_MISMATCH",
);

assert.equal(
  compiled.content.body,
  runtime.content.body,
  "V8_PROJECTION_INTEGRITY_CONTENT_BODY_MISMATCH",
);

const eligibilityEvaluator =
  new PublicationEligibilityEvaluator(
    store,
  );

const eligibility =
  eligibilityEvaluator.evaluate({
    compiled,

    scopeId:
      runtime.scopeId,

    contextId:
      runtime.contextId,
  });

assert.equal(
  eligibility.status,
  "ELIGIBLE",
  `V8_PROJECTION_INTEGRITY_NOT_ELIGIBLE:${JSON.stringify(
    eligibility.reasons,
  )}`,
);

assert.equal(
  eligibility.eligible,
  true,
  "V8_PROJECTION_INTEGRITY_ELIGIBLE_FLAG_FALSE",
);

assertString(
  eligibility.contentId,
  "V8_PROJECTION_INTEGRITY_ELIGIBILITY_CONTENT_ID_INVALID",
);

assert.equal(
  eligibility.contentId,
  compiled.content.id,
  "V8_PROJECTION_INTEGRITY_ELIGIBILITY_CONTENT_MISMATCH",
);

const projector =
  new ProjectionProjector(
    store,
  );

const projectionResult =
  projector.project({
    compiled,

    scopeId:
      runtime.scopeId,

    contextId:
      runtime.contextId,
  });

assert(
  projectionResult !== null &&
    projectionResult !== undefined,
  "V8_PROJECTION_INTEGRITY_RESULT_MISSING",
);

assert(
  projectionResult.projected !== null &&
    projectionResult.projected !== undefined,
  "V8_PROJECTION_INTEGRITY_PROJECTED_MISSING",
);

const projected =
  projectionResult.projected;

assertString(
  projected.projectionId,
  "V8_PROJECTION_INTEGRITY_PROJECTION_ID_INVALID",
);

assertString(
  projected.contentId,
  "V8_PROJECTION_INTEGRITY_PROJECTION_CONTENT_ID_INVALID",
);

assertString(
  projected.decisionId,
  "V8_PROJECTION_INTEGRITY_PROJECTION_DECISION_ID_INVALID",
);

assertString(
  projected.scopeId,
  "V8_PROJECTION_INTEGRITY_PROJECTION_SCOPE_ID_INVALID",
);

assertString(
  projected.contextId,
  "V8_PROJECTION_INTEGRITY_PROJECTION_CONTEXT_ID_INVALID",
);

assertString(
  projected.title,
  "V8_PROJECTION_INTEGRITY_PROJECTION_TITLE_INVALID",
);

assertString(
  projected.body,
  "V8_PROJECTION_INTEGRITY_PROJECTION_BODY_INVALID",
);

assertString(
  projected.fingerprint,
  "V8_PROJECTION_INTEGRITY_PROJECTION_FINGERPRINT_INVALID",
);

assert.equal(
  projected.contentId,
  compiled.content.id,
  "V8_PROJECTION_INTEGRITY_CONTENT_ID_MISMATCH",
);

assert.equal(
  projected.decisionId,
  compiled.decision.aggregateId,
  "V8_PROJECTION_INTEGRITY_DECISION_ID_MISMATCH",
);

assert.equal(
  projected.scopeId,
  runtime.scopeId,
  "V8_PROJECTION_INTEGRITY_SCOPE_ID_MISMATCH",
);

assert.equal(
  projected.contextId,
  runtime.contextId,
  "V8_PROJECTION_INTEGRITY_CONTEXT_ID_MISMATCH",
);

assert.equal(
  projected.title,
  compiled.content.title,
  "V8_PROJECTION_INTEGRITY_TITLE_MISMATCH",
);

assert.equal(
  projected.body,
  compiled.content.body,
  "V8_PROJECTION_INTEGRITY_BODY_MISMATCH",
);

assert.equal(
  projected.sourceContent.aggregateId,
  compiled.decision.aggregateId,
  "V8_PROJECTION_INTEGRITY_SOURCE_DECISION_MISMATCH",
);

assert.equal(
  projected.sourceContent.fingerprint,
  compiled.decision.fingerprint,
  "V8_PROJECTION_INTEGRITY_SOURCE_DECISION_FINGERPRINT_MISMATCH",
);

assertArray(
  projected.lineage,
  "V8_PROJECTION_INTEGRITY_LINEAGE_INVALID",
);

assert(
  projected.lineage.length > 0,
  "V8_PROJECTION_INTEGRITY_LINEAGE_EMPTY",
);

assert(
  hasLineage(
    projected.lineage,
    {
      type: "DECISION",
      id: compiled.decision.aggregateId,
      version: compiled.decision.version,
      fingerprint: compiled.decision.fingerprint,
    },
  ),
  "V8_PROJECTION_INTEGRITY_DECISION_LINEAGE_MISSING",
);

for (
  const link of eligibility.lineage
) {
  assert(
    hasLineage(
      projected.lineage,
      link,
    ),
    `V8_PROJECTION_INTEGRITY_ELIGIBILITY_LINEAGE_MISSING:${link.type}:${link.id}`,
  );
}

const projectionRecord =
  getRequiredRecord(
    store,
    "PROJECTION",
    projected.projectionId,
    "V8_PROJECTION_INTEGRITY_PROJECTION_RECORD_NOT_FOUND",
  );

assert.equal(
  projectionRecord.aggregateType,
  "PROJECTION",
  "V8_PROJECTION_INTEGRITY_PROJECTION_TYPE_MISMATCH",
);

assert.equal(
  projectionRecord.aggregateId,
  projected.projectionId,
  "V8_PROJECTION_INTEGRITY_PROJECTION_ID_MISMATCH",
);

assert.equal(
  projectionRecord.state,
  "REGISTERED",
  "V8_PROJECTION_INTEGRITY_PROJECTION_STATE_INVALID",
);

assert.deepEqual(
  projectionRecord.payload,
  {
    contentId:
      compiled.content.id,

    decisionId:
      compiled.decision.aggregateId,

    sourceFingerprint:
      compiled.fingerprint,

    scopeId:
      runtime.scopeId,

    contextId:
      runtime.contextId,

    title:
      compiled.content.title,

    body:
      compiled.content.body,
  },
  "V8_PROJECTION_INTEGRITY_PROJECTION_PAYLOAD_MISMATCH",
);

assert.deepEqual(
  projectionRecord.lineage,
  projected.lineage,
  "V8_PROJECTION_INTEGRITY_PROJECTION_LINEAGE_MISMATCH",
);

assert.equal(
  projectionRecord.fingerprint,
  projected.fingerprint,
  "V8_PROJECTION_INTEGRITY_PROJECTION_FINGERPRINT_MISMATCH",
);

assert.equal(
  projectionRecord.recordId,
  `PROJECTION:${projected.projectionId}:1`,
  "V8_PROJECTION_INTEGRITY_PROJECTION_RECORD_ID_MISMATCH",
);

const secondProjection =
  projector.project({
    compiled,

    scopeId:
      runtime.scopeId,

    contextId:
      runtime.contextId,
  });

assert.deepEqual(
  secondProjection.projected,
  projected,
  "V8_PROJECTION_INTEGRITY_NON_DETERMINISTIC_REPROJECTION",
);

/*
 * Tamper test 1:
 * Changing Content title invalidates the canonical Content
 * fingerprint before Projection source-fingerprint validation.
 */
const tamperedTitle =
  {
    ...compiled,
    content: {
      ...compiled.content,
      title:
        `${compiled.content.title} TAMPERED`,
    },
  };

expectFailure(
  () =>
    projector.project({
      compiled:
        tamperedTitle,

      scopeId:
        runtime.scopeId,

      contextId:
        runtime.contextId,
    }),
  "CONTENT_FINGERPRINT_MISMATCH",
);

/*
 * Tamper test 2:
 * Changing Content body is likewise rejected by the
 * publication eligibility layer before projection.
 */
const tamperedBody =
  {
    ...compiled,
    content: {
      ...compiled.content,
      body:
        `${compiled.content.body}\nTAMPERED`,
    },
  };

expectFailure(
  () =>
    projector.project({
      compiled:
        tamperedBody,

      scopeId:
        runtime.scopeId,

      contextId:
        runtime.contextId,
    }),
  "CONTENT_FINGERPRINT_MISMATCH",
);

/*
 * Tamper test 3:
 * Changing the Decision aggregate identity must fail
 * before a Projection can be accepted.
 */
const tamperedDecision =
  {
    ...compiled,
    decision: {
      ...compiled.decision,
      aggregateId:
        `${compiled.decision.aggregateId}:tampered`,
    },
  };

expectFailure(
  () =>
    projector.project({
      compiled:
        tamperedDecision,

      scopeId:
        runtime.scopeId,

      contextId:
        runtime.contextId,
    }),
  "V8_PROJECTION_CONTENT_DECISION_MISMATCH",
);

store.verifyChain();

const persistedProjection =
  getRequiredRecord(
    store,
    "PROJECTION",
    projected.projectionId,
    "V8_PROJECTION_INTEGRITY_PERSISTED_PROJECTION_MISSING",
  );

assert.equal(
  persistedProjection.state,
  "REGISTERED",
  "V8_PROJECTION_INTEGRITY_PERSISTED_PROJECTION_STATE_INVALID",
);

assert.equal(
  persistedProjection.fingerprint,
  projectionRecord.fingerprint,
  "V8_PROJECTION_INTEGRITY_PERSISTED_FINGERPRINT_CHANGED",
);

console.log(
  "[NEXMOLD][V8-PROJECTION-INTEGRITY] REAL INTERNET PROJECTION INTEGRITY GATE PASS",
);

console.log(
  `[V8-PROJECTION-INTEGRITY] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] decision=${runtime.decisionId}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] decisionState=${decision.state}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] content=${compiled.content.id}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] eligibility=${eligibility.status}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] projection=${projected.projectionId}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] projectionState=${projectionRecord.state}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] projectionFingerprint=${projectionRecord.fingerprint}`,
);

console.log(
  `[V8-PROJECTION-INTEGRITY] lineage=${projectionRecord.lineage.length}`,
);

console.log(
  "[V8-PROJECTION-INTEGRITY] deterministicReprojection=true",
);

console.log(
  "[V8-PROJECTION-INTEGRITY] tamperRejection=true",
);

console.log(
  "[V8-PROJECTION-INTEGRITY] chainValid=true",
);