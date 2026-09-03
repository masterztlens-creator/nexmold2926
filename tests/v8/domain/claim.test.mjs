import test from 'node:test';
import assert from 'node:assert/strict';
import { createClaim } from '../../../.v8-build/src/v8/index.js';

test('claim requires evidence and known status', () => {
  const c = createClaim({statement:'A', evidenceIds:['e2','e1','e1'], status:'VERIFIED'});
  assert.deepEqual(c.evidenceIds, ['e1','e2']);
  assert.throws(() => createClaim({statement:'A', evidenceIds:[], status:'VERIFIED'}));
  assert.throws(() => createClaim({statement:'A', evidenceIds:['e1'], status:'UNKNOWN'}));
});
