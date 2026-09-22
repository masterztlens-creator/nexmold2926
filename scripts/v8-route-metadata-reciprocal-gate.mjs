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
  RouteMetadataProjector,
  RouteMetadataGate,
} from "../.v8-build/src/v8/route-metadata/index.js";

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function buildLocaleModel() {
  const routes = {
    en: "/knowledge/plastic-injection-molding-wall-thickness",
    de: "/de/wissen/kunststoff-spritzguss-wanddicke",
    fr: "/fr/connaissance/epaisseur-paroi-moulage-injection",
  };

  const alternates = {
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

  return {
    routes,
    alternates,
  };
}

function canonicalMap(routeMetadataPages) {
  return new Map(
    routeMetadataPages.map((page) => [
      page.locale.toLowerCase(),
      page.canonicalRoute,
    ]),
  );
}

function alternateMap(routeMetadata) {
  return new Map(
    routeMetadata.alternates.map((item) => [
      item.locale.toLowerCase(),
      item.route,
    ]),
  );
}

function assertExactAlternateSet(
  routeMetadata,
  expectedRoutes,
) {
  const actual = alternateMap(routeMetadata);

  assert.equal(
    actual.size,
    expectedRoutes.size,
    `V8_ROUTE_METADATA_RECIPROCAL_ALTERNATE_COUNT_MISMATCH:${routeMetadata.locale}`,
  );

  for (const [locale, route] of expectedRoutes) {
    assert.equal(
      actual.get(locale),
      route,
      `V8_ROUTE_METADATA_RECIPROCAL_ROUTE_MISMATCH:${routeMetadata.locale}:${locale}`,
    );
  }
}

function assertPairwiseReciprocity(
  left,
  right,
) {
  const leftAlternates = alternateMap(left);
  const rightAlternates = alternateMap(right);

  assert.equal(
    leftAlternates.get(right.locale.toLowerCase()),
    right.canonicalRoute,
    `V8_ROUTE_METADATA_RECIPROCAL_FORWARD_MISMATCH:${left.locale}:${right.locale}`,
  );

  assert.equal(
    rightAlternates.get(left.locale.toLowerCase()),
    left.canonicalRoute,
    `V8_ROUTE_METADATA_RECIPROCAL_REVERSE_MISMATCH:${left.locale}:${right.locale}`,
  );
}

function emitAcquisitionDiagnostics(
  acquisition,
) {
  console.log(
    `[V8-18.1][DIAGNOSTIC] discovery.accepted=${acquisition.discovery.accepted}`,
  );

  console.log(
    `[V8-18.1][DIAGNOSTIC] discovery.rejected=${acquisition.discovery.rejected}`,
  );

  console.log(
    "[V8-18.1][DIAGNOSTIC] discovery.candidates=" +
      JSON.stringify(
        acquisition.discovery.candidates.map(
          (candidate) => ({
            url: candidate.url,
            normalizedUrl: candidate.normalizedUrl,
            kind: candidate.kind,
            title: candidate.title,
          }),
        ),
      ),
  );

  console.log(
    "[V8-18.1][DIAGNOSTIC] searchErrors=" +
      JSON.stringify(
        acquisition.searchErrors,
      ),
  );

  console.log(
    "[V8-18.1][DIAGNOSTIC] fetchErrors=" +
      JSON.stringify(
        acquisition.fetchErrors,
      ),
  );

  console.log(
    "[V8-18.1][DIAGNOSTIC] acquisitions=" +
      JSON.stringify(
        acquisition.acquisitions.map(
          (item) => ({
            candidateUrl: item.candidateUrl,
            finalUrl: item.page.finalUrl,
            status: item.page.status,
          }),
        ),
      ),
  );
}

const apiKey = process.env.V8_SEARCH_API_KEY;

assertTruthy(
  apiKey,
  "V8_ROUTE_METADATA_RECIPROCAL_SEARCH_API_KEY_MISSING",
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
    "V8-18.1 cross-locale reciprocal hreflang integrity",
  ],
};

