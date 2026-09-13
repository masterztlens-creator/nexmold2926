import assert from "node:assert/strict";

import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";

import { HttpPageFetcher } from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";

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
} from "../.v8-build/src/v8/governance/rule.js";

import {
  createPolicy,
} from "../.v8-build/src/v8/governance/policy.js";

import {
  project,
} from "../.v8-build/src/v8/projection/projector.js";

import {
  releasePreflight,
} from "../.v8-build/src/v8/release/preflight.js";

import {
  assertReleaseReady,
} from "../.v8-build/src/v8/release/gate.js";

const apiKey = process.env.V8_SEARCH_API_KEY;

assert(
  typeof apiKey === "string" && apiKey.trim().length > 0,
  "V8_RELEASE_INTEGRITY_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
);

function assertTruthy(value, message) {
  assert(value, message);
}

function assertString(value, message) {
  assert.equal(
    typeof value,
    "string",
    message,
  );

  assert(
    value.trim().length > 0,
    message,
  );
}

function assertArray(value, message) {
  assert(
    Array.isArray(value),
    message,
  );
}

function getRequiredRecord(store, type, id, message) {
  assertString(
    id,
    message ?? `V8_RELEASE_INTEGRITY_ID_MISSING:${type}`,
  );

  const record = store.get(type, id);

  assertTruthy(
    record,
    message ??
      `V8_RELEASE_INTEGRITY_RECORD_NOT_FOUND:${type}:${id}`,
  );

  return record;
}

function lineageLink(record) {
  return {
    type: record.aggregateType,
    id: record.aggregateId,
    version: record.version,
    fingerprint: record.fingerprint,
  };
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
    "V8 release integrity gate real internet validation",
  ],
};

const store = new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(apiKey);

const pageFetcher =
  new HttpPageFetcher({
    timeoutMs: 20_000,
    maxBytes: 5_000_000,
  });

const runtime = await runV8ArticleRuntime({
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
    actorId: "v8-release-integrity-gate",
  },

  scope: {
    geography: "GLOBAL",

    industries: [
      "PLASTICS",
      "INJECTION_MOLDING",
    ],

    languages: [
      "en",
    ],
  },

  context: {
    purpose:
      "Validate release integrity from real Internet evidence through publication and release.",

    variables: {
      source: "REAL_INTERNET",
      gate: "V8-15",
    },
  },

  problem: {
    question:
      "What wall thickness considerations should be evaluated for plastic injection molding?",

    constraints: [
      "Claims must be grounded in verified Internet evidence.",
      "Publication requires an approved decision.",
      "Release must preserve publication and projection identity.",
    ],
  },

  title:
    "Plastic Injection Molding Wall Thickness",
});

assertTruthy(
  runtime.acquisition,
  "V8_RELEASE_INTEGRITY_ACQUISITION_MISSING",
);

assertArray(
  runtime.acquisition.acquisitions,
  "V8_RELEASE_INTEGRITY_ACQUISITIONS_INVALID",
);

assert(
  runtime.acquisition.acquisitions.length > 0,
  "V8_RELEASE_INTEGRITY_ACQUISITION_EMPTY",
);

assertArray(
  runtime.verifiedEvidenceIds,
  "V8_RELEASE_INTEGRITY_EVIDENCE_IDS_INVALID",
);

assert(
  runtime.verifiedEvidenceIds.length > 0,
  "V8_RELEASE_INTEGRITY_VERIFIED_EVIDENCE_EMPTY",
);

assertArray(
  runtime.claimIds,
  "V8_RELEASE_INTEGRITY_CLAIM_IDS_INVALID",
);

assert(
  runtime.claimIds.length > 0,
  "V8_RELEASE_INTEGRITY_CLAIMS_EMPTY",
);

assertArray(
  runtime.knowledgeIds,
  "V8_RELEASE_INTEGRITY_KNOWLEDGE_IDS_INVALID",
);

assert(
  runtime.knowledgeIds.length > 0,
  "V8_RELEASE_INTEGRITY_KNOWLEDGE_EMPTY",
);

