import assert from "node:assert/strict";
import test from "node:test";

import { evaluateSourceUrl } from "../../../.v8-build/src/v8/acquisition/source-policy.js";

test("V8-10-D accepts HTTP public hostname", () => {
  const decision = evaluateSourceUrl("http://EXAMPLE.COM:80");

  assert.equal(decision.status, "ELIGIBLE");
  assert.equal(decision.normalizedUrl, "http://example.com/");
});

test("V8-10-D accepts HTTPS public hostname", () => {
  const decision = evaluateSourceUrl("https://EXAMPLE.COM:443/a#b");

  assert.equal(decision.status, "ELIGIBLE");
  assert.equal(decision.normalizedUrl, "https://example.com/a");
});

test("V8-10-D blocks unsupported scheme", () => {
  const decision = evaluateSourceUrl("ftp://example.com/a");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_UNSUPPORTED_URL");
});

test("V8-10-D blocks malformed URL", () => {
  const decision = evaluateSourceUrl("not-a-url");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_INVALID_URL");
});

test("V8-10-D blocks localhost", () => {
  const decision = evaluateSourceUrl("http://localhost:8080/internal");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks localhost subdomain", () => {
  const decision = evaluateSourceUrl("https://api.localhost/internal");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks .local hostname", () => {
  const decision = evaluateSourceUrl("http://printer.local/status");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 loopback", () => {
  const decision = evaluateSourceUrl("http://127.0.0.1/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 private 10/8", () => {
  const decision = evaluateSourceUrl("http://10.0.0.10/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 private 172.16/12", () => {
  const decision = evaluateSourceUrl("http://172.16.10.20/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 private 192.168/16", () => {
  const decision = evaluateSourceUrl("http://192.168.1.100/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 link-local", () => {
  const decision = evaluateSourceUrl("http://169.254.1.10/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 unspecified", () => {
  const decision = evaluateSourceUrl("http://0.0.0.0/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv4 multicast", () => {
  const decision = evaluateSourceUrl("http://224.0.0.1/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv6 loopback", () => {
  const decision = evaluateSourceUrl("http://[::1]/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv6 unique-local address", () => {
  const decision = evaluateSourceUrl("http://[fc00::1]/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv6 link-local address", () => {
  const decision = evaluateSourceUrl("http://[fe80::1]/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks IPv6 multicast address", () => {
  const decision = evaluateSourceUrl("http://[ff02::1]/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(decision.reason, "V8_ACQUISITION_NON_PUBLIC_HOST");
});

test("V8-10-D blocks embedded source credentials", () => {
  const decision = evaluateSourceUrl("https://user:password@example.com/");

  assert.equal(decision.status, "BLOCKED");
  assert.equal(
    decision.reason,
    "V8_ACQUISITION_SOURCE_CREDENTIALS_FORBIDDEN",
  );
});