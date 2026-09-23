import {
  runResearchAcquisition,
} from "../.v8-build/src/v8/intelligence/research-planner/acquisition-runner.js";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  TavilySearchProvider,
} from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";

const apiKey =
  process.env.V8_SEARCH_API_KEY;

if (!apiKey) {
  throw new Error(
    "V8_ARTICLE_RUNTIME_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}

const opportunity = {
  keyword: {
    keyword:
      "plastic injection molding wall thickness",

    normalized:
      "plastic injection molding wall thickness",

    source:
      "SEED",

    intent:
      "INFORMATIONAL",

    terms: [
      "wall thickness",
      "injection molding",
    ],
  },

  score:
    0.9,

  demand:
    0.8,

  relevance:
    1,

  competition:
    0.3,

  authorityGap:
    0.7,

  conversionPotential:
    0.6,

  reasons: [
    "V8 article runtime real internet acquisition diagnostic",
  ],
};

const store =
  new InMemoryFoundationStore();

const searchProvider =
  new TavilySearchProvider(
    apiKey,
    "https://api.tavily.com/search",
    "v8-article-runtime-diagnostic",
  );

const pageFetcher =
  new HttpPageFetcher({
    timeoutMs:
      20000,

    maxBytes:
      5000000,
  });

console.log(
  "",
);

console.log(
  "================================================================",
);

console.log(
  "[NEXMOLD][V8-ARTICLE-RUNTIME] ACQUISITION DIAGNOSTIC",
);

console.log(
  "================================================================",
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] keyword=${opportunity.keyword.keyword}`,
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] searchProvider=TAVILY",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] sourceMode=REAL_INTERNET",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] maxQueries=1",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] maxCandidates=3",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] timeoutMs=20000",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] maxBytes=5000000",
);

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 1: RESEARCH ACQUISITION",
);

console.log(
  "================================================================",
);

/*
 * IMPORTANT:
 *
 * This file intentionally calls runResearchAcquisition()
 * exactly once.
 *
 * We do NOT call runV8ArticleRuntime() afterward.
 *
 * runV8ArticleRuntime() internally calls the same
 * runResearchAcquisition() function. Calling both would cause:
 *
 *   Search #1
 *   Fetch #1
 *   Diagnostic
 *   Search #2
 *   Fetch #2
 *
 * That would contaminate the diagnostic result.
 *
 * Therefore this workflow is deliberately limited to observing
 * the Acquisition layer.
 */

let acquisition;

try {
  acquisition =
    await runResearchAcquisition(
      opportunity,
      searchProvider,
      pageFetcher,
      store,
      {
        maxQueries:
          1,

        maxCandidates:
          3,

        actorId:
          "v8-article-runtime-diagnostic",
      },
    );
} catch (error) {
  console.error(
    "",
  );

  console.error(
    "================================================================",
  );

  console.error(
    "[NEXMOLD][V8-ARTICLE-RUNTIME] ACQUISITION DIAGNOSTIC ERROR",
  );

  console.error(
    "================================================================",
  );

  console.error(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] error=${error instanceof Error ? error.message : String(error)}`,
  );

  if (
    error instanceof Error &&
    error.stack
  ) {
    console.error(
      "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] stack=",
    );

    console.error(
      error.stack,
    );
  }

  console.error(
    "================================================================",
  );

  throw error;
}

console.log(
  "",
);

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 2: RESEARCH PLAN",
);

console.log(
  "================================================================",
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] sourceQueries.count=${acquisition.plan.sourceQueries.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] sourceQueries=${JSON.stringify(
    acquisition.plan.sourceQueries,
  )}`,
);

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 3: SEARCH RESULT → DISCOVERY",
);

console.log(
  "================================================================",
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] discovery.candidates=${acquisition.discovery.candidates.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] discovery.accepted=${acquisition.discovery.accepted}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] discovery.rejected=${acquisition.discovery.rejected}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] searchErrors=${acquisition.searchErrors.length}`,
);

if (
  acquisition.searchErrors.length ===
  0
) {
  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] searchErrors=[]",
  );
}

for (
  const [
    index,
    error,
  ] of acquisition.searchErrors.entries()
) {
  console.error(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC][SEARCH_ERROR][${index + 1}] ${JSON.stringify(
      {
        query:
          error.query ??
          null,

        url:
          error.url ??
          null,

        error:
          error.error,
      },
    )}`,
  );
}

console.log(
  "",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] discoveredCandidates=",
);

for (
  const [
    index,
    candidate,
  ] of acquisition.discovery.candidates.entries()
) {
  console.log(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC][CANDIDATE][${index + 1}] ${JSON.stringify(
      {
        url:
          candidate.url,

        normalizedUrl:
          candidate.normalizedUrl,

        kind:
          candidate.kind,

        title:
          candidate.title ??
          null,
      },
    )}`,
  );
}

if (
  acquisition.discovery.candidates.length ===
  0
) {
  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] discoveredCandidates=[]",
  );
}

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 4: CANDIDATE FETCH",
);

