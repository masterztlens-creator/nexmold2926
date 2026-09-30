import test from "node:test";
import assert from "node:assert/strict";

import {
  canonicalizeUrl,
} from "../../../.v8-build/src/v8/research/discovery.js";

import {
  normalizeDiscoveryUrl,
} from "../../../.v8-build/src/v8/intelligence/web-discovery/candidate-normalizer.js";

const REQUIRED_EQUIVALENCE_CASES = [
  {
    name: "lowercases hostname",
    input: "https://EXAMPLE.COM/path",
  },
  {
    name: "removes fragment",
    input: "https://example.com/path#section",
  },
  {
    name: "removes default https port",
    input: "https://example.com:443/path",
  },
  {
    name: "removes default http port",
    input: "http://example.com:80/path",
  },
  {
    name: "removes trailing slash from non-root path",
    input: "https://example.com/path/",
  },
  {
    name: "removes utm tracking parameters",
    input: "https://example.com/path?utm_source=test&x=1",
  },
  {
    name: "removes gclid",
    input: "https://example.com/path?gclid=test&x=1",
  },
  {
    name: "removes fbclid",
    input: "https://example.com/path?fbclid=test&x=1",
  },
  {
    name: "removes msclkid",
    input: "https://example.com/path?msclkid=test&x=1",
  },
];

for (const testCase of REQUIRED_EQUIVALENCE_CASES) {
  test(`V8 Discovery Identity contract: ${testCase.name}`, () => {
    const research = canonicalizeUrl(testCase.input);
    const intelligence = normalizeDiscoveryUrl(testCase.input);

    assert.equal(
      intelligence,
      research,
      `Discovery identity divergence for ${testCase.name}`,
    );
  });
}

test("V8 Discovery Identity contract: root slash remains stable", () => {
  const input = "https://EXAMPLE.COM/";

  assert.equal(
    canonicalizeUrl(input),
    "https://example.com/",
  );

  assert.equal(
    normalizeDiscoveryUrl(input),
    "https://example.com/",
  );
});

test("V8 Discovery Identity contract: HTTP and HTTPS remain distinct schemes", () => {
  const http = canonicalizeUrl("http://example.com/path");
  const https = canonicalizeUrl("https://example.com/path");

  assert.notEqual(http, https);

  assert.equal(
    normalizeDiscoveryUrl("http://example.com/path"),
    http,
  );

  assert.equal(
    normalizeDiscoveryUrl("https://example.com/path"),
    https,
  );
});

test("V8 Discovery Identity contract: query parameter order is preserved", () => {
  const input = "https://example.com/path?b=2&a=1";

  const research = canonicalizeUrl(input);
  const intelligence = normalizeDiscoveryUrl(input);

  assert.equal(
    research,
    "https://example.com/path?b=2&a=1",
  );

  assert.equal(
    intelligence,
    "https://example.com/path?b=2&a=1",
  );

  assert.equal(
    intelligence,
    research,
    "Discovery authorities must preserve query parameter order identically.",
  );
});

test("V8 Discovery Identity contract: duplicate query-key order is preserved", () => {
  const input = "https://example.com/path?a=2&a=1";

  const research = canonicalizeUrl(input);
  const intelligence = normalizeDiscoveryUrl(input);

  assert.equal(
    research,
    "https://example.com/path?a=2&a=1",
  );

  assert.equal(
    intelligence,
    "https://example.com/path?a=2&a=1",
  );

  assert.equal(
    intelligence,
    research,
    "Discovery authorities must preserve duplicate query-key order identically.",
  );
});

test("V8 Discovery Identity contract: empty query values remain preserved", () => {
  const input = "https://example.com/path?a=&b=2";

  const research = canonicalizeUrl(input);
  const intelligence = normalizeDiscoveryUrl(input);

  assert.equal(
    research,
    "https://example.com/path?a=&b=2",
  );

  assert.equal(
    intelligence,
    "https://example.com/path?a=&b=2",
  );
});

test("V8 Discovery Identity contract: encoded query values expose no hidden authority", () => {
  const input = "https://example.com/path?q=hello%20world&x=%2F";

  const research = canonicalizeUrl(input);
  const intelligence = normalizeDiscoveryUrl(input);

  assert.equal(
    research,
    "https://example.com/path?q=hello%20world&x=%2F",
  );

  assert.equal(
    intelligence,
    "https://example.com/path?q=hello%20world&x=%2F",
  );

  assert.equal(
    intelligence,
    research,
    "Encoded query serialization must remain identical across Discovery authorities.",
  );
});

test("V8 Discovery Identity contract: invalid URLs fail consistently", () => {
  const invalidInputs = [
    "",
    "not-a-url",
    "ftp://example.com/path",
  ];

  for (const input of invalidInputs) {
    assert.throws(
      () => canonicalizeUrl(input),
      `Research canonicalizer unexpectedly accepted: ${input}`,
    );

    assert.equal(
      normalizeDiscoveryUrl(input),
      null,
      `Intelligence normalizer unexpectedly accepted: ${input}`,
    );
  }
});