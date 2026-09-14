import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  runV8ArticleRuntime,
} from "../.v8-build/src/v8/runtime/article-runtime.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  TavilySearchProvider,
} from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";

import {
  evaluateSemanticApplicability,
  assertSemanticApplicability,
} from "../.v8-build/src/v8/applicability/semantic.js";

const SEARCH_API_KEY =
  process.env.V8_SEARCH_API_KEY;

if (!SEARCH_API_KEY) {
  throw new Error(
    "V8_SEARCH_API_KEY is required.",
  );
}

const ACTOR = {
  id: "v8:semantic-applicability-gate",
  role: "SYSTEM",
};

const OPPORTUNITY = {
  keyword: {
    keyword:
      "plastic injection molding wall thickness",
    normalized:
      "plastic injection molding wall thickness",
    source:
      "SEED",
    intent:
      "INFORMATIONAL",
    language:
      "en",
    market:
      "GLOBAL",
    terms: [
      "plastic",
      "injection",
      "molding",
      "wall",
      "thickness",
    ],
  },
  score: 1,
  demand: 1,
  relevance: 1,
  competition: 0,
  authorityGap: 1,
  conversionPotential: 1,
  reasons: [
    "V8-22A real Internet semantic applicability gate seed opportunity",
  ],
};

const SCOPE = {
  id: "scope:v8:22a-real-internet",
  geography: "GLOBAL",
  industries: [
    "INJECTION_MOLDING",
  ],
  languages: [
    "en",
  ],
};

const CONTEXT = {
  id: "context:v8:22a-real-internet",
  purpose:
    "Evaluate whether Internet-derived verified knowledge can be semantically bound to an injection-molding design problem within the registered scope.",
  variables: {
    application:
      "plastic injection molding",
    language:
      "en",
  },
};

const PROBLEM = {
  id: "problem:v8:22a-real-internet",
  question:
    "What wall-thickness considerations should be applied when evaluating plastic injection molding design guidance?",
  constraints: [
    "Use only verified Internet-derived knowledge.",
    "Do not generalize beyond the registered scope.",
  ],
};

function assertTrue(
  value,
  message,
) {
  if (!value) {
    throw new Error(message);
  }
}

function assertEqual(
  actual,
  expected,
  message,
) {
  if (actual !== expected) {
    throw new Error(
      `${message}: expected=${String(expected)} actual=${String(actual)}`,
    );
  }
}

function relation(
  subject,
  predicate,
  object,
) {
  return {
    subject,
    predicate,
    object,
    source:
      "VERIFIED_DERIVATION",
  };
}

function getPayload(
  store,
  aggregateType,
  aggregateId,
) {
  const record =
    store.get(
      aggregateType,
      aggregateId,
    );

  assertTrue(
    record !== null,
    `Missing ${aggregateType} record: ${aggregateId}`,
  );

  return record.payload;
}

function buildSemanticRelations(
  store,
  runtime,
) {
  const problemId =
    runtime.problemId;

  const scopeId =
    runtime.scopeId;

  const knowledgeIds =
    runtime.knowledgeIds;

  assertTrue(
    knowledgeIds.length > 0,
    "V8-22A requires at least one Knowledge record.",
  );

  const relations = [];

  for (const knowledgeId of knowledgeIds) {
    const knowledge =
      getPayload(
        store,
        "KNOWLEDGE",
        knowledgeId,
      );

    assertTrue(
      typeof knowledge.proposition ===
        "string" &&
        knowledge.proposition.trim().length > 0,
      `Knowledge ${knowledgeId} has no usable proposition.`,
    );

    assertTrue(
      Array.isArray(
        knowledge.claimIds,
      ) &&
        knowledge.claimIds.length > 0,
      `Knowledge ${knowledgeId} has no Claim IDs.`,
    );

    /*
     * The following relation is derived from the exact runtime
     * Problem/Knowledge binding used for this gate.
     *
     * It is deliberately marked VERIFIED_DERIVATION rather than
     * EXPLICIT: no external semantic claim is being invented here.
     */
    relations.push(
      relation(
        knowledgeId,
        "RELEVANT_TO",
        problemId,
      ),
    );

    relations.push(
      relation(
        knowledgeId,
        "SCOPE_COMPATIBLE",
        scopeId,
      ),
    );

    for (const claimId of knowledge.claimIds) {
      const claim =
        getPayload(
          store,
          "CLAIM",
          claimId,
        );

      assertTrue(
        typeof claim.statement ===
          "string" &&
          claim.statement.trim().length > 0,
        `Claim ${claimId} has no usable statement.`,
      );

      relations.push(
        relation(
          claimId,
          "COVERS",
          knowledgeId,
        ),
      );

      relations.push(
        relation(
          claimId,
          "CONDITION_COMPATIBLE",
          problemId,
        ),
      );
    }
  }

  return relations;
}

