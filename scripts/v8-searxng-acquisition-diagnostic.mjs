import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  SearXNGSearchProvider,
} from "../.v8-build/src/v8/acquisition/searxng-search-provider.js";

import {
  runResearchAcquisition,
} from "../.v8-build/src/v8/intelligence/research-planner/acquisition-runner.js";

const endpoint =
  typeof process.env.V8_SEARCH_ENDPOINT === "string"
    ? process.env.V8_SEARCH_ENDPOINT.trim()
    : "";

assert.ok(
  endpoint,
  "V8_SEARCH_ENDPOINT is required for SearXNG acquisition diagnostics",
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
  new SearXNGSearchProvider({
    endpoint,
    language: "en",
    categories: "general",
    page: 1,
    safeSearch: 0,
  });

const pageFetcher =
  new HttpPageFetcher();

console.log(
  "[V8-SEARXNG-DIAGNOSTIC] Starting real SearXNG acquisition diagnostics",
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] endpoint=${endpoint}`,
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] provider=${searchProvider.name}`,
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] keyword=${opportunity.keyword.keyword}`,
);

const result =
  await runResearchAcquisition(
    opportunity,
    searchProvider,
    pageFetcher,
    store,
    {
      actorId:
        "v8:searxng-acquisition-diagnostic",
    },
  );

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] plannedQueries=${result.plan.sourceQueries.length}`,
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] discoveryKeys=${JSON.stringify(
    Object.keys(result.discovery),
  )}`,
);

const candidates =
  Array.isArray(result.discovery?.candidates)
    ? result.discovery.candidates
    : [];

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] discoveryCandidates=${candidates.length}`,
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] discoveryAccepted=${result.discovery.accepted}`,
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] discoveryRejected=${result.discovery.rejected}`,
);

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] searchErrors=${result.searchErrors.length}`,
);

for (
  const error of result.searchErrors
) {
  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][SEARCH_ERROR] query=${JSON.stringify(
      error.query ?? "",
    )}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][SEARCH_ERROR] error=${JSON.stringify(
      error.error,
    )}`,
  );
}

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] fetchErrors=${result.fetchErrors.length}`,
);

for (
  const error of result.fetchErrors
) {
  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][FETCH_ERROR] url=${JSON.stringify(
      error.url ?? "",
    )}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][FETCH_ERROR] error=${JSON.stringify(
      error.error,
    )}`,
  );
}

console.log(
  `[V8-SEARXNG-DIAGNOSTIC] acquisitions=${result.acquisitions.length}`,
);

console.log(
  "[V8-SEARXNG-DIAGNOSTIC] Candidate URLs:",
);

for (
  const candidate of candidates
) {
  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][CANDIDATE] ${candidate.url}`,
  );

  if (
    typeof candidate.title === "string" &&
    candidate.title.trim()
  ) {
    console.log(
      `[V8-SEARXNG-DIAGNOSTIC][CANDIDATE_TITLE] ${candidate.title.trim()}`,
    );
  }
}

console.log(
  "[V8-SEARXNG-DIAGNOSTIC] Acquired URLs:",
);

for (
  const acquisition of result.acquisitions
) {
  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][ACQUIRED] candidateUrl=${acquisition.candidateUrl}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][ACQUIRED] requestedUrl=${acquisition.page.requestedUrl}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][ACQUIRED] finalUrl=${acquisition.page.finalUrl}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][ACQUIRED] status=${acquisition.page.status}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][ACQUIRED] mediaType=${acquisition.page.mediaType}`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC][ACQUIRED] evidence=${acquisition.acquisition.evidence.length}`,
  );
}

const healthy =
  result.searchErrors.length === 0 &&
  result.fetchErrors.length === 0 &&
  result.acquisitions.length > 0;

if (healthy) {
  console.log(
    "[V8-SEARXNG-DIAGNOSTIC] SEARCH PATH HEALTHY",
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC] searchErrors=0`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC] fetchErrors=0`,
  );

  console.log(
    `[V8-SEARXNG-DIAGNOSTIC] acquisitions=${result.acquisitions.length}`,
  );

  process.exitCode = 0;
} else {
  console.error(
    "[V8-SEARXNG-DIAGNOSTIC] SEARCH PATH FAILED",
  );

  console.error(
    `[V8-SEARXNG-DIAGNOSTIC] searchErrors=${result.searchErrors.length}`,
  );

  console.error(
    `[V8-SEARXNG-DIAGNOSTIC] fetchErrors=${result.fetchErrors.length}`,
  );

  console.error(
    `[V8-SEARXNG-DIAGNOSTIC] acquisitions=${result.acquisitions.length}`,
  );

  process.exitCode = 1;
}

console.log(
  "[V8-SEARXNG-DIAGNOSTIC] Complete",
);