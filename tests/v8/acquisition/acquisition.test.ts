import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryFoundationStore } from "../../../.v8-build/src/v8/foundation/store.js";
import { ingestFetchedPage } from "../../../.v8-build/src/v8/acquisition/foundation-adapter.js";
import { extractTextEvidence } from "../../../.v8-build/src/v8/acquisition/source-extractor.js";

test("V8-05 ingests web page as sealed snapshot and unverified evidence", () => {
  const store = new InMemoryFoundationStore();
  const page = {
    requestedUrl: "https://example.com/dfm",
    finalUrl: "https://example.com/dfm",
    redirectChain: ["https://example.com/dfm"],
    status: 200,
    mediaType: "text/html",
    body: "<html><body><h1>DFM</h1><p>Wall thickness should be uniform.</p></body></html>",
    bytes: new TextEncoder().encode("<html><body><h1>DFM</h1><p>Wall thickness should be uniform.</p></body></html>"),
    fetchedAt: "2026-09-09T00:00:00.000Z",
  };
  const result = ingestFetchedPage(store, page, extractTextEvidence(page.body));
  const snapshot = store.get("SNAPSHOT", result.snapshotId);
  assert.equal(snapshot?.state, "SEALED");
  assert.equal(store.auditTrail().filter((r) => r.aggregateType === "EVIDENCE").length, 1);
  assert.equal(store.auditTrail().find((r) => r.aggregateType === "EVIDENCE")?.state, "INGESTED");
  store.verifyChain();
});

test("V8-05 extractor never invents evidence from empty HTML", () => {
  assert.deepEqual(extractTextEvidence("<html><script>alert(1)</script></html>"), []);
});
