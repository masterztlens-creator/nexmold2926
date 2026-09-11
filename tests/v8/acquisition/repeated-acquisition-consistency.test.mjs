import assert from "node:assert/strict";
import test from "node:test";

import {
  InMemoryFoundationStore,
} from "../../../.v8-build/src/v8/foundation/store.js";

import {
  ingestFetchedPage,
} from "../../../.v8-build/src/v8/acquisition/foundation-adapter.js";

import {
  evidenceAggregateId,
} from "../../../.v8-build/src/v8/acquisition/evidence-builder.js";

function page({
  requestedUrl,
  finalUrl,
  body,
  fetchedAt,
  redirectChain = [requestedUrl, finalUrl],
}) {
  return {
    requestedUrl,
    finalUrl,
    redirectChain,
    status: 200,
    mediaType: "text/html",
    body,
    bytes: new TextEncoder().encode(body),
    fetchedAt,
  };
}

test(
  "V8-10-C same requested URL and same content reuses immutable snapshot identity",
  () => {
    const store = new InMemoryFoundationStore();

    const requestedUrl = "https://example.com/source";
    const finalUrl = "https://example.com/resolved";
    const body = "<html><body>same</body></html>";

    const first = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body,
        fetchedAt: "2026-09-10T00:00:00.000Z",
      }),
      [],
    );

    const second = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body,
        fetchedAt: "2026-09-11T00:00:00.000Z",
      }),
      [],
    );

    assert.equal(second.sourceId, first.sourceId);
    assert.equal(second.snapshotId, first.snapshotId);

    assert.equal(
      store.history("SOURCE", first.sourceId).length,
      1,
    );

    assert.equal(
      store.history("SNAPSHOT", first.snapshotId).length,
      2,
    );

    assert.equal(
      store.get("SNAPSHOT", first.snapshotId)?.state,
      "SEALED",
    );

    assert.equal(
      store.get("SNAPSHOT", first.snapshotId)?.payload.capturedAt,
      "2026-09-10T00:00:00.000Z",
    );

    assert.deepEqual(
      second.snapshot,
      store.get("SNAPSHOT", second.snapshotId)?.payload,
    );

    store.verifyChain();
  },
);

test(
  "V8-10-C same source with changed content creates a distinct immutable snapshot",
  () => {
    const store = new InMemoryFoundationStore();

    const requestedUrl = "https://example.com/source";
    const finalUrl = "https://example.com/resolved";

    const first = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body: "<html><body>v1</body></html>",
        fetchedAt: "2026-09-10T00:00:00.000Z",
      }),
      [],
    );

    const second = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body: "<html><body>v2</body></html>",
        fetchedAt: "2026-09-11T00:00:00.000Z",
      }),
      [],
    );

    assert.equal(second.sourceId, first.sourceId);
    assert.notEqual(second.snapshotId, first.snapshotId);

    assert.equal(
      store.history("SOURCE", first.sourceId).length,
      1,
    );

    assert.equal(
      store.history("SNAPSHOT", first.snapshotId).length,
      2,
    );

    assert.equal(
      store.history("SNAPSHOT", second.snapshotId).length,
      2,
    );

    assert.notEqual(
      store.get("SNAPSHOT", first.snapshotId)?.fingerprint,
      store.get("SNAPSHOT", second.snapshotId)?.fingerprint,
    );

    assert.deepEqual(
      second.snapshot,
      store.get("SNAPSHOT", second.snapshotId)?.payload,
    );

    store.verifyChain();
  },
);

test(
  "V8-10-C redirect provenance changes snapshot identity without changing source identity",
  () => {
    const store = new InMemoryFoundationStore();

    const requestedUrl = "https://example.com/source";
    const body = "<html><body>same-bytes</body></html>";

    const first = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl: "https://example.com/resolved-a",
        body,
        fetchedAt: "2026-09-10T00:00:00.000Z",
      }),
      [],
    );

    const second = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl: "https://example.com/resolved-b",
        body,
        redirectChain: [
          requestedUrl,
          "https://example.com/intermediate",
          "https://example.com/resolved-b",
        ],
        fetchedAt: "2026-09-11T00:00:00.000Z",
      }),
      [],
    );

    assert.equal(second.sourceId, first.sourceId);
    assert.notEqual(second.snapshotId, first.snapshotId);

    assert.equal(
      store.get("SNAPSHOT", first.snapshotId)?.payload.finalUrl,
      "https://example.com/resolved-a",
    );

    assert.equal(
      store.get("SNAPSHOT", second.snapshotId)?.payload.finalUrl,
      "https://example.com/resolved-b",
    );

    assert.deepEqual(
      store.get("SNAPSHOT", second.snapshotId)?.payload.redirectChain,
      [
        requestedUrl,
        "https://example.com/intermediate",
        "https://example.com/resolved-b",
      ],
    );

    assert.deepEqual(
      second.snapshot,
      store.get("SNAPSHOT", second.snapshotId)?.payload,
    );

    store.verifyChain();
  },
);

