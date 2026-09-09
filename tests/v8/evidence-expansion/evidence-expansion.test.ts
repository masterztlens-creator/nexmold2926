import assert from "node:assert/strict";
import test from "node:test";
import {
  expandEvidenceFromInternet,
  rankEvidenceCandidates,
} from "../../../.v8-build/src/v8/intelligence/evidence-expansion/expansion.js";
import { InMemoryFoundationStore } from "../../../.v8-build/src/v8/foundation/store.js";
test("V8-07 ranks candidates without fabricating authority", () => {
  const ranked = rankEvidenceCandidates("wall thickness", [
    {
      url: "https://example.com/a",
      title: "Wall thickness design",
      publisher: "example.com",
      authority: 0,
      relevance: 0.5,
      query: "wall thickness",
    },
    {
      url: "https://example.com/b",
      title: "Other topic",
      publisher: "example.com",
      authority: 0,
      relevance: 0.8,
      query: "wall thickness",
    },
  ]);
  assert.equal(ranked[0]?.url, "https://example.com/a");
  assert.equal(ranked[0]?.authority, 0);
});
test("V8-07 isolates search and fetch failures", async () => {
  const store = new InMemoryFoundationStore();
  const searchProvider = {
    name: "test-search",
    async search(query: string) {
      if (query === "bad") {
        throw new Error("search failed");
      }
      return [
        {
          url: "https://example.com/good",
          title: "Good engineering source",
          snippet: "engineering evidence",
        },
        {
          url: "https://example.com/good",
          title: "Duplicate",
        },
      ];
    },
  };
  const pageFetcher = {
    async fetch(url: string) {
      if (url.endsWith("/good")) {
        const body =
          "<html><body>Engineering evidence</body></html>";
        return {
          requestedUrl: url,
          finalUrl: url,
          redirectChain: [],
          status: 200,
          mediaType: "text/html",
          body,
          bytes: new TextEncoder().encode(body),
          fetchedAt: new Date().toISOString(),
        };
      }
      throw new Error("fetch failed");
    },
  };
  const result = await expandEvidenceFromInternet(
    ["good", "bad"],
    searchProvider,
    pageFetcher,
    store,
    {
      actorId: "V8-07-TEST",
      maxQueries: 2,
      maxCandidates: 2,
    },
  );
  assert.equal(result.searchErrors.length, 1);
  assert.equal(result.candidates.length, 1);
  assert.equal(result.acquisitions.length, 1);
  assert.equal(result.fetchErrors.length, 0);
  assert.equal(
    result.acquisitions[0]?.evidence.evidence.length,
    1,
  );
  store.verifyChain();
});