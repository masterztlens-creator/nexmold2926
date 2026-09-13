import assert from "node:assert/strict";

import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";
import { HttpPageFetcher } from "../.v8-build/src/v8/acquisition/page-fetcher.js";
import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";
import { runV8ArticleRuntime } from "../.v8-build/src/v8/runtime/article-runtime.js";
import { ApplicabilityEngine } from "../.v8-build/src/v8/applicability/engine.js";

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function createGetTamperedStore(store, tamper) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property !== "get") {
        return Reflect.get(target, property, receiver);
      }

      return (type, id, version) => {
        const record = target.get(type, id, version);

        if (!record) {
          return record;
        }

        return tamper(record, type, id, version);
      };
    },
  });
}

const apiKey = process.env.V8_SEARCH_API_KEY;

assertTruthy(
  apiKey,
  "V8_APPLICABILITY_SEARCH_API_KEY_MISSING",
);

const store = new InMemoryFoundationStore();

const searchProvider = new TavilySearchProvider(apiKey);
const pageFetcher = new HttpPageFetcher();

const runtime = await runV8ArticleRuntime({
  opportunity: {
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
      "V8-20 applicability evaluation against real Internet-derived knowledge",
    ],
  },

  searchProvider,
  pageFetcher,
  store,

  actor: {
    id: "v8:applicability-gate",
    role: "INGESTOR",
  },

  acquisition: {
    maxQueries: 1,
    maxCandidates: 3,
    actorId: "v8:applicability-gate",
  },

  scope: {
    geography: "GLOBAL",
    industries: [
      "INJECTION_MOLDING",
    ],
    languages: [
      "en",
    ],
  },

  context: {
    purpose:
      "V8-20 applicability evaluation for verified Internet-derived knowledge",
    variables: {
      gate: "V8-20",
      domain: "plastic-injection-molding",
    },
  },

  problem: {
    question:
      "What wall thickness considerations apply to plastic injection molding?",
    constraints: [
      "Use only verified evidence.",
      "Do not infer universal applicability.",
    ],
  },

  title:
    "Plastic Injection Molding Wall Thickness",
});

assert.equal(
  runtime.acquisition.acquisitions.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_ACQUISITIONS",
);

assert.equal(
  runtime.verifiedEvidenceIds.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_VERIFIED_EVIDENCE",
);

assert.equal(
  runtime.claimIds.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_CLAIMS",
);

assert.equal(
  runtime.knowledgeIds.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_KNOWLEDGE",
);

const engine = new ApplicabilityEngine(store);

const applicability = engine.evaluate({
  knowledgeId: runtime.knowledgeIds[0],
  scopeId: runtime.scopeId,
  contextId: runtime.contextId,
});

assert.equal(
  applicability.applicable,
  true,
  `V8_APPLICABILITY_REAL_INTERNET_NOT_APPLICABLE:${applicability.reasons.join(",")}`,
);

assert.deepEqual(
  applicability.reasons,
  [],
  "V8_APPLICABILITY_UNEXPECTED_POSITIVE_REASONS",
);

assert.equal(
  applicability.knowledgeId,
  runtime.knowledgeIds[0],
  "V8_APPLICABILITY_KNOWLEDGE_ID_MISMATCH",
);

assert.equal(
  applicability.scopeId,
  runtime.scopeId,
  "V8_APPLICABILITY_SCOPE_ID_MISMATCH",
);

assert.equal(
  applicability.contextId,
  runtime.contextId,
  "V8_APPLICABILITY_CONTEXT_ID_MISMATCH",
);

assert.equal(
  applicability.lineage.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_LINEAGE_RECORDS",
);

const knowledgeRecord = store.get(
  "KNOWLEDGE",
  runtime.knowledgeIds[0],
);

const scopeRecord = store.get(
  "SCOPE",
  runtime.scopeId,
);

const contextRecord = store.get(
  "CONTEXT",
  runtime.contextId,
);

assertTruthy(
  knowledgeRecord,
  "V8_APPLICABILITY_KNOWLEDGE_RECORD_MISSING",
);

assertTruthy(
  scopeRecord,
  "V8_APPLICABILITY_SCOPE_RECORD_MISSING",
);

assertTruthy(
  contextRecord,
  "V8_APPLICABILITY_CONTEXT_RECORD_MISSING",
);

