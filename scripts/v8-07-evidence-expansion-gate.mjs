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

console.log("=== V8-07 DIAGNOSTIC START ===");
console.log(`candidates=${result.candidates.length}`);

for (const candidate of result.candidates) {
  console.log(
    `candidate url=${candidate.url} title=${JSON.stringify(candidate.title ?? "")}`,
  );
}

console.log(`rankedCandidates=${result.rankedCandidates.length}`);

for (const candidate of result.rankedCandidates) {
  console.log(
    `ranked url=${candidate.url} title=${JSON.stringify(candidate.title ?? "")}`,
  );
}

console.log(`acquisitions=${result.acquisitions.length}`);

for (const acquisition of result.acquisitions) {
  console.log(
    "acquisition keys=",
    Object.keys(acquisition),
  );

  console.log(
    "acquisition evidence type=",
    typeof acquisition.evidence,
  );

  console.log(
    "acquisition evidence value=",
    acquisition.evidence,
  );

  console.log(
    "acquisition object=",
    JSON.stringify(acquisition, null, 2),
  );

  console.log(
    `acquisition url=${acquisition.page.finalUrl} status=${acquisition.page.status} mediaType=${JSON.stringify(acquisition.page.mediaType)} bytes=${acquisition.page.bytes.byteLength} bodyLength=${acquisition.page.body.length} evidence=${acquisition.evidence?.length ?? "undefined"}`,
  );
}

console.log(`searchErrors=${JSON.stringify(result.searchErrors)}`);
console.log(`fetchErrors=${JSON.stringify(result.fetchErrors)}`);
console.log("=== V8-07 DIAGNOSTIC END ===");

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
    (item) => item.evidence?.length > 0,
  ),
  "no extracted evidence was persisted",
);

for (const acquisition of result.acquisitions) {
  assert.equal(
    acquisition.page.status >= 200,
    true,
  );

  assert.equal(
    acquisition.evidence?.[0]?.state,
    "INGESTED",
  );
}

store.verifyChain();

console.log("V8-07 REAL INTERNET GATE PASS");
console.log(`candidates=${result.candidates.length}`);
console.log(`acquisitions=${result.acquisitions.length}`);
console.log(`searchErrors=${result.searchErrors.length}`);
console.log(`fetchErrors=${result.fetchErrors.length}`);