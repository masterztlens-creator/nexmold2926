import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  FoundationService,
} from "../.v8-build/src/v8/foundation/service.js";

import {
  ApplicabilityEngine,
} from "../.v8-build/src/v8/applicability/engine.js";

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
  createDecision,
} from "../.v8-build/src/v8/domain/decision.js";

import {
  contentFingerprint,
} from "../.v8-build/src/v8/foundation/hash.js";

const SEARCH_API_KEY =
  process.env.V8_SEARCH_API_KEY;

if (!SEARCH_API_KEY) {
  throw new Error(
    "V8_SEARCH_API_KEY is required.",
  );
}

const ACTOR = {
  id: "v8:decision-gate",
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
    "V8-21 real Internet decision gate seed opportunity",
  ],
};

const SCOPE = {
  id: "scope:v8:decision-gate",
  geography: "GLOBAL",
  industries: [
    "INJECTION_MOLDING",
  ],
  languages: [
    "en",
  ],
};

const CONTEXT = {
  id: "context:v8:decision-gate",
  purpose:
    "Evaluate whether verified knowledge is applicable to a global injection-molding content decision.",
  variables: {
    application:
      "plastic injection molding",
    language: "en",
  },
};

const PROBLEM = {
  id: "problem:v8:decision-gate",
  question:
    "What wall-thickness considerations should be applied when evaluating plastic injection molding design guidance?",
  constraints: [
    "Use only verified Internet-derived knowledge.",
    "Do not generalize beyond the registered scope.",
  ],
};

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

function assertTrue(
  value,
  message,
) {
  if (!value) {
    throw new Error(message);
  }
}

function createDelegatingStore(
  baseStore,
  overrides = {},
) {
  return new Proxy(baseStore, {
    get(target, property, receiver) {
      if (
        Object.prototype.hasOwnProperty.call(
          overrides,
          property,
        )
      ) {
        return overrides[property];
      }

      return Reflect.get(
        target,
        property,
        receiver,
      );
    },
  });
}