console.log(
  "================================================================",
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] fetchAttempts=${acquisition.discovery.candidates.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] successfulAcquisitions=${acquisition.acquisitions.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] fetchErrors=${acquisition.fetchErrors.length}`,
);

if (
  acquisition.fetchErrors.length ===
  0
) {
  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] fetchErrors=[]",
  );
}

for (
  const [
    index,
    error,
  ] of acquisition.fetchErrors.entries()
) {
  console.error(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC][FETCH_ERROR][${index + 1}] ${JSON.stringify(
      {
        query:
          error.query ??
          null,

        url:
          error.url ??
          null,

        error:
          error.error,
      },
    )}`,
  );
}

console.log(
  "",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] successfulAcquisitions=",
);

for (
  const [
    index,
    record,
  ] of acquisition.acquisitions.entries()
) {
  console.log(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC][ACQUISITION][${index + 1}] ${JSON.stringify(
      {
        candidateUrl:
          record.candidateUrl,

        requestedUrl:
          record.page.requestedUrl,

        finalUrl:
          record.page.finalUrl,

        status:
          record.page.status,

        mediaType:
          record.page.mediaType,

        bytes:
          record.page.bytes,

        evidenceCount:
          record.acquisition.evidence.length,

        sourceId:
          record.acquisition.sourceId,

        snapshotId:
          record.acquisition.snapshotId,
      },
    )}`,
  );
}

if (
  acquisition.acquisitions.length ===
  0
) {
  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] successfulAcquisitions=[]",
  );
}

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 5: FOUNDATION INGESTION",
);

console.log(
  "================================================================",
);

const evidenceRecords =
  store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        "EVIDENCE",
    );

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] persistedEvidenceAuditRecords=${evidenceRecords.length}`,
);

const evidenceAggregateIds =
  [
    ...new Set(
      evidenceRecords.map(
        (record) =>
          record.aggregateId,
      ),
    ),
  ];

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] persistedEvidenceAggregates=${evidenceAggregateIds.length}`,
);

for (
  const aggregateId of evidenceAggregateIds
) {
  const records =
    evidenceRecords.filter(
      (record) =>
        record.aggregateId ===
        aggregateId,
    );

  const latest =
    records.reduce(
      (
        current,
        record,
      ) =>
        current ===
          undefined ||
        record.version >
          current.version
          ? record
          : current,
      undefined,
    );

  console.log(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC][EVIDENCE_AGGREGATE] ${JSON.stringify(
      {
        aggregateId,

        historyVersions:
          records.length,

        latestVersion:
          latest?.version ??
          null,

        latestState:
          latest?.state ??
          null,

        verificationStatus:
          latest?.payload
            ?.verificationStatus ??
          null,
      },
    )}`,
  );
}

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 6: FOUNDATION CHAIN",
);

console.log(
  "================================================================",
);

try {
  store.verifyChain();

  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] foundationChain=VALID",
  );
} catch (error) {
  console.error(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] foundationChain=INVALID`,
  );

  console.error(
    `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] chainError=${
      error instanceof Error
        ? error.message
        : String(error)
    }`,
  );

  throw error;
}

console.log(
  "================================================================",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] PHASE 7: ROOT-CAUSE CLASSIFICATION",
);

console.log(
  "================================================================",
);

if (
  acquisition.searchErrors.length >
  0
) {
  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] ROOT_CAUSE_LAYER=SEARCH",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] SearchProvider produced one or more errors.",
  );
} else if (
  acquisition.discovery.candidates.length ===
  0
) {
  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] ROOT_CAUSE_LAYER=DISCOVERY",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] Search completed without usable discovery candidates.",
  );
} else if (
  acquisition.fetchErrors.length ===
    acquisition.discovery.candidates.length &&
  acquisition.acquisitions.length ===
    0
) {
  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] ROOT_CAUSE_LAYER=FETCH",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] All discovered candidates failed during page acquisition.",
  );
} else if (
  acquisition.acquisitions.length ===
  0
) {
  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] ROOT_CAUSE_LAYER=ACQUISITION",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] No successful Internet acquisition was produced.",
  );
} else {
  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] ROOT_CAUSE_LAYER=NONE",
  );

  console.log(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] Internet acquisition produced one or more successful records.",
  );
}

console.log(
  "================================================================",
);

if (
  acquisition.acquisitions.length ===
  0
) {
  console.error(
    "[NEXMOLD][V8-ARTICLE-RUNTIME] ACQUISITION DIAGNOSTIC FAIL",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] The Article Runtime was NOT executed.",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] This failure is intentional and fail-closed.",
  );

  console.error(
    "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] No synthetic acquisition or fallback evidence was created.",
  );

  console.error(
    "================================================================",
  );

  throw new Error(
    "V8_ARTICLE_RUNTIME_DIAGNOSTIC_NO_ACQUISITION",
  );
}

console.log(
  "[NEXMOLD][V8-ARTICLE-RUNTIME] ACQUISITION DIAGNOSTIC PASS",
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] acquisitions=${acquisition.acquisitions.length}`,
);

console.log(
  `[V8-ARTICLE-RUNTIME][DIAGNOSTIC] evidenceAggregates=${evidenceAggregateIds.length}`,
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] The Article Runtime was NOT executed.",
);

console.log(
  "[V8-ARTICLE-RUNTIME][DIAGNOSTIC] No second Internet acquisition was performed.",
);

console.log(
  "================================================================",
);