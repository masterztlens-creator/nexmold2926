import test from 'node:test';
import assert from 'node:assert/strict';
import { createScope } from '../../../.v8-build/src/v8/index.js';

test('scope canonicalizes dimensions', () => {
  const s = createScope({geography:'US', industries:['molding','automotive','molding'], languages:['en-US']});
  assert.deepEqual(s.industries, ['automotive','molding']);
  assert.throws(() => createScope({geography:'US', industries:[], languages:[]}));
});
