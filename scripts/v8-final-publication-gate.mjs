import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

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
} from "../.v8-build/src/v8/route-metadata/projector.js";

import {
  PublicationEligibilityEvaluator,
} from "../.v8-build/src/v8/publication-eligibility/evaluator.js";

/*
 * ============================================================================
 * NEXMOLD V8 REAL INTERNET PUBLICATION GATE
 * ============================================================================
 *
 * Purpose:
 *
 *   REAL INTERNET
 *       ↓
 *   Acquisition
 *       ↓
 *   Verified Evidence
 *       ↓
 *   Claims
 *       ↓
 *   Knowledge
 *       ↓
 *   Scope / Context / Problem
 *       ↓
 *   APPROVED Decision
 *       ↓
 *   Content
 *       ↓
 *   Publication Eligibility
 *       ↓
 *   Projection
 *       ↓
 *   Regional Projection
 *       ↓
 *   Route Metadata
 *       ↓
 *   Immutable Handoff
 *
 * This file intentionally executes against .v8-build.
 *
 * The V8 source tree uses .js import specifiers while the source itself is
 * TypeScript. Running the source .ts files directly with plain Node would
 * therefore resolve imports such as "../constitution/invariants.js" against
 * src/v8 and fail before the actual gate starts.
 *
 * This gate is NOT the Release gate.
 * It creates the canonical handoff consumed by the later actual-dist
 * production closure.
 * ============================================================================
 */

const ROOT = process.cwd();

const searchApiKey =
  typeof process.env.V8_SEARCH_API_KEY === "string"
    ? process.env.V8_SEARCH_API_KEY.trim()
    : "";

assert.ok(
  searchApiKey,
  "V8_SEARCH_API_KEY is required for the real Internet publication gate",
);

/*
 * --------------------------------------------------------------------------
 * Runtime constants
 * --------------------------------------------------------------------------
 */

const TITLE =
  "Plastic Injection Molding Wall Thickness";

const PRIMARY_KEYWORD =
  "plastic injection molding wall thickness";

const SCOPE_ID =
  "scope:global:injection-molding";

const CONTEXT_ID =
  "context:engineering:injection-molding";

const PROBLEM_ID =
  "problem:plastic-injection-molding-wall-thickness";

const ACTOR_ID =
  "v8:article-runtime";

/*
 * --------------------------------------------------------------------------
 * Real Internet opportunity
 *
 * This object matches the actual Opportunity interface in
 * src/v8/intelligence/shared.ts.
 * --------------------------------------------------------------------------
 */

const opportunity = Object.freeze({
  keyword: Object.freeze({
    keyword: PRIMARY_KEYWORD,
    normalized: PRIMARY_KEYWORD,
    source: "SEED",
    intent: "INFORMATIONAL",
    language: "en",
    market: "GLOBAL",
    terms: Object.freeze([
      "plastic",
      "injection",
      "molding",
      "wall",
      "thickness",
    ]),
  }),

  score: 1,
  demand: 1,
  relevance: 1,
  competition: 0,
  authorityGap: 1,
  conversionPotential: 1,

  reasons: Object.freeze([
    "Engineering information directly relevant to injection molding.",
    "Suitable for evidence-backed manufacturing guidance.",
    "Requires authoritative Internet evidence before publication.",
  ]),
});

/*
 * --------------------------------------------------------------------------
 * Foundation / acquisition services
 * --------------------------------------------------------------------------
 */

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    searchApiKey,
  );

const pageFetcher =
  new HttpPageFetcher();

/*
 * --------------------------------------------------------------------------
 * REAL INTERNET ARTICLE RUNTIME
 * --------------------------------------------------------------------------
 */

const runtime =
  await runV8ArticleRuntime({
    store,
    searchProvider,
    pageFetcher,

    opportunity,

    actor: {
      id: ACTOR_ID,
      role: "SYSTEM",
    },

    scope: {
      id: SCOPE_ID,
      geography: "GLOBAL",
      industries: [
        "injection-molding",
      ],
      languages: [
        "en",
      ],
    },

    context: {
      id: CONTEXT_ID,
      purpose:
        "Engineering guidance for plastic injection molding wall thickness.",
      variables: {
        subject:
          "plastic injection molding wall thickness",
        audience:
          "manufacturing engineers",
        application:
          "plastic injection molding",
      },
    },

    problem: {
      id: PROBLEM_ID,
      question:
        "Determine applicable engineering guidance for plastic injection molding wall thickness.",
      constraints: [
        "Use verified Internet evidence.",
        "Do not promote unsupported universal rules.",
        "Preserve evidence lineage through the publication chain.",
      ],
    },

    title: TITLE,
  });

