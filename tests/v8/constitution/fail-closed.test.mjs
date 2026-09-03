import test from 'node:test';
import assert from 'node:assert/strict';
import { requireKnown } from '../../../.v8-build/src/v8/index.js';

test('UNKNOWN is fail-closed', () => {
  assert.throws(() => requireKnown('UNKNOWN', 'V8_TEST_UNKNOWN', 'status'), /V8_TEST_UNKNOWN/);
});
