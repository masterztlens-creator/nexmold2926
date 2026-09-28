import test from "node:test";
import assert from "node:assert/strict";

import {
  discoverWithSelfOwnedCrawl,
} from "../../../dist/v8/research/self-owned-discovery.js";

function createFetcher(pages) {
  return {
    async fetch(url) {
      const page = pages[url];

      if (!page) {
        throw new Error(`UNEXPECTED_FETCH:${url}`);
      }

      return {
        requestedUrl: url,
        finalUrl: page.finalUrl ?? url,
        redirectChain: [],
        status: 200,
        mediaType: page.mediaType ?? "text/html",
        body: page.body ?? "",
        bytes: new TextEncoder().encode(page.body ?? ""),
        fetchedAt: page.fetchedAt ?? "2026-09-28T00:00:00.000Z",
      };
    },
  };
}

test(
  "V8-28A self-owned discovery emits DIRECT candidates",
  async () => {
    const seed = "https://example.com/";

    const fetcher = createFetcher({
      "https://example.com": {
        body: `
          <html>
            <head><title>Example</title></head>
            <body>
              <a href="/standards">Standards</a>
              <a href="/materials">Materials</a>
            </body>
          </html>
        `,
      },
      "https://example.com/standards": {
        body: "<html><title>Standards</title></html>",
      },
      "https://example.com/materials": {
        body: "<html><title>Materials</title></html>",
      },
    });

    const result = await discoverWithSelfOwnedCrawl(
      [seed],
      fetcher,
      {
        maxPages: 3,
        maxDepth: 1,
        maxCandidates: 10,
      },
    );

    assert.equal(result.provider, "SELF_OWNED_CRAWL");
    assert.equal(result.pagesFetched, 3);

    assert.ok(result.candidates.length >= 3);

    for (const candidate of result.candidates) {
      assert.equal(candidate.provider, "DIRECT");
    }
  },
);

test(
  "V8-28A canonicalization deduplicates equivalent URLs",
  async () => {
    const fetcher = createFetcher({
      "https://example.com": {
        body: `
          <a href="/materials">A</a>
          <a href="https://EXAMPLE.com/materials/">B</a>
          <a href="/materials?utm_source=test">C</a>
        `,
      },
      "https://example.com/materials": {
        body: "<html><title>Materials</title></html>",
      },
    });

    const result = await discoverWithSelfOwnedCrawl(
      [
        "https://example.com/",
        "HTTPS://EXAMPLE.COM",
        "https://example.com/#fragment",
      ],
      fetcher,
      {
        maxPages: 2,
        maxDepth: 1,
        maxCandidates: 20,
      },
    );

    const canonicalUrls = result.candidates.map(
      (candidate) => candidate.canonicalUrl,
    );

    assert.equal(
      canonicalUrls.filter(
        (url) => url === "https://example.com/materials",
      ).length,
      1,
    );

    assert.equal(
      new Set(canonicalUrls).size,
      canonicalUrls.length,
    );
  },
);

test(
  "V8-28A duplicate seeds do not duplicate candidates",
  async () => {
    const fetcher = createFetcher({
      "https://example.com": {
        body: "<html><title>Root</title></html>",
      },
    });

    const result = await discoverWithSelfOwnedCrawl(
      [
        "https://example.com/",
        "https://EXAMPLE.COM",
        "https://example.com/#top",
      ],
      fetcher,
      {
        maxPages: 10,
        maxDepth: 0,
        maxCandidates: 10,
      },
    );

    assert.deepEqual(
      result.seeds,
      ["https://example.com"],
    );

    assert.equal(result.candidates.length, 1);
    assert.equal(
      result.candidates[0].canonicalUrl,
      "https://example.com",
    );
  },
);

test(
  "V8-28A invalid seeds fail closed",
  async () => {
    const fetcher = createFetcher({});

    await assert.rejects(
      discoverWithSelfOwnedCrawl(
        [
          "not-a-url",
          "ftp://example.com/file",
          "javascript:alert(1)",
        ],
        fetcher,
      ),
      /V8_RESEARCH_SELF_OWNED_NO_VALID_SEEDS/,
    );
  },
);

test(
  "V8-28A maxCandidates is enforced",
  async () => {
    const fetcher = createFetcher({
      "https://example.com": {
        body: `
          <a href="/a">A</a>
          <a href="/b">B</a>
          <a href="/c">C</a>
          <a href="/d">D</a>
        `,
      },
    });

    const result = await discoverWithSelfOwnedCrawl(
      ["https://example.com"],
      fetcher,
      {
        maxPages: 1,
        maxDepth: 0,
        maxCandidates: 2,
      },
    );

    assert.equal(result.candidates.length, 2);

    for (const candidate of result.candidates) {
      assert.equal(candidate.provider, "DIRECT");
    }
  },
);

test(
  "V8-28A fetch failure does not fabricate discovery candidates",
  async () => {
    const fetcher = {
      async fetch(url) {
        throw new Error(`FETCH_FAILED:${url}`);
      },
    };

    const result = await discoverWithSelfOwnedCrawl(
      ["https://example.com"],
      fetcher,
      {
        maxPages: 5,
        maxDepth: 1,
        maxCandidates: 10,
      },
    );

    assert.equal(result.pagesFetched, 0);
    assert.deepEqual(result.candidates, []);
  },
);

test(
  "V8-28A does not require SearchProvider",
  async () => {
    const fetcher = createFetcher({
      "https://example.com": {
        body: `
          <html>
            <title>Root</title>
            <a href="/knowledge">Knowledge</a>
          </html>
        `,
      },
    });

    const result = await discoverWithSelfOwnedCrawl(
      ["https://example.com"],
      fetcher,
      {
        maxPages: 1,
        maxDepth: 0,
        maxCandidates: 10,
      },
    );

    assert.equal(result.provider, "SELF_OWNED_CRAWL");
    assert.ok(result.candidates.length >= 1);

    assert.equal(
      result.candidates[0].provider,
      "DIRECT",
    );
  },
);

test(
  "V8-28A sourceHint remains descriptive metadata",
  async () => {
    const fetcher = createFetcher({
      "https://example.com": {
        body: "<html><title>Root</title></html>",
      },
    });

    const result = await discoverWithSelfOwnedCrawl(
      ["https://example.com"],
      fetcher,
      {
        maxPages: 1,
        maxDepth: 0,
        maxCandidates: 10,
        sourceHint: "v8-28a-test",
      },
    );

    assert.equal(
      result.candidates[0].sourceHint,
      "v8-28a-test",
    );
  },
);