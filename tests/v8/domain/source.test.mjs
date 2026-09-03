import test from 'node:test';
import assert from 'node:assert/strict';
import { createSource } from '../../../.v8-build/src/v8/index.js';

test('source is immutable and requires access policy', () => {
  const s = createSource({kind:'PUBLIC_WEB', locator:'https://example.test', access:'PAYLOAD_ALLOWED', title:'Example', version:'1'});
  assert.equal(Object.isFrozen(s), true);
  assert.throws(() => createSource({kind:'PUBLIC_WEB', locator:'x', title:'x', version:'1'}));
});
