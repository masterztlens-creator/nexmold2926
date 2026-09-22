import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import { InMemoryFoundationStore } from "../src/v8/foundation/store.ts";
import { HttpPageFetcher } from "../src/v8/acquisition/http-page-fetcher.ts";
import { TavilySearchProvider } from "../src/v8/acquisition/tavily-search-provider.ts";
import { runV8ArticleRuntime } from "../src/v8/runtime/article-runtime.ts";
import { ContentCompiler } from "../src/v8/content-compiler/compiler.ts";
import { ProjectionProjector } from "../src/v8/projection/projector.ts";
import { RegionalProjectionProjector } from "../src/v8/regional-projection/projector.ts";
import { RouteMetadataProjector } from "../src/v8/route-metadata/projector.ts";
import { PublicationEligibilityEvaluator } from "../src/v8/publication-eligibility/evaluator.ts";

const searchApiKey = process.env.V8_SEARCH_API_KEY;

assert.ok(
  searchApiKey,
  "V8_SEARCH_API_KEY is required for the real Internet publication gate",
);

const store = new InMemoryFoundationStore();

const searchProvider = new TavilySearchProvider({
  apiKey: searchApiKey,
});

const pageFetcher = new HttpPageFetcher();

const runtime = await runV8ArticleRuntime({
  store,
  searchProvider,
  pageFetcher,
  keyword: "plastic injection molding wall thickness",
  scope: {
    id: "scope:global:injection-molding",
    type: "GLOBAL",
    domain: "injection-molding",
  },
  context: {
    id: "context:engineering:injection-molding",
    scopeId: "scope:global:injection-molding",
    description:
      "Engineering guidance for plastic injection molding wall thickness.",
  },
  problem: {
    id: "problem:plastic-injection-molding-wall-thickness",
    contextId: "context:engineering:injection-molding",
    statement:
      "Determine applicable engineering guidance for plastic injection molding wall thickness.",
  },
  title: "Plastic Injection Molding Wall Thickness",
});

assert.ok(
  runtime.acquisition.length > 0,
  "V8_REAL_PUBLICATION_ACQUISITION_EMPTY",
);

assert.ok(
  runtime.evidence.length > 0,
  "V8_REAL_PUBLICATION_EVIDENCE_EMPTY",
);

assert.ok(
  runtime.claims.length > 0,
  "V8_REAL_PUBLICATION_CLAIMS_EMPTY",
);

assert.ok(
  runtime.knowledge.length > 0,
  "V8_REAL_PUBLICATION_KNOWLEDGE_EMPTY",
);

assert.equal(
  runtime.decision.status,
  "APPROVED",
  "V8_REAL_PUBLICATION_DECISION_NOT_APPROVED",
);

console.log(
  `[V8-REAL] acquisition=${runtime.acquisition.length}`,
);

console.log(
  `[V8-REAL] evidence=${runtime.evidence.length}`,
);

console.log(
  `[V8-REAL] claims=${runtime.claims.length}`,
);

console.log(
  `[V8-REAL] knowledge=${runtime.knowledge.length}`,
);

console.log(
  `[V8-REAL] decision=${runtime.decision.status}`,
);

const compiler = new ContentCompiler(store);

const compiled = compiler.compile({
  decision: runtime.decision,
  problem: runtime.problem,
  context: runtime.context,
  scope: runtime.scope,
  title: "Plastic Injection Molding Wall Thickness",
});

assert.equal(
  compiled.decisionId,
  runtime.decision.id,
  "V8_REAL_PUBLICATION_CONTENT_DECISION_MISMATCH",
);

assert.equal(
  compiled.contextId,
  runtime.context.id,
  "V8_REAL_PUBLICATION_CONTENT_CONTEXT_MISMATCH",
);

assert.equal(
  compiled.scopeId,
  runtime.scope.id,
  "V8_REAL_PUBLICATION_CONTENT_SCOPE_MISMATCH",
);

assert.ok(
  compiled.body.length > 0,
  "V8_REAL_PUBLICATION_CONTENT_BODY_EMPTY",
);

console.log(
  `[V8-REAL] content=${compiled.id}`,
);

const eligibilityEvaluator =
  new PublicationEligibilityEvaluator(store);

const eligibility = eligibilityEvaluator.evaluate({
  content: compiled,
  decision: runtime.decision,
  scope: runtime.scope,
  context: runtime.context,
});

assert.equal(
  eligibility.status,
  "ELIGIBLE",
  "V8_REAL_PUBLICATION_NOT_ELIGIBLE",
);

assert.equal(
  eligibility.eligible,
  true,
  "V8_REAL_PUBLICATION_ELIGIBILITY_FALSE",
);

