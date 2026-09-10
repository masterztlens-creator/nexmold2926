import assert from "node:assert/strict";
import { InMemoryFoundationStore } from "../.v8-build/src/v8/foundation/store.js";
import {
  expandEvidenceFromInternet,
} from "../.v8-build/src/v8/intelligence/evidence-expansion/expansion.js";
import { TavilySearchProvider } from "../.v8-build/src/v8/acquisition/tavily-search-provider.js";
const apiKey = process.env.V8_SEARCH_API_KEY;
assert.ok(apiKey, "V8_SEARCH_API_KEY is required");
const searchProvider = new TavilySearchProvider(
  apiKey,
  "https://api.tavily.com/search",
  "v8-07-real-search",
);
const pageFetcher = {
  async fetch(url, options = {}) {
    const response = await fetch(url, {
      redirect: "follow",
      signal: options.signal,
    });
    const bytes = new Uint8Array(
      await response.arrayBuffer(),
    );
    const body = new TextDecoder().decode(bytes);
    return {
      requestedUrl: url,
      finalUrl: response.url,
      redirectChain: [],
      status: response.status,
      mediaType:
        response.headers.get("content-type") ?? "",
      body,
      bytes,
      fetchedAt: new Date().toISOString(),
    };
  },
};
const store = new InMemoryFoundationStore();
const result = await expandEvidenceFromInternet(
  ["plastic injection molding wall thickness"],
  searchProvider,
  pageFetcher,
  store,
  {
    actorId: "V8-07-REAL-GATE",
    maxQueries: 1,
    maxCandidates: 3,
  },
);
assert.ok(
  result.candidates.length > 0,
  "real search returned no candidates",
);
assert.ok(
  result.rankedCandidates.length > 0,
  "no ranked candidates",
);
assert.ok(
  result.acquisitions.length > 0,
  "no real webpage was acquired",
);
assert.ok(
  result.acquisitions.some(
    (item) => item.evidence.evidence.length > 0,
  ),
  "no extracted evidence was persisted",
);
for (const acquisition of result.acquisitions) {
  assert.equal(
    acquisition.page.status >= 200,
    true,
  );
  assert.equal(
    acquisition.evidence.evidence[0]?.state,
    "INGESTED",
  );
}
store.verifyChain();
console.log("V8-07 REAL INTERNET GATE PASS");
console.log(`candidates=${result.candidates.length}`);
console.log(`acquisitions=${result.acquisitions.length}`);
console.log(`searchErrors=${result.searchErrors.length}`);
console.log(`fetchErrors=${result.fetchErrors.length}`);