const runtime = await runV8ArticleRuntime({
  opportunity,
  searchProvider,
  pageFetcher,
  store,

  actor: {
    id: "v8:route-metadata-reciprocal-gate",
    role: "INGESTOR",
  },

  acquisition: {
    maxQueries: 1,
    maxCandidates: 3,
    actorId: "v8:route-metadata-reciprocal-gate",
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
    purpose: "V8-18.1 cross-locale reciprocal hreflang integrity",
    variables: {
      gate: "V8-18.1",
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

emitAcquisitionDiagnostics(
  runtime.acquisition,
);

assert.ok(
  Array.isArray(
    runtime.acquisition.acquisitions,
  ),
  "V8_ROUTE_METADATA_RECIPROCAL_ACQUISITION_INVALID",
);

assert.equal(
  runtime.acquisition.acquisitions.length,
  3,
  "V8_ROUTE_METADATA_RECIPROCAL_EXPECTED_THREE_ACQUISITIONS",
);

assert.equal(
  runtime.verifiedEvidenceIds.length,
  3,
  "V8_ROUTE_METADATA_RECIPROCAL_EXPECTED_THREE_EVIDENCE",
);

assert.equal(
  runtime.claimIds.length,
  3,
  "V8_ROUTE_METADATA_RECIPROCAL_EXPECTED_THREE_CLAIMS",
);

assert.equal(
  runtime.knowledgeIds.length,
  3,
  "V8_ROUTE_METADATA_RECIPROCAL_EXPECTED_THREE_KNOWLEDGE",
);

const decision = store.get(
  "DECISION",
  runtime.decisionId,
);

assertTruthy(
  decision,
  "V8_ROUTE_METADATA_RECIPROCAL_DECISION_NOT_FOUND",
);

assert.equal(
  decision.state,
  "APPROVED",
  "V8_ROUTE_METADATA_RECIPROCAL_DECISION_NOT_APPROVED",
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
  "V8_ROUTE_METADATA_RECIPROCAL_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.title,
  runtime.content.title,
  "V8_ROUTE_METADATA_RECIPROCAL_CONTENT_TITLE_MISMATCH",
);

assert.equal(
  compiled.content.body,
  runtime.content.body,
  "V8_ROUTE_METADATA_RECIPROCAL_CONTENT_BODY_MISMATCH",
);

const projectionProjector =
  new ProjectionProjector(
    store,
  );

const projected =
  projectionProjector.project({
    compiled,
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  }).projected;

const projectionRecord =
  store.get(
    "PROJECTION",
    projected.projectionId,
  );

assertTruthy(
  projectionRecord,
  "V8_ROUTE_METADATA_RECIPROCAL_PROJECTION_RECORD_MISSING",
);

assert.equal(
  projected.projectionId,
  projectionRecord.aggregateId,
  "V8_ROUTE_METADATA_RECIPROCAL_PROJECTION_ID_MISMATCH",
);

assert.equal(
  projected.fingerprint,
  projectionRecord.fingerprint,
  "V8_ROUTE_METADATA_RECIPROCAL_PROJECTION_FINGERPRINT_MISMATCH",
);

const localeModel =
  buildLocaleModel();

const regionalProjector =
  new RegionalProjectionProjector();

const routeMetadataProjector =
  new RouteMetadataProjector();

const routeMetadataGate =
  new RouteMetadataGate();

const localePages = [];

for (const locale of ["en", "de", "fr"]) {
  const regional =
    regionalProjector.project({
      projected,
      region: "GLOBAL",
      locale,
      canonicalRoute:
        localeModel.routes[locale],
      alternates:
        localeModel.alternates[locale],
    }).regional;

  assert.equal(
    regional.locale,
    locale,
    `V8_ROUTE_METADATA_RECIPROCAL_REGIONAL_LOCALE_MISMATCH:${locale}`,
  );

  assert.equal(
    regional.canonicalRoute,
    localeModel.routes[locale],
    `V8_ROUTE_METADATA_RECIPROCAL_REGIONAL_CANONICAL_MISMATCH:${locale}`,
  );

  assert.equal(
    regional.alternates.length,
    3,
    `V8_ROUTE_METADATA_RECIPROCAL_REGIONAL_ALTERNATE_COUNT_MISMATCH:${locale}`,
  );

  const routeMetadata =
    routeMetadataProjector.project({
      regional,
      alternates:
        localeModel.alternates[locale],
    }).routeMetadata;

  const gateResult =
    routeMetadataGate.check(
      routeMetadata,
    );

  assert.equal(
    gateResult.passed,
    true,
    `V8_ROUTE_METADATA_RECIPROCAL_ROUTE_METADATA_GATE_FAILED:${locale}`,
  );

  localePages.push(
    routeMetadata,
  );
}

assert.equal(
  localePages.length,
  3,
  "V8_ROUTE_METADATA_RECIPROCAL_PAGE_COUNT_MISMATCH",
);

const pagesByLocale =
  new Map(
    localePages.map((page) => [
      page.locale.toLowerCase(),
      page,
    ]),
  );

for (const locale of ["en", "de", "fr"]) {
  assertTruthy(
    pagesByLocale.has(locale),
    `V8_ROUTE_METADATA_RECIPROCAL_PAGE_MISSING:${locale}`,
  );
}

const expectedRoutes =
  new Map(
    Object.entries(
      localeModel.routes,
    ),
  );

for (const page of localePages) {
  assertExactAlternateSet(
    page,
    expectedRoutes,
  );

  assert.equal(
    page.canonicalRoute,
    expectedRoutes.get(
      page.locale.toLowerCase(),
    ),
    `V8_ROUTE_METADATA_RECIPROCAL_CANONICAL_ROUTE_MISMATCH:${page.locale}`,
  );

  const self =
    page.alternates.find(
      (item) =>
        item.locale.toLowerCase() ===
        page.locale.toLowerCase(),
    );

  assertTruthy(
    self,
    `V8_ROUTE_METADATA_RECIPROCAL_SELF_LOCALE_MISSING:${page.locale}`,
  );

  assert.equal(
    self.route,
    page.canonicalRoute,
    `V8_ROUTE_METADATA_RECIPROCAL_SELF_CANONICAL_MISMATCH:${page.locale}`,
  );
}

const en =
  pagesByLocale.get("en");

const de =
  pagesByLocale.get("de");

const fr =
  pagesByLocale.get("fr");

assertTruthy(
  en,
  "V8_ROUTE_METADATA_RECIPROCAL_EN_PAGE_MISSING",
);

assertTruthy(
  de,
  "V8_ROUTE_METADATA_RECIPROCAL_DE_PAGE_MISSING",
);

assertTruthy(
  fr,
  "V8_ROUTE_METADATA_RECIPROCAL_FR_PAGE_MISSING",
);

assertPairwiseReciprocity(
  en,
  de,
);

assertPairwiseReciprocity(
  en,
  fr,
);

assertPairwiseReciprocity(
  de,
  fr,
);

const canonicalRoutes =
  canonicalMap(
    localePages,
  );

assert.equal(
  canonicalRoutes.get("en"),
  localeModel.routes.en,
  "V8_ROUTE_METADATA_RECIPROCAL_CANONICAL_EN_INVALID",
);

assert.equal(
  canonicalRoutes.get("de"),
  localeModel.routes.de,
  "V8_ROUTE_METADATA_RECIPROCAL_CANONICAL_DE_INVALID",
);

assert.equal(
  canonicalRoutes.get("fr"),
  localeModel.routes.fr,
  "V8_ROUTE_METADATA_RECIPROCAL_CANONICAL_FR_INVALID",
);

const tamperedForward =
  clone(en);

tamperedForward.alternates =
  tamperedForward.alternates.map(
    (item) =>
      item.locale.toLowerCase() === "de"
        ? {
            ...item,
            route: "/tampered-de-route",
          }
        : item,
  );

assert.throws(
  () =>
    routeMetadataGate.check(
      tamperedForward,
    ),
  "V8_ROUTE_METADATA_RECIPROCAL_FORWARD_TAMPER_ACCEPTED",
);

const tamperedReverse =
  clone(de);

tamperedReverse.alternates =
  tamperedReverse.alternates.map(
    (item) =>
      item.locale.toLowerCase() === "en"
        ? {
            ...item,
            route: "/tampered-en-route",
          }
        : item,
  );

assert.throws(
  () =>
    routeMetadataGate.check(
      tamperedReverse,
    ),
  "V8_ROUTE_METADATA_RECIPROCAL_REVERSE_TAMPER_ACCEPTED",
);

const missingLocale =
  clone(fr);

missingLocale.alternates =
  missingLocale.alternates.filter(
    (item) =>
      item.locale.toLowerCase() !== "de",
  );

assert.throws(
  () =>
    routeMetadataGate.check(
      missingLocale,
    ),
  "V8_ROUTE_METADATA_RECIPROCAL_MISSING_LOCALE_ACCEPTED",
);

const wrongCanonical =
  clone(fr);

wrongCanonical.canonicalRoute =
  "/wrong-fr-canonical";

assert.throws(
  () =>
    routeMetadataGate.check(
      wrongCanonical,
    ),
  "V8_ROUTE_METADATA_RECIPROCAL_WRONG_CANONICAL_ACCEPTED",
);

const nonReciprocal =
  clone(en);

nonReciprocal.alternates =
  nonReciprocal.alternates.map(
    (item) =>
      item.locale.toLowerCase() === "de"
        ? {
            ...item,
            route: "/non-reciprocal-de-route",
          }
        : item,
  );

assert.throws(
  () =>
    routeMetadataGate.check(
      nonReciprocal,
    ),
  "V8_ROUTE_METADATA_RECIPROCAL_NON_RECIPROCAL_ACCEPTED",
);

store.verifyChain();

console.log(
  "[NEXMOLD][V8-18.1] REAL INTERNET CROSS-LOCALE RECIPROCAL HREFLANG GATE PASS",
);

console.log(
  `[V8-18.1] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-18.1] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-18.1] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-18.1] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-18.1] decision=${runtime.decisionId}`,
);

console.log(
  `[V8-18.1] decisionState=${decision.state}`,
);

console.log(
  `[V8-18.1] content=${runtime.content.id}`,
);

console.log(
  `[V8-18.1] projection=${projected.projectionId}`,
);

console.log(
  `[V8-18.1] pages=${localePages.length}`,
);

console.log(
  `[V8-18.1] locales=en,de,fr`,
);

console.log(
  `[V8-18.1] canonical.en=${en.canonicalRoute}`,
);

console.log(
  `[V8-18.1] canonical.de=${de.canonicalRoute}`,
);

console.log(
  `[V8-18.1] canonical.fr=${fr.canonicalRoute}`,
);

console.log(
  "[V8-18.1] enToDe=true",
);

console.log(
  "[V8-18.1] deToEn=true",
);

console.log(
  "[V8-18.1] enToFr=true",
);

console.log(
  "[V8-18.1] frToEn=true",
);

console.log(
  "[V8-18.1] deToFr=true",
);

console.log(
  "[V8-18.1] frToDe=true",
);

console.log(
  "[V8-18.1] canonicalConsistency=true",
);

console.log(
  "[V8-18.1] reciprocalHreflang=true",
);

console.log(
  "[V8-18.1] tamperRejection=true",
);

console.log(
  "[V8-18.1] chainValid=true",
);