import test from 'node:test';
import assert from 'node:assert/strict';
import { createContent } from '../../../.v8-build/src/v8/index.js';

test('content must be bound to a Decision', () => {
  const c = createContent({decisionId:'decision:abc', title:'Draft Angle', body:'Use the approved decision.'});
  assert.equal(c.decisionId, 'decision:abc');
  assert.throws(() => createContent({decisionId:'', title:'x', body:'y'}));
});

test('content object has no truth-producing fields', () => {
  const c = createContent({decisionId:'decision:abc', title:'T', body:'B'});
  assert.equal('evidenceIds' in c, false);
  assert.equal('claimIds' in c, false);
  assert.equal('knowledgeIds' in c, false);
});
