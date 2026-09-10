import assert from "node:assert/strict";
import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";
import { HttpPageFetcher } from "../.v8-build/src/v8/acquisition/page-fetcher.js";
import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";
import { runResearchAcquisition } from "../.v8-build/src/v8/intelligence/research-planner/acquisition-runner.js";
const apiKey = process.env.V8_SEARCH_API_KEY;
if (!apiKey) {
  throw new Error(
    "V8_SEARCH_CONFIG_MISSING: V8_SEARCH_API_KEY is required.",
  );
}
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
  reasons: ["V8-06 real internet gate"],
};
const store = new InMemoryFoundationStore();
const searchProvider = new TavilySearchProvider(
  apiKey,
  "https://api.tavily.com/search",
  "v8-06-real-search",
);
const pageFetcher = new HttpPageFetcher({
  timeoutMs: 20000,
  maxBytes: 5000000,
});
const result = await runResearchAcquisition(
  opportunity,
  searchProvider,
  pageFetcher,
  store,
  {
    maxQueries: 1,
    maxCandidates: 3,
    actorId: "v8-06-real-gate",
  },
);
assert.ok(result.plan.sourceQueries.length > 0);
assert.equal(result.searchErrors.length, 0);
assert.ok(
  result.discovery.accepted > 0,
  "V8-06_DISCOVERY_EMPTY: real search returned no accepted URLs.",
);
assert.ok(
  result.acquisitions.length > 0,
  "V8-06_ACQUISITION_EMPTY: no real webpage was successfully acquired.",
);
const successful = result.acquisitions.find(
  (item) =>
    item.page.status >= 200 &&
    item.page.status < 300 &&
    item.page.mediaType.toLowerCase().includes("text/html") &&
    item.page.bytes.length > 0,
);
assert.ok(
  successful,
  "V8-06_FETCH_INVALID: no successful HTML page acquisition.",
);
const evidenceRecords = store
  .auditTrail()
  .filter((record) => record.aggregateType === "EVIDENCE");
assert.ok(
  evidenceRecords.length > 0,
  "V8-06_EVIDENCE_MISSING: no evidence was persisted.",
);
for (const record of evidenceRecords) {
  assert.equal(record.state, "INGESTED");
  assert.equal(record.payload.verificationStatus, "UNVERIFIED");
  assert.ok(
    record.lineage.some(
      (lineage) => lineage.type === "SOURCE",
    ),
    "V8-06_LINEAGE_SOURCE_MISSING",
  );
  assert.ok(
    record.lineage.some(
      (lineage) => lineage.type === "SNAPSHOT",
    ),
    "V8-06_LINEAGE_SNAPSHOT_MISSING",
  );
}
store.verifyChain();
console.log("[NEXMOLD][V8-06] REAL INTERNET RESEARCH GATE PASS");
console.log(`[V8-06] queries=${result.plan.sourceQueries.length}`);
console.log(`[V8-06] discovered=${result.discovery.accepted}`);
console.log(`[V8-06] acquired=${result.acquisitions.length}`);
console.log(`[V8-06] evidence=${evidenceRecords.length}`);
console.log("[V8-06] Evidence remains INGESTED / UNVERIFIED.");