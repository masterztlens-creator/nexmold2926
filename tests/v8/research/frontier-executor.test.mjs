import assert from "node:assert/strict";
import test from "node:test";

import {
  executeResearchFrontier,
} from "../../../.v8-build/src/v8/research/index.js";

function createPageFetcher(pages) {
  return {
    async fetch(url) {
      const page = pages[url];

      if (!page) {
        throw new Error(`PAGE_NOT_FOUND:${url}`);
      }

      return {
        requestedUrl: url,
        finalUrl: url,
        redirectChain: [],
        status: 200,
        mediaType: page.mediaType ?? "text/html",
        body: page.body,
        bytes: new TextEncoder().encode(page.body),
        fetchedAt:
          page.fetchedAt ??
          "2026-09-28T00:00:00.000Z",
      };
    },
  };
}

function seed(url) {
  return {
    url,
    normalizedUrl: url,
    kind: "SEED",
    discoveredAt:
      "2026-09-28T00:00:00.000Z",
  };
}

test(
  "frontier executor closes discovery loop through links",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body: `
          <html>
            <body>
              <a href="/article">Article</a>
            </body>
          </html>
        `,
      },

      "https://example.com/article": {
        body: `
          <html>
            <body>
              <a href="/reference">Reference</a>
            </body>
          </html>
        `,
      },

      "https://example.com/reference": {
        body: `
          <html>
            <body>
              <p>Evidence page.</p>
            </body>
          </html>
        `,
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 10,
          maxDepth: 2,
          sameHostOnly: true,
        },
      );

    assert.equal(
      result.pagesFetched,
      3,
    );

    assert.equal(
      result.errors.length,
      0,
    );

    assert.equal(
      result.candidatesDiscovered,
      2,
    );

    assert.deepEqual(
      result.candidates.map(
        (candidate) =>
          candidate.normalizedUrl,
      ),
      [
        "https://example.com/start",
        "https://example.com/article",
        "https://example.com/reference",
      ],
    );
  },
);

test(
  "frontier executor preserves discovery provenance",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body: `
          <a
            href="/engineering"
            title="Engineering Guide"
          >
            Engineering
          </a>
        `,
        fetchedAt:
          "2026-09-28T01:00:00.000Z",
      },

      "https://example.com/engineering": {
        body: "<p>Engineering</p>",
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 5,
          maxDepth: 1,
        },
      );

    const candidate =
      result.candidates.find(
        (item) =>
          item.normalizedUrl ===
          "https://example.com/engineering",
      );

    assert.ok(candidate);

    assert.equal(
      candidate.kind,
      "LINK",
    );

    assert.equal(
      candidate.sourceUrl,
      "https://example.com/start",
    );

    assert.equal(
      candidate.title,
      "Engineering Guide",
    );

    assert.equal(
      candidate.discoveredAt,
      "2026-09-28T01:00:00.000Z",
    );
  },
);

test(
  "frontier executor enforces maxDepth",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body:
          '<a href="/level-1">Level 1</a>',
      },

      "https://example.com/level-1": {
        body:
          '<a href="/level-2">Level 2</a>',
      },

      "https://example.com/level-2": {
        body:
          '<a href="/level-3">Level 3</a>',
      },

      "https://example.com/level-3": {
        body: "<p>Level 3</p>",
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 20,
          maxDepth: 1,
        },
      );

    assert.deepEqual(
      result.fetchedPages.map(
        (page) => page.finalUrl,
      ),
      [
        "https://example.com/start",
        "https://example.com/level-1",
      ],
    );

    assert.equal(
      result.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://example.com/level-2",
      ),
      true,
    );

    assert.equal(
      result.pagesFetched,
      2,
    );
  },
);

test(
  "frontier executor enforces maxPages",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body: `
          <a href="/a">A</a>
          <a href="/b">B</a>
          <a href="/c">C</a>
        `,
      },

      "https://example.com/a": {
        body: "<p>A</p>",
      },

      "https://example.com/b": {
        body: "<p>B</p>",
      },

      "https://example.com/c": {
        body: "<p>C</p>",
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 2,
          maxDepth: 2,
        },
      );

    assert.equal(
      result.pagesFetched,
      2,
    );
  },
);

test(
  "frontier executor records fetch failures without fabricating discovery",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body:
          '<a href="/missing">Missing</a>',
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 5,
          maxDepth: 1,
        },
      );

    assert.equal(
      result.pagesFetched,
      1,
    );

    assert.equal(
      result.errors.length,
      1,
    );

    assert.equal(
      result.errors[0].url,
      "https://example.com/missing",
    );

    assert.equal(
      result.errors[0].error,
      "PAGE_NOT_FOUND:https://example.com/missing",
    );
  },
);

test(
  "frontier executor rejects cross-host expansion when sameHostOnly is enabled",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body: `
          <a href="https://other.example/article">
            External
          </a>
          <a href="/internal">
            Internal
          </a>
        `,
      },

      "https://example.com/internal": {
        body: "<p>Internal</p>",
      },

      "https://other.example/article": {
        body: "<p>External</p>",
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 10,
          maxDepth: 2,
          sameHostOnly: true,
        },
      );

    assert.equal(
      result.pagesFetched,
      2,
    );

    assert.equal(
      result.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://other.example/article",
      ),
      false,
    );
  },
);

test(
  "frontier executor supports sitemap expansion",
  async () => {
    const fetcher = createPageFetcher({
      "https://example.com/start": {
        body: `
          <link
            rel="sitemap"
            href="/sitemap.xml"
          />
        `,
      },

      "https://example.com/sitemap.xml": {
        mediaType: "application/xml",
        body: `
          <urlset>
            <url>
              <loc>
                https://example.com/article-a
              </loc>
            </url>
            <url>
              <loc>
                https://example.com/article-b
              </loc>
            </url>
          </urlset>
        `,
      },

      "https://example.com/article-a": {
        body: "<p>A</p>",
      },

      "https://example.com/article-b": {
        body: "<p>B</p>",
      },
    });

    const result =
      await executeResearchFrontier(
        [
          seed(
            "https://example.com/start",
          ),
        ],
        fetcher,
        {
          maxPages: 10,
          maxDepth: 2,
          sameHostOnly: true,
        },
      );

    assert.equal(
      result.pagesFetched,
      4,
    );

    assert.equal(
      result.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://example.com/article-a",
      ),
      true,
    );

    assert.equal(
      result.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://example.com/article-b",
      ),
      true,
    );
  },
);