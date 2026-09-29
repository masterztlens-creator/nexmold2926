import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverWithSelfOwnedCrawl,
} from "../../../.v8-build/src/v8/research/self-owned-discovery.js";

import {
  canonicalizeUrl,
} from "../../../.v8-build/src/v8/research/discovery.js";

function createPageFetcher(pages) {
  return {
    async fetch(url) {
      const page = pages[url];

      if (!page) {
        throw new Error(
          `Unexpected fetch URL: ${url}`,
        );
      }

      return {
        requestedUrl: url,
        finalUrl: url,
        redirectChain: [],
        status: 200,
        mediaType: "text/html",
        body: page.body,
        bytes: new TextEncoder().encode(
          page.body,
        ),
        fetchedAt:
          "2026-01-01T00:00:00.000Z",
      };
    },
  };
}

test(
  "V8-28A canonicalization removes tracking parameters deterministically",
  () => {
    assert.equal(
      canonicalizeUrl(
        "HTTPS://Example.COM/a/?utm_source=x&b=2",
      ),
      "https://example.com/a?b=2",
    );
  },
);

test(
  "V8-28A self-owned discovery crawls seeds and emits direct candidates",
  async () => {
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

    const result =
      await discoverWithSelfOwnedCrawl(
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

    assert.equal(
      result.provider,
      "SELF_OWNED_CRAWL",
    );

    assert.equal(
      result.seeds.length,
      1,
    );

    assert.ok(
      result.pagesFetched >= 1,
    );

    assert.ok(
      result.candidates.length >= 4,
    );

    const urls =
      result.candidates.map(
        (candidate) =>
          candidate.canonicalUrl,
      );

    assert.ok(
      urls.includes(
        "https://example.com/start",
      ),
    );

    assert.ok(
      urls.includes(
        "https://example.com/article",
      ),
    );

    assert.ok(
      urls.includes(
        "https://example.com/about",
      ),
    );

    assert.ok(
      urls.includes(
        "https://example.com/reference",
      ),
    );

    for (
      const candidate of result.candidates
    ) {
      assert.equal(
        candidate.provider,
        "DIRECT",
      );

      assert.equal(
        candidate.canonicalUrl,
        canonicalizeUrl(
          candidate.url,
        ),
      );

      if (
        candidate.canonicalUrl ===
        "https://example.com/start"
      ) {
        assert.equal(
          candidate.sourceHint,
          "V8-28A",
        );
      } else {
        assert.equal(
          candidate.sourceHint,
          "https://example.com/start",
        );
      }
    }
  },
);

test(
  "V8-28A self-owned discovery is deterministic for identical input",
  async () => {
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
        body:
          "<html><head><title>A</title></head><body>A</body></html>",
      },

      "https://example.com/b": {
        body:
          "<html><head><title>B</title></head><body>B</body></html>",
      },
    };

    const options = {
      maxPages: 10,
      maxDepth: 1,
      sameHostOnly: true,
      maxCandidates: 10,
      sourceHint: "V8-28A",
    };

    const first =
      await discoverWithSelfOwnedCrawl(
        ["https://example.com/start"],
        createPageFetcher(pages),
        options,
      );

    const second =
      await discoverWithSelfOwnedCrawl(
        ["https://example.com/start"],
        createPageFetcher(pages),
        options,
      );

    const normalize =
      (result) => ({
        provider:
          result.provider,

        seeds:
          result.seeds,

        pagesFetched:
          result.pagesFetched,

        candidates:
          result.candidates.map(
            (candidate) => ({
              url:
                candidate.url,

              canonicalUrl:
                candidate.canonicalUrl,

              provider:
                candidate.provider,

              title:
                candidate.title,

              sourceHint:
                candidate.sourceHint,
            }),
          ),
      });

    assert.deepEqual(
      normalize(first),
      normalize(second),
    );
  },
);

