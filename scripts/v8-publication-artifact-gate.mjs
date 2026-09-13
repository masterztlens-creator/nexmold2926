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
  PublicationGate,
} from "../.v8-build/src/v8/publication/gate.js";

import {
  createRule,
  createPolicy,
} from "../.v8-build/src/v8/governance/index.js";

const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_PUBLICATION_ARTIFACT_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}

function lineageLink(record) {
  return {
    type: record.aggregateType,
    id: record.aggregateId,
    version: record.version,
    fingerprint: record.fingerprint,
  };
}

function latestRecords(
  store,
  aggregateType,
) {
  const map = new Map();

  for (const record of store.auditTrail()) {
    if (
      record.aggregateType !==
      aggregateType
    ) {
      continue;
    }

    const previous =
      map.get(record.aggregateId);

    if (
      previous === undefined ||
      record.version > previous.version
    ) {
      map.set(
        record.aggregateId,
        record,
      );
    }
  }

  return [...map.values()];
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
    "V8 publication artifact gate real internet validation",
  ],
};

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    apiKey,
    "https://api.tavily.com/search",
    "v8-publication-artifact-gate",
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
      id: "v8-publication-artifact-gate",
      role: "SYSTEM",
    },

    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId:
        "v8-publication-artifact-gate",
    },

    scope: {
      id:
        "scope:v8:publication-artifact-gate",

      geography: "GLOBAL",

      industries: [
        "PLASTIC_INJECTION_MOLDING",
      ],

      languages: [
        "en",
      ],
    },

    context: {
      id:
        "context:v8:publication-artifact-gate",

      purpose:
        "Produce a publication artifact only from evidence-backed approved content.",

      variables: {
        sourceMode:
          "REAL_INTERNET",

        evidencePolicy:
          "VERIFIED_ONLY",

        contentPolicy:
          "EVIDENCE_BACKED",

        publicationPolicy:
          "APPROVED_POLICY_REQUIRED",
      },
    },

    problem: {
      id:
        "problem:v8:publication-artifact-gate",

      question:
        "What evidence-backed information can be published about plastic injection molding wall thickness?",

      constraints: [
        "Use real Internet-acquired evidence only.",
        "Only VERIFIED evidence may produce claims.",
        "Only VERIFIED claims may produce approved knowledge.",
        "Decision must be APPROVED.",
        "Content must be derived from the approved decision.",
        "Publication eligibility must be ELIGIBLE.",
        "Publication requires an APPROVED policy.",
      ],
    },

    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert.ok(
  result.acquisition,
  "V8_PUBLICATION_ARTIFACT_ACQUISITION_MISSING",
);

assert.ok(
  result.acquisition.acquisitions.length > 0,
  "V8_PUBLICATION_ARTIFACT_ACQUISITION_EMPTY",
);

assert.ok(
  result.verifiedEvidenceIds.length > 0,
  "V8_PUBLICATION_ARTIFACT_VERIFIED_EVIDENCE_EMPTY",
);

assert.ok(
  result.claimIds.length > 0,
  "V8_PUBLICATION_ARTIFACT_CLAIMS_EMPTY",
);

assert.ok(
  result.knowledgeIds.length > 0,
  "V8_PUBLICATION_ARTIFACT_KNOWLEDGE_EMPTY",
);

assert.ok(
  result.scopeId,
  "V8_PUBLICATION_ARTIFACT_SCOPE_MISSING",
);

assert.ok(
  result.contextId,
  "V8_PUBLICATION_ARTIFACT_CONTEXT_MISSING",
);

assert.ok(
  result.problemId,
  "V8_PUBLICATION_ARTIFACT_PROBLEM_MISSING",
);

assert.ok(
  result.decisionId,
  "V8_PUBLICATION_ARTIFACT_DECISION_MISSING",
);

assert.ok(
  result.content,
  "V8_PUBLICATION_ARTIFACT_CONTENT_MISSING",
);

const compiler =
  new ContentCompiler(store);