console.log(
  `[V8-REAL] eligibility=${eligibility.status}`,
);

const projectionProjector =
  new ProjectionProjector(store);

const projected = await projectionProjector.project({
  compiled,
  scopeId: runtime.scope.id,
  contextId: runtime.context.id,
});

assert.equal(
  projected.contentId,
  compiled.id,
  "V8_REAL_PUBLICATION_PROJECTION_CONTENT_MISMATCH",
);

assert.equal(
  projected.decisionId,
  runtime.decision.id,
  "V8_REAL_PUBLICATION_PROJECTION_DECISION_MISMATCH",
);

assert.equal(
  projected.scopeId,
  runtime.scope.id,
  "V8_REAL_PUBLICATION_PROJECTION_SCOPE_MISMATCH",
);

assert.equal(
  projected.contextId,
  runtime.context.id,
  "V8_REAL_PUBLICATION_PROJECTION_CONTEXT_MISMATCH",
);

assert.ok(
  projected.fingerprint &&
    /^[a-f0-9]{64}$/.test(projected.fingerprint),
  "V8_REAL_PUBLICATION_PROJECTION_FINGERPRINT_INVALID",
);

console.log(
  `[V8-REAL] projection=${projected.projectionId}`,
);

console.log(
  `[V8-REAL] projectionFingerprint=${projected.fingerprint}`,
);

const regionalProjector =
  new RegionalProjectionProjector(store);

const regionalProjections = [];

for (const region of [
  {
    region: "GLOBAL",
    locale: "en",
    canonicalRoute:
      "/knowledge/plastic-injection-molding-wall-thickness/",
  },
  {
    region: "EU",
    locale: "de",
    canonicalRoute:
      "/de/wissen/plastic-injection-molding-wall-thickness/",
  },
  {
    region: "EU",
    locale: "fr",
    canonicalRoute:
      "/fr/knowledge/plastic-injection-molding-wall-thickness/",
  },
]) {
  const regional = await regionalProjector.project({
    projection: projected,
    region: region.region,
    locale: region.locale,
    canonicalRoute: region.canonicalRoute,
  });

  assert.equal(
    regional.projectionId,
    projected.projectionId,
    "V8_REAL_PUBLICATION_REGIONAL_PROJECTION_MISMATCH",
  );

  assert.equal(
    regional.contentId,
    projected.contentId,
    "V8_REAL_PUBLICATION_REGIONAL_CONTENT_MISMATCH",
  );

  assert.equal(
    regional.decisionId,
    projected.decisionId,
    "V8_REAL_PUBLICATION_REGIONAL_DECISION_MISMATCH",
  );

  assert.equal(
    regional.scopeId,
    projected.scopeId,
    "V8_REAL_PUBLICATION_REGIONAL_SCOPE_MISMATCH",
  );

  assert.equal(
    regional.contextId,
    projected.contextId,
    "V8_REAL_PUBLICATION_REGIONAL_CONTEXT_MISMATCH",
  );

  assert.ok(
    regional.fingerprint &&
      /^[a-f0-9]{64}$/.test(regional.fingerprint),
    "V8_REAL_PUBLICATION_REGIONAL_FINGERPRINT_INVALID",
  );

  regionalProjections.push(regional);
}

assert.equal(
  regionalProjections.length,
  3,
  "V8_REAL_PUBLICATION_REGIONAL_PROJECTION_COUNT_INVALID",
);

const routeMetadataProjector =
  new RouteMetadataProjector(store);

const pages = [];

for (const regional of regionalProjections) {
  const metadata = await routeMetadataProjector.project({
    regionalProjection: regional,
  });

  pages.push(metadata);
}

assert.equal(
  pages.length,
  regionalProjections.length,
  "V8_REAL_PUBLICATION_ROUTE_METADATA_COUNT_INVALID",
);

const routes = new Set();

for (const page of pages) {
  assert.ok(
    page.canonicalRoute.startsWith("/"),
    "V8_REAL_PUBLICATION_CANONICAL_ROUTE_INVALID",
  );

  assert.ok(
    !routes.has(page.canonicalRoute),
    `V8_REAL_PUBLICATION_DUPLICATE_ROUTE:${page.canonicalRoute}`,
  );

  routes.add(page.canonicalRoute);

  assert.ok(
    page.fingerprint &&
      /^[a-f0-9]{64}$/.test(page.fingerprint),
    `V8_REAL_PUBLICATION_ROUTE_METADATA_FINGERPRINT_INVALID:${page.canonicalRoute}`,
  );

  assert.ok(
    Array.isArray(page.alternates),
    `V8_REAL_PUBLICATION_ALTERNATES_INVALID:${page.canonicalRoute}`,
  );
}

