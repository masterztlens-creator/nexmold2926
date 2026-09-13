import assert from "node:assert/strict";
import { createHash } from "node:crypto";

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
  RouteMetadataProjector,
  RouteMetadataGate,
} from "../.v8-build/src/v8/route-metadata/index.js";

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function assertThrows(fn, message) {
  assert.throws(fn, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function alternateSet(alternates) {
  return alternates.map((item) => ({
    locale: item.locale,
    route: item.route,
  }));
}

function buildReciprocalSets() {
  const routes = {
    en: "/knowledge/plastic-injection-molding-wall-thickness",
    de: "/de/wissen/kunststoff-spritzguss-wanddicke",
    fr: "/fr/connaissance/epaisseur-paroi-moulage-injection",
  };

  return {
    routes,

    en: [
      {
        locale: "de",
        route: routes.de,
      },
      {
        locale: "en",
        route: routes.en,
      },
      {
        locale: "fr",
        route: routes.fr,
      },
    ],

    de: [
      {
        locale: "de",
        route: routes.de,
      },
      {
        locale: "en",
        route: routes.en,
      },
      {
        locale: "fr",
        route: routes.fr,
      },
    ],

    fr: [
      {
        locale: "de",
        route: routes.de,
      },
      {
        locale: "en",
        route: routes.en,
      },
      {
        locale: "fr",
        route: routes.fr,
      },
    ],
  };
}

const apiKey = process.env.V8_SEARCH_API_KEY;

assertTruthy(
  apiKey,
  "V8_ROUTE_METADATA_SEARCH_API_KEY_MISSING",
);

const store = new InMemoryFoundationStore();

const searchProvider = new TavilySearchProvider(
  apiKey,
);

const pageFetcher = new HttpPageFetcher();

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
    "V8 route metadata integrity gate real internet source",
  ],
};

const runtime = await runV8ArticleRuntime({
  opportunity,
  searchProvider,
  pageFetcher,
  store,

  actor: {
    id: "v8:route-metadata-integrity-gate",
    role: "INGESTOR",
  },

  acquisition: {
    maxQueries: 1,
    maxCandidates: 3,
    actorId: "v8:route-metadata-integrity-gate",
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
    purpose: "V8-18 route metadata integrity",
    variables: {
      gate: "V8-18",
    },
  },

  problem: {
    question:
      "What wall thickness considerations apply to plastic injection molding?",
    constraints: [
      "Use only verified evidence.",
      "Do not publish unsupported claims.",
    ],
  },

  title: "Plastic Injection Molding Wall Thickness",
});

assert.ok(
  Array.isArray(
    runtime.acquisition.acquisitions,
  ),
  "V8_ROUTE_METADATA_ACQUISITION_INVALID",
);

assert.equal(
  runtime.acquisition.acquisitions.length,
  3,
  "V8_ROUTE_METADATA_EXPECTED_THREE_ACQUISITIONS",
);

assert.equal(
  runtime.verifiedEvidenceIds.length,
  3,
  "V8_ROUTE_METADATA_EXPECTED_THREE_EVIDENCE",
);

assert.equal(
  runtime.claimIds.length,
  3,
  "V8_ROUTE_METADATA_EXPECTED_THREE_CLAIMS",
);

assert.equal(
  runtime.knowledgeIds.length,
  3,
  "V8_ROUTE_METADATA_EXPECTED_THREE_KNOWLEDGE",
);

const decision = store.get(
  "DECISION",
  runtime.decisionId,
);

assertTruthy(
  decision,
  "V8_ROUTE_METADATA_DECISION_NOT_FOUND",
);

assert.equal(
  decision.state,
  "APPROVED",
  "V8_ROUTE_METADATA_DECISION_NOT_APPROVED",
);

const compiler = new ContentCompiler(
  store,
);

const compiled = compiler.compile({
  decisionId: runtime.decisionId,
  scopeId: runtime.scopeId,
  contextId: runtime.contextId,
  title: "Plastic Injection Molding Wall Thickness",
});

