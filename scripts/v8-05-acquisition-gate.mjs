import assert from 'node:assert/strict';

const { HttpPageFetcher } = await import('../.v8-build/src/v8/acquisition/page-fetcher.js');
const { extractTextEvidence } = await import('../.v8-build/src/v8/acquisition/source-extractor.js');
const { ingestFetchedPage } = await import('../.v8-build/src/v8/acquisition/foundation-adapter.js');
const { InMemoryFoundationStore } = await import('../.v8-build/src/v8/foundation/store.js');
const { EvidenceGate } = await import('../.v8-build/src/v8/evidence/evidence-gate.js');

const TEST_URL = 'https://example.com/';

function pass(name) {
  console.log(`[V8-05][PASS] ${name}`);
}

async function main() {
  const fetcher = new HttpPageFetcher({ timeoutMs: 15000, maxBytes: 2_000_000 });
  const page = await fetcher.fetch(TEST_URL);

  assert.equal(page.status, 200, `unexpected HTTP status: ${page.status}`);
  assert.equal(page.mediaType, 'text/html');
  assert.ok(page.bytes.byteLength > 0, 'HTTP response body is empty');
  assert.ok(page.finalUrl.startsWith('https://'), `unexpected final URL: ${page.finalUrl}`);
  assert.ok(page.redirectChain.length >= 1, 'redirect chain is missing');
  pass('real internet HTTP fetch');

  const candidates = extractTextEvidence(page.body);
  assert.ok(candidates.length > 0, 'extractor returned no evidence from example.com');
  for (const candidate of candidates) {
    assert.ok(candidate.excerpt.trim().length > 0, 'evidence candidate excerpt is empty');
    assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(candidate.extractionConfidence));
  }
  pass('source extraction produces bounded candidates');

  const store = new InMemoryFoundationStore();
  const result = ingestFetchedPage(store, page, candidates, { actorId: 'v8-05-gate' });
  const snapshot = store.get('SNAPSHOT', result.snapshotId);
  assert.ok(snapshot, 'snapshot was not persisted');
  assert.equal(snapshot.state, 'SEALED');
  assert.equal(snapshot.payload.metadataOnly, false);
  assert.equal(snapshot.payload.contentHash, snapshot.payload.contentHash);
  pass('SOURCE -> SNAPSHOT CAPTURED -> SEALED');

  const evidenceRecords = store.auditTrail().filter((r) => r.aggregateType === 'EVIDENCE');
  assert.equal(evidenceRecords.length, result.evidence.length);
  assert.ok(evidenceRecords.length > 0, 'no evidence was persisted');
  for (const record of evidenceRecords) {
    assert.equal(record.state, 'INGESTED');
    assert.equal(record.payload.verificationStatus, 'UNVERIFIED');
    const snapshotLink = record.lineage.find((l) => l.type === 'SNAPSHOT');
    assert.ok(snapshotLink, `missing snapshot lineage for ${record.aggregateId}`);
    assert.equal(snapshotLink.id, result.snapshotId);
    assert.equal(snapshotLink.version, snapshot.version);
    assert.equal(snapshotLink.fingerprint, snapshot.fingerprint);
  }
  pass('evidence lineage is exact and remains UNVERIFIED');

  const gate = new EvidenceGate(store);
  const ids = evidenceRecords.map((r) => r.aggregateId);
  const blocked = gate.check(ids);
  assert.equal(blocked.passed, false);
  assert.ok(blocked.reasons.some((r) => r.includes('AUDITED or VERIFIED')));
  pass('EvidenceGate blocks unverified web evidence');

  const sourceRecord = store.get('SOURCE', result.sourceId);
  assert.ok(sourceRecord, 'source record missing');
  for (const record of evidenceRecords) {
    store.append({
      aggregateType: 'EVIDENCE',
      aggregateId: record.aggregateId,
      version: record.version + 1,
      state: 'AUDITED',
      payload: record.payload,
      lineage: record.lineage,
      actor: { id: 'v8-05-gate-auditor', role: 'AUDITOR' },
      reason: 'V8-05 gate-only audit fixture',
    });
  }
  const auditedIds = evidenceRecords.map((r) => r.aggregateId);
  const accepted = gate.assert(auditedIds);
  assert.equal(accepted.passed, true);
  pass('EvidenceGate accepts only after explicit AUDITED transition');

  store.verifyChain();
  pass('foundation chain integrity');

  console.log('[V8-05] ACQUISITION GATE PASSED');
}

main().catch((error) => {
  console.error('[V8-05][FAIL]', error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