test(
  "V8-28A self-owned discovery preserves provenance for multiple ResearchSeeds",
  async () => {
    const seedA =
      "https://example.com/seed-a";

    const seedB =
      "https://example.com/seed-b";

    const childA =
      "https://example.com/seed-a/child";

    const childB =
      "https://example.com/seed-b/child";

    const pages = {
      [seedA]: {
        body: `
          <html>
            <head>
              <title>Seed A</title>
            </head>
            <body>
              <p>Injection molding wall thickness engineering A.</p>
              <a href="${childA}">
                Seed A child
              </a>
            </body>
          </html>
        `,
      },

      [seedB]: {
        body: `
          <html>
            <head>
              <title>Seed B</title>
            </head>
            <body>
              <p>Injection molding wall thickness engineering B.</p>
              <a href="${childB}">
                Seed B child
              </a>
            </body>
          </html>
        `,
      },

      [childA]: {
        body: `
          <html>
            <head>
              <title>Seed A Child</title>
            </head>
            <body>
              <p>
                Injection molding wall thickness evidence A.
              </p>
            </body>
          </html>
        `,
      },

      [childB]: {
        body: `
          <html>
            <head>
              <title>Seed B Child</title>
            </head>
            <body>
              <p>
                Injection molding wall thickness evidence B.
              </p>
            </body>
          </html>
        `,
      },
    };

    const result =
      await discoverWithSelfOwnedCrawl(
        [
          seedA,
          seedB,
        ],
        createPageFetcher(pages),
        {
          maxPages: 10,
          maxDepth: 1,
          sameHostOnly: true,
          maxCandidates: 10,
          sourceHint: "V8-28A",
        },
      );

    assert.equal(
      result.provider,
      "SELF_OWNED_CRAWL",
    );

    assert.deepEqual(
      result.seeds,
      [
        seedA,
        seedB,
      ],
    );

    assert.equal(
      result.pagesFetched,
      4,
    );

    const byUrl =
      new Map(
        result.candidates.map(
          (candidate) => [
            candidate.canonicalUrl,
            candidate,
          ],
        ),
      );

    const seedACandidate =
      byUrl.get(seedA);

    const seedBCandidate =
      byUrl.get(seedB);

    const childACandidate =
      byUrl.get(childA);

    const childBCandidate =
      byUrl.get(childB);

    assert.ok(
      seedACandidate,
      "Seed A must remain a candidate",
    );

    assert.ok(
      seedBCandidate,
      "Seed B must remain a candidate",
    );

    assert.ok(
      childACandidate,
      "Seed A child must remain a candidate",
    );

    assert.ok(
      childBCandidate,
      "Seed B child must remain a candidate",
    );

    /*
     * Explicit Seed A must point to itself.
     */
    assert.equal(
      seedACandidate.sourceHint,
      seedA,
      "Seed A must preserve its own ResearchSeed provenance",
    );

    /*
     * Explicit Seed B must point to itself.
     *
     * This is the exact regression that the old
     * normalizedSeeds[0] implementation violated.
     */
    assert.equal(
      seedBCandidate.sourceHint,
      seedB,
      "Seed B must preserve its own ResearchSeed provenance",
    );

    /*
     * Descendants must inherit their originating seed,
     * not the first seed in the entire crawl.
     */
    assert.equal(
      childACandidate.sourceHint,
      seedA,
      "Seed A child must inherit Seed A provenance",
    );

    assert.equal(
      childBCandidate.sourceHint,
      seedB,
      "Seed B child must inherit Seed B provenance",
    );

    /*
     * Explicit seeds and their descendants must never
     * cross-contaminate provenance.
     */
    assert.notEqual(
      childACandidate.sourceHint,
      seedB,
      "Seed A child must never inherit Seed B provenance",
    );

    assert.notEqual(
      childBCandidate.sourceHint,
      seedA,
      "Seed B child must never inherit Seed A provenance",
    );
  },
);