test(
  "V8-10-C repeated acquisition keeps returned evidence identical to persisted evidence",
  () => {
    const store = new InMemoryFoundationStore();

    const requestedUrl = "https://example.com/spec";
    const finalUrl = "https://example.com/spec";
    const body = "<html><body>80 C</body></html>";

    const candidate = {
      locator: finalUrl,
      excerpt: "Rated operating temperature: 80 C",
      parameter: "operating temperature",
      value: 80,
      unit: "C",
      extractionConfidence: "HIGH",
    };

    const first = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body,
        fetchedAt: "2026-09-10T00:00:00.000Z",
      }),
      [candidate],
    );

    const second = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body,
        fetchedAt: "2026-09-11T00:00:00.000Z",
      }),
      [candidate],
    );

    assert.equal(second.sourceId, first.sourceId);
    assert.equal(second.snapshotId, first.snapshotId);

    const evidenceId = evidenceAggregateId(
      first.sourceId,
      first.snapshotId,
      candidate,
      first.snapshot?.contentHash,
    );

    const persistedEvidence = store.get(
      "EVIDENCE",
      evidenceId,
    );

    const persistedSnapshot = store.get(
      "SNAPSHOT",
      second.snapshotId,
    );

    assert.ok(persistedEvidence);
    assert.ok(persistedSnapshot);

    assert.deepEqual(
      second.snapshot,
      persistedSnapshot?.payload,
    );

    assert.ok(Array.isArray(second.evidence));
    assert.equal(second.evidence.length, 1);

    assert.deepEqual(
      second.evidence[0],
      persistedEvidence?.payload,
    );

    store.verifyChain();
  },
);

test(
  "V8-10-C evidence lineage remains bound to the exact sealed snapshot",
  () => {
    const store = new InMemoryFoundationStore();

    const requestedUrl = "https://example.com/spec";
    const finalUrl = "https://example.com/spec";

    const candidate = {
      locator: finalUrl,
      excerpt: "Rated operating temperature: 80 C",
      parameter: "operating temperature",
      value: 80,
      unit: "C",
      extractionConfidence: "HIGH",
    };

    const result = ingestFetchedPage(
      store,
      page({
        requestedUrl,
        finalUrl,
        body: "<html><body>80 C</body></html>",
        fetchedAt: "2026-09-10T00:00:00.000Z",
      }),
      [candidate],
    );

    const evidenceId = evidenceAggregateId(
      result.sourceId,
      result.snapshotId,
      candidate,
      result.snapshot?.contentHash,
    );

    const evidence = store.get(
      "EVIDENCE",
      evidenceId,
    );

    const snapshot = store.get(
      "SNAPSHOT",
      result.snapshotId,
    );

    assert.ok(evidence);
    assert.ok(snapshot);

    const snapshotLineage = evidence?.lineage.find(
      (link) => link.type === "SNAPSHOT",
    );

    assert.ok(snapshotLineage);

    assert.equal(
      snapshotLineage?.id,
      result.snapshotId,
    );

    assert.equal(
      snapshotLineage?.version,
      snapshot?.version,
    );

    assert.equal(
      snapshotLineage?.fingerprint,
      snapshot?.fingerprint,
    );

    store.verifyChain();
  },
);

test(
  "V8-10-F evidence aggregate identity separates candidates with identical locator and excerpt but different content",
  () => {
    const source = "https://example.com/spec";
    const snapshotId = "snapshot:test-evidence-identity";
    const snapshotContentHash = "hash:test-snapshot";

    const firstCandidate = {
      locator: source,
      excerpt: "Rated operating condition",
      parameter: "temperature",
      value: 80,
      unit: "C",
      extractionConfidence: "HIGH",
    };

    const secondCandidate = {
      locator: source,
      excerpt: "Rated operating condition",
      parameter: "pressure",
      value: 10,
      unit: "bar",
      extractionConfidence: "HIGH",
    };

    const firstId = evidenceAggregateId(
      source,
      snapshotId,
      firstCandidate,
      snapshotContentHash,
    );

    const secondId = evidenceAggregateId(
      source,
      snapshotId,
      secondCandidate,
      snapshotContentHash,
    );

    assert.notEqual(
      firstId,
      secondId,
      "Evidence candidates with different semantic content must not collide",
    );

    assert.notEqual(
      firstCandidate.parameter,
      secondCandidate.parameter,
    );

    assert.notEqual(
      firstCandidate.value,
      secondCandidate.value,
    );

    assert.notEqual(
      firstCandidate.unit,
      secondCandidate.unit,
    );
  },
);