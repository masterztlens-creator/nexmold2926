import assert from "node:assert/strict";
import test from "node:test";

import {
  SearXNGSearchProvider,
} from "../../../.v8-build/src/v8/acquisition/searxng-search-provider.js";

function createJsonResponse(
  body,
  status = 200,
  headers = {
    "content-type": "application/json",
  },
) {
  return new Response(
    JSON.stringify(body),
    {
      status,
      headers,
    },
  );
}

test(
  "V8 SearXNG provider maps JSON results to SearchResult",
  async () => {
    const originalFetch =
      globalThis.fetch;

    let capturedUrl;

    globalThis.fetch =
      async (
        input,
        init,
      ) => {
        capturedUrl =
          String(input);

        assert.equal(
          init?.method,
          "GET",
        );

        assert.equal(
          init?.headers?.accept,
          "application/json",
        );

        return createJsonResponse({
          results: [
            {
              url:
                "https://example.com/engineering",
              title:
                "Engineering Guide",
              content:
                "Authoritative engineering information.",
            },
            {
              url:
                "https://example.org/design",
              title:
                "Design Guide",
              snippet:
                "Design considerations.",
            },
          ],
        });
      };

    try {
      const provider =
        new SearXNGSearchProvider({
          endpoint:
            "https://search.example.test",
          language:
            "en",
          categories:
            "general",
          page:
            1,
          safeSearch:
            0,
        });

      const results =
        await provider.search(
          "plastic injection molding wall thickness",
        );

      assert.equal(
        provider.name,
        "searxng-search",
      );

      assert.equal(
        results.length,
        2,
      );

      assert.deepEqual(
        results[0],
        {
          url:
            "https://example.com/engineering",
          title:
            "Engineering Guide",
          snippet:
            "Authoritative engineering information.",
        },
      );

      assert.deepEqual(
        results[1],
        {
          url:
            "https://example.org/design",
          title:
            "Design Guide",
          snippet:
            "Design considerations.",
        },
      );

      assert.ok(
        capturedUrl,
      );

      const parsed =
        new URL(
          capturedUrl,
        );

      assert.equal(
        parsed.pathname,
        "/search",
      );

      assert.equal(
        parsed.searchParams.get(
          "q",
        ),
        "plastic injection molding wall thickness",
      );

      assert.equal(
        parsed.searchParams.get(
          "format",
        ),
        "json",
      );

      assert.equal(
        parsed.searchParams.get(
          "language",
        ),
        "en",
      );

      assert.equal(
        parsed.searchParams.get(
          "categories",
        ),
        "general",
      );

      assert.equal(
        parsed.searchParams.get(
          "pageno",
        ),
        "1",
      );

      assert.equal(
        parsed.searchParams.get(
          "safesearch",
        ),
        "0",
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);

test(
  "V8 SearXNG provider rejects empty queries",
  async () => {
    const provider =
      new SearXNGSearchProvider({
        endpoint:
          "https://search.example.test",
      });

    await assert.rejects(
      () =>
        provider.search("   "),
      {
        message:
          "V8_ACQUISITION_EMPTY_SEARCH_QUERY",
      },
    );
  },
);

test(
  "V8 SearXNG provider rejects non-success HTTP responses",
  async () => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () =>
        new Response(
          "rate limited",
          {
            status: 429,
            headers: {
              "content-type":
                "text/plain",
            },
          },
        );

    try {
      const provider =
        new SearXNGSearchProvider({
          endpoint:
            "https://search.example.test",
        });

      await assert.rejects(
        () =>
          provider.search(
            "injection molding",
          ),
        {
          message:
            "V8_ACQUISITION_SEARXNG_HTTP_429:rate limited",
        },
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);

test(
  "V8 SearXNG provider rejects non-JSON responses",
  async () => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () =>
        new Response(
          "<html>not json</html>",
          {
            status: 200,
            headers: {
              "content-type":
                "text/html",
            },
          },
        );

    try {
      const provider =
        new SearXNGSearchProvider({
          endpoint:
            "https://search.example.test",
        });

      await assert.rejects(
        () =>
          provider.search(
            "injection molding",
          ),
        {
          message:
            "V8_ACQUISITION_SEARXNG_CONTENT_TYPE_INVALID:text/html",
        },
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);

test(
  "V8 SearXNG provider ignores invalid result URLs",
  async () => {
    const originalFetch =
      globalThis.fetch;

    globalThis.fetch =
      async () =>
        createJsonResponse({
          results: [
            {
              url:
                "javascript:alert(1)",
              title:
                "Invalid",
            },
            {
              url:
                "not-a-url",
              title:
                "Invalid",
            },
            {
              url:
                "https://example.com/valid",
              title:
                "Valid",
            },
          ],
        });

    try {
      const provider =
        new SearXNGSearchProvider({
          endpoint:
            "https://search.example.test",
        });

      const results =
        await provider.search(
          "injection molding",
        );

      assert.equal(
        results.length,
        1,
      );

      assert.deepEqual(
        results[0],
        {
          url:
            "https://example.com/valid",
          title:
            "Valid",
          snippet:
            undefined,
        },
      );
    } finally {
      globalThis.fetch =
        originalFetch;
    }
  },
);