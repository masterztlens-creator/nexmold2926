import assert from "node:assert/strict";
import test from "node:test";
import { InMemoryFoundationStore } from "../../../.v8-build/src/v8/foundation/store.js";
import { ingestFetchedPage } from "../../../.v8-build/src/v8/acquisition/foundation-adapter.js";

test("V8-10-B separates source identity from redirect resolution", () => {
  const store = new InMemoryFoundationStore();
  const requestedUrl = "https://example.com/original";
  const finalUrl = "https://example.com/resolved";
  const body = "<html><body>resolved</body></html>";
  const result = ingestFetchedPage(store, {
    requestedUrl, finalUrl, redirectChain: [requestedUrl, finalUrl], status: 200,
    mediaType: "text/html", body, bytes: new TextEncoder().encode(body),
    fetchedAt: "2026-09-10T00:00:00.000Z",
  }, []);

  const source = store.get("SOURCE", result.sourceId);
  const snapshot = store.get("SNAPSHOT", result.snapshotId);
  assert.ok(source);
  assert.equal(result.sourceId, requestedUrl);
  assert.equal(source?.payload.url, requestedUrl);
  assert.notEqual(result.sourceId, finalUrl);
  assert.equal(snapshot?.payload.requestedUrl, requestedUrl);
  assert.equal(snapshot?.payload.finalUrl, finalUrl);
  assert.deepEqual(snapshot?.payload.redirectChain, [requestedUrl, finalUrl]);
  assert.equal(snapshot?.payload.sourceId, requestedUrl);
  store.verifyChain();
});
