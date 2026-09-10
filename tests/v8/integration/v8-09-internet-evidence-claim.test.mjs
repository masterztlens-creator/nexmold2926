import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  FoundationService,
  InMemoryFoundationStore,
  ingestInternetDocument,
} from "../../../.v8-build/src/v8/foundation/index.js";
import {
  appendEvidence,
  evidenceAggregateId,
} from "../../../.v8-build/src/v8/acquisition/index.js";

const ingestor = { id: "v8-09-internet-ingestor", role: "INGESTOR" };
const auditor = { id: "v8-09-auditor", role: "AUDITOR" };

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

test("V8-09: Internet → Source → sealed Snapshot → Evidence → Audit → Claim", async () => {
  await withServer((_req, res) => {
    res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
    res.end("V8-09 governed evidence fixture");
  }, async (url) => {
    const snapshotRoot = mkdtempSync(join(tmpdir(), "nexmold-v8-09-"));

    const store = new InMemoryFoundationStore();
    const service = new FoundationService(store);

    const acquired = await ingestInternetDocument(service, {
      url,
      title: "NEXMOLD V8-09 Internet Fixture",
      publisher: "NEXMOLD Test Authority",
      authority: "ENGINEERING_REFERENCE",
      version: "v8-09-fixture-1",
      actor: ingestor,
      snapshotRoot,
    });

    assert.equal(acquired.acquisition.status, 200);
    assert.equal(acquired.snapshotRecord.state, "SEALED");

    const candidate = {
      locator: "body",
      excerpt: "V8-09 governed evidence fixture",
      parameter: "fixture",
      value: "governed",
      unit: "text",
      section: "body",
      extractionConfidence: "HIGH",
    };

    const payloads = appendEvidence(
      store,
      acquired.source.id,
      acquired.snapshotRecord.aggregateId,
      acquired.snapshotRecord.payload,
      [candidate],
      ingestor.id,
    );

    assert.equal(payloads.length, 1);
    const evidenceId = evidenceAggregateId(
      acquired.source.id,
      acquired.snapshotRecord.aggregateId,
      candidate,
    );

    const ingestedEvidence = store.get("EVIDENCE", evidenceId);
    assert.ok(ingestedEvidence);
    assert.equal(ingestedEvidence.state, "INGESTED");
    assert.equal(ingestedEvidence.payload.verificationStatus, "UNVERIFIED");

    assert.throws(
      () =>
        service.createClaim(
          {
            id: "v8-09-premature-claim",
            statement: "The fixture is governed evidence.",
            evidenceIds: [evidenceId],
            status: "VERIFIED",
            fingerprint: "ignored",
          },
          auditor,
        ),
      /CLAIM_EVIDENCE_NOT_VERIFIED|EVIDENCE_NOT_VERIFIED/,
    );

    const audited = service.verifyEvidence(evidenceId, auditor);
    assert.equal(audited.state, "VERIFIED");
    assert.equal(audited.payload.verificationStatus, "VERIFIED");

    const evidenceHistory = store.history("EVIDENCE", evidenceId);
    assert.deepEqual(
      evidenceHistory.map((record) => record.state),
      ["INGESTED", "AUDITED", "VERIFIED"],
    );

    const claim = service.createClaim(
      {
        id: "v8-09-claim",
        statement: "The fixture is governed evidence.",
        evidenceIds: [evidenceId],
        status: "VERIFIED",
        fingerprint: "ignored",
      },
      auditor,
    );

    assert.equal(claim.state, "VERIFIED");
    assert.equal(claim.payload.status, "VERIFIED");
    assert.ok(claim.lineage.some((item) => item.type === "EVIDENCE"));
    assert.ok(claim.lineage.some((item) => item.type === "SNAPSHOT"));
    assert.ok(claim.lineage.some((item) => item.type === "SOURCE"));

    store.verifyChain();
  });
});
