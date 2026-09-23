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
  ApplicabilityEngine,
} from "../.v8-build/src/v8/applicability/engine.js";

function assertTruthy(
  value,
  message,
) {
  assert.ok(
    value,
    message,
  );
}

function recordsOfType(
  store,
  type,
) {
  return store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        type,
    );
}

function createGetTamperedStore(
  store,
  tamper,
) {
  return new Proxy(
    store,
    {
      get(
        target,
        property,
        receiver,
      ) {
        if (
          property !==
          "get"
        ) {
          return Reflect.get(
            target,
            property,
            receiver,
          );
        }

        return (
          type,
          id,
          version,
        ) => {
          const record =
            target.get(
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
    },
  );
}

function constraintMismatchReasons(
  reasons,
) {
  return reasons.filter(
    (reason) =>
      reason.startsWith(
        "KNOWLEDGE_CONDITION_MISMATCH:",
      ) ||
      reason.startsWith(
        "KNOWLEDGE_UNIT_MISMATCH:",
      ),
  );
}

function unitMismatchReasons(
  reasons,
) {
  return reasons.filter(
    (reason) =>
      reason.startsWith(
        "KNOWLEDGE_UNIT_MISMATCH:",
      ),
  );
}

function conditionMismatchReasons(
  reasons,
) {
  return reasons.filter(
    (reason) =>
      reason.startsWith(
        "KNOWLEDGE_CONDITION_MISMATCH:",
      ),
  );
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
  new TavilySearchProvider(
    apiKey,
  );

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
        "V8-20 real Internet applicability evaluation with fail-closed Knowledge condition enforcement",
      ],
    },

    searchProvider,
    pageFetcher,
    store,

    actor: {
      id:
        "v8:applicability-gate",
      role:
        "INGESTOR",
    },

    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId:
        "v8:applicability-gate",
    },

    scope: {
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
      purpose:
        "V8-20 real Internet applicability evaluation for verified Internet-derived knowledge",

      variables: {
        gate:
          "V8-20",

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
  runtimeError =
    error;
}

/*
 * V8-25 semantic correction:
 *
 * Knowledge.units is currently preserved metadata.
 * It is NOT an Applicability constraint.
 *
 * Knowledge.conditions are the current Applicability
 * constraints.
 *
 * Therefore the real Internet runtime has two valid
 * outcomes:
 *
 * 1. Runtime succeeds.
 *    The selected Knowledge is applicable to the
 *    runtime Context.
 *
 * 2. Runtime fails closed with
 *    V8_APPLICABILITY_BLOCKED.
 *    In that case the block MUST be caused by a
 *    Knowledge condition mismatch, never by a unit
 *    mismatch.
 *
 * A runtime block caused only by
 * KNOWLEDGE_UNIT_MISMATCH is invalid under V8-25.
 */

if (runtimeError) {
  assert.equal(
    runtimeError.code,
    "V8_APPLICABILITY_BLOCKED",
    `V8_APPLICABILITY_UNEXPECTED_RUNTIME_ERROR:${
      runtimeError.message ??
      String(runtimeError)
    }`,
  );

  const runtimeMessage =
    runtimeError.message ??
    String(runtimeError);

  assert.ok(
    !runtimeMessage.includes(
      "KNOWLEDGE_UNIT_MISMATCH:",
    ),
    "V8_APPLICABILITY_RUNTIME_MUST_NOT_BLOCK_ON_UNITS",
  );

  assert.ok(
    runtimeMessage.includes(
      "KNOWLEDGE_CONDITION_MISMATCH:",
    ),
    "V8_APPLICABILITY_RUNTIME_BLOCK_MUST_BE_CONDITION_BASED",
  );
}

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
          record.payload?.conditions,
        ) &&
        record.payload.conditions
          .length > 0
      ) ||
      (
        Array.isArray(
          record.payload?.units,
        ) &&
        record.payload.units
          .length > 0
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
  constrainedKnowledgeRecord
    .aggregateId;

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

/*
 * The selected real Internet Knowledge may be:
 *
 * - applicable=true, when all Knowledge conditions
 *   are represented by the Context;
 *
 * - applicable=false, when one or more Knowledge
 *   conditions are not represented by the Context.
 *
 * Both outcomes are semantically valid.
 *
 * The prohibited outcome is a unit-only applicability
 * failure because Knowledge.units is metadata rather
 * than an Applicability constraint.
 */

const applicabilityUnitMismatches =
  unitMismatchReasons(
    applicability.reasons,
  );

assert.deepEqual(
  applicabilityUnitMismatches,
  [],
  "V8_APPLICABILITY_MUST_NOT_TREAT_UNITS_AS_CONSTRAINTS",
);

const applicabilityConditionMismatches =
  conditionMismatchReasons(
    applicability.reasons,
  );

if (
  !applicability.applicable
) {
  assert.ok(
    applicabilityConditionMismatches
      .length > 0 ||
    applicability.reasons.some(
      (reason) =>
        reason ===
          "KNOWLEDGE_NOT_FOUND" ||
        reason ===
          "KNOWLEDGE_NOT_VERIFIED" ||
        reason ===
          "SCOPE_NOT_FOUND" ||
        reason ===
          "SCOPE_NOT_REGISTERED" ||
        reason ===
          "CONTEXT_NOT_FOUND" ||
        reason ===
          "CONTEXT_NOT_REGISTERED" ||
        reason ===
          "CONTEXT_SCOPE_MISMATCH",
    ),
    "V8_APPLICABILITY_FALSE_RESULT_HAS_NO_VALID_FAIL_CLOSED_REASON",
  );
}

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
    type:
      "KNOWLEDGE",

    id:
      constrainedKnowledgeRecord
        .aggregateId,

    version:
      constrainedKnowledgeRecord
        .version,

    fingerprint:
      constrainedKnowledgeRecord
        .fingerprint,
  },

  {
    type:
      "SCOPE",

    id:
      scopeRecord.aggregateId,

    version:
      scopeRecord.version,

    fingerprint:
      scopeRecord.fingerprint,
  },

  {
    type:
      "CONTEXT",

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
    (
      record,
      type,
    ) => {
      if (
        type ===
          "KNOWLEDGE" &&
        record.aggregateId ===
          constrainedKnowledgeId
      ) {
        return {
          ...record,

          state:
            "REJECTED",
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
  tamperedKnowledgeApplicability
    .applicable,
  false,
  "V8_APPLICABILITY_KNOWLEDGE_TAMPER_NOT_REJECTED",
);

assert.ok(
  tamperedKnowledgeApplicability
    .reasons
    .includes(
      "KNOWLEDGE_NOT_VERIFIED",
    ),
  "V8_APPLICABILITY_KNOWLEDGE_TAMPER_REASON_MISSING",
);

const tamperedContextStore =
  createGetTamperedStore(
    store,
    (
      record,
      type,
    ) => {
      if (
        type ===
          "CONTEXT" &&
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
  tamperedContextApplicability
    .applicable,
  false,
  "V8_APPLICABILITY_CONTEXT_TAMPER_NOT_REJECTED",
);

assert.ok(
  tamperedContextApplicability
    .reasons
    .includes(
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
  missingKnowledgeApplicability
    .applicable,
  false,
  "V8_APPLICABILITY_MISSING_KNOWLEDGE_NOT_BLOCKED",
);

assert.ok(
  missingKnowledgeApplicability
    .reasons
    .includes(
      "KNOWLEDGE_NOT_FOUND",
    ),
  "V8_APPLICABILITY_MISSING_KNOWLEDGE_REASON_MISSING",
);

let assertBlocked =
  false;

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

if (
  applicability.applicable
) {
  assert.equal(
    assertBlocked,
    false,
    "V8_APPLICABILITY_ASSERT_REJECTED_VALID_APPLICABILITY",
  );
} else {
  assert.equal(
    assertBlocked,
    true,
    "V8_APPLICABILITY_ASSERT_FAIL_CLOSED_FAILED",
  );
}

/*
 * Knowledge.units must remain persisted and preserved
 * even though units are not currently Applicability
 * constraints.
 *
 * V8-24 owns this preservation invariant.
 * V8-25 only verifies that the ApplicabilityEngine
 * does not reinterpret the metadata as a constraint.
 */
const knowledgeUnits =
  constrainedKnowledgeRecord
    .payload?.units;

if (
  Array.isArray(
    knowledgeUnits,
  ) &&
  knowledgeUnits.length > 0
) {
  assert.ok(
    knowledgeUnits.every(
      (unit) =>
        typeof unit ===
          "string" &&
        unit.trim().length >
          0,
    ),
    "V8_APPLICABILITY_KNOWLEDGE_UNITS_MUST_REMAIN_VALID_METADATA",
  );
}

/*
 * InMemoryFoundationStore.verifyChain()
 * is intentionally a void-returning invariant check.
 *
 * Success:
 *   returns undefined.
 *
 * Failure:
 *   throws a Foundation invariant error.
 *
 * Therefore the correct gate is simply to execute
 * verifyChain() and allow any thrown invariant to
 * fail the process.
 */
store.verifyChain();

console.log(
  "[V8-20] REAL INTERNET FAIL-CLOSED APPLICABILITY GATE PASS",
);

console.log(
  `[V8-20] runtimeOutcome=${
    runtimeError
      ? "BLOCKED"
      : "APPLICABLE"
  }`,
);

console.log(
  `[V8-20] persistedSources=${
    sourceRecords.length
  }`,
);

console.log(
  `[V8-20] persistedSnapshotVersions=${
    snapshotRecords.length
  }`,
);

console.log(
  `[V8-20] persistedEvidence=${
    evidenceRecords.length
  }`,
);

console.log(
  `[V8-20] claims=${
    claimRecords.length
  }`,
);

console.log(
  `[V8-20] knowledge=${
    knowledgeRecords.length
  }`,
);

console.log(
  "[V8-20] verifiedEvidenceMinimum=3",
);

console.log(
  `[V8-20] applicability=${
    applicability.applicable
  }`,
);

console.log(
  `[V8-20] applicabilityReasons=${
    applicability.reasons.join("|")
  }`,
);

console.log(
  `[V8-20] conditionMismatchCount=${
    applicabilityConditionMismatches.length
  }`,
);

console.log(
  `[V8-20] unitMismatchCount=${
    applicabilityUnitMismatches.length
  }`,
);

console.log(
  `[V8-20] lineage=${
    applicability.lineage.length
  }`,
);

console.log(
  `[V8-20] runtimeApplicabilityBlock=${
    runtimeError !== null
  }`,
);

console.log(
  "[V8-20] unitsAreNotApplicabilityConstraints=true",
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