const expectedLineage = [
  {
    type: "KNOWLEDGE",
    id: knowledgeRecord.aggregateId,
    version: knowledgeRecord.version,
    fingerprint: knowledgeRecord.fingerprint,
  },
  {
    type: "SCOPE",
    id: scopeRecord.aggregateId,
    version: scopeRecord.version,
    fingerprint: scopeRecord.fingerprint,
  },
  {
    type: "CONTEXT",
    id: contextRecord.aggregateId,
    version: contextRecord.version,
    fingerprint: contextRecord.fingerprint,
  },
];

assert.deepEqual(
  applicability.lineage,
  expectedLineage,
  "V8_APPLICABILITY_LINEAGE_INTEGRITY_FAILED",
);

const tamperedKnowledgeStore =
  createGetTamperedStore(
    store,
    (record, type) => {
      if (
        type === "KNOWLEDGE" &&
        record.aggregateId ===
          runtime.knowledgeIds[0]
      ) {
        return {
          ...record,
          state: "REJECTED",
        };
      }

      return record;
    },
  );

const tamperedKnowledgeApplicability =
  new ApplicabilityEngine(
    tamperedKnowledgeStore,
  ).evaluate({
    knowledgeId: runtime.knowledgeIds[0],
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

assert.equal(
  tamperedKnowledgeApplicability.applicable,
  false,
  "V8_APPLICABILITY_KNOWLEDGE_TAMPER_NOT_REJECTED",
);

assert.ok(
  tamperedKnowledgeApplicability.reasons.includes(
    "KNOWLEDGE_NOT_VERIFIED",
  ),
  "V8_APPLICABILITY_KNOWLEDGE_TAMPER_REASON_MISSING",
);

const tamperedContextStore =
  createGetTamperedStore(
    store,
    (record, type) => {
      if (
        type === "CONTEXT" &&
        record.aggregateId ===
          runtime.contextId
      ) {
        return {
          ...record,
          payload: {
            ...record.payload,
            scopeId: "scope:v8:tampered",
          },
        };
      }

      return record;
    },
  );

const tamperedContextApplicability =
  new ApplicabilityEngine(
    tamperedContextStore,
  ).evaluate({
    knowledgeId: runtime.knowledgeIds[0],
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

assert.equal(
  tamperedContextApplicability.applicable,
  false,
  "V8_APPLICABILITY_CONTEXT_TAMPER_NOT_REJECTED",
);

assert.ok(
  tamperedContextApplicability.reasons.includes(
    "CONTEXT_SCOPE_MISMATCH",
  ),
  "V8_APPLICABILITY_CONTEXT_TAMPER_REASON_MISSING",
);

const missingKnowledgeApplicability =
  engine.evaluate({
    knowledgeId:
      "knowledge:v8:nonexistent",
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

assert.equal(
  missingKnowledgeApplicability.applicable,
  false,
  "V8_APPLICABILITY_MISSING_KNOWLEDGE_NOT_BLOCKED",
);

assert.ok(
  missingKnowledgeApplicability.reasons.includes(
    "KNOWLEDGE_NOT_FOUND",
  ),
  "V8_APPLICABILITY_MISSING_KNOWLEDGE_REASON_MISSING",
);

let assertBlocked = false;

try {
  const blockedEngine =
    new ApplicabilityEngine(
      tamperedKnowledgeStore,
    );

  blockedEngine.assert({
    knowledgeId: runtime.knowledgeIds[0],
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });
} catch (error) {
  assertBlocked =
    error?.code ===
    "V8_APPLICABILITY_BLOCKED";
}

assert.equal(
  assertBlocked,
  true,
  "V8_APPLICABILITY_ASSERT_FAIL_CLOSED_FAILED",
);

store.verifyChain();

console.log(
  "[V8-20] REAL INTERNET APPLICABILITY GATE PASS",
);

console.log(
  `[V8-20] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-20] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-20] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-20] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-20] applicable=${applicability.applicable}`,
);

console.log(
  `[V8-20] lineage=${applicability.lineage.length}`,
);

console.log(
  "[V8-20] knowledgeTamperRejection=true",
);

console.log(
  "[V8-20] contextTamperRejection=true",
);

console.log(
  "[V8-20] missingKnowledgeRejection=true",
);

console.log(
  "[V8-20] assertFailClosed=true",
);

console.log(
  "[V8-20] foundationChainVerified=true",
);