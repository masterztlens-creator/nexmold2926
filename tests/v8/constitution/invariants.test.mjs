import test from 'node:test';
import assert from 'node:assert/strict';
import { V8_CONSTITUTION_VERSION, V8_RULES, V8InvariantError, immutable, invariant, requireKnown } from '../../../.v8-build/src/v8/index.js';

test('constitution is executable', () => {
  assert.equal(V8_CONSTITUTION_VERSION, 'V8-00');
  assert.equal(V8_RULES.failClosed, true);
  assert.equal(V8_RULES.unknownIsFailure, true);
  assert.equal(V8_RULES.contentCannotCreateTruth, true);
  assert.equal(V8_RULES.contentCannotCreateKnowledge, true);
  assert.equal(V8_RULES.decisionIdentityMustBeDeterministic, true);
  assert.equal(V8_RULES.immutableDomainObjects, true);
  assert.deepEqual(V8_RULES.truthLayerOrder, ['SOURCE','EVIDENCE','CLAIM','KNOWLEDGE','DECISION','CONTENT']);
});

test('invariant throws typed error', () => {
  assert.throws(() => invariant(false, 'TEST', 'boom'), e => e instanceof V8InvariantError && e.code === 'TEST');
});

test('requireKnown is fail-closed', () => {
  assert.equal(requireKnown('KNOWN', 'TEST_UNKNOWN', 'value'), 'KNOWN');
  assert.throws(() => requireKnown('UNKNOWN', 'TEST_UNKNOWN', 'value'), e => e instanceof V8InvariantError && e.code === 'TEST_UNKNOWN');
});

test('immutable recursively freezes nested objects and arrays', () => {
  const value = immutable({ nested: { count: 1 }, items: [{ id: 1 }] });
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(value.nested), true);
  assert.equal(Object.isFrozen(value.items), true);
  assert.equal(Object.isFrozen(value.items[0]), true);
  assert.throws(() => { value.nested.count = 2; }, TypeError);
  assert.throws(() => { value.items[0].id = 99; }, TypeError);
});

test('immutable handles repeated references and cycles', () => {
  const shared = { value: 1 };
  const value = { left: shared, right: shared };
  value.self = value;
  immutable(value);
  assert.equal(Object.isFrozen(value), true);
  assert.equal(Object.isFrozen(shared), true);
});
