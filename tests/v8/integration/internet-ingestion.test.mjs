import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FoundationService,
  InMemoryFoundationStore,
  ingestInternetDocument,
} from "../../../.v8-build/src/v8/foundation/index.js";

const actor = { id: "internet-ingestor", role: "INGESTOR" };

async function withServer(handler, fn) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    return await fn(`http://127.0.0.1:${address.port}/fixture`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
}

test("Internet → Source → raw Snapshot → sealed Snapshot", async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("NEXMOLD V8 internet acquisition fixture");
  }, async (url) => {
    const root = mkdtempSync(join(tmpdir(), "nexmold-v8-internet-"));
    const store = new InMemoryFoundationStore();
    const service = new FoundationService(store);

    const result = await ingestInternetDocument(service, {
      url,
      title: "NEXMOLD V8 Internet Fixture",
      publisher: "NEXMOLD Test Authority",
      authority: "ENGINEERING_REFERENCE",
      version: "fixture-1",
      actor,
      snapshotRoot: root,
    });

    assert.equal(result.acquisition.status, 200);
    assert.equal(result.acquisition.finalUrl, url);
    assert.match(result.acquisition.documentHash, /^[a-f0-9]{64}$/);
    assert.equal(result.source.kind, "PUBLIC_WEB");
    assert.equal(result.source.documentHash, result.acquisition.documentHash);
    assert.equal(result.snapshotRecord.state, "SEALED");
    assert.equal(result.snapshotRecord.payload.contentHash, result.acquisition.documentHash);
    assert.equal(result.snapshotRecord.payload.blobLocator, result.rawSnapshotPath);
    assert.equal(existsSync(result.rawSnapshotPath), true);
    assert.equal(readFileSync(result.rawSnapshotPath, "utf8"), "NEXMOLD V8 internet acquisition fixture");

    const history = store.history("SNAPSHOT", result.snapshotRecord.aggregateId);
    assert.equal(history.length, 2);
    assert.equal(history[0].state, "CAPTURED");
    assert.equal(history[1].state, "SEALED");
    store.verifyChain();
  });
});
