import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledge } from '../../../.v8-build/src/v8/index.js';

test('knowledge requires claims and approval state', () => {
  const k = createKnowledge({proposition:'P', claimIds:['c2','c1'], status:'APPROVED'});
  assert.deepEqual(k.claimIds, ['c1','c2']);
  assert.throws(() => createKnowledge({proposition:'P', claimIds:[], status:'APPROVED'}));
  assert.throws(() => createKnowledge({proposition:'P', claimIds:['c1'], status:'UNKNOWN'}));
});
