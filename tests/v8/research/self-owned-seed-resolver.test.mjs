import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveResearchSeeds,
} from "../../../.v8-build/src/v8/intelligence/research-planner/self-owned-seed-resolver.js";

test("V8 self-owned seed resolver accepts explicit public HTTPS seeds", () => {
  const result =
    resolveResearchSeeds([
      {
        url:
          "HTTPS://Example.COM/engineering/?utm_source=test#section",
        source: "AUTHORITY",
        reason:
          "Explicit authoritative engineering source",
      },
    ]);

  assert.equal(
    result.accepted.length,
    1,
  );

  assert.equal(
    result.accepted[0].url,
    "https://example.com/engineering/?utm_source=test#section",
  );

  assert.equal(
    result.accepted[0].canonicalUrl,
    "https://example.com/engineering",
  );

  assert.equal(
    result.accepted[0].source,
    "AUTHORITY",
  );

  assert.equal(
    result.rejected.length,
    0,
  );
});

test("V8 self-owned seed resolver rejects private and local targets", () => {
  const result =
    resolveResearchSeeds([
      {
        url:
          "http://127.0.0.1:8080/source",
        source: "DIRECT",
        reason:
          "Must be rejected",
      },
      {
        url:
          "http://localhost/source",
        source: "DIRECT",
        reason:
          "Must be rejected",
      },
      {
        url:
          "http://192.168.1.10/source",
        source: "DIRECT",
        reason:
          "Must be rejected",
      },
    ]);

  assert.equal(
    result.accepted.length,
    0,
  );

  assert.equal(
    result.rejected.length,
    3,
  );

  for (
    const rejected of
      result.rejected
  ) {
    assert.ok(
      rejected.reason.length > 0,
    );
  }
});

test("V8 self-owned seed resolver rejects non-HTTP schemes", () => {
  const result =
    resolveResearchSeeds([
      {
        url:
          "file:///etc/passwd",
        source: "DIRECT",
        reason:
          "Unsupported source scheme",
      },
      {
        url:
          "javascript:alert(1)",
        source: "DIRECT",
        reason:
          "Unsupported source scheme",
      },
    ]);

  assert.equal(
    result.accepted.length,
    0,
  );

  assert.equal(
    result.rejected.length,
    2,
  );
});

test("V8 self-owned seed resolver deduplicates canonical URLs", () => {
  const result =
    resolveResearchSeeds([
      {
        url:
          "https://example.com/engineering/?utm_source=a",
        source: "AUTHORITY",
        reason:
          "First explicit seed",
      },
      {
        url:
          "https://EXAMPLE.COM/engineering/",
        source: "DIRECT",
        reason:
          "Equivalent explicit seed",
      },
      {
        url:
          "https://example.com/other",
        source: "ENTITY",
        reason:
          "Independent explicit seed",
      },
    ]);

  assert.equal(
    result.accepted.length,
    2,
  );

  assert.deepEqual(
    result.accepted.map(
      (seed) =>
        seed.canonicalUrl,
    ),
    [
      "https://example.com/engineering",
      "https://example.com/other",
    ],
  );
});

test("V8 self-owned seed resolver does not manufacture URLs from reasons", () => {
  const result =
    resolveResearchSeeds([
      {
        url:
          "https://example.com/authority",
        source: "AUTHORITY",
        reason:
          "Research plastic injection molding wall thickness",
      },
    ]);

  assert.equal(
    result.accepted.length,
    1,
  );

  assert.equal(
    result.accepted[0].canonicalUrl,
    "https://example.com/authority",
  );

  assert.notEqual(
    result.accepted[0].canonicalUrl,
    "https://example.com/plastic-injection-molding-wall-thickness",
  );
});

test("V8 self-owned seed resolver rejects empty reasons", () => {
  const result =
    resolveResearchSeeds([
      {
        url:
          "https://example.com/source",
        source: "DIRECT",
        reason: "   ",
      },
    ]);

  assert.equal(
    result.accepted.length,
    0,
  );

  assert.equal(
    result.rejected.length,
    1,
  );

  assert.equal(
    result.rejected[0].reason,
    "V8_RESEARCH_SEED_EMPTY_REASON",
  );
});

test("V8 self-owned seed resolver is deterministic for identical input", () => {
  const seeds = [
    {
      url:
        "https://example.com/a/?utm_source=test",
      source: "AUTHORITY",
      reason:
        "Authoritative source",
    },
    {
      url:
        "https://example.com/b",
      source: "ENTITY",
      reason:
        "Entity source",
    },
  ];

  const first =
    resolveResearchSeeds(
      seeds,
    );

  const second =
    resolveResearchSeeds(
      seeds,
    );

  assert.deepEqual(
    first,
    second,
  );
});