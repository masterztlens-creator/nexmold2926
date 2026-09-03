import test from 'node:test';
import assert from 'node:assert/strict';
import { createProblem } from '../../../.v8-build/src/v8/index.js';

test('problem requires a real question', () => {
  assert.equal(createProblem({contextId:'ctx:1', question:'Which draft?', constraints:['cost','cost']}).constraints.length, 1);
  assert.throws(() => createProblem({contextId:'ctx:1', question:'', constraints:[]}));
});
