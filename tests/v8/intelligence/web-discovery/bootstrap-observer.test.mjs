import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveBootstrapSources,
  bootstrapSourcesToCandidates,
} from "../../../../.v8-build/src/v8/intelligence/web-discovery/bootstrap.js";

import {
  observeInternetFirstHop,
} from "../../../../.v8-build/src/v8/intelligence/web-discovery/first-hop-observer.js";

const CORPUS = [
  {
    id: "iso:294-1",
    url: "https://www.iso.org/standard/67036.html",
    title:
      "ISO 294-1 Plastics Injection Moulding of Test Specimens",
    terms: [
      "plastics",
      "injection",
      "moulding",
      "molding",
      "test specimens",
      "thermoplastic",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },
  {
    id: "iso:294-4",
    url: "https://www.iso.org/standard/70413.html",
    title:
      "ISO 294-4 Plastics Injection Moulding Shrinkage",
    terms: [
      "plastics",
      "injection",
      "moulding",
      "molding",
      "shrinkage",
      "standards",
    ],
    authority:
      "AUTHORITATIVE_STANDARD",
  },
];

function fakeFetcher(pages) {
  return {
    async fetch(url) {
      const page = pages[url];

      if (!page) {
        throw new Error(
          `UNEXPECTED_URL:${url}`,
        );
      }

      return Object.freeze({
        requestedUrl: url,
        finalUrl: page.finalUrl ?? url,
        redirectChain: [],
        status: 200,
        mediaType:
          page.mediaType ??
          "text/html",
        body: page.body,
        bytes: new TextEncoder().encode(
          page.body,
        ),
        fetchedAt:
          page.fetchedAt ??
          "2026-10-01T00:00:00.000Z",
      });
    },
  };
}

test(
  "V8 bootstrap resolver only returns explicitly registered sources",
  () => {
    const result =
      resolveBootstrapSources(
        "plastic injection molding",
        CORPUS,
      );

    assert.equal(
      result.matched.length,
      2,
    );

    assert.equal(
      result.matched[0].id,
      "iso:294-1",
    );

    assert.equal(
      result.matched[1].id,
      "iso:294-4",
    );
  },
);

test(
  "V8 bootstrap resolver never manufactures URLs from query text",
  () => {
    const result =
      resolveBootstrapSources(
        "completely unknown topic xyz",
        CORPUS,
      );

    assert.equal(
      result.matched.length,
      0,
    );
  },
);

test(
  "V8 bootstrap resolver rejects non-public sources",
  () => {
    const result =
      resolveBootstrapSources(
        "plastic injection molding",
        [
          ...CORPUS,
          {
            id: "invalid:local",
            url:
              "http://127.0.0.1:8080/search",
            title:
              "Invalid Local Source",
            terms: [
              "plastic",
              "injection",
            ],
            authority:
              "ENGINEERING_REFERENCE",
          },
        ],
      );

    assert.equal(
      result.matched.length,
      2,
    );

    assert.equal(
      result.rejected.length,
      1,
    );

    assert.equal(
      result.rejected[0].id,
      "invalid:local",
    );
  },
);

test(
  "V8 bootstrap sources reuse existing DiscoveryCandidate identity",
  () => {
    const candidates =
      bootstrapSourcesToCandidates(
        CORPUS.slice(0, 1),
        "2026-10-01T00:00:00.000Z",
      );

    assert.equal(
      candidates.length,
      1,
    );

    assert.equal(
      candidates[0].normalizedUrl,
      "https://www.iso.org/standard/67036.html",
    );

    assert.equal(
      candidates[0].kind,
      "SEED",
    );

    assert.equal(
      candidates[0].sourceUrl,
      "https://www.iso.org/standard/67036.html",
    );
  },
);

test(
  "V8-owned first-hop observer performs real observation through PageFetcher",
  async () => {
    const fetcher =
      fakeFetcher({
        "https://www.iso.org/standard/67036.html":
          {
            body: `
              <html>
                <head>
                  <title>ISO 294-1</title>
                  <link
                    rel="canonical"
                    href="https://www.iso.org/standard/67036.html"
                  >
                </head>
                <body>
                  <a href="https://www.iso.org/standard/70413.html">
                    Related standard
                  </a>
                </body>
              </html>
            `,
          },

        "https://www.iso.org/standard/70413.html":
          {
            body: `
              <html>
                <body>
                  <a href="https://www.iso.org/standard/76649.html">
                    Related standard
                  </a>
                </body>
              </html>
            `,
          },
      });

    const result =
      await observeInternetFirstHop(
        "plastic injection molding",
        CORPUS,
        fetcher,
        {
          limit: 10,
        },
      );

    assert.equal(
      result.pagesObserved,
      2,
    );

    assert.equal(
      result.fetchErrors.length,
      0,
    );

    assert.equal(
      result.bootstrap.matched.length,
      2,
    );

    assert.ok(
      result.observation.accepted >= 2,
    );

    assert.ok(
      result.observation.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://www.iso.org/standard/67036.html",
      ),
    );

    assert.ok(
      result.observation.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://www.iso.org/standard/70413.html",
      ),
    );

    assert.ok(
      result.observation.candidates.some(
        (candidate) =>
          candidate.normalizedUrl ===
          "https://www.iso.org/standard/76649.html",
      ),
    );
  },
);

test(
  "V8-owned first-hop observer fails closed when bootstrap fetch fails",
  async () => {
    const fetcher = {
      async fetch() {
        throw new Error(
          "NETWORK_FAILURE",
        );
      },
    };

    const result =
      await observeInternetFirstHop(
        "plastic injection molding",
        CORPUS,
        fetcher,
      );

    assert.equal(
      result.pagesObserved,
      0,
    );

    assert.equal(
      result.fetchErrors.length,
      2,
    );

    assert.equal(
      result.observation.accepted,
      0,
    );
  },
);

test(
  "V8-owned first-hop observer preserves deterministic results",
  async () => {
    const fetcher =
      fakeFetcher({
        "https://www.iso.org/standard/67036.html":
          {
            body:
              "<html><body></body></html>",
          },
        "https://www.iso.org/standard/70413.html":
          {
            body:
              "<html><body></body></html>",
          },
      });

    const first =
      await observeInternetFirstHop(
        "plastic injection molding",
        CORPUS,
        fetcher,
      );

    const second =
      await observeInternetFirstHop(
        "plastic injection molding",
        CORPUS,
        fetcher,
      );

    assert.deepEqual(
      first.observation,
      second.observation,
    );
  },
);