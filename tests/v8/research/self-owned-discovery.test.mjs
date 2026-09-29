import assert from "node:assert/strict";
import test from "node:test";

import {
  discoverWithSelfOwnedCrawl,
} from "../../../.v8-build/src/v8/research/self-owned-discovery.js";

import {
  canonicalizeUrl,
} from "../../../.v8-build/src/v8/research/discovery.js";

function createPageFetcher(
  pages,
) {
  return {
    async fetch(url) {
      const page =
        pages[url];

      if (!page) {
        throw new Error(
          `Unexpected fetch URL: ${url}`,
        );
      }

      return {
        requestedUrl:
          url,

        finalUrl:
          url,

        redirectChain:
          [],

        status:
          200,

        mediaType:
          "text/html",

        body:
          page.body,

        bytes:
          new TextEncoder().encode(
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
            <head>
              <title>Start</title>
            </head>
            <body>
              <a href="/article">Article</a>
              <a href="https://example.com/about?utm_source=test">
                About
              </a>
              <a href="/article#fragment">
                Duplicate article
              </a>
            </body>
          </html>
        `,
      },

      "https://example.com/article": {
        body: `
          <html>
            <head>
              <title>Article</title>
            </head>
            <body>
              <p>
                Evidence-bearing article content.
              </p>
              <a href="/reference">
                Reference
              </a>
            </body>
          </html>
        `,
      },

      "https://example.com/about": {
        body: `
          <html>
            <head>
              <title>About</title>
            </head>
            <body>
              <p>About page.</p>
            </body>
          </html>
        `,
      },

      "https://example.com/reference": {
        body: `
          <html>
            <head>
              <title>Reference</title>
            </head>
            <body>
              <p>Reference page.</p>
            </body>
          </html>
        `,
      },
    };

    const result =
      await discoverWithSelfOwnedCrawl(
        [
          "https://example.com/start",
        ],
        createPageFetcher(
          pages,
        ),
        {
          maxPages:
            10,

          maxDepth:
            2,

          sameHostOnly:
            true,

          maxCandidates:
            10,

          sourceHint:
            "V8-28A",
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

    assert.equal(
      result.fetchErrors.length,
      0,
    );

    assert.ok(
      result.candidates.length >= 4,
    );

    const urls =
      result.candidates.map(
        (
          candidate,
        ) =>
          candidate.normalizedUrl,
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
      const candidate of
        result.candidates
    ) {
      assert.equal(
        candidate.provider,
        "SELF_OWNED_CRAWL",
      );

      assert.equal(
        candidate.normalizedUrl,
        canonicalizeUrl(
          candidate.url,
        ),
      );

      if (
        candidate.normalizedUrl ===
        "https://example.com/start"
      ) {
        assert.equal(
          candidate.sourceUrl,
          "V8-28A",
        );
      } else {
        assert.equal(
          candidate.sourceUrl,
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
            <head>
              <title>Start</title>
            </head>
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
      maxPages:
        10,

      maxDepth:
        1,

      sameHostOnly:
        true,

      maxCandidates:
        10,

      sourceHint:
        "V8-28A",
    };

    const first =
      await discoverWithSelfOwnedCrawl(
        [
          "https://example.com/start",
        ],
        createPageFetcher(
          pages,
        ),
        options,
      );

    const second =
      await discoverWithSelfOwnedCrawl(
        [
          "https://example.com/start",
        ],
        createPageFetcher(
          pages,
        ),
        options,
      );

    const normalize =
      (
        result,
      ) => ({
        provider:
          result.provider,

        seeds:
          result.seeds,

        pagesFetched:
          result.pagesFetched,

        fetchErrors:
          result.fetchErrors,

        candidates:
          result.candidates.map(
            (
              candidate,
            ) => ({
              url:
                candidate.url,

              normalizedUrl:
                candidate.normalizedUrl,

              provider:
                candidate.provider,

              title:
                candidate.title,

              sourceUrl:
                candidate.sourceUrl,
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
              <p>
                Injection molding wall thickness
                engineering A.
              </p>
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
              <p>
                Injection molding wall thickness
                engineering B.
              </p>
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
                Injection molding wall thickness
                evidence A.
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
                Injection molding wall thickness
                evidence B.
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
        createPageFetcher(
          pages,
        ),
        {
          maxPages:
            10,

          maxDepth:
            1,

          sameHostOnly:
            true,

          maxCandidates:
            10,

          sourceHint:
            "V8-28A",
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

    assert.equal(
      result.fetchErrors.length,
      0,
    );

    const byUrl =
      new Map(
        result.candidates.map(
          (
            candidate,
          ) => [
            candidate.normalizedUrl,
            candidate,
          ],
        ),
      );

    const seedACandidate =
      byUrl.get(
        seedA,
      );

    const seedBCandidate =
      byUrl.get(
        seedB,
      );

    const childACandidate =
      byUrl.get(
        childA,
      );

    const childBCandidate =
      byUrl.get(
        childB,
      );

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
     * Explicit ResearchSeed pages use the controlled
     * sourceUrl supplied by the discovery caller.
     *
     * Their own ResearchSeed URL is represented by the
     * discoveryRoot internally and is used for descendants.
     */
    assert.equal(
      seedACandidate.sourceUrl,
      "V8-28A",
      "Seed A must use the controlled discovery source URL",
    );

    assert.equal(
      seedBCandidate.sourceUrl,
      "V8-28A",
      "Seed B must use the controlled discovery source URL",
    );

    /*
     * Descendants must inherit the exact ResearchSeed
     * that originated the page from which they were found.
     */
    assert.equal(
      childACandidate.sourceUrl,
      seedA,
      "Seed A child must inherit Seed A provenance",
    );

    assert.equal(
      childBCandidate.sourceUrl,
      seedB,
      "Seed B child must inherit Seed B provenance",
    );

    /*
     * Explicit seeds and their descendants must never
     * cross-contaminate provenance.
     */
    assert.notEqual(
      childACandidate.sourceUrl,
      seedB,
      "Seed A child must never inherit Seed B provenance",
    );

    assert.notEqual(
      childBCandidate.sourceUrl,
      seedA,
      "Seed B child must never inherit Seed A provenance",
    );
  },
);

test(
  "V8-28A self-owned discovery exposes crawler fetch failures",
  async () => {
    const seed =
      "https://example.com/seed";

    const brokenChild =
      "https://example.com/broken";

    const pages = {
      [seed]: {
        body: `
          <html>
            <head>
              <title>Seed</title>
            </head>
            <body>
              <a href="${brokenChild}">
                Broken child
              </a>
            </body>
          </html>
        `,
      },
    };

    const result =
      await discoverWithSelfOwnedCrawl(
        [
          seed,
        ],
        {
          async fetch(url) {
            if (
              url === seed
            ) {
              return {
                requestedUrl:
                  url,

                finalUrl:
                  url,

                redirectChain:
                  [],

                status:
                  200,

                mediaType:
                  "text/html",

                body:
                  pages[seed].body,

                bytes:
                  new TextEncoder().encode(
                    pages[seed].body,
                  ),

                fetchedAt:
                  "2026-01-01T00:00:00.000Z",
              };
            }

            throw new Error(
              "HTTP 503",
            );
          },
        },
        {
          maxPages:
            10,

          maxDepth:
            1,

          sameHostOnly:
            true,

          maxCandidates:
            10,

          sourceHint:
            "V8-28A",
        },
      );

    assert.equal(
      result.pagesFetched,
      1,
    );

    assert.equal(
      result.fetchErrors.length,
      1,
    );

    assert.equal(
      result.fetchErrors[0].url,
      brokenChild,
    );

    assert.equal(
      result.fetchErrors[0].error,
      "HTTP 503",
    );
  },
);

test(
  "V8-28A self-owned discovery rejects unsupported media types explicitly",
  async () => {
    const seed =
      "https://example.com/pdf";

    const result =
      await discoverWithSelfOwnedCrawl(
        [
          seed,
        ],
        {
          async fetch(url) {
            return {
              requestedUrl:
                url,

              finalUrl:
                url,

              redirectChain:
                [],

              status:
                200,

              mediaType:
                "application/pdf",

              body:
                "%PDF-1.7",

              bytes:
                new TextEncoder().encode(
                  "%PDF-1.7",
                ),

              fetchedAt:
                "2026-01-01T00:00:00.000Z",
            };
          },
        },
        {
          maxPages:
            10,

          maxDepth:
            0,

          sameHostOnly:
            true,

          maxCandidates:
            10,

          sourceHint:
            "V8-28A",
        },
      );

    assert.equal(
      result.pagesFetched,
      0,
    );

    assert.equal(
      result.candidates.length,
      0,
    );

    assert.equal(
      result.fetchErrors.length,
      1,
    );

    assert.equal(
      result.fetchErrors[0].url,
      seed,
    );

    assert.match(
      result.fetchErrors[0].error,
      /^V8_RESEARCH_UNSUPPORTED_MEDIA_TYPE:application\/pdf$/,
    );
  },
);