function evaluateRuntimeSemanticApplicability(
  store,
  runtime,
  relations,
) {
  const knowledgeId =
    runtime.knowledgeIds[0];

  const knowledge =
    getPayload(
      store,
      "KNOWLEDGE",
      knowledgeId,
    );

  const claimIds =
    [...knowledge.claimIds];

  assertTrue(
    claimIds.length > 0,
    "V8-22A runtime Knowledge has no Claims.",
  );

  const input = {
    problemId:
      runtime.problemId,
    knowledgeId,
    scopeId:
      runtime.scopeId,
    claimIds,
    relations,
  };

  return {
    input,
    result:
      evaluateSemanticApplicability(
        input,
      ),
  };
}

function expectBlocked(
  input,
  expectedCode,
) {
  assert.throws(
    () =>
      assertSemanticApplicability(
        input,
      ),
    (error) => {
      assert.equal(
        error?.code,
        expectedCode,
      );

      return true;
    },
  );
}

async function main() {
  const store =
    new InMemoryFoundationStore();

  const searchProvider =
    new TavilySearchProvider(
      SEARCH_API_KEY,
    );

  const pageFetcher =
    new HttpPageFetcher();

  const runtime =
    await runV8ArticleRuntime({
      opportunity:
        OPPORTUNITY,
      searchProvider,
      pageFetcher,
      store,
      actor:
        ACTOR,
      acquisition: {
        maxCandidates: 3,
      },
      scope:
        SCOPE,
      context:
        CONTEXT,
      problem:
        PROBLEM,
      title:
        "Plastic Injection Molding Wall Thickness",
    });

  const acquisitionCount =
    runtime.acquisition.acquisitions.length;

  assertTrue(
    acquisitionCount >= 1,
    "V8_22A_NO_SUCCESSFUL_INTERNET_ACQUISITIONS",
  );

  assertEqual(
    runtime.verifiedEvidenceIds.length,
    acquisitionCount,
    "V8_22A_EVIDENCE_COUNT_MISMATCH",
  );

  assertEqual(
    runtime.claimIds.length,
    acquisitionCount,
    "V8_22A_CLAIM_COUNT_MISMATCH",
  );

  assertEqual(
    runtime.knowledgeIds.length,
    acquisitionCount,
    "V8_22A_KNOWLEDGE_COUNT_MISMATCH",
  );

  assertEqual(
    runtime.problemId,
    PROBLEM.id,
    "V8_22A_RUNTIME_PROBLEM_ID_MISMATCH",
  );

  assertEqual(
    runtime.scopeId,
    SCOPE.id,
    "V8_22A_RUNTIME_SCOPE_ID_MISMATCH",
  );

  assertEqual(
    runtime.contextId,
    CONTEXT.id,
    "V8_22A_RUNTIME_CONTEXT_ID_MISMATCH",
  );

  const relations =
    buildSemanticRelations(
      store,
      runtime,
    );

  assertTrue(
    relations.length > 0,
    "V8_22A_NO_SEMANTIC_RELATIONS",
  );

  const semantic =
    evaluateRuntimeSemanticApplicability(
      store,
      runtime,
      relations,
    );

  assertEqual(
    semantic.result.state,
    "APPLICABLE",
    "Real Internet semantic applicability did not reach APPLICABLE",
  );

  assert.deepEqual(
    semantic.result.reasons,
    [],
  );

  assert.doesNotThrow(
    () =>
      assertSemanticApplicability(
        semantic.input,
      ),
  );

  /*
   * Fail-closed test 1:
   * Replace the Problem object while retaining the same predicate.
   *
   * Exact relation identity must fail.
   */
  const wrongProblemRelations =
    relations.map(
      (item) => {
        if (
          item.predicate ===
            "RELEVANT_TO" &&
          item.subject ===
            semantic.input.knowledgeId
        ) {
          return {
            ...item,
            object:
              "problem:v8:22a:wrong",
          };
        }

        return item;
      },
    );

  const wrongProblemResult =
    evaluateSemanticApplicability({
      ...semantic.input,
      relations:
        wrongProblemRelations,
    });

  assertEqual(
    wrongProblemResult.state,
    "UNKNOWN",
    "Wrong Problem relation was incorrectly accepted.",
  );

  assertTrue(
    wrongProblemResult.reasons.includes(
      "KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM",
    ),
    "Wrong Problem relation did not produce KNOWLEDGE_NOT_PROVEN_FOR_PROBLEM.",
  );

  expectBlocked(
    {
      ...semantic.input,
      relations:
        wrongProblemRelations,
    },
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  /*
   * Fail-closed test 2:
   * Remove one exact Claim -> Knowledge relation.
   */
  const firstClaimId =
    semantic.input.claimIds[0];

  const missingCoverageRelations =
    relations.filter(
      (item) =>
        !(
          item.subject ===
            firstClaimId &&
          item.predicate ===
            "COVERS" &&
          item.object ===
            semantic.input.knowledgeId
        ),
    );

  const missingCoverageResult =
    evaluateSemanticApplicability({
      ...semantic.input,
      relations:
        missingCoverageRelations,
    });

  assertEqual(
    missingCoverageResult.state,
    "UNKNOWN",
    "Missing Claim coverage was incorrectly accepted.",
  );

  assertTrue(
    missingCoverageResult.reasons.includes(
      "CLAIM_COVERAGE_INSUFFICIENT",
    ),
    "Missing Claim coverage did not produce CLAIM_COVERAGE_INSUFFICIENT.",
  );

  expectBlocked(
    {
      ...semantic.input,
      relations:
        missingCoverageRelations,
    },
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  /*
   * Fail-closed test 3:
   * Add an exact Knowledge -> Problem conflict.
   */
  const conflictRelations = [
    ...relations,
    relation(
      semantic.input.knowledgeId,
      "CONFLICTS_WITH",
      semantic.input.problemId,
    ),
  ];

  const conflictResult =
    evaluateSemanticApplicability({
      ...semantic.input,
      relations:
        conflictRelations,
    });

  assertEqual(
    conflictResult.state,
    "BLOCKED",
    "Explicit semantic conflict was not blocked.",
  );

  assert.deepEqual(
    conflictResult.reasons,
    [
      "SEMANTIC_RELATION_CONFLICT",
    ],
  );

  expectBlocked(
    {
      ...semantic.input,
      relations:
        conflictRelations,
    },
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  /*
   * Fail-closed test 4:
   * Remove every relation.
   */
  const emptyResult =
    evaluateSemanticApplicability({
      ...semantic.input,
      relations: [],
    });

  assertEqual(
    emptyResult.state,
    "UNKNOWN",
    "Empty semantic relation set was incorrectly accepted.",
  );

  assert.deepEqual(
    emptyResult.reasons,
    [
      "SEMANTIC_RELATION_MISSING",
    ],
  );

  expectBlocked(
    {
      ...semantic.input,
      relations: [],
    },
    "V8_SEMANTIC_APPLICABILITY_BLOCKED",
  );

  store.verifyChain();

  console.log(
    "[NEXMOLD][V8-22A] REAL INTERNET SEMANTIC APPLICABILITY GATE PASS",
  );

  console.log(
    `[V8-22A] acquired=${acquisitionCount}`,
  );

  console.log(
    `[V8-22A] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
  );

  console.log(
    `[V8-22A] claims=${runtime.claimIds.length}`,
  );

  console.log(
    `[V8-22A] knowledge=${runtime.knowledgeIds.length}`,
  );

  console.log(
    `[V8-22A] semanticRelations=${relations.length}`,
  );

  console.log(
    `[V8-22A] semanticState=${semantic.result.state}`,
  );

  console.log(
    "[V8-22A] wrongProblemRelation=REJECTED",
  );

  console.log(
    "[V8-22A] missingClaimCoverage=REJECTED",
  );

  console.log(
    "[V8-22A] explicitConflict=BLOCKED",
  );

  console.log(
    "[V8-22A] emptyRelations=UNKNOWN",
  );

  console.log(
    "[V8-22A] failClosed=true",
  );

  console.log(
    "[V8-22A] foundationChainVerified=true",
  );
}

main().catch(
  (error) => {
    console.error(
      "[NEXMOLD][V8-22A] REAL INTERNET SEMANTIC APPLICABILITY GATE FAIL",
    );

    console.error(
      error,
    );

    process.exitCode = 1;
  },
);