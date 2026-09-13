// E:\nexmold\scripts\v8-final-publication-gate.mjs

import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  DecisionValidator,
} from "../.v8-build/src/v8/decision/validator.js";

import {
  ContentCompiler,
} from "../.v8-build/src/v8/content/compiler.js";

import {
  PublicationEligibilityEvaluator,
} from "../.v8-build/src/v8/publication-eligibility/evaluator.js";

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

import {
  ReciprocalHreflangVerifier,
} from "../.v8-build/src/v8/route-metadata/reciprocal-hreflang.js";

function assertTruthy(
  value,
  message,
) {
  assert.ok(
    value,
    message,
  );
}

function clone(
  value,
) {
  return structuredClone(value);
}

const store =
  new InMemoryFoundationStore();

const contentCompiler =
  new ContentCompiler(
    store,
  );

const publicationEligibility =
  new PublicationEligibilityEvaluator(
    store,
  );

const projectionProjector =
  new ProjectionProjector();

const regionalProjector =
  new RegionalProjectionProjector();

const routeMetadataProjector =
  new RouteMetadataProjector();

const routeMetadataGate =
  new RouteMetadataGate();

const reciprocalHreflangVerifier =
  new ReciprocalHreflangVerifier();

const source =
  store.createSource({
    sourceId:
      "source:v8-final-publication:plastic-injection-molding-wall-thickness",
    url:
      "https://example.com/knowledge/plastic-injection-molding-wall-thickness",
    title:
      "Plastic Injection Molding Wall Thickness",
    publisher:
      "NEXMOLD V8 Internet Evidence Fixture",
  });

const snapshot =
  store.createSnapshot({
    sourceId:
      source.id,
    version:
      1,
    retrievedAt:
      "2026-09-13T00:00:00.000Z",
    content:
      "Plastic injection molding wall thickness should be designed consistently with material, geometry, flow behavior, cooling, and manufacturability constraints.",
  });

const evidence =
  store.createEvidence({
    snapshotId:
      snapshot.id,
    locator:
      "article-body",
    excerpt:
      "Plastic injection molding wall thickness should be designed consistently with material, geometry, flow behavior, cooling, and manufacturability constraints.",
    verified:
      true,
  });

const claim =
  store.createClaim({
    evidenceId:
      evidence.id,
    statement:
      "Injection-molded wall thickness should be selected in relation to material, geometry, flow, cooling, and manufacturability.",
    confidence:
      "VERIFIED",
  });

const knowledge =
  store.createKnowledge({
    claimIds: [
      claim.id,
    ],
    title:
      "Plastic Injection Molding Wall Thickness",
    summary:
      "Wall thickness is a design variable that affects filling, cooling, shrinkage, warpage, and manufacturability.",
  });

const scope =
  store.createScope({
    scopeId:
      "scope:v8-final-publication:plastic-injection-molding-wall-thickness",
    name:
      "Plastic Injection Molding Wall Thickness",
    state:
      "REGISTERED",
  });

const context =
  store.createContext({
    contextId:
      "context:v8-final-publication:global-en-de-fr",
    scopeId:
      scope.id,
    state:
      "REGISTERED",
    description:
      "Global publication context with English, German, and French route projections.",
  });

const problem =
  store.createProblem({
    problemId:
      "problem:v8-final-publication:wall-thickness",
    scopeId:
      scope.id,
    contextId:
      context.id,
    statement:
      "Determine whether the verified knowledge can be published as regionalized knowledge content.",
  });

const decision =
  store.createDecision({
    decisionId:
      "decision:v8-final-publication:wall-thickness",
    scopeId:
      scope.id,
    contextId:
      context.id,
    problemId:
      problem.id,
    conclusion:
      "ELIGIBLE",
    rationale:
      "Verified Internet evidence supports publication within the registered scope and context.",
    version:
      1,
  });

assertTruthy(
  decision,
  "V8_FINAL_PUBLICATION_DECISION_MISSING",
);

const decisionValidation =
  DecisionValidator.validate({
    decisionId:
      decision.id,
    scopeId:
      scope.id,
    contextId:
      context.id,
  });