function createDecisionForRuntime(
  runtime,
) {
  const decisionFingerprint =
    contentFingerprint({
      gate: "V8-21",
      runtimeFingerprint:
        runtime.fingerprint,
      problemId:
        runtime.problemId,
      knowledgeIds:
        runtime.knowledgeIds,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  return createDecision({
    id:
      `decision:v8:21:${decisionFingerprint}`,
    problemId:
      runtime.problemId,
    knowledgeIds:
      runtime.knowledgeIds,
    outcome:
      "Approve evidence-backed content generation from verified knowledge within the registered scope and context.",
    status:
      "APPROVED",
  });
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
      actor: ACTOR,
      acquisition: {
        maxCandidates: 3,
      },
      scope: SCOPE,
      context: CONTEXT,
      problem: PROBLEM,
      title:
        "Plastic Injection Molding Wall Thickness",
    });

  assertEqual(
    runtime.acquisition.acquisitions.length,
    3,
    "Unexpected acquisition count",
  );

  assertEqual(
    runtime.verifiedEvidenceIds.length,
    3,
    "Unexpected verified evidence count",
  );

  assertEqual(
    runtime.claimIds.length,
    3,
    "Unexpected claim count",
  );

  assertEqual(
    runtime.knowledgeIds.length,
    3,
    "Unexpected knowledge count",
  );

  const applicability =
    new ApplicabilityEngine(
      store,
    ).evaluate({
      knowledgeId:
        runtime.knowledgeIds[0],
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    applicability.applicable,
    "Runtime Knowledge is not applicable.",
  );

  assertEqual(
    applicability.knowledgeId,
    runtime.knowledgeIds[0],
    "Applicability Knowledge ID mismatch",
  );

  assertEqual(
    applicability.scopeId,
    runtime.scopeId,
    "Applicability Scope ID mismatch",
  );

  assertEqual(
    applicability.contextId,
    runtime.contextId,
    "Applicability Context ID mismatch",
  );

  assertEqual(
    applicability.reasons.length,
    0,
    "Applicable Knowledge returned blocking reasons",
  );

  const runtimeDecision =
    store.get(
      "DECISION",
      runtime.decisionId,
    );

  assertTrue(
    runtimeDecision !== null,
    "Runtime Decision was not persisted.",
  );

  assertEqual(
    runtimeDecision.state,
    "APPROVED",
    "Runtime Decision state is not APPROVED",
  );

  const service =
    new FoundationService(
      store,
    );

  const gateDecision =
    createDecisionForRuntime(
      runtime,
    );

  const decisionBefore =
    store.get(
      "DECISION",
      gateDecision.id,
    );

  assertEqual(
    decisionBefore,
    null,
    "V8-21 gate Decision unexpectedly already exists.",
  );

  const persistedDecision =
    service.createDecision(
      gateDecision,
      runtime.scopeId,
      runtime.contextId,
      ACTOR,
      "V8-21 real Internet decision gate",
    );

  assertEqual(
    persistedDecision.state,
    "APPROVED",
    "V8-21 Decision did not reach APPROVED state",
  );

  const persistedDecisionCheck =
    store.get(
      "DECISION",
      gateDecision.id,
    );

  assertTrue(
    persistedDecisionCheck !== null,
    "V8-21 Decision was not persisted.",
  );

  const knowledgeRecord =
    store.get(
      "KNOWLEDGE",
      runtime.knowledgeIds[0],
    );

  assertTrue(
    knowledgeRecord !== null,
    "Runtime Knowledge record is missing.",
  );

  const contextRecord =
    store.get(
      "CONTEXT",
      runtime.contextId,
    );

  assertTrue(
    contextRecord !== null,
    "Runtime Context record is missing.",
  );

  const decisionHistoryBeforeTamper =
    store.history(
      "DECISION",
      gateDecision.id,
    );

  const tamperedKnowledgeStore =
    createDelegatingStore(
      store,
      {
        get: (
          aggregateType,
          aggregateId,
        ) => {
          const record =
            store.get(
              aggregateType,
              aggregateId,
            );

          if (
            aggregateType ===
              "KNOWLEDGE" &&
            aggregateId ===
              runtime.knowledgeIds[0] &&
            record !== null
          ) {
            return {
              ...record,
              state: "REJECTED",
            };
          }

          return record;
        },
      },
    );

  let knowledgeTamperDecisionRejection =
    false;

  try {
    const tamperedService =
      new FoundationService(
        tamperedKnowledgeStore,
      );

    const tamperedDecision =
      createDecision({
        id:
          `${gateDecision.id}:knowledge-tamper`,
        problemId:
          runtime.problemId,
        knowledgeIds:
          runtime.knowledgeIds,
        outcome:
          "This Decision must be blocked when referenced Knowledge is not verified.",
        status:
          "APPROVED",
      });

    tamperedService.createDecision(
      tamperedDecision,
      runtime.scopeId,
      runtime.contextId,
      ACTOR,
      "V8-21 knowledge tamper rejection",
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "V8_APPLICABILITY_BLOCKED",
        ) ||
        error.message.includes(
          "V8_FOUNDATION_KNOWLEDGE_NOT_VERIFIED",
        )
      )
    ) {
      knowledgeTamperDecisionRejection =
        true;
    } else {
      throw error;
    }
  }

  assertTrue(
    knowledgeTamperDecisionRejection,
    "Knowledge tamper did not block Decision creation.",
  );

  const contextTamperStore =
    createDelegatingStore(
      store,
      {
        get: (
          aggregateType,
          aggregateId,
        ) => {
          const record =
            store.get(
              aggregateType,
              aggregateId,
            );

          if (
            aggregateType ===
              "CONTEXT" &&
            aggregateId ===
              runtime.contextId &&
            record !== null
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
      },
    );

  let contextTamperDecisionRejection =
    false;

  try {
    const tamperedService =
      new FoundationService(
        contextTamperStore,
      );

    const tamperedDecision =
      createDecision({
        id:
          `${gateDecision.id}:context-tamper`,
        problemId:
          runtime.problemId,
        knowledgeIds:
          runtime.knowledgeIds,
        outcome:
          "This Decision must be blocked when Context scope binding is tampered.",
        status:
          "APPROVED",
      });

    tamperedService.createDecision(
      tamperedDecision,
      runtime.scopeId,
      runtime.contextId,
      ACTOR,
      "V8-21 context tamper rejection",
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "V8_APPLICABILITY_BLOCKED",
        ) ||
        error.message.includes(
          "V8_APPLICABILITY_CONTEXT_SCOPE_MISMATCH",
        ) ||
        error.message.includes(
          "V8_FOUNDATION_DECISION_SCOPE_MISMATCH",
        )
      )
    ) {
      contextTamperDecisionRejection =
        true;
    } else {
      throw error;
    }
  }

  assertTrue(
    contextTamperDecisionRejection,
    "Context tamper did not block Decision creation.",
  );

  const missingKnowledgeStore =
    createDelegatingStore(
      store,
      {
        get: (
          aggregateType,
          aggregateId,
        ) => {
          if (
            aggregateType ===
              "KNOWLEDGE" &&
            aggregateId ===
              runtime.knowledgeIds[0]
          ) {
            return null;
          }

          return store.get(
            aggregateType,
            aggregateId,
          );
        },
      },
    );

  let missingKnowledgeDecisionRejection =
    false;

  try {
    const tamperedService =
      new FoundationService(
        missingKnowledgeStore,
      );

    const tamperedDecision =
      createDecision({
        id:
          `${gateDecision.id}:missing-knowledge`,
        problemId:
          runtime.problemId,
        knowledgeIds:
          runtime.knowledgeIds,
        outcome:
          "This Decision must be blocked when referenced Knowledge is absent.",
        status:
          "APPROVED",
      });

    tamperedService.createDecision(
      tamperedDecision,
      runtime.scopeId,
      runtime.contextId,
      ACTOR,
      "V8-21 missing Knowledge rejection",
    );
  } catch (error) {
    if (
      error instanceof Error &&
      (
        error.message.includes(
          "V8_APPLICABILITY_BLOCKED",
        ) ||
        error.message.includes(
          "V8_FOUNDATION_KNOWLEDGE_NOT_FOUND",
        )
      )
    ) {
      missingKnowledgeDecisionRejection =
        true;
    } else {
      throw error;
    }
  }

  assertTrue(
    missingKnowledgeDecisionRejection,
    "Missing Knowledge did not block Decision creation.",
  );

  const decisionHistoryAfterTamper =
    store.history(
      "DECISION",
      gateDecision.id,
    );

  assertEqual(
    decisionHistoryAfterTamper.length,
    decisionHistoryBeforeTamper.length,
    "Tampered Decision attempts changed persisted Decision history",
  );

  store.verifyChain();

  console.log(
    "[V8-21] REAL INTERNET DECISION GATE PASS",
  );

  console.log(
    `[V8-21] acquired=${runtime.acquisition.acquisitions.length}`,
  );

  console.log(
    `[V8-21] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
  );

  console.log(
    `[V8-21] claims=${runtime.claimIds.length}`,
  );

  console.log(
    `[V8-21] knowledge=${runtime.knowledgeIds.length}`,
  );

  console.log(
    "[V8-21] applicability=true",
  );

  console.log(
    `[V8-21] decisionState=${persistedDecision.state}`,
  );

  console.log(
    "[V8-21] decisionPersisted=true",
  );

  console.log(
    `[V8-21] knowledgeTamperDecisionRejection=${knowledgeTamperDecisionRejection}`,
  );

  console.log(
    `[V8-21] contextTamperDecisionRejection=${contextTamperDecisionRejection}`,
  );

  console.log(
    `[V8-21] missingKnowledgeDecisionRejection=${missingKnowledgeDecisionRejection}`,
  );

  console.log(
    "[V8-21] rejectedDecisionNotPersisted=true",
  );

  console.log(
    "[V8-21] foundationChainVerified=true",
  );
}

main().catch((error) => {
  console.error(
    "[V8-21] REAL INTERNET DECISION GATE FAIL",
  );

  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : error,
  );

  process.exitCode = 1;
});