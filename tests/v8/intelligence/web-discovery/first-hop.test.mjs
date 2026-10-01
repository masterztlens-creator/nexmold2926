import assert from "node:assert/strict";
import test from "node:test";

import {
  observeFirstHop,
} from "../../../../.v8-build/src/v8/intelligence/web-discovery/first-hop.js";

test("V8 first-hop discovery accepts explicitly observed public URLs", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding wall thickness",
      observations: [
        {
          url:
            "https://EXAMPLE.COM/guide/?utm_source=test#section",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
          kind:
            "INDEX_REFERENCE",
          title:
            "Injection Molding Wall Thickness Guide",
        },
      ],
    });

  assert.equal(
    result.accepted,
    1,
  );

  assert.equal(
    result.rejected,
    0,
  );

  assert.equal(
    result.candidates.length,
    1,
  );

  assert.equal(
    result.candidates[0].normalizedUrl,
    "https://example.com/guide",
  );

  assert.equal(
    result.candidates[0].sourceUrl,
    "https://example.com/search",
  );

  assert.equal(
    result.candidates[0].title,
    "Injection Molding Wall Thickness Guide",
  );

  assert.equal(
    result.candidates[0].discoveredAt,
    "2026-10-01T00:00:00.000Z",
  );
});

test("V8 first-hop discovery does not manufacture a URL from the query", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding wall thickness",
      observations: [],
    });

  assert.equal(
    result.accepted,
    0,
  );

  assert.equal(
    result.rejected,
    0,
  );
});

test("V8 first-hop discovery rejects invalid observed URLs", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "not-a-url",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "ftp://example.com/file",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "javascript:alert(1)",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
      ],
    });

  assert.equal(
    result.accepted,
    0,
  );

  assert.equal(
    result.rejected,
    3,
  );
});

test("V8 first-hop discovery rejects non-public observed URLs", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "http://localhost/private",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "http://127.0.0.1/private",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:01.000Z",
        },
        {
          url:
            "http://192.168.1.10/private",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:02.000Z",
        },
        {
          url:
            "http://10.0.0.1/private",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:03.000Z",
        },
      ],
    });

  assert.equal(
    result.accepted,
    0,
  );

  assert.equal(
    result.rejected,
    4,
  );
});

test("V8 first-hop discovery rejects credential-bearing observed URLs", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "https://user:password@example.com/private",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
      ],
    });

  assert.equal(
    result.accepted,
    0,
  );

  assert.equal(
    result.rejected,
    1,
  );
});

test("V8 first-hop discovery rejects invalid observation sources", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "https://example.com/a",
          observedFrom:
            "",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "https://example.com/b",
          observedFrom:
            "not-a-url",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "https://example.com/c",
          observedFrom:
            "http://localhost/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "https://example.com/d",
          observedFrom:
            "http://192.168.1.10/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
      ],
    });

  assert.equal(
    result.accepted,
    0,
  );

  assert.equal(
    result.rejected,
    4,
  );
});

test("V8 first-hop discovery rejects invalid observation timestamps", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "https://example.com/a",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "not-a-timestamp",
        },
        {
          url:
            "https://example.com/b",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "",
        },
      ],
    });

  assert.equal(
    result.accepted,
    0,
  );

  assert.equal(
    result.rejected,
    2,
  );
});

test("V8 first-hop discovery deduplicates canonical URLs", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "https://example.com/guide/?utm_source=a",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "https://EXAMPLE.COM/guide/",
          observedFrom:
            "https://example.com/other-search",
          observedAt:
            "2026-10-01T00:00:01.000Z",
        },
        {
          url:
            "https://example.com/other",
          observedFrom:
            "https://example.com/search",
          observedAt:
            "2026-10-01T00:00:02.000Z",
        },
      ],
    });

  assert.equal(
    result.accepted,
    2,
  );

  assert.deepEqual(
    result.candidates.map(
      (candidate) =>
        candidate.normalizedUrl,
    ),
    [
      "https://example.com/guide",
      "https://example.com/other",
    ],
  );

  assert.equal(
    result.candidates[0].sourceUrl,
    "https://example.com/search",
  );
});

test("V8 first-hop discovery preserves deterministic observation order", () => {
  const input = {
    query:
      "plastic injection molding",
    observations: [
      {
        url:
          "https://example.com/a",
        observedFrom:
          "https://example.com/index",
        observedAt:
          "2026-10-01T00:00:00.000Z",
      },
      {
        url:
          "https://example.com/b",
        observedFrom:
          "https://example.com/index",
        observedAt:
          "2026-10-01T00:00:01.000Z",
      },
    ],
  };

  const first =
    observeFirstHop(
      input,
    );

  const second =
    observeFirstHop(
      input,
    );

  assert.deepEqual(
    first,
    second,
  );
});

test("V8 first-hop discovery enforces the candidate limit", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      limit: 2,
      observations: [
        {
          url:
            "https://example.com/a",
          observedFrom:
            "https://example.com/index",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
        {
          url:
            "https://example.com/b",
          observedFrom:
            "https://example.com/index",
          observedAt:
            "2026-10-01T00:00:01.000Z",
        },
        {
          url:
            "https://example.com/c",
          observedFrom:
            "https://example.com/index",
          observedAt:
            "2026-10-01T00:00:02.000Z",
        },
      ],
    });

  assert.equal(
    result.accepted,
    2,
  );

  assert.equal(
    result.candidates.length,
    2,
  );
});

test("V8 first-hop discovery rejects invalid limits", () => {
  assert.throws(
    () =>
      observeFirstHop({
        query:
          "plastic injection molding",
        observations: [],
        limit: 0,
      }),
    /V8_FIRST_HOP_LIMIT_INVALID/,
  );

  assert.throws(
    () =>
      observeFirstHop({
        query:
          "plastic injection molding",
        observations: [],
        limit: 101,
      }),
    /V8_FIRST_HOP_LIMIT_INVALID/,
  );
});

test("V8 first-hop discovery rejects empty queries", () => {
  assert.throws(
    () =>
      observeFirstHop({
        query: "   ",
        observations: [],
      }),
    /V8_FIRST_HOP_QUERY_EMPTY/,
  );
});

test("V8 first-hop discovery uses the existing DiscoveryCandidate identity", () => {
  const result =
    observeFirstHop({
      query:
        "plastic injection molding",
      observations: [
        {
          url:
            "https://EXAMPLE.COM/path/?utm_source=test&x=1#section",
          observedFrom:
            "https://example.com/index",
          observedAt:
            "2026-10-01T00:00:00.000Z",
        },
      ],
    });

  assert.equal(
    result.candidates[0].normalizedUrl,
    "https://example.com/path?x=1",
  );
});