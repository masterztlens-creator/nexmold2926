import assert from "node:assert/strict"; import test from "node:test";
import { evaluateSourceUrl } from "../../../.v8-build/src/v8/acquisition/source-policy.js";
test("V8-10-A accepts HTTP", () => { const d=evaluateSourceUrl("http://EXAMPLE.COM:80"); assert.equal(d.status,"ELIGIBLE"); assert.equal(d.normalizedUrl,"http://example.com/"); });
test("V8-10-A accepts HTTPS", () => { const d=evaluateSourceUrl("https://EXAMPLE.COM:443/a#b"); assert.equal(d.status,"ELIGIBLE"); assert.equal(d.normalizedUrl,"https://example.com/a"); });
test("V8-10-A blocks unsupported scheme", () => { const d=evaluateSourceUrl("ftp://example.com/a"); assert.equal(d.status,"BLOCKED"); assert.equal(d.reason,"V8_ACQUISITION_UNSUPPORTED_URL"); });
test("V8-10-A blocks malformed URL", () => { const d=evaluateSourceUrl("not-a-url"); assert.equal(d.status,"BLOCKED"); assert.equal(d.reason,"V8_ACQUISITION_INVALID_URL"); });