for (const page of pages) {
  const reciprocalLocales = new Set(
    page.alternates.map((alternate) => alternate.locale),
  );

  assert.equal(
    reciprocalLocales.size,
    pages.length,
    `V8_REAL_PUBLICATION_HREFLANG_INCOMPLETE:${page.canonicalRoute}`,
  );
}

console.log(
  `[V8-REAL] regionalProjections=${regionalProjections.length}`,
);

console.log(
  `[V8-REAL] routeMetadata=${pages.length}`,
);

console.log(
  "[V8-REAL] reciprocal hreflang validation: PASS",
);

/*
 * --------------------------------------------------------------------------
 * Canonical Real Internet Publication Handoff
 * --------------------------------------------------------------------------
 *
 * This file is deliberately generated outside src/v8/.
 *
 * It binds the real Internet runtime chain to the exact Projection and
 * regional route metadata that the later production closure gate will verify.
 *
 * The handoff is not a ReleaseArtifact.
 * It is the boundary artifact between the real publication gate and the
 * subsequent actual-dist production closure.
 * --------------------------------------------------------------------------
 */

function canonicalHandoffPayload(value) {
  return JSON.stringify(value);
}

function sha256Text(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

const handoffPages = pages
  .map((page) => {
    const regional = regionalProjections.find(
      (candidate) =>
        candidate.locale === page.locale &&
        candidate.canonicalRoute === page.canonicalRoute,
    );

    assert.ok(
      regional,
      `V8_HANDOFF_REGIONAL_PROJECTION_NOT_FOUND:${page.canonicalRoute}`,
    );

    return {
      locale: page.locale,
      region: regional.region,
      canonicalRoute: page.canonicalRoute,
      regionalProjectionId: regional.id,
      regionalProjectionFingerprint: regional.fingerprint,
      routeMetadataFingerprint: page.fingerprint,
    };
  })
  .sort((a, b) =>
    `${a.locale}:${a.canonicalRoute}`.localeCompare(
      `${b.locale}:${b.canonicalRoute}`,
    ),
  );

const handoffPayload = {
  schema: "nexmold.v8.real-publication-handoff.v1",

  contentId: projected.contentId,
  decisionId: projected.decisionId,

  projectionId: projected.projectionId,
  projectionFingerprint: projected.fingerprint,

  scopeId: projected.scopeId,
  contextId: projected.contextId,

  pages: handoffPages,
};

const handoffCanonical =
  canonicalHandoffPayload(handoffPayload);

const handoff = {
  ...handoffPayload,
  fingerprint: sha256Text(handoffCanonical),
};

assert.ok(
  /^[a-f0-9]{64}$/.test(handoff.fingerprint),
  "V8_HANDOFF_FINGERPRINT_INVALID",
);

const handoffDirectory =
  path.resolve(".nexmold");

fs.mkdirSync(handoffDirectory, {
  recursive: true,
});

const handoffPath =
  path.join(
    handoffDirectory,
    "v8-real-publication-handoff.json",
  );

fs.writeFileSync(
  handoffPath,
  `${JSON.stringify(handoff, null, 2)}\n`,
  "utf8",
);

assert.ok(
  fs.existsSync(handoffPath),
  "V8_FINAL_PUBLICATION_HANDOFF_NOT_WRITTEN",
);

const persistedHandoff =
  JSON.parse(
    fs.readFileSync(handoffPath, "utf8"),
  );

assert.deepEqual(
  persistedHandoff,
  handoff,
  "V8_FINAL_PUBLICATION_HANDOFF_PERSISTENCE_MISMATCH",
);

console.log(
  "[V8-HANDOFF] Real Internet publication handoff: PASS",
);

console.log(
  `[V8-HANDOFF] content=${handoff.contentId}`,
);

console.log(
  `[V8-HANDOFF] decision=${handoff.decisionId}`,
);

console.log(
  `[V8-HANDOFF] projection=${handoff.projectionId}`,
);

console.log(
  `[V8-HANDOFF] projectionFingerprint=${handoff.projectionFingerprint}`,
);

console.log(
  `[V8-HANDOFF] pages=${handoff.pages.length}`,
);

console.log(
  `[V8-HANDOFF] fingerprint=${handoff.fingerprint}`,
);

const chainVerification =
  store.verifyChain();

assert.equal(
  chainVerification.valid,
  true,
  "V8_REAL_PUBLICATION_FOUNDATION_CHAIN_INVALID",
);

console.log(
  "[V8-REAL] Foundation chain verification: PASS",
);

console.log(
  "[V8-FINAL-PUBLICATION] REAL INTERNET PUBLICATION GATE PASS",
);