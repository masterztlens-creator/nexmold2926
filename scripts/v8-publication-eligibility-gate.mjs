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


function requiredEnv(name) {
  const value = process.env[name]?.trim();

  assert.ok(
    value,
    `V8_PUBLICATION_ELIGIBILITY_CONFIG_MISSING: ${name} is required.`,
  );

  return value;
}


function assertTruthy(value, message) {
  assert.ok(value, message);
}


function assertEqual(actual, expected, message) {
  assert.equal(actual, expected, message);
}


function assertIncludes(values, expected, message) {
  assert.ok(
    values.includes(expected),
    `${message}: expected ${expected}`,
  );
}


const apiKey = requiredEnv(
  "V8_SEARCH_API_KEY",
);


const store =
  new InMemoryFoundationStore();


const searchProvider =
  new TavilySearchProvider(
    apiKey,
  );


const pageFetcher =
  new HttpPageFetcher({
    timeoutMs: 20000,
    maxBytes: 5000000,
  });


const result =
  await runV8ArticleRuntime({
    opportunity: {
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

      score:
        0.9,

      demand:
        0.8,

      relevance:
        1,

      competition:
        0.3,

      authorityGap:
        0.7,

      conversionPotential:
        0.6,

      reasons: [
        "V8 publication eligibility gate real internet validation",
      ],
    },

    searchProvider,

    pageFetcher,

    store,

    actor: {
      id:
        "v8:publication-eligibility-gate",

      role:
        "SYSTEM",
    },

    acquisition: {
      maxQueries:
        1,

      maxCandidates:
        3,

      actorId:
        "v8-publication-eligibility-gate",
    },

    scope: {
      id:
        "scope:v8:publication-eligibility-gate",

      geography:
        "GLOBAL",

      industries: [
        "INJECTION_MOLDING",
      ],

      languages: [
        "en",
      ],
    },

    context: {
      id:
        "context:v8:publication-eligibility-gate",

      purpose:
        "Validate whether evidence-backed injection molding knowledge is eligible for publication.",

      variables: {
        domain:
          "plastic injection molding",

        audience:
          "engineering",
      },
    },

    problem: {
      id:
        "problem:v8:publication-eligibility-gate",

      question:
        "What wall-thickness considerations are supported by the acquired evidence for plastic injection molding?",
    },

    title:
      "Plastic Injection Molding Wall Thickness",
  });


assertTruthy(
  result,
  "V8_PUBLICATION_ELIGIBILITY_RUNTIME_RESULT_MISSING",
);


assertTruthy(
  result.content,
  "V8_PUBLICATION_ELIGIBILITY_CONTENT_MISSING",
);


assertTruthy(
  result.decisionId,
  "V8_PUBLICATION_ELIGIBILITY_DECISION_MISSING",
);


assertTruthy(
  result.scopeId,
  "V8_PUBLICATION_ELIGIBILITY_SCOPE_MISSING",
);


assertTruthy(
  result.contextId,
  "V8_PUBLICATION_ELIGIBILITY_CONTEXT_MISSING",
);


assert.ok(
  Array.isArray(
    result.verifiedEvidenceIds,
  ) &&
    result.verifiedEvidenceIds.length > 0,
  "V8_PUBLICATION_ELIGIBILITY_VERIFIED_EVIDENCE_MISSING",
);


assert.ok(
  Array.isArray(
    result.claimIds,
  ) &&
    result.claimIds.length > 0,
  "V8_PUBLICATION_ELIGIBILITY_CLAIMS_MISSING",
);


assert.ok(
  Array.isArray(
    result.knowledgeIds,
  ) &&
    result.knowledgeIds.length > 0,
  "V8_PUBLICATION_ELIGIBILITY_KNOWLEDGE_MISSING",
);


const compiled =
  new ContentCompiler(
    store,
  ).compile({
    decisionId:
      result.decisionId,

    scopeId:
      result.scopeId,

    contextId:
      result.contextId,

    title:
      result.content.title,
  });


assertTruthy(
  compiled,
  "V8_PUBLICATION_ELIGIBILITY_COMPILED_CONTENT_MISSING",
);


assertEqual(
  compiled.decision.aggregateId,
  result.decisionId,
  "V8_PUBLICATION_ELIGIBILITY_DECISION_ID_MISMATCH",
);


assertEqual(
  compiled.content.id,
  result.content.id,
  "V8_PUBLICATION_ELIGIBILITY_CONTENT_ID_MISMATCH",
);