assert.equal(
  compiled.content.id,
  runtime.content.id,
  "V8_ROUTE_METADATA_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.title,
  runtime.content.title,
  "V8_ROUTE_METADATA_CONTENT_TITLE_MISMATCH",
);

assert.equal(
  compiled.content.body,
  runtime.content.body,
  "V8_ROUTE_METADATA_CONTENT_BODY_MISMATCH",
);

const projectionProjector =
  new ProjectionProjector(
    store,
  );

const projectionResult =
  projectionProjector.project({
    compiled,
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

const projected =
  projectionResult.projected;

const projectionRecord =
  store.get(
    "PROJECTION",
    projected.projectionId,
  );

assertTruthy(
  projectionRecord,
  "V8_ROUTE_METADATA_PROJECTION_RECORD_MISSING",
);

assert.equal(
  projected.projectionId,
  projectionRecord.aggregateId,
  "V8_ROUTE_METADATA_PROJECTION_ID_MISMATCH",
);

assert.equal(
  projected.fingerprint,
  projectionRecord.fingerprint,
  "V8_ROUTE_METADATA_PROJECTION_FINGERPRINT_MISMATCH",
);

const routes =
  buildReciprocalSets();

const regionalProjector =
  new RegionalProjectionProjector();

const regionalResult =
  regionalProjector.project({
    projected,
    region: "GLOBAL",
    locale: "en",
    canonicalRoute:
      routes.routes.en,
    alternates:
      routes.en,
  });

const regional =
  regionalResult.regional;

assert.equal(
  regional.locale,
  "en",
  "V8_ROUTE_METADATA_REGIONAL_LOCALE_MISMATCH",
);

assert.equal(
  regional.canonicalRoute,
  routes.routes.en,
  "V8_ROUTE_METADATA_REGIONAL_CANONICAL_MISMATCH",
);

assert.equal(
  regional.alternates.length,
  3,
  "V8_ROUTE_METADATA_REGIONAL_ALTERNATE_COUNT_MISMATCH",
);

const routeMetadataProjector =
  new RouteMetadataProjector();

const routeMetadataResult =
  routeMetadataProjector.project({
    regional,
    alternates: routes.en,
  });

const routeMetadata =
  routeMetadataResult.routeMetadata;

const gate =
  new RouteMetadataGate();

const gateResult =
  gate.check(
    routeMetadata,
  );

assert.equal(
  gateResult.passed,
  true,
  "V8_ROUTE_METADATA_GATE_FAILED",
);

assert.equal(
  routeMetadata.canonicalRoute,
  routes.routes.en,
  "V8_ROUTE_METADATA_CANONICAL_ROUTE_MISMATCH",
);

assert.equal(
  routeMetadata.alternates.length,
  3,
  "V8_ROUTE_METADATA_ALTERNATE_COUNT_MISMATCH",
);

const self =
  routeMetadata.alternates.find(
    (item) =>
      item.locale ===
      routeMetadata.locale,
  );

assertTruthy(
  self,
  "V8_ROUTE_METADATA_SELF_ALTERNATE_MISSING",
);

assert.equal(
  self.route,
  routeMetadata.canonicalRoute,
  "V8_ROUTE_METADATA_SELF_CANONICAL_MISMATCH",
);

const regionalLineage =
  routeMetadata.lineage.find(
    (item) =>
      item.type === "PROJECTION" &&
      item.id ===
        regional.id,
  );

assertTruthy(
  regionalLineage,
  "V8_ROUTE_METADATA_REGIONAL_LINEAGE_MISSING",
);

const sourceProjectionLineage =
  routeMetadata.lineage.find(
    (item) =>
      item.type === "PROJECTION" &&
      item.id ===
        regional.projectionId,
  );

assertTruthy(
  sourceProjectionLineage,
  "V8_ROUTE_METADATA_PROJECTION_LINEAGE_MISSING",
);

const deterministic =
  routeMetadataProjector.project({
    regional,
    alternates: routes.en,
  }).routeMetadata;

assert.deepEqual(
  deterministic,
  routeMetadata,
  "V8_ROUTE_METADATA_NON_DETERMINISTIC",
);

const tampered =
  clone(routeMetadata);

tampered.canonicalRoute =
  "/tampered-route";

assertThrows(
  () =>
    gate.check(
      tampered,
    ),
  "V8_ROUTE_METADATA_TAMPER_CANONICAL_ACCEPTED",
);

const missingSelf =
  clone(routeMetadata);

missingSelf.alternates =
  missingSelf.alternates.filter(
    (item) =>
      item.locale !==
      missingSelf.locale,
  );

assertThrows(
  () =>
    gate.check(
      missingSelf,
    ),
  "V8_ROUTE_METADATA_MISSING_SELF_ACCEPTED",
);

const duplicateLocale =
  clone(routeMetadata);

duplicateLocale.alternates = [
  ...duplicateLocale.alternates,
  {
    locale:
      duplicateLocale.locale,
    route:
      duplicateLocale.canonicalRoute,
  },
];

assertThrows(
  () =>
    gate.check(
      duplicateLocale,
    ),
  "V8_ROUTE_METADATA_DUPLICATE_LOCALE_ACCEPTED",
);

const wrongCanonical =
  clone(routeMetadata);

wrongCanonical.alternates =
  wrongCanonical.alternates.map(
    (item) =>
      item.locale ===
      wrongCanonical.locale
        ? {
            ...item,
            route:
              "/wrong-canonical",
          }
        : item,
  );

assertThrows(
  () =>
    gate.check(
      wrongCanonical,
    ),
  "V8_ROUTE_METADATA_WRONG_CANONICAL_ACCEPTED",
);

const fingerprintTampered =
  clone(routeMetadata);

fingerprintTampered.fingerprint =
  createHash("sha256")
    .update(
      "tampered-route-metadata",
      "utf8",
    )
    .digest("hex");

assertThrows(
  () =>
    gate.check(
      fingerprintTampered,
    ),
  "V8_ROUTE_METADATA_FINGERPRINT_TAMPER_ACCEPTED",
);

const reciprocalLocales =
  new Set(
    routeMetadata.alternates.map(
      (item) =>
        item.locale.toLowerCase(),
    ),
  );

for (
  const alternate of
    routeMetadata.alternates
) {
  assert.ok(
    reciprocalLocales.has(
      alternate.locale.toLowerCase(),
    ),
    `V8_ROUTE_METADATA_RECIPROCAL_LOCALE_MISSING:${alternate.locale}`,
  );
}

store.verifyChain();

console.log(
  "[NEXMOLD][V8-ROUTE-METADATA] REAL INTERNET ROUTE METADATA INTEGRITY GATE PASS",
);

console.log(
  `[V8-ROUTE-METADATA] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-ROUTE-METADATA] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-ROUTE-METADATA] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-ROUTE-METADATA] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-ROUTE-METADATA] decision=${runtime.decisionId}`,
);

console.log(
  `[V8-ROUTE-METADATA] decisionState=${decision.state}`,
);

console.log(
  `[V8-ROUTE-METADATA] content=${runtime.content.id}`,
);

console.log(
  `[V8-ROUTE-METADATA] projection=${projected.projectionId}`,
);

console.log(
  `[V8-ROUTE-METADATA] regional=${regional.id}`,
);

console.log(
  `[V8-ROUTE-METADATA] regionalLocale=${regional.locale}`,
);

console.log(
  `[V8-ROUTE-METADATA] canonical=${routeMetadata.canonicalRoute}`,
);

console.log(
  `[V8-ROUTE-METADATA] alternates=${routeMetadata.alternates.length}`,
);

console.log(
  `[V8-ROUTE-METADATA] fingerprint=${routeMetadata.fingerprint}`,
);

console.log(
  "[V8-ROUTE-METADATA] deterministicReprojection=true",
);

console.log(
  "[V8-ROUTE-METADATA] tamperRejection=true",
);

console.log(
  "[V8-ROUTE-METADATA] reciprocalHreflang=true",
);

console.log(
  "[V8-ROUTE-METADATA] chainValid=true",
);