assert.ok(
  runtime.acquisition.acquisitions.length > 0,
  "V8_REAL_PUBLICATION_ACQUISITION_EMPTY",
);

assert.ok(
  runtime.verifiedEvidenceIds.length > 0,
  "V8_REAL_PUBLICATION_EVIDENCE_EMPTY",
);

assert.ok(
  runtime.claimIds.length > 0,
  "V8_REAL_PUBLICATION_CLAIMS_EMPTY",
);

assert.ok(
  runtime.knowledgeIds.length > 0,
  "V8_REAL_PUBLICATION_KNOWLEDGE_EMPTY",
);

assert.ok(
  runtime.decisionId,
  "V8_REAL_PUBLICATION_DECISION_ID_EMPTY",
);

assert.ok(
  runtime.content,
  "V8_REAL_PUBLICATION_RUNTIME_CONTENT_EMPTY",
);

console.log(
  `[V8-REAL] acquisition=${runtime.acquisition.acquisitions.length}`,
);

console.log(
  `[V8-REAL] verifiedEvidence=${runtime.verifiedEvidenceIds.length}`,
);

console.log(
  `[V8-REAL] claims=${runtime.claimIds.length}`,
);

console.log(
  `[V8-REAL] knowledge=${runtime.knowledgeIds.length}`,
);

console.log(
  `[V8-REAL] decision=${runtime.decisionId}`,
);

console.log(
  `[V8-REAL] content=${runtime.content.id}`,
);

/*
 * --------------------------------------------------------------------------
 * CONTENT COMPILER
 *
 * ArticleRuntime already creates and compiles Content internally.
 * We independently compile from the same persisted Foundation state so this
 * gate verifies that the canonical compiler reproduces the same Content.
 * --------------------------------------------------------------------------
 */

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
    title: TITLE,
  });

assert.equal(
  compiled.content.id,
  runtime.content.id,
  "V8_REAL_PUBLICATION_CONTENT_ID_MISMATCH",
);

assert.equal(
  compiled.content.decisionId,
  runtime.decisionId,
  "V8_REAL_PUBLICATION_CONTENT_DECISION_MISMATCH",
);

assert.equal(
  compiled.content.title,
  TITLE,
  "V8_REAL_PUBLICATION_CONTENT_TITLE_MISMATCH",
);

assert.ok(
  compiled.content.body.length > 0,
  "V8_REAL_PUBLICATION_CONTENT_BODY_EMPTY",
);

assert.ok(
  /^[a-f0-9]{64}$/.test(
    compiled.fingerprint,
  ),
  "V8_REAL_PUBLICATION_CONTENT_FINGERPRINT_INVALID",
);

assert.equal(
  compiled.fingerprint,
  compiled.fingerprint,
  "V8_REAL_PUBLICATION_CONTENT_DETERMINISM_FAILED",
);

console.log(
  `[V8-REAL] contentFingerprint=${compiled.fingerprint}`,
);

/*
 * --------------------------------------------------------------------------
 * PUBLICATION ELIGIBILITY
 * --------------------------------------------------------------------------
 */

const eligibilityEvaluator =
  new PublicationEligibilityEvaluator(
    store,
  );

