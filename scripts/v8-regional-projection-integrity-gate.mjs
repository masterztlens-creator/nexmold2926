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
  ProjectionProjector,
} from "../.v8-build/src/v8/projection/projector.js";

import {
  RegionalProjectionProjector,
} from "../.v8-build/src/v8/regional-projection/projector.js";

import {
  RegionalProjectionGate,
} from "../.v8-build/src/v8/regional-projection/gate.js";

const apiKey =
  process.env.V8_SEARCH_API_KEY?.trim();

assert(
  apiKey,
  "V8_REGIONAL_PROJECTION_SEARCH_API_KEY_MISSING",
);

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
    "V8-17 regional projection integrity gate",
  ],
};

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(apiKey);

const pageFetcher =
  new HttpPageFetcher();

const runtime =
  await runV8ArticleRuntime({
    opportunity,
    searchProvider,
    pageFetcher,
    store,
    actorId:
      "v8-regional-projection-gate",
    acquisition: {
      maxQueries: 1,
      maxCandidates: 3,
      actorId:
        "v8-regional-projection-gate",
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
        "V8-17 regional projection integrity",
      variables: {
        market: "GLOBAL",
        audience: "B2B",
      },
    },
    problem: {
      question:
        "How should injection molding wall thickness be evaluated for a global B2B audience?",
      constraints: [
        "Use only verified evidence.",
        "Do not publish unsupported universal claims.",
      ],
    },
    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert(
  Array.isArray(
    runtime.acquisition.acquisitions,
  ),
  "V8_REGIONAL_PROJECTION_ACQUISITION_INVALID",
);

assert(
  runtime.acquisition.acquisitions.length >
    0,
  "V8_REGIONAL_PROJECTION_NO_ACQUISITION",
);

assert(
  runtime.verifiedEvidenceIds.length >
    0,
  "V8_REGIONAL_PROJECTION_NO_EVIDENCE",
);

assert(
  runtime.claimIds.length > 0,
  "V8_REGIONAL_PROJECTION_NO_CLAIMS",
);

assert(
  runtime.knowledgeIds.length > 0,
  "V8_REGIONAL_PROJECTION_NO_KNOWLEDGE",
);

assert(
  runtime.content !== null,
  "V8_REGIONAL_PROJECTION_NO_CONTENT",
);

const decision =
  store.get(
    "DECISION",
    runtime.decisionId,
  );

assert(
  decision !== null,
  "V8_REGIONAL_PROJECTION_DECISION_NOT_FOUND",
);

assert(
  decision.state === "APPROVED",
  "V8_REGIONAL_PROJECTION_DECISION_NOT_APPROVED",
);

const compiler =
  new ContentCompiler(store);

const compiled =
  compiler.compile({
    decisionId:
      runtime.decisionId,
    scopeId:
      runtime.scopeId,
    contextId:
      runtime.contextId,
    title:
      "Plastic Injection Molding Wall Thickness",
  });

assert.equal(
  compiled.content.id,
  runtime.content.id,
  "V8_REGIONAL_PROJECTION_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.title,
  runtime.content.title,
  "V8_REGIONAL_PROJECTION_CONTENT_TITLE_MISMATCH",
);

assert.equal(
  compiled.content.body,
  runtime.content.body,
  "V8_REGIONAL_PROJECTION_CONTENT_BODY_MISMATCH",
);

assert.equal(
  compiled.decision.aggregateId,
  runtime.decisionId,
  "V8_REGIONAL_PROJECTION_DECISION_ID_MISMATCH",
);

assert.equal(
  compiled.fingerprint.length,
  64,
  "V8_REGIONAL_PROJECTION_COMPILED_FINGERPRINT_INVALID",
);

const projectionProjector =
  new ProjectionProjector(store);

const projectionResult =
  projectionProjector.project({
    compiled,
    scopeId:
      runtime.scopeId,
    contextId:
      runtime.contextId,
  });

const projected =
  projectionResult.projected;

assert.equal(
  projected.contentId,
  compiled.content.id,
  "V8_REGIONAL_PROJECTION_PROJECTED_CONTENT_MISMATCH",
);

assert.equal(
  projected.decisionId,
  compiled.decision.aggregateId,
  "V8_REGIONAL_PROJECTION_PROJECTED_DECISION_MISMATCH",
);

assert.equal(
  projected.scopeId,
  runtime.scopeId,
  "V8_REGIONAL_PROJECTION_PROJECTED_SCOPE_MISMATCH",
);

assert.equal(
  projected.contextId,
  runtime.contextId,
  "V8_REGIONAL_PROJECTION_PROJECTED_CONTEXT_MISMATCH",
);

assert.equal(
  projected.title,
  compiled.content.title,
  "V8_REGIONAL_PROJECTION_PROJECTED_TITLE_MISMATCH",
);

assert.equal(
  projected.body,
  compiled.content.body,
  "V8_REGIONAL_PROJECTION_PROJECTED_BODY_MISMATCH",
);

const projectionRecord =
  store.get(
    "PROJECTION",
    projected.projectionId,
  );

assert(
  projectionRecord !== null,
  "V8_REGIONAL_PROJECTION_SOURCE_RECORD_NOT_FOUND",
);

assert.equal(
  projectionRecord.fingerprint,
  projected.fingerprint,
  "V8_REGIONAL_PROJECTION_SOURCE_FINGERPRINT_MISMATCH",
);

assert.equal(
  projectionRecord.version,
  1,
  "V8_REGIONAL_PROJECTION_SOURCE_VERSION_INVALID",
);

const regionalProjector =
  new RegionalProjectionProjector();

const regionalInput = {
  projected,
  region: "GLOBAL",
  locale: "en",
  canonicalRoute:
    "/knowledge/plastic-injection-molding-wall-thickness",
  alternates: [
    {
      locale: "en",
      route:
        "/knowledge/plastic-injection-molding-wall-thickness",
    },
    {
      locale: "de",
      route:
        "/de/knowledge/plastic-injection-molding-wall-thickness",
    },
    {
      locale: "fr",
      route:
        "/fr/knowledge/plastic-injection-molding-wall-thickness",
    },
  ],
};

const regionalResult =
  regionalProjector.project(
    regionalInput,
  );

const regional =
  regionalResult.regional;

const gate =
  new RegionalProjectionGate();

gate.check(regional);

assert(
  regional.lineage.some(
    (link) =>
      link.type === "PROJECTION" &&
      link.id === projected.projectionId &&
      link.version === projectionRecord.version &&
      link.fingerprint === projectionRecord.fingerprint,
  ),
  "V8_REGIONAL_PROJECTION_SOURCE_LINEAGE_INVALID",
);

const second =
  regionalProjector.project(
    regionalInput,
  ).regional;

assert.equal(
  regional.id,
  second.id,
  "V8_REGIONAL_PROJECTION_NON_DETERMINISTIC_ID",
);

assert.equal(
  regional.fingerprint,
  second.fingerprint,
  "V8_REGIONAL_PROJECTION_NON_DETERMINISTIC_FINGERPRINT",
);

assert.deepEqual(
  regional.alternates,
  second.alternates,
  "V8_REGIONAL_PROJECTION_NON_DETERMINISTIC_ALTERNATES",
);

const tampered =
  {
    ...regional,
    canonicalRoute:
      "/knowledge/tampered-route",
  };

assert.throws(
  () => gate.check(tampered),
  /V8_REGIONAL_PROJECTION_FINGERPRINT_MISMATCH/,
  "V8_REGIONAL_PROJECTION_TAMPER_NOT_REJECTED",
);

const missingSelfAlternate =
  regional.alternates.filter(
    (item) =>
      item.locale.toLowerCase() !==
      regional.locale.toLowerCase(),
  );

assert.throws(
  () =>
    regionalProjector.project({
      projected,
      region:
        regional.region,
      locale:
        regional.locale,
      canonicalRoute:
        regional.canonicalRoute,
      alternates:
        missingSelfAlternate,
    }),
  /V8_REGIONAL_PROJECTION_SELF_ALTERNATE_MISSING/,
  "V8_REGIONAL_PROJECTION_SELF_ALTERNATE_NOT_REJECTED",
);

const duplicateLocaleAlternates = [
  ...regional.alternates,
  regional.alternates[0],
];

assert.throws(
  () =>
    regionalProjector.project({
      projected,
      region:
        regional.region,
      locale:
        regional.locale,
      canonicalRoute:
        regional.canonicalRoute,
      alternates:
        duplicateLocaleAlternates,
    }),
  /V8_REGIONAL_PROJECTION_DUPLICATE_LOCALE/,
  "V8_REGIONAL_PROJECTION_DUPLICATE_LOCALE_NOT_REJECTED",
);

const canonicalSelfMismatch =
  regional.alternates.map(
    (item) =>
      item.locale.toLowerCase() ===
      regional.locale.toLowerCase()
        ? {
            ...item,
            route:
              "/knowledge/different-canonical",
          }
        : item,
  );

assert.throws(
  () =>
    regionalProjector.project({
      projected,
      region:
        regional.region,
      locale:
        regional.locale,
      canonicalRoute:
        regional.canonicalRoute,
      alternates:
        canonicalSelfMismatch,
    }),
  /V8_REGIONAL_PROJECTION_CANONICAL_SELF_MISMATCH/,
  "V8_REGIONAL_PROJECTION_CANONICAL_SELF_MISMATCH_NOT_REJECTED",
);

store.verifyChain();

console.log(
  "[NEXMOLD][V8-REGIONAL-PROJECTION] REAL INTERNET REGIONAL PROJECTION INTEGRITY GATE PASS",
);

console.log(
  `[V8-REGIONAL-PROJECTION] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] decision=${runtime.decisionId}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] decisionState=${
    decision.state
  }`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] content=${runtime.content.id}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] projection=${projected.projectionId}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] projectionState=${projectionRecord.state}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] regional=${regional.id}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] region=${regional.region}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] locale=${regional.locale}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] canonical=${regional.canonicalRoute}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] alternates=${regional.alternates.length}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] fingerprint=${regional.fingerprint}`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] deterministicReprojection=true`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] tamperRejection=true`,
);

console.log(
  `[V8-REGIONAL-PROJECTION] chainValid=true`,
);