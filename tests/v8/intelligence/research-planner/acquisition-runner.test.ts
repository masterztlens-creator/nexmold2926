import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryFoundationStore } from "../../../.v8-build/src/v8/foundation/store.js";
import type {
  FetchedPage,
  PageFetcher,
  SearchProvider,
} from "../../../.v8-build/src/v8/acquisition/types.js";
import type { Opportunity } from "../../../.v8-build/src/v8/intelligence/shared.js";
import { runResearchAcquisition } from "../../../.v8-build/src/v8/intelligence/research-planner/acquisition-runner.js";
const opportunity: Opportunity = {
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
  reasons: ["V8-06 wiring test"],
};
test("wires opportunity through research, search, discovery, fetch and evidence", async () => {
  const store = new InMemoryFoundationStore();
  const url = "https://example.com/engineering";
  const searchProvider: SearchProvider = {
    name: "fake-search",
    async search() {
      return [
        {
          url,
          title: "Engineering Source",
          snippet: "Engineering source fixture",
        },
        {
          url,
          title: "Duplicate Engineering Source",
          snippet: "Duplicate fixture",
        },
      ];
    },
  };
  const body = [
    "<html>",
    "<head><title>Engineering Source</title></head>",
    "<body>",
    "<h1>Plastic Injection Molding Wall Thickness</h1>",
    "<p>Engineering evidence fixture.</p>",
    "</body>",
    "</html>",
  ].join("");
  const page: FetchedPage = {
    requestedUrl: url,
    finalUrl: url,
    redirectChain: [url],
    status: 200,
    mediaType: "text/html",
    body,
    bytes: new TextEncoder().encode(body),
    fetchedAt: "2026-01-01T00:00:00.000Z",
  };
  const pageFetcher: PageFetcher = {
    async fetch() {
      return page;
    },
  };
  const result = await runResearchAcquisition(
    opportunity,
    searchProvider,
    pageFetcher,
    store,
    {
      maxQueries: 1,
      maxCandidates: 5,
      actorId: "v8-06-test",
    },
  );
  assert.ok(result.plan.sourceQueries.length > 0);
  assert.equal(result.searchErrors.length, 0);
  assert.equal(result.discovery.accepted, 1);
  assert.equal(result.discovery.rejected, 1);
  assert.equal(result.acquisitions.length, 1);
  assert.equal(result.fetchErrors.length, 0);
  const evidenceRecords = store
    .auditTrail()
    .filter((record) => record.aggregateType === "EVIDENCE");
  assert.equal(evidenceRecords.length, 1);
  const evidenceRecord = evidenceRecords[0];
  assert.equal(evidenceRecord.state, "INGESTED");
  assert.equal(evidenceRecord.payload.verificationStatus, "UNVERIFIED");
  assert.ok(
    evidenceRecord.lineage.some(
      (lineage) => lineage.type === "SNAPSHOT",
    ),
  );
  store.verifyChain();
});
test("fails closed when search provider fails", async () => {
  const store = new InMemoryFoundationStore();
  const searchProvider: SearchProvider = {
    name: "failing-search",
    async search() {
      throw new Error("SEARCH_PROVIDER_FAILURE");
    },
  };
  const pageFetcher: PageFetcher = {
    async fetch() {
      throw new Error("FETCH_SHOULD_NOT_RUN");
    },
  };
  const result = await runResearchAcquisition(
    opportunity,
    searchProvider,
    pageFetcher,
    store,
    {
      maxQueries: 1,
      maxCandidates: 5,
      actorId: "v8-06-test",
    },
  );
  assert.equal(result.discovery.accepted, 0);
  assert.equal(result.acquisitions.length, 0);
  assert.equal(result.searchErrors.length, 1);
  assert.equal(result.fetchErrors.length, 0);
  assert.equal(store.auditTrail().length, 0);
});