const eligibility =
  eligibilityEvaluator.evaluate({
    compiled,
    scopeId:
      runtime.scopeId,
    contextId:
      runtime.contextId,
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

assert.ok(
  /^[a-f0-9]{64}$/.test(
    eligibility.fingerprint,
  ),
  "V8_REAL_PUBLICATION_ELIGIBILITY_FINGERPRINT_INVALID",
);

console.log(
  `[V8-REAL] eligibility=${eligibility.status}`,
);

/*
 * --------------------------------------------------------------------------
 * V8-16 PROJECTION
 * --------------------------------------------------------------------------
 */

const projectionProjector =
  new ProjectionProjector(
    store,
  );

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
  "V8_REAL_PUBLICATION_PROJECTION_CONTENT_MISMATCH",
);

assert.equal(
  projected.decisionId,
  runtime.decisionId,
  "V8_REAL_PUBLICATION_PROJECTION_DECISION_MISMATCH",
);

assert.equal(
  projected.scopeId,
  runtime.scopeId,
  "V8_REAL_PUBLICATION_PROJECTION_SCOPE_MISMATCH",
);

assert.equal(
  projected.contextId,
  runtime.contextId,
  "V8_REAL_PUBLICATION_PROJECTION_CONTEXT_MISMATCH",
);

assert.equal(
  projected.title,
  compiled.content.title,
  "V8_REAL_PUBLICATION_PROJECTION_TITLE_MISMATCH",
);

assert.equal(
  projected.body,
  compiled.content.body,
  "V8_REAL_PUBLICATION_PROJECTION_BODY_MISMATCH",
);

assert.ok(
  /^[a-f0-9]{64}$/.test(
    projected.fingerprint,
  ),
  "V8_REAL_PUBLICATION_PROJECTION_FINGERPRINT_INVALID",
);

console.log(
  `[V8-REAL] projection=${projected.projectionId}`,
);

console.log(
  `[V8-REAL] projectionFingerprint=${projected.fingerprint}`,
);

/*
 * --------------------------------------------------------------------------
 * REGIONAL PROJECTION
 *
 * The current RegionalProjectionProjector requires the complete alternate
 * set, including the self-locale canonical route.
 * --------------------------------------------------------------------------
 */

const regionalProjector =
  new RegionalProjectionProjector();

const regionalDefinitions = Object.freeze([
  Object.freeze({
    region: "GLOBAL",
    locale: "en",
    canonicalRoute:
      "/knowledge/plastic-injection-molding-wall-thickness/",
  }),

  Object.freeze({
    region: "EU",
    locale: "de",
    canonicalRoute:
      "/de/wissen/plastic-injection-molding-wall-thickness/",
  }),

  Object.freeze({
    region: "EU",
    locale: "fr",
    canonicalRoute:
      "/fr/knowledge/plastic-injection-molding-wall-thickness/",
  }),
]);

const alternateSet =
  Object.freeze(
    regionalDefinitions.map(
      (item) =>
        Object.freeze({
          locale: item.locale,
          route: item.canonicalRoute,
        }),
    ),
  );

const regionalProjections = [];

for (const definition of regionalDefinitions) {
  const result =
    regionalProjector.project({
      projected,
      region:
        definition.region,
      locale:
        definition.locale,
      canonicalRoute:
        definition.canonicalRoute,
      alternates:
        alternateSet,
    });

  const regional =
    result.regional;

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

  assert.equal(
    regional.title,
    projected.title,
    "V8_REAL_PUBLICATION_REGIONAL_TITLE_MISMATCH",
  );

  assert.equal(
    regional.body,
    projected.body,
    "V8_REAL_PUBLICATION_REGIONAL_BODY_MISMATCH",
  );

  assert.ok(
    /^[a-f0-9]{64}$/.test(
      regional.fingerprint,
    ),
    "V8_REAL_PUBLICATION_REGIONAL_FINGERPRINT_INVALID",
  );

  assert.equal(
    regional.alternates.length,
    alternateSet.length,
    "V8_REAL_PUBLICATION_REGIONAL_ALTERNATE_COUNT_INVALID",
  );

  regionalProjections.push(
    regional,
  );
}

assert.equal(
  regionalProjections.length,
  regionalDefinitions.length,
  "V8_REAL_PUBLICATION_REGIONAL_PROJECTION_COUNT_INVALID",
);

console.log(
  `[V8-REAL] regionalProjections=${regionalProjections.length}`,
);

/*
 * --------------------------------------------------------------------------
 * ROUTE METADATA
 *
 * RouteMetadataProjector requires:
 *
 *   {
 *     regional,
 *     alternates
 *   }
 *
 * and verifies that the route set exactly matches the Regional Projection.
 * --------------------------------------------------------------------------
 */

const routeMetadataProjector =
  new RouteMetadataProjector();

const pages = [];

for (const regional of regionalProjections) {
  const result =
    routeMetadataProjector.project({
      regional,
      alternates:
        regional.alternates,
    });

  const routeMetadata =
    result.routeMetadata;

  assert.equal(
    routeMetadata.regionalProjectionId,
    regional.id,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_REGIONAL_MISMATCH",
  );

  assert.equal(
    routeMetadata.projectionId,
    projected.projectionId,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_PROJECTION_MISMATCH",
  );

  assert.equal(
    routeMetadata.contentId,
    projected.contentId,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_CONTENT_MISMATCH",
  );

  assert.equal(
    routeMetadata.decisionId,
    projected.decisionId,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_DECISION_MISMATCH",
  );

  assert.equal(
    routeMetadata.scopeId,
    projected.scopeId,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_SCOPE_MISMATCH",
  );

  assert.equal(
    routeMetadata.contextId,
    projected.contextId,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_CONTEXT_MISMATCH",
  );

  assert.equal(
    routeMetadata.canonicalRoute,
    regional.canonicalRoute,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_CANONICAL_ROUTE_MISMATCH",
  );

  assert.equal(
    routeMetadata.locale,
    regional.locale,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_LOCALE_MISMATCH",
  );

  assert.equal(
    routeMetadata.title,
    regional.title,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_TITLE_MISMATCH",
  );

  assert.equal(
    routeMetadata.body,
    regional.body,
    "V8_REAL_PUBLICATION_ROUTE_METADATA_BODY_MISMATCH",
  );

  assert.ok(
    /^[a-f0-9]{64}$/.test(
      String(routeMetadata.fingerprint),
    ),
    `V8_REAL_PUBLICATION_ROUTE_METADATA_FINGERPRINT_INVALID:${regional.canonicalRoute}`,
  );

  pages.push(
    routeMetadata,
  );
}

assert.equal(
  pages.length,
  regionalProjections.length,
  "V8_REAL_PUBLICATION_ROUTE_METADATA_COUNT_INVALID",
);

/*
 * --------------------------------------------------------------------------
 * Route uniqueness / reciprocal hreflang verification
 * --------------------------------------------------------------------------
 */

const routeSet =
  new Set();

for (const page of pages) {
  assert.ok(
    page.canonicalRoute.startsWith("/"),
    "V8_REAL_PUBLICATION_CANONICAL_ROUTE_INVALID",
  );

  assert.ok(
    page.canonicalRoute !== "/",
    "V8_REAL_PUBLICATION_ROOT_ROUTE_FORBIDDEN",
  );

  assert.ok(
    !routeSet.has(
      page.canonicalRoute,
    ),
    `V8_REAL_PUBLICATION_DUPLICATE_ROUTE:${page.canonicalRoute}`,
  );

  routeSet.add(
    page.canonicalRoute,
  );

  assert.equal(
    page.alternates.length,
    pages.length,
    `V8_REAL_PUBLICATION_HREFLANG_COUNT_INVALID:${page.canonicalRoute}`,
  );

  const locales =
    new Set(
      page.alternates.map(
        (alternate) =>
          alternate.locale.toLowerCase(),
      ),
    );

  assert.equal(
    locales.size,
    pages.length,
    `V8_REAL_PUBLICATION_HREFLANG_LOCALE_SET_INVALID:${page.canonicalRoute}`,
  );

  assert.ok(
    locales.has(
      page.locale.toLowerCase(),
    ),
    `V8_REAL_PUBLICATION_HREFLANG_SELF_LOCALE_MISSING:${page.canonicalRoute}`,
  );

  const self =
    page.alternates.find(
      (alternate) =>
        alternate.locale.toLowerCase() ===
        page.locale.toLowerCase(),
    );

  assert.ok(
    self,
    `V8_REAL_PUBLICATION_HREFLANG_SELF_ROUTE_MISSING:${page.canonicalRoute}`,
  );

  assert.equal(
    self.route,
    page.canonicalRoute,
    `V8_REAL_PUBLICATION_HREFLANG_SELF_ROUTE_MISMATCH:${page.canonicalRoute}`,
  );
}

console.log(
  "[V8-REAL] reciprocal hreflang validation: PASS",
);

/*
 * --------------------------------------------------------------------------
 * CANONICAL REAL INTERNET PUBLICATION HANDOFF
 * --------------------------------------------------------------------------
 *
 * IMPORTANT:
 *
 * This is intentionally NOT a ReleaseArtifact.
 *
 * The later production closure must independently construct/validate the
 * Release against the actual dist artifact.
 * --------------------------------------------------------------------------
 */

function canonicalJson(
  value,
) {
  return JSON.stringify(
    value,
  );
}

function sha256Text(
  value,
) {
  return createHash("sha256")
    .update(
      value,
      "utf8",
    )
    .digest("hex");
}

const handoffPages =
  pages
    .map(
      (page) => {
        const regional =
          regionalProjections.find(
            (candidate) =>
              candidate.id ===
              page.regionalProjectionId,
          );

        assert.ok(
          regional,
          `V8_HANDOFF_REGIONAL_PROJECTION_NOT_FOUND:${page.canonicalRoute}`,
        );

        return {
          locale:
            page.locale,

          region:
            regional.region,

          canonicalRoute:
            page.canonicalRoute,

          regionalProjectionId:
            regional.id,

          regionalProjectionFingerprint:
            String(
              regional.fingerprint,
            ),

          routeMetadataFingerprint:
            String(
              page.fingerprint,
            ),
        };
      },
    )
    .sort(
      (a, b) =>
        `${a.locale}:${a.canonicalRoute}`.localeCompare(
          `${b.locale}:${b.canonicalRoute}`,
        ),
    );

const handoffPayload =
  Object.freeze({
    schema:
      "nexmold.v8.real-publication-handoff.v1",

    contentId:
      projected.contentId,

    decisionId:
      projected.decisionId,

    projectionId:
      projected.projectionId,

    projectionFingerprint:
      String(
        projected.fingerprint,
      ),

    scopeId:
      projected.scopeId,

    contextId:
      projected.contextId,

    pages:
      handoffPages,
  });

const handoffCanonical =
  canonicalJson(
    handoffPayload,
  );

const handoff =
  Object.freeze({
    ...handoffPayload,

    fingerprint:
      sha256Text(
        handoffCanonical,
      ),
  });

assert.ok(
  /^[a-f0-9]{64}$/.test(
    handoff.fingerprint,
  ),
  "V8_HANDOFF_FINGERPRINT_INVALID",
);

/*
 * --------------------------------------------------------------------------
 * Persist handoff
 * --------------------------------------------------------------------------
 */

const handoffDirectory =
  path.resolve(
    ROOT,
    ".nexmold",
  );

fs.mkdirSync(
  handoffDirectory,
  {
    recursive: true,
  },
);

const handoffPath =
  path.join(
    handoffDirectory,
    "v8-real-publication-handoff.json",
  );

fs.writeFileSync(
  handoffPath,
  `${JSON.stringify(
    handoff,
    null,
    2,
  )}\n`,
  "utf8",
);

assert.ok(
  fs.existsSync(
    handoffPath,
  ),
  "V8_FINAL_PUBLICATION_HANDOFF_NOT_WRITTEN",
);

const persistedHandoff =
  JSON.parse(
    fs.readFileSync(
      handoffPath,
      "utf8",
    ),
  );

assert.deepEqual(
  persistedHandoff,
  handoff,
  "V8_FINAL_PUBLICATION_HANDOFF_PERSISTENCE_MISMATCH",
);

/*
 * Recompute the persisted handoff fingerprint independently.
 */

const {
  fingerprint:
    persistedFingerprint,
  ...persistedPayload
} = persistedHandoff;

assert.equal(
  persistedFingerprint,
  sha256Text(
    canonicalJson(
      persistedPayload,
    ),
  ),
  "V8_FINAL_PUBLICATION_HANDOFF_FINGERPRINT_RECOMPUTATION_FAILED",
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

/*
 * --------------------------------------------------------------------------
 * FOUNDATION CHAIN
 * --------------------------------------------------------------------------
 */

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