const compiled =
  compiler.compile({
    decisionId:
      result.decisionId,

    scopeId:
      result.scopeId,

    contextId:
      result.contextId,

    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert.equal(
  compiled.decision.state,
  "APPROVED",
  "V8_PUBLICATION_ARTIFACT_DECISION_NOT_APPROVED",
);

assert.equal(
  compiled.content.id,
  result.content.id,
  "V8_PUBLICATION_ARTIFACT_CONTENT_ID_MISMATCH",
);

const eligibilityEvaluator =
  new PublicationEligibilityEvaluator(
    store,
  );

const eligibilityResult =
  eligibilityEvaluator.evaluate({
    compiled,
    scopeId:
      result.scopeId,
    contextId:
      result.contextId,
  });

assert.equal(
  eligibilityResult.status,
  "ELIGIBLE",
  `V8_PUBLICATION_ARTIFACT_ELIGIBILITY_NOT_ELIGIBLE:${eligibilityResult.reasons.join(",")}`,
);

assert.equal(
  eligibilityResult.eligible,
  true,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_FALSE",
);

assert.equal(
  eligibilityResult.contentId,
  compiled.content.id,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_CONTENT_MISMATCH",
);

assert.equal(
  eligibilityResult.decisionId,
  compiled.decision.aggregateId,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_DECISION_MISMATCH",
);

assert.equal(
  eligibilityResult.scopeId,
  result.scopeId,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_SCOPE_MISMATCH",
);

assert.equal(
  eligibilityResult.contextId,
  result.contextId,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_CONTEXT_MISMATCH",
);

assert.equal(
  eligibilityResult.fingerprint,
  compiled.fingerprint,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_FINGERPRINT_MISMATCH",
);

const eligibilityId =
  `eligibility:v8:publication-artifact-gate:${compiled.fingerprint}`;

const eligibilityRecord =
  store.append({
    aggregateType:
      "ELIGIBILITY",

    aggregateId:
      eligibilityId,

    version: 1,

    state: "APPROVED",

    payload: {
      status:
        eligibilityResult.status,

      eligible:
        eligibilityResult.eligible,

      contentId:
        eligibilityResult.contentId,

      decisionId:
        eligibilityResult.decisionId,

      scopeId:
        eligibilityResult.scopeId,

      contextId:
        eligibilityResult.contextId,

      fingerprint:
        eligibilityResult.fingerprint,

      reasons:
        eligibilityResult.reasons,
    },

    lineage:
      eligibilityResult.lineage,

    actor: {
      id:
        "v8-publication-artifact-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-14 publication eligibility approved for publication artifact creation.",
  });

assert.equal(
  eligibilityRecord.state,
  "APPROVED",
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_RECORD_NOT_APPROVED",
);

assert.equal(
  eligibilityRecord.fingerprint.length > 0,
  true,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_RECORD_FINGERPRINT_MISSING",
);

const knowledgeRecords =
  result.knowledgeIds.map(
    (knowledgeId) => {
      const record =
        store.get(
          "KNOWLEDGE",
          knowledgeId,
        );

      assert.ok(
        record,
        `V8_PUBLICATION_ARTIFACT_KNOWLEDGE_RECORD_MISSING:${knowledgeId}`,
      );

      assert.equal(
        record.state,
        "VERIFIED",
        `V8_PUBLICATION_ARTIFACT_KNOWLEDGE_NOT_VERIFIED:${knowledgeId}`,
      );

      return record;
    },
  );

const rule =
  createRule({
    id:
      `rule:v8:publication-artifact-gate:${compiled.fingerprint}`,

    statement:
      "Publication requires verified knowledge derived from an approved decision and an eligible publication state.",

    knowledgeIds:
      knowledgeRecords.map(
        (record) =>
          record.aggregateId,
      ),

    effect:
      "ALLOW",

    status:
      "APPROVED",
  });

const ruleRecord =
  store.append({
    aggregateType:
      "RULE",

    aggregateId:
      rule.id,

    version: 1,

    state: "APPROVED",

    payload: rule,

    lineage:
      knowledgeRecords.map(
        lineageLink,
      ),

    actor: {
      id:
        "v8-publication-artifact-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-14 publication artifact policy rule.",
  });

assert.equal(
  ruleRecord.state,
  "APPROVED",
  "V8_PUBLICATION_ARTIFACT_RULE_NOT_APPROVED",
);

const policy =
  createPolicy({
    id:
      `policy:v8:publication-artifact-gate:${compiled.fingerprint}`,

    name:
      "V8 Publication Artifact Policy",

    ruleIds: [
      rule.id,
    ],

    mode:
      "ALL",

    status:
      "APPROVED",
  });

const policyRecord =
  store.append({
    aggregateType:
      "POLICY",

    aggregateId:
      policy.id,

    version: 1,

    state: "APPROVED",

    payload: policy,

    lineage: [
      lineageLink(ruleRecord),
    ],

    actor: {
      id:
        "v8-publication-artifact-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-14 approved publication policy.",
  });

assert.equal(
  policyRecord.state,
  "APPROVED",
  "V8_PUBLICATION_ARTIFACT_POLICY_NOT_APPROVED",
);

assert.equal(
  policyRecord.payload.fingerprint,
  policy.fingerprint,
  "V8_PUBLICATION_ARTIFACT_POLICY_FINGERPRINT_MISMATCH",
);

const eligibilityLink =
  lineageLink(
    eligibilityRecord,
  );

const publicationGate =
  new PublicationGate(store);

const artifact =
  publicationGate.publish({
    subjectId:
      compiled.content.id,

    title:
      compiled.content.title,

    body:
      compiled.content.body,

    eligibility:
      eligibilityRecord,

    policyId:
      policyRecord.aggregateId,

    lineage: [
      ...eligibilityResult.lineage,
      eligibilityLink,
    ],
  });

assert.ok(
  artifact,
  "V8_PUBLICATION_ARTIFACT_MISSING",
);

assert.ok(
  artifact.id,
  "V8_PUBLICATION_ARTIFACT_ID_MISSING",
);

assert.equal(
  artifact.subjectId,
  compiled.content.id,
  "V8_PUBLICATION_ARTIFACT_SUBJECT_MISMATCH",
);

assert.equal(
  artifact.title,
  compiled.content.title,
  "V8_PUBLICATION_ARTIFACT_TITLE_MISMATCH",
);

assert.equal(
  artifact.body,
  compiled.content.body,
  "V8_PUBLICATION_ARTIFACT_BODY_MISMATCH",
);

assert.equal(
  artifact.eligibilityRecordId,
  eligibilityRecord.recordId,
  "V8_PUBLICATION_ARTIFACT_ELIGIBILITY_RECORD_MISMATCH",
);

assert.equal(
  artifact.policyId,
  policyRecord.aggregateId,
  "V8_PUBLICATION_ARTIFACT_POLICY_ID_MISMATCH",
);

assert.equal(
  artifact.policyFingerprint,
  policyRecord.fingerprint,
  "V8_PUBLICATION_ARTIFACT_POLICY_FINGERPRINT_MISMATCH",
);

assert.ok(
  artifact.contentFingerprint,
  "V8_PUBLICATION_ARTIFACT_CONTENT_FINGERPRINT_MISSING",
);

const publicationRecord =
  store.append({
    aggregateType:
      "PUBLICATION",

    aggregateId:
      artifact.id,

    version: 1,

    state: "SEALED",

    payload: artifact,

    lineage:
      artifact.lineage,

    actor: {
      id:
        "v8-publication-artifact-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-14 immutable publication artifact sealed after publication gate approval.",
  });

assert.equal(
  publicationRecord.state,
  "SEALED",
  "V8_PUBLICATION_ARTIFACT_PUBLICATION_NOT_SEALED",
);

assert.equal(
  publicationRecord.payload.id,
  artifact.id,
  "V8_PUBLICATION_ARTIFACT_PERSISTED_ID_MISMATCH",
);

assert.equal(
  publicationRecord.payload.contentFingerprint,
  artifact.contentFingerprint,
  "V8_PUBLICATION_ARTIFACT_PERSISTED_FINGERPRINT_MISMATCH",
);

const persistedPublication =
  store.get(
    "PUBLICATION",
    artifact.id,
  );

assert.ok(
  persistedPublication,
  "V8_PUBLICATION_ARTIFACT_PERSISTED_RECORD_MISSING",
);

assert.equal(
  persistedPublication.state,
  "SEALED",
  "V8_PUBLICATION_ARTIFACT_PERSISTED_STATE_INVALID",
);

assert.equal(
  persistedPublication.payload.policyId,
  policyRecord.aggregateId,
  "V8_PUBLICATION_ARTIFACT_PERSISTED_POLICY_MISMATCH",
);

assert.equal(
  persistedPublication.payload.eligibilityRecordId,
  eligibilityRecord.recordId,
  "V8_PUBLICATION_ARTIFACT_PERSISTED_ELIGIBILITY_MISMATCH",
);

store.verifyChain();

const publicationRecords =
  latestRecords(
    store,
    "PUBLICATION",
  );

assert.equal(
  publicationRecords.length,
  1,
  "V8_PUBLICATION_ARTIFACT_PUBLICATION_COUNT_MISMATCH",
);

const policyRecords =
  latestRecords(
    store,
    "POLICY",
  );

assert.equal(
  policyRecords.length,
  1,
  "V8_PUBLICATION_ARTIFACT_POLICY_COUNT_MISMATCH",
);

const ruleRecords =
  latestRecords(
    store,
    "RULE",
  );

assert.equal(
  ruleRecords.length,
  1,
  "V8_PUBLICATION_ARTIFACT_RULE_COUNT_MISMATCH",
);

console.log(
  "[NEXMOLD][V8-PUBLICATION-ARTIFACT] REAL INTERNET PUBLICATION ARTIFACT GATE PASS",
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] acquired=${result.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] claims=${result.claimIds.length}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] knowledge=${result.knowledgeIds.length}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] decision=${result.decisionId}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] decisionState=${compiled.decision.state}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] content=${compiled.content.id}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] eligibility=${eligibilityRecord.recordId}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] eligibilityState=${eligibilityRecord.state}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] policy=${policyRecord.aggregateId}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] policyState=${policyRecord.state}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] rule=${ruleRecord.aggregateId}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] artifact=${artifact.id}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] contentFingerprint=${artifact.contentFingerprint}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] policyFingerprint=${artifact.policyFingerprint}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] lineage=${artifact.lineage.length}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] publicationState=${publicationRecord.state}`,
);

console.log(
  `[V8-PUBLICATION-ARTIFACT] chainValid=true`,
);