assertEqual(
  compiled.content.title,
  result.content.title,
  "V8_PUBLICATION_ELIGIBILITY_CONTENT_TITLE_MISMATCH",
);


assertEqual(
  compiled.content.body,
  result.content.body,
  "V8_PUBLICATION_ELIGIBILITY_CONTENT_BODY_MISMATCH",
);


const evaluator =
  new PublicationEligibilityEvaluator(
    store,
  );


const eligibility =
  evaluator.evaluate({
    compiled,

    scopeId:
      result.scopeId,

    contextId:
      result.contextId,
  });


assertEqual(
  eligibility.status,
  "ELIGIBLE",
  `V8_PUBLICATION_ELIGIBILITY_NOT_ELIGIBLE: ${eligibility.reasons.join(",")}`,
);


assertEqual(
  eligibility.eligible,
  true,
  "V8_PUBLICATION_ELIGIBILITY_FALSE",
);


assertEqual(
  eligibility.contentId,
  compiled.content.id,
  "V8_PUBLICATION_ELIGIBILITY_CONTENT_ID_INVALID",
);


assertEqual(
  eligibility.decisionId,
  compiled.decision.aggregateId,
  "V8_PUBLICATION_ELIGIBILITY_DECISION_INVALID",
);


assertEqual(
  eligibility.scopeId,
  result.scopeId,
  "V8_PUBLICATION_ELIGIBILITY_SCOPE_INVALID",
);


assertEqual(
  eligibility.contextId,
  result.contextId,
  "V8_PUBLICATION_ELIGIBILITY_CONTEXT_INVALID",
);


assertEqual(
  eligibility.fingerprint,
  compiled.fingerprint,
  "V8_PUBLICATION_ELIGIBILITY_FINGERPRINT_INVALID",
);


assert.ok(
  eligibility.reasons.length === 0,
  `V8_PUBLICATION_ELIGIBILITY_UNEXPECTED_REASONS: ${eligibility.reasons.join(",")}`,
);


const decisionRecord =
  store.get(
    "DECISION",
    result.decisionId,
  );


assertTruthy(
  decisionRecord,
  `V8_PUBLICATION_ELIGIBILITY_DECISION_RECORD_MISSING:${result.decisionId}`,
);


assertEqual(
  decisionRecord.state,
  "APPROVED",
  "V8_PUBLICATION_ELIGIBILITY_DECISION_NOT_APPROVED",
);


assertIncludes(
  eligibility.lineage.map(
    (item) => item.type,
  ),
  "DECISION",
  "V8_PUBLICATION_ELIGIBILITY_DECISION_LINEAGE_MISSING",
);


assertIncludes(
  eligibility.lineage.map(
    (item) => item.type,
  ),
  "SCOPE",
  "V8_PUBLICATION_ELIGIBILITY_SCOPE_LINEAGE_MISSING",
);


assertIncludes(
  eligibility.lineage.map(
    (item) => item.type,
  ),
  "CONTEXT",
  "V8_PUBLICATION_ELIGIBILITY_CONTEXT_LINEAGE_MISSING",
);


for (
  const knowledgeId of result.knowledgeIds
) {
  const knowledge =
    store.get(
      "KNOWLEDGE",
      knowledgeId,
    );

  assertTruthy(
    knowledge,
    `V8_PUBLICATION_ELIGIBILITY_KNOWLEDGE_RECORD_MISSING:${knowledgeId}`,
  );

  assertEqual(
    knowledge.state,
    "VERIFIED",
    `V8_PUBLICATION_ELIGIBILITY_KNOWLEDGE_NOT_VERIFIED:${knowledgeId}`,
  );
}


store.verifyChain();


console.log(
  "[NEXMOLD][V8-PUBLICATION-ELIGIBILITY] REAL INTERNET PUBLICATION ELIGIBILITY GATE PASS",
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] acquired=${result.acquisition.acquisitions.length}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] claims=${result.claimIds.length}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] knowledge=${result.knowledgeIds.length}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] scope=${result.scopeId}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] context=${result.contextId}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] decision=${result.decisionId}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] decisionState=${decisionRecord.state}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] content=${compiled.content.id}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] contentFingerprint=${compiled.fingerprint}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] status=${eligibility.status}`,
);


console.log(
  `[V8-PUBLICATION-ELIGIBILITY] lineage=${eligibility.lineage.length}`,
);


console.log(
  "[V8-PUBLICATION-ELIGIBILITY] chainValid=true",
);