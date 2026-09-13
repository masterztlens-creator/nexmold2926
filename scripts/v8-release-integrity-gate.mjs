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

import {
  project,
} from "../.v8-build/src/v8/projection/projector.js";

import {
  releasePreflight,
  assertReleaseReady,
} from "../.v8-build/src/v8/release/index.js";

const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_RELEASE_INTEGRITY_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function lineageLink(record) {
  return {
    type: record.aggregateType,
    id: record.aggregateId,
    version: record.version,
    fingerprint: record.fingerprint,
  };
}

function getRequiredRecord(
  store,
  type,
  id,
  message,
) {
  const record = store.get(type, id);

  assertTruthy(
    record,
    message ?? `V8_RELEASE_INTEGRITY_RECORD_MISSING:${type}:${id}`,
  );

  return record;
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
    "V8 release integrity gate real internet validation",
  ],
};

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    apiKey,
    "https://api.tavily.com/search",
    "v8-release-integrity-gate",
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
      id: "v8-release-integrity-gate",
      role: "SYSTEM",
    },

    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId:
        "v8-release-integrity-gate",
    },

    scope: {
      id:
        "scope:v8:release-integrity-gate",

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
        "context:v8:release-integrity-gate",

      purpose:
        "Validate that an approved publication can pass release integrity without losing its provenance.",

      variables: {
        sourceMode:
          "REAL_INTERNET",

        evidencePolicy:
          "VERIFIED_ONLY",

        contentPolicy:
          "EVIDENCE_BACKED",

        publicationPolicy:
          "APPROVED_POLICY_REQUIRED",

        releasePolicy:
          "CANONICAL_MANIFEST",
      },
    },

    problem: {
      id:
        "problem:v8:release-integrity-gate",

      question:
        "What evidence-backed information can be released about plastic injection molding wall thickness?",

      constraints: [
        "Use real Internet-acquired evidence only.",
        "Only VERIFIED evidence may produce claims.",
        "Only VERIFIED claims may produce approved knowledge.",
        "Decision must be APPROVED.",
        "Content must be derived from the approved decision.",
        "Publication eligibility must be ELIGIBLE.",
        "Publication requires an APPROVED policy.",
        "Release manifest must be canonical.",
      ],
    },

    title:
      "Plastic Injection Molding Wall Thickness",
  });

assertTruthy(
  result.acquisition,
  "V8_RELEASE_INTEGRITY_ACQUISITION_MISSING",
);

assert.ok(
  result.acquisition.acquisitions.length > 0,
  "V8_RELEASE_INTEGRITY_ACQUISITION_EMPTY",
);

assert.ok(
  result.verifiedEvidenceIds.length > 0,
  "V8_RELEASE_INTEGRITY_VERIFIED_EVIDENCE_EMPTY",
);

assert.ok(
  result.claimIds.length > 0,
  "V8_RELEASE_INTEGRITY_CLAIMS_EMPTY",
);

assert.ok(
  result.knowledgeIds.length > 0,
  "V8_RELEASE_INTEGRITY_KNOWLEDGE_EMPTY",
);

assertTruthy(
  result.scopeId,
  "V8_RELEASE_INTEGRITY_SCOPE_MISSING",
);

assertTruthy(
  result.contextId,
  "V8_RELEASE_INTEGRITY_CONTEXT_MISSING",
);

assertTruthy(
  result.decisionId,
  "V8_RELEASE_INTEGRITY_DECISION_MISSING",
);

assertTruthy(
  result.content,
  "V8_RELEASE_INTEGRITY_CONTENT_MISSING",
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
  "V8_RELEASE_INTEGRITY_DECISION_NOT_APPROVED",
);

assert.equal(
  compiled.content.id,
  result.content.id,
  "V8_RELEASE_INTEGRITY_CONTENT_ID_MISMATCH",
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
  `V8_RELEASE_INTEGRITY_ELIGIBILITY_NOT_ELIGIBLE:${eligibilityResult.reasons.join(",")}`,
);

assert.equal(
  eligibilityResult.eligible,
  true,
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_FALSE",
);

assert.equal(
  eligibilityResult.fingerprint,
  compiled.fingerprint,
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_FINGERPRINT_MISMATCH",
);

const eligibilityId =
  `eligibility:v8:release-integrity-gate:${compiled.fingerprint}`;

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
        "v8-release-integrity-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-15 release integrity eligibility approval.",
  });

