import assert from "node:assert/strict";

import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";
import { HttpPageFetcher } from "../.v8-build/src/v8/acquisition/page-fetcher.js";
import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";
import { runV8ArticleRuntime } from "../.v8-build/src/v8/runtime/article-runtime.js";
import { ContentCompiler } from "../.v8-build/src/v8/content-compiler/compiler.js";
import { ProjectionProjector } from "../.v8-build/src/v8/projection/projector.js";
import { RegionalProjectionProjector } from "../.v8-build/src/v8/regional-projection/projector.js";
import {
  RouteMetadataProjector,
  RouteMetadataGate,
} from "../.v8-build/src/v8/route-metadata/index.js";
import { PublicationEligibilityEvaluator } from "../.v8-build/src/v8/publication-eligibility/evaluator.js";

function assertTruthy(value, message) {
  assert.ok(value, message);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

const apiKey = process.env.V8_SEARCH_API_KEY;

assertTruthy(
  apiKey,
  "V8_FINAL_PUBLICATION_SEARCH_API_KEY_MISSING",
);

const store = new InMemoryFoundationStore();

const searchProvider = new TavilySearchProvider(apiKey);
const pageFetcher = new HttpPageFetcher();

const runtime = await runV8ArticleRuntime({
  opportunity: {
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
      "V8-19 final publication eligibility and release integrity",
    ],
  },

  searchProvider,
  pageFetcher,
  store,

  actor: {
    id: "v8:final-publication-gate",
    role: "INGESTOR",
  },

  acquisition: {
    maxQueries: 1,
    maxCandidates: 3,
    actorId: "v8:final-publication-gate",
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
      "V8-19 final publication eligibility and release integrity",
    variables: {
      gate: "V8-19",
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

  title:
    "Plastic Injection Molding Wall Thickness",
});

assert.equal(
  runtime.acquisition.acquisitions.length,
  3,
  "V8_FINAL_PUBLICATION_EXPECTED_THREE_ACQUISITIONS",
);

assert.equal(
  runtime.verifiedEvidenceIds.length,
  3,
  "V8_FINAL_PUBLICATION_EXPECTED_THREE_EVIDENCE",
);

assert.equal(
  runtime.claimIds.length,
  3,
  "V8_FINAL_PUBLICATION_EXPECTED_THREE_CLAIMS",
);

assert.equal(
  runtime.knowledgeIds.length,
  3,
  "V8_FINAL_PUBLICATION_EXPECTED_THREE_KNOWLEDGE",
);

const decision = store.get(
  "DECISION",
  runtime.decisionId,
);

assertTruthy(
  decision,
  "V8_FINAL_PUBLICATION_DECISION_NOT_FOUND",
);

assert.equal(
  decision.state,
  "APPROVED",
  "V8_FINAL_PUBLICATION_DECISION_NOT_APPROVED",
);

const compiler = new ContentCompiler(store);

const compiled = compiler.compile({
  decisionId: runtime.decisionId,
  scopeId: runtime.scopeId,
  contextId: runtime.contextId,
  title: "Plastic Injection Molding Wall Thickness",
});

assert.equal(
  compiled.content.id,
  runtime.content.id,
  "V8_FINAL_PUBLICATION_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.body,
  runtime.content.body,
  "V8_FINAL_PUBLICATION_CONTENT_BODY_MISMATCH",
);

const eligibility =
  new PublicationEligibilityEvaluator(store);

const eligible =
  eligibility.evaluate({
    compiled,
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

assert.equal(
  eligible.status,
  "ELIGIBLE",
  `V8_FINAL_PUBLICATION_ELIGIBILITY_FAILED:${eligible.reasons.join(",")}`,
);

assert.equal(
  eligible.eligible,
  true,
  "V8_FINAL_PUBLICATION_NOT_ELIGIBLE",
);

const tamperedCompiled = clone(compiled);

tamperedCompiled.fingerprint =
  `${tamperedCompiled.fingerprint}-tampered`;

const tamperedEligibility =
  eligibility.evaluate({
    compiled: tamperedCompiled,
    scopeId: runtime.scopeId,
    contextId: runtime.contextId,
  });

assert.equal(
  tamperedEligibility.eligible,
  false,
  "V8_FINAL_PUBLICATION_CONTENT_TAMPER_NOT_REJECTED",
);

assert.ok(
  tamperedEligibility.reasons.includes(
    "CONTENT_FINGERPRINT_MISMATCH",
  ),
  "V8_FINAL_PUBLICATION_CONTENT_TAMPER_REASON_MISSING",
);

const projected =
  new ProjectionProjector(store).project({
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
  "V8_FINAL_PUBLICATION_PROJECTION_MISSING",
);

assert.equal(
  projected.fingerprint,
  projectionRecord.fingerprint,
  "V8_FINAL_PUBLICATION_PROJECTION_FINGERPRINT_MISMATCH",
);

const routes = {
  en:
    "/knowledge/plastic-injection-molding-wall-thickness",

  de:
    "/de/wissen/kunststoff-spritzguss-wanddicke",

  fr:
    "/fr/connaissance/epaisseur-paroi-moulage-injection",
};

const alternates = Object.fromEntries(
  Object.entries(routes).map(
    ([locale]) => [
      locale,
      Object.entries(routes).map(
        ([otherLocale, route]) => ({
          locale: otherLocale,
          route,
        }),
      ),
    ],
  ),
);

const regionalProjector =
  new RegionalProjectionProjector();

const routeMetadataProjector =
  new RouteMetadataProjector();

const routeMetadataGate =
  new RouteMetadataGate();

const pages = [];

for (const locale of [
  "en",
  "de",
  "fr",
]) {
  const regional =
    regionalProjector.project({
      projected,
      region: "GLOBAL",
      locale,
      canonicalRoute: routes[locale],
      alternates: alternates[locale],
    }).regional;

  assert.equal(
    regional.locale,
    locale,
    `V8_FINAL_PUBLICATION_REGIONAL_LOCALE_MISMATCH:${locale}`,
  );

  assert.equal(
    regional.canonicalRoute,
    routes[locale],
    `V8_FINAL_PUBLICATION_REGIONAL_CANONICAL_MISMATCH:${locale}`,
  );

  const regionalSelf =
    regional.alternates.find(
      (item) =>
        item.locale.toLowerCase() ===
        locale.toLowerCase(),
    );

  assertTruthy(
    regionalSelf,
    `V8_FINAL_PUBLICATION_REGIONAL_SELF_MISSING:${locale}`,
  );

  assert.equal(
    regionalSelf.route,
    regional.canonicalRoute,
    `V8_FINAL_PUBLICATION_REGIONAL_SELF_CANONICAL_MISMATCH:${locale}`,
  );

  const routeMetadata =
    routeMetadataProjector.project({
      regional,
      alternates: alternates[locale],
    }).routeMetadata;

  assert.equal(
    routeMetadata.locale,
    locale,
    `V8_FINAL_PUBLICATION_METADATA_LOCALE_MISMATCH:${locale}`,
  );

  assert.equal(
    routeMetadata.canonicalRoute,
    regional.canonicalRoute,
    `V8_FINAL_PUBLICATION_METADATA_CANONICAL_MISMATCH:${locale}`,
  );

  const routeMetadataSelf =
    routeMetadata.alternates.find(
      (item) =>
        item.locale.toLowerCase() ===
        routeMetadata.locale.toLowerCase(),
    );

  assertTruthy(
    routeMetadataSelf,
    `V8_FINAL_PUBLICATION_METADATA_SELF_MISSING:${locale}`,
  );

  assert.equal(
    routeMetadataSelf.route,
    routeMetadata.canonicalRoute,
    `V8_FINAL_PUBLICATION_METADATA_SELF_CANONICAL_MISMATCH:${locale}`,
  );

  for (const expected of alternates[locale]) {
    const actual =
      regional.alternates.find(
        (item) =>
          item.locale.toLowerCase() ===
          expected.locale.toLowerCase(),
      );

    assertTruthy(
      actual,
      `V8_FINAL_PUBLICATION_REGIONAL_ALTERNATE_MISSING:${locale}:${expected.locale}`,
    );

    assert.equal(
      actual.route,
      expected.route,
      `V8_FINAL_PUBLICATION_REGIONAL_ALTERNATE_ROUTE_MISMATCH:${locale}:${expected.locale}`,
    );
  }

  for (const expected of regional.alternates) {
    const actual =
      routeMetadata.alternates.find(
        (item) =>
          item.locale.toLowerCase() ===
          expected.locale.toLowerCase(),
      );

    assertTruthy(
      actual,
      `V8_FINAL_PUBLICATION_METADATA_ALTERNATE_MISSING:${locale}:${expected.locale}`,
    );

    assert.equal(
      actual.route,
      expected.route,
      `V8_FINAL_PUBLICATION_METADATA_ALTERNATE_ROUTE_MISMATCH:${locale}:${expected.locale}`,
    );
  }

  const gateResult =
    routeMetadataGate.check(
      routeMetadata,
    );

  assert.equal(
    gateResult.passed,
    true,
    `V8_FINAL_PUBLICATION_ROUTE_METADATA_BLOCKED:${locale}`,
  );

  pages.push(routeMetadata);
}

assert.equal(
  pages.length,
  3,
  "V8_FINAL_PUBLICATION_ROUTE_PAGE_COUNT_MISMATCH",
);

const tamperedRoute =
  clone(pages[0]);

tamperedRoute.alternates[1].route =
  "/tampered";

let routeTamperRejected =
  false;

try {
  routeMetadataGate.check(
    tamperedRoute,
  );
} catch (error) {
  routeTamperRejected =
    error?.code ===
    "V8_ROUTE_METADATA_CANONICAL_MISMATCH";
}

assert.equal(
  routeTamperRejected,
  true,
  "V8_FINAL_PUBLICATION_ROUTE_TAMPER_NOT_REJECTED",
);

for (const page of pages) {
  const self =
    page.alternates.find(
      (item) =>
        item.locale.toLowerCase() ===
        page.locale.toLowerCase(),
    );

  assertTruthy(
    self,
    `V8_FINAL_PUBLICATION_SELF_LOCALE_MISSING:${page.locale}`,
  );

  assert.equal(
    self.route,
    page.canonicalRoute,
    `V8_FINAL_PUBLICATION_SELF_CANONICAL_MISMATCH:${page.locale}`,
  );

  for (const other of pages) {
    const alternate =
      page.alternates.find(
        (item) =>
          item.locale.toLowerCase() ===
          other.locale.toLowerCase(),
      );

    assertTruthy(
      alternate,
      `V8_FINAL_PUBLICATION_ALTERNATE_MISSING:${page.locale}:${other.locale}`,
    );

    assert.equal(
      alternate.route,
      other.canonicalRoute,
      `V8_FINAL_PUBLICATION_RECIPROCAL_MISMATCH:${page.locale}:${other.locale}`,
    );
  }
}

console.log(
  "[V8-19] REAL INTERNET FINAL PUBLICATION GATE PASS",
);

console.log(
  `[V8-19] acquired=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-19] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-19] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-19] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-19] decisionState=${decision.state}`,
);

console.log(
  `[V8-19] publicationEligibility=${eligible.status}`,
);

console.log(
  `[V8-19] content=${compiled.content.id}`,
);

console.log(
  `[V8-19] projection=${projected.projectionId}`,
);

console.log(
  `[V8-19] routeMetadata=${pages.length === 3}`,
);

console.log(
  "[V8-19] reciprocalHreflang=true",
);

console.log(
  "[V8-19] contentTamperRejection=true",
);

console.log(
  "[V8-19] routeMetadataTamperRejection=true",
);

console.log(
  "[V8-19] finalPublishable=true",
);