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
  runResearchAcquisition,
} from "../.v8-build/src/v8/intelligence/research-planner/acquisition-runner.js";

const searchApiKey =
  typeof process.env.V8_SEARCH_API_KEY === "string"
    ? process.env.V8_SEARCH_API_KEY.trim()
    : "";

assert.ok(
  searchApiKey,
  "V8_SEARCH_API_KEY is required for acquisition diagnostics",
);

const opportunity = Object.freeze({
  keyword: Object.freeze({
    keyword:
      "plastic injection molding wall thickness",
    normalized:
      "plastic injection molding wall thickness",
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

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    searchApiKey,
  );

const pageFetcher =
  new HttpPageFetcher();

console.log(
  "[V8-DIAGNOSTIC] Starting real Internet acquisition diagnostics",
);

console.log(
  `[V8-DIAGNOSTIC] keyword=${opportunity.keyword.keyword}`,
);

const result =
  await runResearchAcquisition(
    opportunity,
    searchProvider,
    pageFetcher,
    store,
    {
      actorId:
        "v8:publication-acquisition-diagnostic",
    },
  );

console.log(
  `[V8-DIAGNOSTIC] plannedQueries=${result.plan.sourceQueries.length}`,
);

const discovery =
  result.discovery;

const discoveryCandidates =
  Array.isArray(discovery?.candidates)
    ? discovery.candidates
    : [];

const discoveryKeys =
  discovery &&
  typeof discovery === "object"
    ? Object.keys(discovery)
    : [];

console.log(
  `[V8-DIAGNOSTIC] discoveryKeys=${JSON.stringify(discoveryKeys)}`,
);

console.log(
  `[V8-DIAGNOSTIC] discoveryCandidates=${discoveryCandidates.length}`,
);

if (
  discovery &&
  typeof discovery === "object"
) {
  console.log(
    `[V8-DIAGNOSTIC] discovery=${JSON.stringify(discovery, null, 2)}`,
  );
}

console.log(
  `[V8-DIAGNOSTIC] acquisitions=${result.acquisitions.length}`,
);

console.log(
  `[V8-DIAGNOSTIC] searchErrors=${result.searchErrors.length}`,
);

for (
  const error of result.searchErrors
) {
  console.log(
    `[V8-DIAGNOSTIC][SEARCH_ERROR] query=${JSON.stringify(error.query ?? "")}`,
  );

  console.log(
    `[V8-DIAGNOSTIC][SEARCH_ERROR] error=${JSON.stringify(error.error)}`,
  );
}

console.log(
  `[V8-DIAGNOSTIC] fetchErrors=${result.fetchErrors.length}`,
);

for (
  const error of result.fetchErrors
) {
  console.log(
    `[V8-DIAGNOSTIC][FETCH_ERROR] url=${JSON.stringify(error.url ?? "")}`,
  );

  console.log(
    `[V8-DIAGNOSTIC][FETCH_ERROR] error=${JSON.stringify(error.error)}`,
  );
}

console.log(
  "[V8-DIAGNOSTIC] Candidate URLs:",
);

for (
  const candidate of discoveryCandidates
) {
  console.log(
    `[V8-DIAGNOSTIC][CANDIDATE] ${candidate.url}`,
  );
}

console.log(
  "[V8-DIAGNOSTIC] Acquired URLs:",
);

for (
  const acquisition of result.acquisitions
) {
  console.log(
    `[V8-DIAGNOSTIC][ACQUIRED] candidateUrl=${acquisition.candidateUrl}`,
  );

  console.log(
    `[V8-DIAGNOSTIC][ACQUIRED] finalUrl=${acquisition.page.finalUrl}`,
  );

  console.log(
    `[V8-DIAGNOSTIC][ACQUIRED] status=${acquisition.page.status}`,
  );
}

if (
  result.searchErrors.length === 0 &&
  result.fetchErrors.length === 0 &&
  result.acquisitions.length > 0
) {
  console.log(
    "[V8-DIAGNOSTIC] ACQUISITION PATH HEALTHY",
  );
} else {
  console.log(
    "[V8-DIAGNOSTIC] ACQUISITION PATH REQUIRES ROOT-CAUSE ANALYSIS",
  );
}

console.log(
  "[V8-DIAGNOSTIC] Complete",
);