assert.equal(
  eligibilityRecord.state,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_NOT_APPROVED",
);

const knowledgeRecords =
  result.knowledgeIds.map(
    (knowledgeId) => {
      const record =
        getRequiredRecord(
          store,
          "KNOWLEDGE",
          knowledgeId,
        );

      assert.equal(
        record.state,
        "VERIFIED",
        `V8_RELEASE_INTEGRITY_KNOWLEDGE_NOT_VERIFIED:${knowledgeId}`,
      );

      return record;
    },
  );

const rule =
  createRule({
    id:
      `rule:v8:release-integrity-gate:${compiled.fingerprint}`,

    statement:
      "Release requires verified knowledge, approved decision, eligible publication state, and canonical release manifest.",

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

    payload:
      rule,

    lineage:
      knowledgeRecords.map(
        lineageLink,
      ),

    actor: {
      id:
        "v8-release-integrity-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-15 approved release rule.",
  });

assert.equal(
  ruleRecord.state,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_RULE_NOT_APPROVED",
);

const policy =
  createPolicy({
    id:
      `policy:v8:release-integrity-gate:${compiled.fingerprint}`,

    name:
      "V8 Release Integrity Policy",

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

    payload:
      policy,

    lineage: [
      lineageLink(ruleRecord),
    ],

    actor: {
      id:
        "v8-release-integrity-gate",
      role:
        "GOVERNOR",
    },

    reason:
      "V8-15 approved release policy.",
  });

assert.equal(
  policyRecord.state,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_POLICY_NOT_APPROVED",
);

const publicationGate =
  new PublicationGate(store);

const publicationArtifact =
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

    lineage:
      eligibilityRecord.lineage,
  });

assert.ok(
  publicationArtifact.id,
  "V8_RELEASE_INTEGRITY_PUBLICATION_ID_MISSING",
);

assert.equal(
  publicationArtifact.eligibilityRecordId,
  eligibilityRecord.aggregateId,
  "V8_RELEASE_INTEGRITY_PUBLICATION_ELIGIBILITY_MISMATCH",
);

assert.equal(
  publicationArtifact.policyId,
  policyRecord.aggregateId,
  "V8_RELEASE_INTEGRITY_PUBLICATION_POLICY_MISMATCH",
);

assert.equal(
  publicationArtifact.policyFingerprint,
  policyRecord.fingerprint,
  "V8_RELEASE_INTEGRITY_PUBLICATION_POLICY_FINGERPRINT_MISMATCH",
);

assert.equal(
  publicationArtifact.contentFingerprint,
  compiled.fingerprint,
  "V8_RELEASE_INTEGRITY_PUBLICATION_CONTENT_FINGERPRINT_MISMATCH",
);

const publicationRecord =
  store.append({
    aggregateType:
      "PUBLICATION",

    aggregateId:
      publicationArtifact.id,

    version: 1,

    state: "SEALED",

    payload:
      publicationArtifact,

    lineage:
      publicationArtifact.lineage,

    actor: {
      id:
        "v8-release-integrity-gate",
      role:
        "PUBLISHER",
    },

    reason:
      "V8-15 sealed publication artifact for release integrity validation.",
  });

assert.equal(
  publicationRecord.state,
  "SEALED",
  "V8_RELEASE_INTEGRITY_PUBLICATION_NOT_SEALED",
);

const storedPublication =
  getRequiredRecord(
    store,
    "PUBLICATION",
    publicationArtifact.id,
  );

assert.equal(
  storedPublication.fingerprint,
  publicationRecord.fingerprint,
  "V8_RELEASE_INTEGRITY_PUBLICATION_RECORD_FINGERPRINT_MISMATCH",
);

const legacyProjection =
  project({
    artifact:
      publicationArtifact,

    route:
      "/industries/plastic-injection-molding/wall-thickness/",
  });

assert.ok(
  legacyProjection.id,
  "V8_RELEASE_INTEGRITY_PROJECTION_ID_MISSING",
);

assert.equal(
  legacyProjection.publicationId,
  publicationArtifact.id,
  "V8_RELEASE_INTEGRITY_PROJECTION_PUBLICATION_MISMATCH",
);

assert.ok(
  legacyProjection.fingerprint.length === 64,
  "V8_RELEASE_INTEGRITY_PROJECTION_FINGERPRINT_INVALID",
);

