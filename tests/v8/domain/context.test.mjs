import test from 'node:test';
import assert from 'node:assert/strict';
import { createContext } from '../../../.v8-build/src/v8/index.js';

test('context canonicalizes variables and is immutable', () => {
  const c = createContext({scopeId:'scope:1', purpose:'DFM', variables:{z:'2',a:'1'}});
  assert.deepEqual(Object.keys(c.variables), ['a','z']);
  assert.equal(Object.isFrozen(c), true);
});