assertString(
  runtime.scopeId,
  "V8_RELEASE_INTEGRITY_SCOPE_ID_INVALID",
);

assertString(
  runtime.contextId,
  "V8_RELEASE_INTEGRITY_CONTEXT_ID_INVALID",
);

assertString(
  runtime.problemId,
  "V8_RELEASE_INTEGRITY_PROBLEM_ID_INVALID",
);

assertString(
  runtime.decisionId,
  "V8_RELEASE_INTEGRITY_DECISION_ID_INVALID",
);

assertTruthy(
  runtime.content,
  "V8_RELEASE_INTEGRITY_CONTENT_MISSING",
);

const decision = getRequiredRecord(
  store,
  "DECISION",
  runtime.decisionId,
  "V8_RELEASE_INTEGRITY_DECISION_NOT_FOUND",
);

assert.equal(
  decision.state,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_DECISION_NOT_APPROVED",
);

assert.equal(
  decision.payload.status,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_DECISION_PAYLOAD_NOT_APPROVED",
);

const compiler =
  new ContentCompiler(store);

const compiled = compiler.compile({
  decisionId: runtime.decisionId,
  scopeId: runtime.scopeId,
  contextId: runtime.contextId,
  title: "Plastic Injection Molding Wall Thickness",
});

assertTruthy(
  compiled.content,
  "V8_RELEASE_INTEGRITY_COMPILED_CONTENT_MISSING",
);

assert.equal(
  compiled.content.id,
  runtime.content.id,
  "V8_RELEASE_INTEGRITY_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.decisionId,
  runtime.decisionId,
  "V8_RELEASE_INTEGRITY_CONTENT_DECISION_MISMATCH",
);

assert.equal(
  compiled.content.title,
  runtime.content.title,
  "V8_RELEASE_INTEGRITY_CONTENT_TITLE_MISMATCH",
);

assert.equal(
  compiled.content.body,
  runtime.content.body,
  "V8_RELEASE_INTEGRITY_CONTENT_BODY_MISMATCH",
);

const eligibilityEvaluator =
  new PublicationEligibilityEvaluator(store);

