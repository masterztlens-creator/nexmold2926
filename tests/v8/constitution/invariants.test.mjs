import test from 'node:test';
import assert from 'node:assert/strict';
import { V8_CONSTITUTION_VERSION, V8_RULES, V8InvariantError, invariant, requireKnown } from '../../../.v8-build/src/v8/index.js';

test('constitution is executable', () => {
  assert.equal(V8_CONSTITUTION_VERSION, 'V8-00');
  assert.equal(V8_RULES.failClosed, true);
  assert.equal(V8_RULES.unknownIsFailure, true);
  assert.equal(V8_RULES.contentCannotCreateTruth, true);
  assert.equal(V8_RULES.decisionIdentityMustBeDeterministic, true);
});

test('invariant throws typed error', () => {
  assert.throws(() => invariant(false, 'TEST', 'boom'), e => e instanceof V8InvariantError && e.code === 'TEST');
});
