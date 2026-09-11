import assert from "node:assert/strict"; import test from "node:test";
import { normalizeSourceUrl } from "../../../.v8-build/src/v8/acquisition/url-normalizer.js";
test("V8-10-A normalizes URL syntax without changing query semantics", () => assert.equal(normalizeSourceUrl("HTTPS://EXAMPLE.COM:443/path?a=2&b=1#section"), "https://example.com/path?a=2&b=1"));
test("V8-10-A normalizes empty path", () => assert.equal(normalizeSourceUrl("https://EXAMPLE.COM"), "https://example.com/"));
test("V8-10-A blocks unsupported scheme", () => assert.throws(() => normalizeSourceUrl("ftp://example.com/file"), /V8_ACQUISITION_UNSUPPORTED_URL/));
test("V8-10-A blocks malformed URL", () => assert.throws(() => normalizeSourceUrl("not-a-url"), /V8_ACQUISITION_INVALID_URL/));
