import assert from "node:assert/strict";

import {
  InMemoryFoundationStore,
} from "../.v8-build/src/v8/foundation/store.js";

import {
  HttpPageFetcher,
} from "../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  expandEvidenceFromInternet,
} from "../.v8-build/src/v8/intelligence/evidence-expansion/expansion.js";

const RESEARCH_SEEDS = Object.freeze([
  Object.freeze({
    url:
      "https://www.protolabs.com/services/injection-molding/plastic-injection-molding/design-guidelines/",
    title:
      "Plastic Injection Molding Design Guidelines",
    snippet:
      "Injection molding design guidance including wall thickness and manufacturing considerations.",
  }),
  Object.freeze({
    url:
      "https://www.protolabs.com/services/injection-molding/plastic-injection-molding/",
    title:
      "Plastic Injection Molding",
    snippet:
      "Plastic injection molding process and manufacturing guidance.",
  }),
  Object.freeze({
    url:
      "https://www.protolabs.com/resources/guides-and-trend-reports/injection-molding-guide-process-design-tips-materials/",
    title:
      "Injection Molding Guide",
    snippet:
      "Injection molding process, design tips, and material guidance.",
  }),
]);

const QUERY =
  "plastic injection molding wall thickness";

const searchProvider = {
  name:
    "v8-07-self-owned-seed-provider",

  async search(query, options = {}) {
    if (options.signal?.aborted) {
      throw new Error(
        "V8-07_SEARCH_ABORTED",
      );
    }

    if (
      query !== QUERY
    ) {
      return [];
    }

    return RESEARCH_SEEDS.map(
      (seed) => ({
        url:
          seed.url,
        title:
          seed.title,
        snippet:
          seed.snippet,
      }),
    );
  },
};

const pageFetcher =
  new HttpPageFetcher({
    timeoutMs: 20000,
    maxBytes: 5000000,
  });

const store =
  new InMemoryFoundationStore();

const result =
  await expandEvidenceFromInternet(
    [QUERY],
    searchProvider,
    pageFetcher,
    store,
    {
      actorId:
        "V8-07-REAL-GATE",
      maxQueries: 1,
      maxCandidates: 3,
    },
  );

console.log(
  "=== V8-07 DIAGNOSTIC START ===",
);

console.log(
  `seedCandidates=${RESEARCH_SEEDS.length}`,
);

console.log(
  `candidates=${result.candidates.length}`,
);

for (
  const candidate of result.candidates
) {
  console.log(
    `candidate url=${candidate.url} title=${JSON.stringify(candidate.title)}`,
  );
}

console.log(
  `rankedCandidates=${result.rankedCandidates.length}`,
);

for (
  const candidate of result.rankedCandidates
) {
  console.log(
    `ranked url=${candidate.url} title=${JSON.stringify(candidate.title)}`,
  );
}

console.log(
  `acquisitions=${result.acquisitions.length}`,
);

for (
  const acquisition of result.acquisitions
) {
  console.log(
    `acquisition url=${acquisition.page.finalUrl} status=${acquisition.page.status} mediaType=${JSON.stringify(acquisition.page.mediaType)} bytes=${acquisition.page.bytes.byteLength} bodyLength=${acquisition.page.body.length} evidence=${acquisition.evidence?.evidence?.length ?? "undefined"}`,
  );
}

console.log(
  `searchErrors=${JSON.stringify(result.searchErrors)}`,
);

console.log(
  `fetchErrors=${JSON.stringify(result.fetchErrors)}`,
);

console.log(
  "=== V8-07 DIAGNOSTIC END ===",
);

assert.equal(
  result.searchErrors.length,
  0,
  "self-owned seed discovery produced search errors",
);

assert.equal(
  result.fetchErrors.length,
  0,
  "self-owned seed acquisition produced fetch errors",
);

assert.ok(
  result.candidates.length > 0,
  "self-owned seed discovery returned no candidates",
);

assert.ok(
  result.rankedCandidates.length > 0,
  "no ranked self-owned seed candidates",
);

assert.ok(
  result.acquisitions.length > 0,
  "no real webpage was acquired",
);

assert.ok(
  result.acquisitions.some(
    (item) =>
      item.evidence?.evidence?.length > 0,
  ),
  "no extracted evidence was persisted",
);

for (
  const acquisition of result.acquisitions
) {
  assert.equal(
    acquisition.page.status >= 200,
    true,
  );

  assert.equal(
    acquisition.page.status < 300,
    true,
  );

  assert.equal(
    acquisition.page.mediaType
      .toLowerCase()
      .includes("text/html"),
    true,
  );

  assert.ok(
    acquisition.page.bytes.byteLength > 0,
    "acquired webpage has no bytes",
  );

  assert.ok(
    acquisition.evidence
      .evidence.length > 0,
    "acquired webpage produced no evidence",
  );

  assert.equal(
    acquisition.evidence
      .evidence[0]
      ?.verificationStatus,
    "UNVERIFIED",
  );
}

const evidenceRecords =
  store
    .auditTrail()
    .filter(
      (record) =>
        record.aggregateType ===
        "EVIDENCE",
    );

assert.ok(
  evidenceRecords.length > 0,
  "no evidence records were persisted",
);

for (
  const record of evidenceRecords
) {
  assert.equal(
    record.state,
    "INGESTED",
  );

  assert.equal(
    record.payload
      .verificationStatus,
    "UNVERIFIED",
  );

  assert.ok(
    record.lineage.some(
      (lineage) =>
        lineage.type === "SOURCE",
    ),
    `SOURCE lineage missing for ${record.aggregateId}`,
  );

  assert.ok(
    record.lineage.some(
      (lineage) =>
        lineage.type === "SNAPSHOT",
    ),
    `SNAPSHOT lineage missing for ${record.aggregateId}`,
  );
}

store.verifyChain();

console.log(
  "[NEXMOLD][V8-07] SELF-OWNED REAL INTERNET EVIDENCE EXPANSION GATE PASS",
);

console.log(
  `[V8-07] candidates=${result.candidates.length}`,
);

console.log(
  `[V8-07] acquisitions=${result.acquisitions.length}`,
);

console.log(
  `[V8-07] evidence=${evidenceRecords.length}`,
);

console.log(
  `[V8-07] searchErrors=${result.searchErrors.length}`,
);

console.log(
  `[V8-07] fetchErrors=${result.fetchErrors.length}`,
);

console.log(
  "[V8-07] acquisitionMode=SELF_OWNED_SEEDS",
);

console.log(
  "[V8-07] Evidence remains INGESTED / UNVERIFIED.",
);