const eligibilityResult =
  eligibilityEvaluator.evaluate({
    compiled,
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

assert.equal(
  eligibilityResult.status,
  "ELIGIBLE",
  `V8_RELEASE_INTEGRITY_PUBLICATION_NOT_ELIGIBLE:${JSON.stringify(
    eligibilityResult.reasons,
  )}`,
);

assert.equal(
  eligibilityResult.eligible,
  true,
  "V8_RELEASE_INTEGRITY_PUBLICATION_ELIGIBLE_FLAG_FALSE",
);

const eligibilityId =
  `eligibility:v8:release-integrity-gate:${compiled.fingerprint}`;

const eligibility =
  store.append({
    aggregateType: "ELIGIBILITY",
    aggregateId: eligibilityId,
    version: 1,
    state: "APPROVED",

    payload: {
      contentId: eligibilityResult.contentId,
      decisionId: eligibilityResult.decisionId,
      scopeId: eligibilityResult.scopeId,
      contextId: eligibilityResult.contextId,
      fingerprint: eligibilityResult.fingerprint,
      reasons: eligibilityResult.reasons,
      status: eligibilityResult.status,
      eligible: eligibilityResult.eligible,
    },

    lineage: eligibilityResult.lineage,

    actor: {
      id: "v8-release-integrity-gate",
      role: "GOVERNOR",
    },

    reason:
      "Approve publication eligibility for V8 release integrity validation.",
  });

assert.equal(
  eligibility.aggregateType,
  "ELIGIBILITY",
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_TYPE_MISMATCH",
);

assert.equal(
  eligibility.aggregateId,
  eligibilityId,
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_ID_MISMATCH",
);

assert.equal(
  eligibility.state,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_STATE_INVALID",
);

assertString(
  eligibility.recordId,
  "V8_RELEASE_INTEGRITY_ELIGIBILITY_RECORD_ID_MISSING",
);

const knowledgeForPolicy =
  runtime.knowledgeIds.map(
    (knowledgeId) =>
      getRequiredRecord(
        store,
        "KNOWLEDGE",
        knowledgeId,
        `V8_RELEASE_INTEGRITY_KNOWLEDGE_NOT_FOUND:${knowledgeId}`,
      ),
  );

for (const knowledge of knowledgeForPolicy) {
  assert.equal(
    knowledge.state,
    "VERIFIED",
    `V8_RELEASE_INTEGRITY_KNOWLEDGE_NOT_VERIFIED:${knowledge.aggregateId}`,
  );
}

const rule =
  createRule({
    statement:
      "Publication is allowed only when V8 content is eligible and its supporting knowledge is verified.",

    knowledgeIds:
      runtime.knowledgeIds,

    effect: "ALLOW",

    status: "APPROVED",

    id:
      `rule:v8:release-integrity-gate:${compiled.fingerprint}`,
  });

const ruleRecord =
  store.append({
    aggregateType: "RULE",
    aggregateId: rule.id,
    version: 1,
    state: "APPROVED",

    payload: rule,

    lineage:
      runtime.knowledgeIds.map(
        (knowledgeId) =>
          lineageLink(
            getRequiredRecord(
              store,
              "KNOWLEDGE",
              knowledgeId,
            ),
          ),
      ),

    actor: {
      id: "v8-release-integrity-gate",
      role: "GOVERNOR",
    },

    reason:
      "Approve publication rule for V8 release integrity validation.",
  });

assert.equal(
  ruleRecord.state,
  "APPROVED",
  "V8_RELEASE_INTEGRITY_RULE_NOT_APPROVED",
);

const policy =
  createPolicy({
    name:
      "V8 Release Integrity Publication Policy",

    ruleIds: [
      rule.id,
    ],

    mode: "ALL",

    status: "APPROVED",

    id:
      `policy:v8:release-integrity-gate:${compiled.fingerprint}`,
  });

const policyRecord =
  store.append({
    aggregateType: "POLICY",
    aggregateId: policy.id,
    version: 1,
    state: "APPROVED",

    payload: policy,

    lineage: [
      lineageLink(ruleRecord),
    ],

    actor: {
      id: "v8-release-integrity-gate",
      role: "GOVERNOR",
    },

    reason:
      "Approve publication policy for V8 release integrity validation.",
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

    eligibility,

    policyId:
      policyRecord.aggregateId,

    lineage: [
      ...eligibility.lineage,
      lineageLink(eligibility),
    ],
  });

assertTruthy(
  publicationArtifact,
  "V8_RELEASE_INTEGRITY_PUBLICATION_ARTIFACT_MISSING",
);

assertString(
  publicationArtifact.id,
  "V8_RELEASE_INTEGRITY_PUBLICATION_ID_INVALID",
);

assert.equal(
  publicationArtifact.subjectId,
  compiled.content.id,
  "V8_RELEASE_INTEGRITY_PUBLICATION_SUBJECT_MISMATCH",
);

assert.equal(
  publicationArtifact.title,
  compiled.content.title,
  "V8_RELEASE_INTEGRITY_PUBLICATION_TITLE_MISMATCH",
);

assert.equal(
  publicationArtifact.body,
  compiled.content.body,
  "V8_RELEASE_INTEGRITY_PUBLICATION_BODY_MISMATCH",
);

assert.equal(
  publicationArtifact.eligibilityRecordId,
  eligibility.recordId,
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

/*
 * PublicationGate normalizes publication lineage as:
 *
 *   eligibility.lineage
 *   +
 *   POLICY
 *
 * The ELIGIBILITY aggregate itself is represented by:
 *
 *   publicationArtifact.eligibilityRecordId
 *
 * Therefore PublicationArtifact.lineage must not contain
 * an additional ELIGIBILITY self-link.
 */
assert(
  publicationArtifact.lineage.every(
    (link) =>
      link.type !== "ELIGIBILITY",
  ),
  "V8_RELEASE_INTEGRITY_PUBLICATION_UNEXPECTED_ELIGIBILITY_LINEAGE",
);

assert(
  publicationArtifact.lineage.some(
    (link) =>
      link.type === "POLICY" &&
      link.id === policyRecord.aggregateId &&
      link.version === policyRecord.version &&
      link.fingerprint === policyRecord.fingerprint,
  ),
  "V8_RELEASE_INTEGRITY_PUBLICATION_POLICY_LINEAGE_MISSING",
);

const publicationRecord =
  store.append({
    aggregateType: "PUBLICATION",
    aggregateId: publicationArtifact.id,
    version: 1,
    state: "SEALED",

    payload: publicationArtifact,

    lineage: publicationArtifact.lineage,

    actor: {
      id: "v8-release-integrity-gate",
      role: "GOVERNOR",
    },

    reason:
      "Seal publication artifact for V8 release integrity validation.",
  });

assert.equal(
  publicationRecord.state,
  "SEALED",
  "V8_RELEASE_INTEGRITY_PUBLICATION_STATE_INVALID",
);

assert.equal(
  publicationRecord.aggregateId,
  publicationArtifact.id,
  "V8_RELEASE_INTEGRITY_PUBLICATION_RECORD_ID_MISMATCH",
);

const route =
  "/industries/plastic-injection-molding/wall-thickness/";

const projection =
  project({
    artifact: publicationArtifact,
    route,
  });

assertTruthy(
  projection,
  "V8_RELEASE_INTEGRITY_PROJECTION_MISSING",
);

assert.equal(
  projection.publicationId,
  publicationArtifact.id,
  "V8_RELEASE_INTEGRITY_PROJECTION_PUBLICATION_MISMATCH",
);

assert.equal(
  projection.route,
  route,
  "V8_RELEASE_INTEGRITY_PROJECTION_ROUTE_MISMATCH",
);

assert.equal(
  projection.title,
  publicationArtifact.title,
  "V8_RELEASE_INTEGRITY_PROJECTION_TITLE_MISMATCH",
);

assert.equal(
  projection.body,
  publicationArtifact.body,
  "V8_RELEASE_INTEGRITY_PROJECTION_BODY_MISMATCH",
);

assertString(
  projection.fingerprint,
  "V8_RELEASE_INTEGRITY_PROJECTION_FINGERPRINT_INVALID",
);

assert.equal(
  projection.id,
  `projection:${projection.fingerprint}`,
  "V8_RELEASE_INTEGRITY_PROJECTION_ID_MISMATCH",
);

const projectionRecord =
  store.append({
    aggregateType: "PROJECTION",
    aggregateId: projection.id,
    version: 1,
    state: "REGISTERED",

    payload: projection,

    lineage: [
      lineageLink(publicationRecord),
    ],

    actor: {
      id: "v8-release-integrity-gate",
      role: "SYSTEM",
    },

    reason:
      "Register canonical route projection for V8 release integrity validation.",
  });

assert.equal(
  projectionRecord.state,
  "REGISTERED",
  "V8_RELEASE_INTEGRITY_PROJECTION_STATE_INVALID",
);

assert.equal(
  projectionRecord.aggregateId,
  projection.id,
  "V8_RELEASE_INTEGRITY_PROJECTION_RECORD_ID_MISMATCH",
);

const requiredPaths = [
  route,
];

const generatedPaths = [
  route,
];

const release =
  releasePreflight({
    projection,
    requiredPaths,
    generatedPaths,
  });

assertTruthy(
  release,
  "V8_RELEASE_INTEGRITY_RELEASE_ARTIFACT_MISSING",
);

assertString(
  release.id,
  "V8_RELEASE_INTEGRITY_RELEASE_ID_INVALID",
);

assert.equal(
  release.projectionId,
  projection.id,
  "V8_RELEASE_INTEGRITY_RELEASE_PROJECTION_MISMATCH",
);

assert.equal(
  release.projectionFingerprint,
  projection.fingerprint,
  "V8_RELEASE_INTEGRITY_RELEASE_PROJECTION_FINGERPRINT_MISMATCH",
);

assertArray(
  release.manifest,
  "V8_RELEASE_INTEGRITY_RELEASE_MANIFEST_INVALID",
);

assert(
  release.manifest.length > 0,
  "V8_RELEASE_INTEGRITY_RELEASE_MANIFEST_EMPTY",
);

assert.deepEqual(
  release.manifest,
  [...release.manifest].sort(),
  "V8_RELEASE_INTEGRITY_RELEASE_MANIFEST_NOT_SORTED",
);

assertReleaseReady(release);

const releaseRecord =
  store.append({
    aggregateType: "RELEASE",
    aggregateId: release.id,
    version: 1,
    state: "SEALED",

    payload: release,

    lineage: [
      lineageLink(publicationRecord),
      lineageLink(projectionRecord),
    ],

    actor: {
      id: "v8-release-integrity-gate",
      role: "SYSTEM",
    },

    reason:
      "Seal release artifact for V8 release integrity validation.",
  });

assert.equal(
  releaseRecord.state,
  "SEALED",
  "V8_RELEASE_INTEGRITY_RELEASE_STATE_INVALID",
);

assert.equal(
  releaseRecord.aggregateId,
  release.id,
  "V8_RELEASE_INTEGRITY_RELEASE_ID_MISMATCH",
);

assert.equal(
  releaseRecord.payload.projectionId,
  projection.id,
  "V8_RELEASE_INTEGRITY_RELEASE_PAYLOAD_PROJECTION_MISMATCH",
);

assert.equal(
  releaseRecord.payload.projectionFingerprint,
  projection.fingerprint,
  "V8_RELEASE_INTEGRITY_RELEASE_PAYLOAD_PROJECTION_FINGERPRINT_MISMATCH",
);

assert.deepEqual(
  releaseRecord.payload.manifest,
  generatedPaths,
  "V8_RELEASE_INTEGRITY_RELEASE_MANIFEST_MISMATCH",
);

const persistedRelease =
  store.get(
    "RELEASE",
    release.id,
  );

assertTruthy(
  persistedRelease,
  "V8_RELEASE_INTEGRITY_RELEASE_NOT_PERSISTED",
);

assert.equal(
  persistedRelease.aggregateId,
  release.id,
  "V8_RELEASE_INTEGRITY_PERSISTED_RELEASE_ID_MISMATCH",
);

assert.equal(
  persistedRelease.fingerprint,
  releaseRecord.fingerprint,
  "V8_RELEASE_INTEGRITY_PERSISTED_RELEASE_FINGERPRINT_MISMATCH",
);

assert.equal(
  persistedRelease.payload.fingerprint,
  release.fingerprint,
  "V8_RELEASE_INTEGRITY_RELEASE_ARTIFACT_FINGERPRINT_MISMATCH",
);

store.verifyChain();

console.log(
  "[NEXMOLD][V8-RELEASE-INTEGRITY] REAL INTERNET RELEASE INTEGRITY GATE PASS",
);

console.log(
  `[V8-RELEASE-INTEGRITY] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] decision=${runtime.decisionId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] decisionState=${decision.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] content=${compiled.content.id}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] eligibility=${eligibility.aggregateId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] eligibilityRecord=${eligibility.recordId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] eligibilityState=${eligibility.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] policy=${policyRecord.aggregateId}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] policyState=${policyRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] publication=${publicationArtifact.id}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] publicationState=${publicationRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] projection=${projection.id}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] projectionFingerprint=${projection.fingerprint}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] release=${release.id}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] releaseState=${releaseRecord.state}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] releaseFingerprint=${release.fingerprint}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] manifest=${release.manifest.length}`,
);

console.log(
  `[V8-RELEASE-INTEGRITY] chainValid=true`,
);