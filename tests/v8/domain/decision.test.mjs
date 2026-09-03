import test from 'node:test';
import assert from 'node:assert/strict';
import { createDecision } from '../../../.v8-build/src/v8/index.js';

test('same semantic Decision has stable identity', () => {
  const a = createDecision({problemId:'p1', knowledgeIds:['k2','k1','k1'], outcome:'Use 1.5° draft', status:'APPROVED'});
  const b = createDecision({problemId:'p1', knowledgeIds:['k1','k2'], outcome:'Use 1.5° draft', status:'APPROVED'});
  assert.equal(a.id, b.id);
  assert.equal(a.fingerprint, b.fingerprint);
});

test('decision rejects UNKNOWN and missing knowledge', () => {
  assert.throws(() => createDecision({problemId:'p1', knowledgeIds:['k1'], outcome:'x', status:'UNKNOWN'}));
  assert.throws(() => createDecision({problemId:'p1', knowledgeIds:[], outcome:'x', status:'APPROVED'}));
});
