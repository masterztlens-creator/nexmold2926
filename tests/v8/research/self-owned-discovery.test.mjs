import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalizeUrl,
  discoverWithSelfOwnedCrawl,
} from "../../../.v8-build/src/v8/research/self-owned-discovery.js";

function createPageFetcher(pages) {
  return {
    async fetch(url) {
      const page = pages[url];

      if (!page) {
        throw new Error(`Unexpected fetch URL: ${url}`);
      }

      return {
        requestedUrl: url,
        finalUrl: url,
        redirectChain: [],
        status: 200,
        mediaType: "text/html",
        body: page.body,
        bytes: new TextEncoder().encode(page.body),
        fetchedAt: "2026-01-01T00:00:00.000Z",
      };
    },
  };
}

test("V8-28A canonicalization removes tracking parameters deterministically", () => {
  assert.equal(
    canonicalizeUrl("HTTPS://Example.COM/a/?utm_source=x&b=2"),
    "https://example.com/a?b=2",
  );
});

test("V8-28A self-owned discovery crawls seeds and emits direct candidates", async () => {
  const pages = {
    "https://example.com/start": {
      body: `
        <html>
          <head><title>Start</title></head>
          <body>
            <a href="/article">Article</a>
            <a href="https://example.com/about?utm_source=test">About</a>
            <a href="/article#fragment">Duplicate article</a>
          </body>
        </html>
      `,
    },

    "https://example.com/article": {
      body: `
        <html>
          <head><title>Article</title></head>
          <body>
            <p>Evidence-bearing article content.</p>
            <a href="/reference">Reference</a>
          </body>
        </html>
      `,
    },

    "https://example.com/about": {
      body: `
        <html>
          <head><title>About</title></head>
          <body>
            <p>About page.</p>
          </body>
        </html>
      `,
    },

    "https://example.com/reference": {
      body: `
        <html>
          <head><title>Reference</title></head>
          <body>
            <p>Reference page.</p>
          </body>
        </html>
      `,
    },
  };

  const result = await discoverWithSelfOwnedCrawl(
    ["https://example.com/start"],
    createPageFetcher(pages),
    {
      maxPages: 10,
      maxDepth: 2,
      sameHostOnly: true,
      maxCandidates: 10,
      sourceHint: "V8-28A",
    },
  );

  assert.equal(result.provider, "SELF_OWNED_CRAWL");
  assert.equal(result.seeds.length, 1);
  assert.ok(result.pagesFetched >= 1);
  assert.ok(result.candidates.length >= 4);

  const urls = result.candidates.map((candidate) => candidate.canonicalUrl);

  assert.ok(urls.includes("https://example.com/start"));
  assert.ok(urls.includes("https://example.com/article"));
  assert.ok(urls.includes("https://example.com/about"));
  assert.ok(urls.includes("https://example.com/reference"));

  for (const candidate of result.candidates) {
    assert.equal(candidate.provider, "DIRECT");
    assert.equal(candidate.sourceHint, "V8-28A");
    assert.equal(candidate.canonicalUrl, canonicalizeUrl(candidate.url));
  }
});

test("V8-28A self-owned discovery is deterministic for identical input", async () => {
  const pages = {
    "https://example.com/start": {
      body: `
        <html>
          <head><title>Start</title></head>
          <body>
            <a href="/b">B</a>
            <a href="/a">A</a>
          </body>
        </html>
      `,
    },

    "https://example.com/a": {
      body: "<html><head><title>A</title></head><body>A</body></html>",
    },

    "https://example.com/b": {
      body: "<html><head><title>B</title></head><body>B</body></html>",
    },
  };

  const options = {
    maxPages: 10,
    maxDepth: 1,
    sameHostOnly: true,
    maxCandidates: 10,
    sourceHint: "V8-28A",
  };

  const first = await discoverWithSelfOwnedCrawl(
    ["https://example.com/start"],
    createPageFetcher(pages),
    options,
  );

  const second = await discoverWithSelfOwnedCrawl(
    ["https://example.com/start"],
    createPageFetcher(pages),
    options,
  );

  const normalize = (result) => ({
    provider: result.provider,
    seeds: result.seeds,
    pagesFetched: result.pagesFetched,
    candidates: result.candidates.map((candidate) => ({
      url: candidate.url,
      canonicalUrl: candidate.canonicalUrl,
      provider: candidate.provider,
      title: candidate.title,
      sourceHint: candidate.sourceHint,
    })),
  });

  assert.deepEqual(normalize(first), normalize(second));
});