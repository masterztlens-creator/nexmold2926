import test from 'node:test';
import assert from 'node:assert/strict';
import { sourceId, sortedUnique, stableFingerprint } from '../../../.v8-build/src/v8/index.js';

test('branded primitive factories reject empty values', () => assert.throws(() => sourceId('   ')));
test('sortedUnique canonicalizes sets', () => assert.deepEqual(sortedUnique(['b','a','b'], 'x'), ['a','b']));
test('fingerprint is deterministic', () => assert.equal(stableFingerprint({b:2,a:1}), stableFingerprint({a:1,b:2})));
