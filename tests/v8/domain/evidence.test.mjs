import test from 'node:test';
import assert from 'node:assert/strict';
import { createEvidence } from '../../../.v8-build/src/v8/index.js';

test('evidence requires known ingestion state', () => {
  const base = {sourceId:'s1', locator:'L1', excerpt:'fact', ingestion:'INGESTED', capturedAt:'2026-01-01T00:00:00Z'};
  assert.equal(createEvidence(base).sourceId, 's1');
  assert.throws(() => createEvidence({...base, ingestion:'UNKNOWN'}));
  assert.throws(() => createEvidence({...base, excerpt:''}));
});
