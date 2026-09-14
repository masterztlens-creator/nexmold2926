import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  DecisionValidator,
} from "../.v8-build/src/v8/decision-validation/validator.js";

import {
  runV8ArticleRuntime,
} from "../.v8-build/src/v8/runtime/article-runtime.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  TavilySearchProvider,
} from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";

const SEARCH_API_KEY =
  process.env.V8_SEARCH_API_KEY;

if (!SEARCH_API_KEY) {
  throw new Error(
    "V8_SEARCH_API_KEY is required.",
  );
}

const ACTOR = {
  id: "v8:decision-validation-gate",
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
    "V8-22 real Internet decision validation gate seed opportunity",
  ],
};

const SCOPE = {
  id: "scope:v8:decision-validation-gate",
  geography: "GLOBAL",
  industries: [
    "INJECTION_MOLDING",
  ],
  languages: [
    "en",
  ],
};

const CONTEXT = {
  id: "context:v8:decision-validation-gate",
  purpose:
    "Validate an approved decision against its persisted problem, context, scope, and verified knowledge.",
  variables: {
    application:
      "plastic injection molding",
    language: "en",
  },
};

const PROBLEM = {
  id: "problem:v8:decision-validation-gate",
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

function assertIncludes(
  values,
  expected,
  message,
) {
  if (!values.includes(expected)) {
    throw new Error(
      `${message}: missing=${expected}`,
    );
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

  assertTrue(
    runtime.decisionId.length > 0,
    "Runtime Decision ID is missing.",
  );

  const decision =
    store.get(
      "DECISION",
      runtime.decisionId,
    );

  assertTrue(
    decision !== null,
    "Runtime Decision was not persisted.",
  );

  assertEqual(
    decision.state,
    "APPROVED",
    "Runtime Decision state is not APPROVED.",
  );

  const validator =
    new DecisionValidator(store);

  const validation =
    validator.validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    validation.valid,
    `Persisted Decision validation failed: ${validation.reasons.join(",")}`,
  );

  assertEqual(
    validation.status,
    "APPROVED",
    "Validated Decision status is not APPROVED.",
  );

  assertEqual(
    validation.decisionId,
    runtime.decisionId,
    "Validated Decision ID mismatch.",
  );

  assertEqual(
    validation.reasons.length,
    0,
    "Valid Decision returned validation reasons.",
  );

  const lineageTypes =
    validation.lineage.map(
      (link) => link.type,
    );

  assertIncludes(
    lineageTypes,
    "DECISION",
    "Decision lineage is incomplete.",
  );

  assertIncludes(
    lineageTypes,
    "PROBLEM",
    "Problem lineage is incomplete.",
  );

  assertIncludes(
    lineageTypes,
    "CONTEXT",
    "Context lineage is incomplete.",
  );

  assertIncludes(
    lineageTypes,
    "SCOPE",
    "Scope lineage is incomplete.",
  );

  assertEqual(
    validation.lineage.filter(
      (link) =>
        link.type === "KNOWLEDGE",
    ).length,
    runtime.knowledgeIds.length,
    "Knowledge lineage count mismatch.",
  );

  const decisionHistoryBeforeTamper =
    store.history(
      "DECISION",
      runtime.decisionId,
    );

  assertTrue(
    decisionHistoryBeforeTamper.length > 0,
    "Decision history is empty.",
  );

  const fingerprintTamperStore =
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
              "DECISION" &&
            aggregateId ===
              runtime.decisionId &&
            record !== null
          ) {
            return {
              ...record,
              payload: {
                ...record.payload,
                fingerprint:
                  "tampered-decision-fingerprint",
              },
            };
          }

          return record;
        },
      },
    );

  const fingerprintTamperedValidation =
    new DecisionValidator(
      fingerprintTamperStore,
    ).validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    !fingerprintTamperedValidation.valid,
    "Decision fingerprint tamper was accepted.",
  );

  assertIncludes(
    fingerprintTamperedValidation.reasons,
    "DECISION_FINGERPRINT_MISMATCH",
    "Decision fingerprint tamper reason is missing.",
  );

  const stateTamperStore =
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
              "DECISION" &&
            aggregateId ===
              runtime.decisionId &&
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

  const stateTamperedValidation =
    new DecisionValidator(
      stateTamperStore,
    ).validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    !stateTamperedValidation.valid,
    "Decision state tamper was accepted.",
  );

  assertIncludes(
    stateTamperedValidation.reasons,
    "DECISION_NOT_APPROVED",
    "Decision state tamper reason is missing.",
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

  const contextTamperedValidation =
    new DecisionValidator(
      contextTamperStore,
    ).validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    !contextTamperedValidation.valid,
    "Context scope tamper was accepted.",
  );

  assertIncludes(
    contextTamperedValidation.reasons,
    "CONTEXT_SCOPE_MISMATCH",
    "Context scope tamper reason is missing.",
  );

  const knowledgeTamperStore =
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
            runtime.knowledgeIds.includes(
              aggregateId,
            ) &&
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

  const knowledgeTamperedValidation =
    new DecisionValidator(
      knowledgeTamperStore,
    ).validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    !knowledgeTamperedValidation.valid,
    "Knowledge verification tamper was accepted.",
  );

  assertTrue(
    knowledgeTamperedValidation.reasons.some(
      (reason) =>
        reason.startsWith(
          "KNOWLEDGE_NOT_VERIFIED:",
        ),
    ),
    "Knowledge verification tamper reason is missing.",
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

  const missingKnowledgeValidation =
    new DecisionValidator(
      missingKnowledgeStore,
    ).validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        runtime.contextId,
    });

  assertTrue(
    !missingKnowledgeValidation.valid,
    "Missing Knowledge was accepted.",
  );

  assertTrue(
    missingKnowledgeValidation.reasons.some(
      (reason) =>
        reason ===
        `KNOWLEDGE_NOT_FOUND:${runtime.knowledgeIds[0]}`,
    ),
    "Missing Knowledge reason is missing.",
  );

  const invalidScopeValidation =
    validator.validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        "scope:v8:tampered",
      contextId:
        runtime.contextId,
    });

  assertTrue(
    !invalidScopeValidation.valid,
    "Invalid validation scope was accepted.",
  );

  assertIncludes(
    invalidScopeValidation.reasons,
    "CONTEXT_SCOPE_MISMATCH",
    "Invalid validation scope reason is missing.",
  );

  const invalidContextValidation =
    validator.validate({
      decisionId:
        runtime.decisionId,
      scopeId:
        runtime.scopeId,
      contextId:
        "context:v8:missing",
    });

  assertTrue(
    invalidContextValidation.valid === false,
    "Invalid validation context was accepted.",
  );

  assertIncludes(
    invalidContextValidation.reasons,
    "CONTEXT_SCOPE_MISMATCH",
    "Invalid validation context did not fail closed.",
  );

  const decisionHistoryAfterTamper =
    store.history(
      "DECISION",
      runtime.decisionId,
    );

  assertEqual(
    decisionHistoryAfterTamper.length,
    decisionHistoryBeforeTamper.length,
    "Validation tamper attempts changed persisted Decision history.",
  );

  store.verifyChain();

  console.log(
    "[V8-22] REAL INTERNET DECISION VALIDATION GATE PASS",
  );

  console.log(
    `[V8-22] acquired=${runtime.acquisition.acquisitions.length}`,
  );

  console.log(
    `[V8-22] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
  );

  console.log(
    `[V8-22] claims=${runtime.claimIds.length}`,
  );

  console.log(
    `[V8-22] knowledge=${runtime.knowledgeIds.length}`,
  );

  console.log(
    `[V8-22] decisionState=${decision.state}`,
  );

  console.log(
    "[V8-22] decisionValidation=true",
  );

  console.log(
    `[V8-22] lineage=${validation.lineage.length}`,
  );

  console.log(
    "[V8-22] fingerprintTamperRejection=true",
  );

  console.log(
    "[V8-22] decisionStateTamperRejection=true",
  );

  console.log(
    "[V8-22] contextScopeTamperRejection=true",
  );

  console.log(
    "[V8-22] knowledgeTamperRejection=true",
  );

  console.log(
    "[V8-22] missingKnowledgeRejection=true",
  );

  console.log(
    "[V8-22] invalidScopeRejection=true",
  );

  console.log(
    "[V8-22] invalidContextRejection=true",
  );

  console.log(
    "[V8-22] rejectedValidationDidNotMutateHistory=true",
  );

  console.log(
    "[V8-22] foundationChainVerified=true",
  );
}

main().catch((error) => {
  console.error(
    "[V8-22] REAL INTERNET DECISION VALIDATION GATE FAIL",
  );

  console.error(
    error instanceof Error
      ? error.stack ?? error.message
      : String(error),
  );

  process.exitCode = 1;
});