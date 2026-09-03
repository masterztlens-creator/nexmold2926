import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryFoundationStore,
  RulePolicyGovernance,
  createRule,
  createPolicy,
  V8InvariantError,
} from '../.v8-build/src/v8/index.js';

const governor = { id: 'gov-01', role: 'GOVERNOR' };
const verifier = { id: 'ver-01', role: 'VERIFIER' };
const reason = 'V8-04 contract test';

function knowledge(store, id, state = 'VERIFIED') {
  return store.append({
    aggregateType: 'KNOWLEDGE', aggregateId: id, version: 1, state,
    payload: { proposition: `knowledge:${id}`, claimIds: [] },
    lineage: [], actor: verifier, reason,
  });
}

test('V8-04 Rule is grounded in VERIFIED knowledge and deterministic', () => {
  const a = createRule({ statement: 'Draft angle >= 1°', knowledgeIds: ['k-2', 'k-1', 'k-1'], effect: 'ALLOW', status: 'PROPOSED' });
  const b = createRule({ statement: 'Draft angle >= 1°', knowledgeIds: ['k-1', 'k-2'], effect: 'ALLOW', status: 'PROPOSED' });
  assert.equal(a.fingerprint, b.fingerprint);
  assert.deepEqual(a.knowledgeIds, ['k-1', 'k-2']);
});

test('V8-04 rejects UNKNOWN Rule/Policy states', () => {
  assert.throws(() => createRule({ statement: 'x', knowledgeIds: ['k'], effect: 'ALLOW', status: 'UNKNOWN' }), V8InvariantError);
  assert.throws(() => createPolicy({ name: 'p', ruleIds: ['r'], mode: 'ALL', status: 'UNKNOWN' }), V8InvariantError);
});

test('V8-04 governance enforces Knowledge -> Rule -> Policy', () => {
  const store = new InMemoryFoundationStore();
  knowledge(store, 'k-1');
  const gov = new RulePolicyGovernance(store);
  const proposedRule = gov.proposeRule(createRule({ statement: 'ALLOW DFM', knowledgeIds: ['k-1'], effect: 'ALLOW', status: 'PROPOSED' }), governor, reason);
  assert.equal(proposedRule.state, 'PROPOSED');
  const approvedRule = gov.approveRule(proposedRule.aggregateId, governor, reason);
  assert.equal(approvedRule.state, 'APPROVED');
  assert.equal(approvedRule.payload.status, 'APPROVED');
  const proposedPolicy = gov.proposePolicy(createPolicy({ name: 'DFM policy', ruleIds: [proposedRule.aggregateId], mode: 'ALL', status: 'PROPOSED' }), governor, reason);
  assert.equal(proposedPolicy.state, 'PROPOSED');
  const approvedPolicy = gov.approvePolicy(proposedPolicy.aggregateId, governor, reason);
  assert.equal(approvedPolicy.state, 'APPROVED');
  assert.equal(approvedPolicy.payload.status, 'APPROVED');
  store.verifyChain();
});

test('V8-04 fail-closed: non-GOVERNOR cannot approve', () => {
  const store = new InMemoryFoundationStore();
  knowledge(store, 'k-1');
  const gov = new RulePolicyGovernance(store);
  const rule = gov.proposeRule(createRule({ statement: 'x', knowledgeIds: ['k-1'], effect: 'ALLOW', status: 'PROPOSED' }), governor, reason);
  assert.throws(() => gov.approveRule(rule.aggregateId, verifier, reason), /V8_GOVERNANCE_ROLE_REQUIRED/);
});

test('V8-04 fail-closed: Rule cannot use unapproved Knowledge', () => {
  const store = new InMemoryFoundationStore();
  const gov = new RulePolicyGovernance(store);
  assert.throws(() => gov.proposeRule(createRule({ statement: 'x', knowledgeIds: ['missing'], effect: 'ALLOW', status: 'PROPOSED' }), governor, reason), /V8_RULE_KNOWLEDGE_NOT_APPROVED/);
});