const requiredPaths = [
  "/industries/plastic-injection-molding/wall-thickness/",
];

const releaseArtifact =
  releasePreflight({
    projection:
      legacyProjection,

    requiredPaths,

    generatedPaths: [
      ...requiredPaths,
    ],
  });

assert.ok(
  releaseArtifact.id,
  "V8_RELEASE_INTEGRITY_RELEASE_ID_MISSING",
);

assert.equal(
  releaseArtifact.projectionId,
  legacyProjection.id,
  "V8_RELEASE_INTEGRITY_RELEASE_PROJECTION_MISMATCH",
);

assert.equal(
  releaseArtifact.projectionFingerprint,
  legacyProjection.fingerprint,
  "V8_RELEASE_INTEGRITY_RELEASE_PROJECTION_FINGERPRINT_MISMATCH",
);

assert.deepEqual(
  releaseArtifact.manifest,
  [
    "/industries/plastic-injection-molding/wall-thickness/",
  ],
  "V8_RELEASE_INTEGRITY_RELEASE_MANIFEST_MISMATCH",
);

const releaseAssertion =
  assertReleaseReady(
    releaseArtifact,
  );

assert.equal(
  releaseAssertion.passed,
  true,
  "V8_RELEASE_INTEGRITY_RELEASE_ASSERTION_FAILED",
);

assert.equal(
  releaseAssertion.releaseId,
  releaseArtifact.id,
  "V8_RELEASE_INTEGRITY_RELEASE_ASSERTION_ID_MISMATCH",
);

const releaseRecord =
  store.append({
    aggregateType:
      "RELEASE",

    aggregateId:
      releaseArtifact.id,

    version: 1,

    state: "SEALED",

    payload:
      releaseArtifact,

    lineage: [
      {
        type:
          "PUBLICATION",

        id:
          publicationRecord.aggregateId,

        version:
          publicationRecord.version,

        fingerprint:
          publicationRecord.fingerprint,
      },

      {
        type:
          "PROJECTION",

        id:
          legacyProjection.id,

        version: 1,

        fingerprint:
          legacyProjection.fingerprint,
      },
    ],

    actor: {
      id:
        "v8-release-integrity-gate",
      role:
        "RELEASER",
    },

    reason:
      "V8-15 release artifact sealed after canonical release preflight.",
  });

assert.equal(
  releaseRecord.state,
  "SEALED",
  "V8_RELEASE_INTEGRITY_RELEASE_NOT_SEALED",
);

const storedRelease =
  getRequiredRecord(
    store,
    "RELEASE",
    releaseArtifact.id,
  );

assert.equal(
  storedRelease.payload.projectionId,
  legacyProjection.id,
  "V8_RELEASE_INTEGRITY_STORED_RELEASE_PROJECTION_MISMATCH",
);

assert.equal(
  storedRelease.payload.projectionFingerprint,
  legacyProjection.fingerprint,
  "V8_RELEASE_INTEGRITY_STORED_RELEASE_PROJECTION_FINGERPRINT_MISMATCH",
);

assert.equal(
  storedRelease.payload.fingerprint,
  releaseArtifact.fingerprint,
  "V8_RELEASE_INTEGRITY_STORED_RELEASE_FINGERPRINT_MISMATCH",
);

store.verifyChain();

console.log(
  "[NEXMOLD][V8-RELEASE-INTEGRITY] REAL INTERNET RELEASE INTEGRITY GATE PASS",
);

console.log(
  `[V8-RELEASE-INTEGRITY] acquired=${result.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] verifiedEvidence=${result.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] claims=${result.claimIds.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] knowledge=${result.knowledgeIds.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] decision=${result.decisionId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] decisionState=${compiled.decision.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] eligibility=${eligibilityRecord.aggregateId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] eligibilityState=${eligibilityRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] policy=${policyRecord.aggregateId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] policyState=${policyRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] publication=${publicationRecord.aggregateId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] publicationState=${publicationRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] projection=${legacyProjection.id}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] projectionFingerprint=${legacyProjection.fingerprint}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] release=${releaseRecord.aggregateId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] releaseState=${releaseRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] releaseFingerprint=${releaseArtifact.fingerprint}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] manifest=${releaseArtifact.manifest.length}`,
);

console.log(
  "[V8-RELEASE-INTEGRITY] chainValid=true",
);