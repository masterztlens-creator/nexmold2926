import assert from "node:assert/strict";
import test from "node:test";

import { HttpPageFetcher } from "../../../.v8-build/src/v8/acquisition/page-fetcher.js";

const response = (body, options = {}) =>
  new Response(body, options);

test(
  "V8-10-A records complete observed redirect chain",
  async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url) => {
      calls.push(String(url));

      if (calls.length === 1) {
        return response("", {
          status: 301,
          headers: {
            location: "https://EXAMPLE.COM/step-2",
          },
        });
      }

      if (calls.length === 2) {
        return response("", {
          status: 302,
          headers: {
            location: "/final#fragment",
          },
        });
      }

      return response("<html><body>OK</body></html>", {
        status: 200,
        headers: {
          "content-type": "text/html",
        },
      });
    };

    try {
      const page = await new HttpPageFetcher().fetch(
        "HTTPS://EXAMPLE.COM:443/start#client",
      );

      assert.deepEqual(page.redirectChain, [
        "https://example.com/start",
        "https://example.com/step-2",
        "https://example.com/final",
      ]);

      assert.equal(
        page.requestedUrl,
        "https://example.com/start",
      );

      assert.equal(
        page.finalUrl,
        "https://example.com/final",
      );

      assert.equal(page.status, 200);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

test(
  "V8-10-A fails closed when Location is missing",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      response("", {
        status: 301,
      });

    try {
      await assert.rejects(
        () =>
          new HttpPageFetcher().fetch(
            "https://example.com/start",
          ),
        /V8_ACQUISITION_REDIRECT_PROVENANCE_UNKNOWN/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

test(
  "V8-10-A fails closed on redirect loops",
  async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = async () =>
      response("", {
        status: 302,
        headers: {
          location: "https://example.com/start",
        },
      });

    try {
      await assert.rejects(
        () =>
          new HttpPageFetcher().fetch(
            "https://example.com/start",
          ),
        /V8_ACQUISITION_REDIRECT_LOOP/,
      );
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);

test(
  "V8-10-E blocks redirect to a non-public host before network access",
  async () => {
    const originalFetch = globalThis.fetch;
    const calls = [];

    globalThis.fetch = async (url) => {
      calls.push(String(url));

      if (calls.length === 1) {
        return response("", {
          status: 302,
          headers: {
            location: "http://127.0.0.1/private",
          },
        });
      }

      throw new Error(
        "V8_TEST_UNEXPECTED_NETWORK_ACCESS",
      );
    };

    try {
      await assert.rejects(
        () =>
          new HttpPageFetcher().fetch(
            "https://example.com/start",
          ),
        /V8_ACQUISITION_NON_PUBLIC_HOST/,
      );

      assert.deepEqual(calls, [
        "https://example.com/start",
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  },
);
