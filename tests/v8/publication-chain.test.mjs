import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../../.v8-build/src/v8/index.js";

const gov = { id: "gov", role: "GOVERNOR" };
const ver = { id: "ver", role: "VERIFIER" };
const aud = { id: "aud", role: "AUDITOR" };
const ing = { id: "ing", role: "INGESTOR" };
const why = "boundary contract";

function setup() {
  const store = new V.InMemoryFoundationStore();
  const fs = new V.FoundationService(store);
  const src = V.createSource({ kind: "PUBLIC_WEB", locator: "https://example.test/spec", access: "PAYLOAD_ALLOWED", title: "Spec", version: "1" });
  fs.registerSource(src, ing, why);
  const snap = fs.captureSnapshot({ source: src, capturedAt: "2026-01-01T00:00:00Z", locator: src.locator, content: "draft angle >= 1 degree", metadataOnly: false }, ing, why);
  fs.sealSnapshot(snap.aggregateId, aud, why);
  const ev = fs.ingestEvidence({ sourceId: src.id, snapshotId: snap.aggregateId, locator: "#draft", excerpt: "Draft angle >= 1 degree", ingestion: "INGESTED", capturedAt: snap.payload.capturedAt }, ing, why);
  fs.auditEvidence(ev.aggregateId, aud, why);
  const knowledge = V.createKnowledge({ proposition: "Draft angle should be at least 1 degree", claimIds: [], status: "APPROVED" });
  return { store, fs, src, snap, ev, knowledge };
}

test("evidence gate rejects duplicate references and snapshot/source mismatch", () => {
  const x = setup();
  const gate = new V.EvidenceGate(x.store);
  assert.equal(gate.check([x.ev.aggregateId, x.ev.aggregateId]).passed, false);

  const tampered = x.store.append({
    aggregateType: "EVIDENCE",
    aggregateId: "tampered-evidence",
    version: 1,
    state: "AUDITED",
    payload: { ...x.ev.payload, sourceId: "wrong-source" },
    lineage: x.ev.lineage,
    actor: aud,
    reason: why,
  });
  assert.equal(gate.check([tampered.aggregateId]).passed, false);
});

test("publication gate ignores forged lineage and rebuilds it from approved eligibility/policy", () => {
  const x = setup();
  const claim = V.createClaim({ statement: "Draft angle >= 1 degree", evidenceIds: [x.ev.aggregateId], status: "VERIFIED" });
  x.fs.createClaim(claim, ver, why);
  const knowledge = V.createKnowledge({ proposition: "Draft angle should be at least 1 degree", claimIds: [claim.id], status: "APPROVED" });
  x.fs.createKnowledge(knowledge, ver, why);

  const g = new V.RulePolicyGovernance(x.store);
  const rule = g.approveRule(
    g.proposeRule(V.createRule({ statement: "ALLOW", knowledgeIds: [knowledge.id], effect: "ALLOW", status: "PROPOSED" }), gov, why).aggregateId,
    gov,
    why,
  );
  const policyDraft = g.proposePolicy(V.createPolicy({ name: "policy", ruleIds: [rule.aggregateId], mode: "ALL", status: "PROPOSED" }), gov, why);
  const policy = g.approvePolicy(policyDraft.aggregateId, gov, why);
  const eligibility = new V.EligibilityEngine(x.store).persist(
    { subjectId: "article-1", evidenceIds: [x.ev.aggregateId], ruleIds: [rule.aggregateId] },
    gov,
    why,
  );

  assert.throws(() => new V.PublicationGate(x.store).publish({
    subjectId: "article-1",
    title: "Draft Angle",
    body: "Evidence-backed content",
    eligibility: eligibility.record,
    policyId: policy.aggregateId,
    lineage: [],
  }), /V8_PUBLICATION_LINEAGE_MISMATCH/);

  const artifact = new V.PublicationGate(x.store).publish({
    subjectId: "article-1",
    title: "Draft Angle",
    body: "Evidence-backed content",
    eligibility: eligibility.record,
    policyId: policy.aggregateId,
    lineage: eligibility.lineage,
  });

  assert.equal(artifact.policyFingerprint, policy.fingerprint);
  assert.equal(artifact.lineage.at(-1).type, "POLICY");
});

test("projection gate rejects forged id/content", () => {
  const artifact = {
    id: "publication:test",
    subjectId: "s",
    title: "T",
    body: "B",
    contentFingerprint: "a".repeat(64),
    lineage: [],
    eligibilityRecordId: "e",
    policyId: "p",
    policyFingerprint: "b".repeat(64),
  };
  const p = V.project({ artifact, route: "/x" });
  assert.throws(() => new V.ProjectionGate().check(artifact, { ...p, id: "projection:forged" }), /V8_PROJECTION_ID_MISMATCH/);
});
