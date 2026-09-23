import assert from "node:assert/strict";

import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";
import { HttpPageFetcher } from "../.v8-build/src/v8/acquisition/page-fetcher.js";
import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";
import { runV8ArticleRuntime } from "../.v8-build/src/v8/runtime/article-runtime.js";
import { ApplicabilityEngine } from "../.v8-build/src/v8/applicability/engine.js";

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function recordsOfType(store, type) {
  return store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType === type,
    );
}

function createGetTamperedStore(store, tamper) {
  return new Proxy(store, {
    get(target, property, receiver) {
      if (property !== "get") {
        return Reflect.get(
          target,
          property,
          receiver,
        );
      }

      return (type, id, version) => {
        const record = target.get(
          type,
          id,
          version,
        );

        if (!record) {
          return record;
        }

        return tamper(
          record,
          type,
          id,
          version,
        );
      };
    },
  });
}

const apiKey =
  process.env.V8_SEARCH_API_KEY;

assertTruthy(
  apiKey,
  "V8_APPLICABILITY_SEARCH_API_KEY_MISSING",
);

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(apiKey);

const pageFetcher =
  new HttpPageFetcher();

let runtimeError = null;

try {
  await runV8ArticleRuntime({
    opportunity: {
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
        "V8-20 fail-closed applicability evaluation against real Internet-derived knowledge",
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
      actorId:
        "v8:applicability-gate",
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
        "V8-20 fail-closed applicability evaluation for verified Internet-derived knowledge",

      variables: {
        gate: "V8-20",
        domain:
          "plastic-injection-molding",
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
} catch (error) {
  runtimeError = error;
}

assertTruthy(
  runtimeError,
  "V8_APPLICABILITY_EXPECTED_RUNTIME_BLOCK",
);

assert.equal(
  runtimeError?.code,
  "V8_APPLICABILITY_BLOCKED",
  `V8_APPLICABILITY_UNEXPECTED_RUNTIME_ERROR:${runtimeError?.message ?? String(runtimeError)}`,
);

assert.match(
  runtimeError?.message ?? "",
  /KNOWLEDGE_(?:UNIT|CONDITION)_MISMATCH:/,
  "V8_APPLICABILITY_RUNTIME_BLOCK_REASON_MISSING",
);

const sourceRecords =
  recordsOfType(
    store,
    "SOURCE",
  );

const snapshotRecords =
  recordsOfType(
    store,
    "SNAPSHOT",
  );

const evidenceRecords =
  recordsOfType(
    store,
    "EVIDENCE",
  );

const claimRecords =
  recordsOfType(
    store,
    "CLAIM",
  );

const knowledgeRecords =
  recordsOfType(
    store,
    "KNOWLEDGE",
  );

const scopeRecords =
  recordsOfType(
    store,
    "SCOPE",
  );

const contextRecords =
  recordsOfType(
    store,
    "CONTEXT",
  );

assert.equal(
  sourceRecords.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_SOURCES",
);

assert.equal(
  snapshotRecords.length,
  6,
  "V8_APPLICABILITY_EXPECTED_SIX_SNAPSHOT_VERSIONS",
);

assert.ok(
  evidenceRecords.length >= 3,
  "V8_APPLICABILITY_EXPECTED_PERSISTED_EVIDENCE_NOT_LESS_THAN_VERIFIED",
);

assert.equal(
  claimRecords.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_CLAIMS",
);

assert.equal(
  knowledgeRecords.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_KNOWLEDGE",
);

assert.equal(
  scopeRecords.length,
  1,
  "V8_APPLICABILITY_EXPECTED_ONE_SCOPE",
);

assert.equal(
  contextRecords.length,
  1,
  "V8_APPLICABILITY_EXPECTED_ONE_CONTEXT",
);

const constrainedKnowledgeRecord =
  knowledgeRecords.find(
    (record) =>
      (
        Array.isArray(
          record.payload?.units,
        ) &&
        record.payload.units.length > 0
      ) ||
      (
        Array.isArray(
          record.payload?.conditions,
        ) &&
        record.payload.conditions.length > 0
      ),
  );

assertTruthy(
  constrainedKnowledgeRecord,
  "V8_APPLICABILITY_EXPECTED_CONSTRAINED_KNOWLEDGE",
);

const scopeRecord =
  scopeRecords[0];

const contextRecord =
  contextRecords[0];

assertTruthy(
  scopeRecord,
  "V8_APPLICABILITY_SCOPE_RECORD_MISSING",
);

assertTruthy(
  contextRecord,
  "V8_APPLICABILITY_CONTEXT_RECORD_MISSING",
);

const constrainedKnowledgeId =
  constrainedKnowledgeRecord.aggregateId;

const scopeId =
  scopeRecord.aggregateId;

const contextId =
  contextRecord.aggregateId;

const engine =
  new ApplicabilityEngine(
    store,
  );

const applicability =
  engine.evaluate({
    knowledgeId:
      constrainedKnowledgeId,
    scopeId,
    contextId,
  });

assert.equal(
  applicability.applicable,
  false,
  "V8_APPLICABILITY_CONSTRAINED_KNOWLEDGE_MUST_FAIL_CLOSED",
);

assert.ok(
  applicability.reasons.some(
    (reason) =>
      reason.startsWith(
        "KNOWLEDGE_UNIT_MISMATCH:",
      ) ||
      reason.startsWith(
        "KNOWLEDGE_CONDITION_MISMATCH:",
      ),
  ),
  "V8_APPLICABILITY_CONSTRAINT_MISMATCH_REASON_MISSING",
);

assert.equal(
  applicability.knowledgeId,
  constrainedKnowledgeId,
  "V8_APPLICABILITY_KNOWLEDGE_ID_MISMATCH",
);

assert.equal(
  applicability.scopeId,
  scopeId,
  "V8_APPLICABILITY_SCOPE_ID_MISMATCH",
);

assert.equal(
  applicability.contextId,
  contextId,
  "V8_APPLICABILITY_CONTEXT_ID_MISMATCH",
);

assert.equal(
  applicability.lineage.length,
  3,
  "V8_APPLICABILITY_EXPECTED_THREE_LINEAGE_RECORDS",
);

const expectedLineage = [
  {
    type: "KNOWLEDGE",
    id:
      constrainedKnowledgeRecord.aggregateId,
    version:
      constrainedKnowledgeRecord.version,
    fingerprint:
      constrainedKnowledgeRecord.fingerprint,
  },
  {
    type: "SCOPE",
    id:
      scopeRecord.aggregateId,
    version:
      scopeRecord.version,
    fingerprint:
      scopeRecord.fingerprint,
  },
  {
    type: "CONTEXT",
    id:
      contextRecord.aggregateId,
    version:
      contextRecord.version,
    fingerprint:
      contextRecord.fingerprint,
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
          constrainedKnowledgeId
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
    knowledgeId:
      constrainedKnowledgeId,
    scopeId,
    contextId,
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
          contextId
      ) {
        return {
          ...record,
          payload: {
            ...record.payload,
            scopeId:
              "scope:v8:tampered",
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
    knowledgeId:
      constrainedKnowledgeId,
    scopeId,
    contextId,
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
    scopeId,
    contextId,
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
  engine.assert({
    knowledgeId:
      constrainedKnowledgeId,
    scopeId,
    contextId,
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

/*
 * InMemoryFoundationStore.verifyChain()
 * is intentionally a void-returning invariant check.
 *
 * Success:
 *   returns undefined
 *
 * Failure:
 *   throws V8_FOUNDATION_CHAIN_BROKEN
 *   or V8_FOUNDATION_FINGERPRINT_MISMATCH
 *
 * Therefore the correct gate is simply to execute it
 * and allow any thrown invariant to fail the process.
 */
store.verifyChain();

console.log(
  "[V8-20] REAL INTERNET FAIL-CLOSED APPLICABILITY GATE PASS",
);

console.log(
  `[V8-20] acquired=${runtimeError ? "3" : "UNKNOWN"}`,
);

console.log(
  `[V8-20] persistedSources=${sourceRecords.length}`,
);

console.log(
  `[V8-20] persistedSnapshotVersions=${snapshotRecords.length}`,
);

console.log(
  `[V8-20] persistedEvidence=${evidenceRecords.length}`,
);

console.log(
  `[V8-20] claims=${claimRecords.length}`,
);

console.log(
  `[V8-20] knowledge=${knowledgeRecords.length}`,
);

console.log(
  "[V8-20] verifiedEvidenceMinimum=3",
);

console.log(
  `[V8-20] applicability=${applicability.applicable}`,
);

console.log(
  `[V8-20] applicabilityReasons=${applicability.reasons.join("|")}`,
);

console.log(
  `[V8-20] lineage=${applicability.lineage.length}`,
);

console.log(
  "[V8-20] runtimeApplicabilityBlock=true",
);

console.log(
  "[V8-20] knowledgeConstraintFailClosed=true",
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