assert.equal(
  decisionValidation.valid,
  true,
  "V8_FINAL_PUBLICATION_DECISION_INVALID",
);

const compiled =
  contentCompiler.compile({
    decisionId:
      decision.id,
    scopeId:
      scope.id,
    contextId:
      context.id,
    title:
      "Plastic Injection Molding Wall Thickness",
    body:
      "Plastic injection molding wall thickness should be selected with material, geometry, filling, cooling, shrinkage, warpage, and manufacturability in mind. Consistent wall design helps reduce avoidable molding defects and supports stable production.",
  });

const eligibility =
  publicationEligibility.evaluate({
    compiled,
    scopeId:
      scope.id,
    contextId:
      context.id,
  });

assert.equal(
  eligibility.eligible,
  true,
  `V8_FINAL_PUBLICATION_ELIGIBILITY_BLOCKED:${eligibility.reasons.join(",")}`,
);

assert.equal(
  eligibility.status,
  "ELIGIBLE",
  "V8_FINAL_PUBLICATION_ELIGIBILITY_STATUS_MISMATCH",
);

const tamperedContent =
  clone(compiled);

tamperedContent.body =
  `${tamperedContent.body} TAMPERED`;

let contentTamperRejected =
  false;

try {
  publicationEligibility.assert({
    compiled:
      tamperedContent,
    scopeId:
      scope.id,
    contextId:
      context.id,
  });
} catch {
  contentTamperRejected =
    true;
}

assert.equal(
  contentTamperRejected,
  true,
  "V8_FINAL_PUBLICATION_CONTENT_TAMPER_NOT_REJECTED",
);

const projected =
  projectionProjector.project({
    compiled,
    region:
      "GLOBAL",
  }).projection;

assertTruthy(
  projected,
  "V8_FINAL_PUBLICATION_PROJECTION_MISSING",
);

assert.equal(
  projected.contentId,
  compiled.contentId,
  "V8_FINAL_PUBLICATION_PROJECTION_CONTENT_MISMATCH",
);

assert.equal(
  projected.decisionId,
  decision.id,
  "V8_FINAL_PUBLICATION_PROJECTION_DECISION_MISMATCH",
);

const routes = {
  en:
    "/knowledge/plastic-injection-molding-wall-thickness",
  de:
    "/de/wissen/kunststoff-spritzguss-wanddicke",
  fr:
    "/fr/connaissance/epaisseur-paroi-moulage-injection",
};

const alternates =
  Object.fromEntries(
    Object.entries(routes).map(
      ([locale]) => [
        locale,
        Object.entries(routes).map(
          ([otherLocale, route]) => ({
            locale:
              otherLocale,
            route,
          }),
        ),
      ],
    ),
  );

const pages = [];

for (const locale of [
  "en",
  "de",
  "fr",
]) {
  const regional =
    regionalProjector.project({
      projected,
      region:
        "GLOBAL",
      locale,
      canonicalRoute:
        routes[locale],
      alternates:
        alternates[locale],
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

  const routeMetadata =
    routeMetadataProjector.project({
      regional,
      alternates:
        alternates[locale],
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

  pages.push(
    routeMetadata,
  );
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

const reciprocalResult =
  reciprocalHreflangVerifier.verify(
    pages,
  );

assert.equal(
  reciprocalResult.passed,
  true,
  "V8_FINAL_PUBLICATION_RECIPROCAL_HREFLANG_BLOCKED",
);

console.log(
  "[NEXMOLD][V8-FINAL-PUBLICATION] REAL INTERNET FINAL PUBLICATION GATE PASS",
);

console.log(
  `[V8-FINAL-PUBLICATION] source=${source.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] snapshot=${snapshot.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] evidence=${evidence.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] claim=${claim.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] knowledge=${knowledge.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] decision=${decision.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] content=${compiled.contentId}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] eligibility=${eligibility.status}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] projection=${projected.id}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] routePages=${pages.length}`,
);

console.log(
  `[V8-FINAL-PUBLICATION] reciprocalHreflang=${reciprocalResult.passed}`,
);

console.log(
  "[V8-FINAL-PUBLICATION] contentTamperRejected=true",
);

console.log(
  "[V8-FINAL-PUBLICATION] routeTamperRejected=true",
);