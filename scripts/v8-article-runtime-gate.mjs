import assert from "node:assert/strict";

import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";
import { HttpPageFetcher } from "../.v8-build/src/v8/acquisition/page-fetcher.js";
import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";
import { runV8ArticleRuntime } from "../.v8-build/src/v8/runtime/article-runtime.js";

const apiKey = process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_ARTICLE_RUNTIME_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}

const opportunity = {
  keyword: {
    keyword: "plastic injection molding wall thickness",
    normalized: "plastic injection molding wall thickness",
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
    "V8 article runtime real internet gate",
  ],
};

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    apiKey,
    "https://api.tavily.com/search",
    "v8-article-runtime-gate",
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
      id: "v8-article-runtime-gate",
      role: "SYSTEM",
    },

    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId: "v8-article-runtime-gate",
    },

    scope: {
      id: "scope:v8:article-runtime-gate",
      geography: "GLOBAL",
      industries: [
        "PLASTIC_INJECTION_MOLDING",
      ],
      languages: [
        "en",
      ],
    },

    context: {
      id: "context:v8:article-runtime-gate",
      purpose:
        "Produce evidence-backed technical content from real Internet sources.",
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
      id: "problem:v8:article-runtime-gate",
      question:
        "What evidence-backed information can be stated about plastic injection molding wall thickness?",
      constraints: [
        "Use real Internet-acquired evidence only.",
        "Only VERIFIED evidence may produce claims.",
        "Only VERIFIED claims may produce approved knowledge.",
        "Decision must be APPROVED.",
        "Content must be derived from the approved decision.",
      ],
    },

    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert.ok(
  result.acquisition,
  "V8_ARTICLE_RUNTIME_ACQUISITION_MISSING",
);

assert.ok(
  result.acquisition.acquisitions.length > 0,
  "V8_ARTICLE_RUNTIME_ACQUISITION_EMPTY",
);

assert.ok(
  result.verifiedEvidenceIds.length > 0,
  "V8_ARTICLE_RUNTIME_VERIFIED_EVIDENCE_EMPTY",
);

assert.ok(
  result.claimIds.length > 0,
  "V8_ARTICLE_RUNTIME_CLAIMS_EMPTY",
);

assert.ok(
  result.knowledgeIds.length > 0,
  "V8_ARTICLE_RUNTIME_KNOWLEDGE_EMPTY",
);

assert.ok(
  result.scopeId,
  "V8_ARTICLE_RUNTIME_SCOPE_MISSING",
);

assert.ok(
  result.contextId,
  "V8_ARTICLE_RUNTIME_CONTEXT_MISSING",
);

assert.ok(
  result.problemId,
  "V8_ARTICLE_RUNTIME_PROBLEM_MISSING",
);

assert.ok(
  result.decisionId,
  "V8_ARTICLE_RUNTIME_DECISION_MISSING",
);

assert.ok(
  result.content,
  "V8_ARTICLE_RUNTIME_CONTENT_MISSING",
);

assert.ok(
  result.fingerprint,
  "V8_ARTICLE_RUNTIME_FINGERPRINT_MISSING",
);

const evidenceRecords =
  store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        "EVIDENCE",
    );

assert.ok(
  evidenceRecords.length > 0,
  "V8_ARTICLE_RUNTIME_EVIDENCE_NOT_PERSISTED",
);

for (const record of evidenceRecords) {
  assert.equal(
    record.state,
    "VERIFIED",
    `Evidence ${record.aggregateId} did not reach VERIFIED.`,
  );

  assert.equal(
    record.payload.verificationStatus,
    "VERIFIED",
    `Evidence ${record.aggregateId} payload is not VERIFIED.`,
  );
}

const claimRecords =
  store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        "CLAIM",
    );

assert.ok(
  claimRecords.length > 0,
  "V8_ARTICLE_RUNTIME_CLAIMS_NOT_PERSISTED",
);

for (const record of claimRecords) {
  assert.equal(
    record.state,
    "VERIFIED",
    `Claim ${record.aggregateId} did not reach VERIFIED.`,
  );
}

const knowledgeRecords =
  store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        "KNOWLEDGE",
    );

assert.ok(
  knowledgeRecords.length > 0,
  "V8_ARTICLE_RUNTIME_KNOWLEDGE_NOT_PERSISTED",
);

for (const record of knowledgeRecords) {
  assert.equal(
    record.state,
    "VERIFIED",
    `Knowledge ${record.aggregateId} did not reach VERIFIED.`,
  );
}

const decisionRecords =
  store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        "DECISION",
    );

assert.ok(
  decisionRecords.length > 0,
  "V8_ARTICLE_RUNTIME_DECISION_NOT_PERSISTED",
);

const decisionRecord =
  decisionRecords.find(
    (record) =>
      record.aggregateId ===
      result.decisionId,
  );

assert.ok(
  decisionRecord,
  "V8_ARTICLE_RUNTIME_DECISION_ID_MISSING",
);

assert.equal(
  decisionRecord.state,
  "APPROVED",
  "V8_ARTICLE_RUNTIME_DECISION_NOT_APPROVED",
);

assert.ok(
  result.content,
  "V8_ARTICLE_RUNTIME_CONTENT_EMPTY",
);

store.verifyChain();

console.log(
  "[NEXMOLD][V8-ARTICLE-RUNTIME] REAL INTERNET ARTICLE RUNTIME GATE PASS",
);

console.log(
  `[V8-ARTICLE-RUNTIME] acquired=${result.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] claims=${result.claimIds.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] knowledge=${result.knowledgeIds.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] scope=${result.scopeId}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] context=${result.contextId}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] problem=${result.problemId}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] decision=${result.decisionId}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] decisionState=${decisionRecord.state}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] content=true`,
);

console.log(
  `[V8-ARTICLE-RUNTIME] fingerprint=${result.fingerprint}`,
);