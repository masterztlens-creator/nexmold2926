import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

import {
  ingestFetchedPage,
} from "../../../.v8-build/src/v8/acquisition/foundation-adapter.js";

import {
  buildEvidencePayloads,
} from "../../../.v8-build/src/v8/acquisition/evidence-builder.js";

import {
  HttpPageFetcher,
} from "../../../.v8-build/src/v8/acquisition/page-fetcher.js";

import {
  extractTextEvidence,
} from "../../../.v8-build/src/v8/acquisition/source-extractor.js";

import {
  rawBytesFingerprint,
} from "../../../.v8-build/src/v8/foundation/hash.js";

import {
  sourceId,
} from "../../../.v8-build/src/v8/domain/primitives.js";

import type {
  SnapshotPayload,
} from "../../../.v8-build/src/v8/foundation/types.js";


test("V8-05 ingests web page as sealed snapshot and unverified evidence", () => {
  const store = new InMemoryFoundationStore();

  const body =
    "<html><body><h1>DFM</h1><p>Wall thickness should be uniform.</p></body></html>";

  const bytes = new TextEncoder().encode(body);

  const page = {
    requestedUrl: "https://example.com/dfm",
    finalUrl: "https://example.com/dfm",
    redirectChain: [
      "https://example.com/dfm",
    ],
    status: 200,
    mediaType: "text/html",
    body,
    bytes,
    fetchedAt: "2026-09-09T00:00:00.000Z",
  };

  const result = ingestFetchedPage(
    store,
    page,
    extractTextEvidence(page.body),
  );

  const snapshot = store.get(
    "SNAPSHOT",
    result.snapshotId,
  );

  assert.equal(
    snapshot?.state,
    "SEALED",
  );

  const snapshotPayload =
    snapshot?.payload as SnapshotPayload | undefined;

  assert.equal(
    snapshotPayload?.contentHash,
    rawBytesFingerprint(bytes),
  );

  assert.equal(
    store
      .auditTrail()
      .filter(
        (r) =>
          r.aggregateType === "EVIDENCE",
      ).length,
    1,
  );

  assert.equal(
    store
      .auditTrail()
      .find(
        (r) =>
          r.aggregateType === "EVIDENCE",
      )?.state,
    "INGESTED",
  );

  const evidenceRecord = store
    .auditTrail()
    .find(
      (r) =>
        r.aggregateType === "EVIDENCE",
    );

  assert.ok(evidenceRecord);

  assert.equal(
    evidenceRecord?.lineage.some(
      (entry) =>
        entry.type === "SNAPSHOT" &&
        entry.id === result.snapshotId,
    ),
    true,
  );

  store.verifyChain();
});


test("V8-05 extractor never invents evidence from empty HTML", () => {
  assert.deepEqual(
    extractTextEvidence(
      "<html><script>alert(1)</script></html>",
    ),
    [],
  );
});


test("V8-05 raw Snapshot hash is derived from response bytes", () => {
  const bodyA = "<p>A</p>";
  const bodyB = "<p>B</p>";

  const bytesA = new TextEncoder().encode(bodyA);
  const bytesB = new TextEncoder().encode(bodyB);

  assert.notEqual(
    rawBytesFingerprint(bytesA),
    rawBytesFingerprint(bytesB),
  );
});


test("V8-05 rejects non-success HTTP status before persistence", () => {
  const store = new InMemoryFoundationStore();

  const page = {
    requestedUrl: "https://example.com/not-found",
    finalUrl: "https://example.com/not-found",
    redirectChain: [
      "https://example.com/not-found",
    ],
    status: 404,
    mediaType: "text/html",
    body: "<html><body>Not Found</body></html>",
    bytes: new TextEncoder().encode(
      "<html><body>Not Found</body></html>",
    ),
    fetchedAt: "2026-09-09T00:00:00.000Z",
  };

  assert.throws(
    () =>
      ingestFetchedPage(
        store,
        page,
        [],
      ),
    /V8_ACQUISITION_HTTP_STATUS_404/,
  );

  assert.equal(
    store.auditTrail().length,
    0,
  );
});


test("V8-05 rejects oversized response before persistence", () => {
  const store = new InMemoryFoundationStore();

  const bytes = new Uint8Array(11);

  const page = {
    requestedUrl: "https://example.com/large",
    finalUrl: "https://example.com/large",
    redirectChain: [
      "https://example.com/large",
    ],
    status: 200,
    mediaType: "text/html",
    body: "oversized",
    bytes,
    fetchedAt: "2026-09-09T00:00:00.000Z",
  };

  assert.throws(
    () =>
      ingestFetchedPage(
        store,
        page,
        [],
        {
          maxBytes: 10,
        },
      ),
    /V8_ACQUISITION_RESPONSE_TOO_LARGE/,
  );

  assert.equal(
    store.auditTrail().length,
    0,
  );
});


test("V8-05 Evidence hash is bound to Snapshot content", () => {
  const candidate = {
    locator: "https://example.com/dfm",
    excerpt: "Wall thickness should be uniform.",
    parameter: "wallThickness",
    value: 2,
    unit: "mm",
    extractionConfidence: "HIGH" as const,
  };

  const snapshotA: SnapshotPayload = {
    sourceId: sourceId(
      "https://example.com/dfm",
    ),
    capturedAt: "2026-09-09T00:00:00.000Z",
    locator: "https://example.com/dfm",
    contentHash: rawBytesFingerprint(
      new TextEncoder().encode(
        "<p>A</p>",
      ),
    ),
    metadataOnly: false,
    payload: "<p>A</p>",
  };

  const snapshotB: SnapshotPayload = {
    ...snapshotA,
    contentHash: rawBytesFingerprint(
      new TextEncoder().encode(
        "<p>B</p>",
      ),
    ),
  };

  const evidenceA = buildEvidencePayloads(
    "https://example.com/dfm",
    "snapshot:example",
    snapshotA,
    [candidate],
  );

  const evidenceB = buildEvidencePayloads(
    "https://example.com/dfm",
    "snapshot:example",
    snapshotB,
    [candidate],
  );

  assert.equal(
    evidenceA.length,
    1,
  );

  assert.equal(
    evidenceB.length,
    1,
  );

  assert.notEqual(
    evidenceA[0]?.evidenceHash,
    evidenceB[0]?.evidenceHash,
  );
});


test("V8-05 HTTP page fetcher fails closed on non-2xx response", async () => {
  const originalFetch = globalThis.fetch;

  globalThis.fetch = async () =>
    new Response(
      "Not Found",
      {
        status: 404,
        headers: {
          "content-type": "text/html",
        },
      },
    );

  try {
    await assert.rejects(
      () =>
        new HttpPageFetcher({
          timeoutMs: 5_000,
        }).fetch(
          "https://example.com/not-found",
        ),
      /V8_ACQUISITION_HTTP_STATUS_404/,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
