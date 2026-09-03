import test from "node:test";
import assert from "node:assert/strict";
import {
  FoundationService,
  InMemoryFoundationStore,
  TruthGovernance,
  createKnowledge,
  createSource,
} from "../../../.v8-build/src/v8/index.js";

const system = { id: "v8-system", role: "SYSTEM" };
const auditor = { id: "v8-auditor", role: "AUDITOR" };
const verifier = { id: "v8-verifier", role: "VERIFIER" };

function setup() {
  const store = new InMemoryFoundationStore();
  const foundation = new FoundationService(store);
  const governance = new TruthGovernance(foundation);
  const source = createSource({
    kind: "PUBLIC_WEB",
    locator: "https://example.test/spec",
    access: "PAYLOAD_ALLOWED",
    title: "Example specification",
    version: "1",
  });
  foundation.registerSource(source, system, "register test source");
  const snapshot = foundation.captureSnapshot({
    source,
    capturedAt: "2026-09-03T00:00:00.000Z",
    locator: source.locator,
    content: "Wall thickness should be uniform.",
    metadataOnly: false,
  }, system, "capture test snapshot");
  foundation.sealSnapshot(snapshot.aggregateId, auditor, "seal test snapshot");
  const evidence = foundation.ingestEvidence({
    sourceId: source.id,
    snapshotId: snapshot.aggregateId,
    locator: "section:1",
    excerpt: "Wall thickness should be uniform.",
    ingestion: "INGESTED",
    capturedAt: snapshot.recordedAt,
  }, system, "ingest test evidence");
  foundation.auditEvidence(evidence.aggregateId, auditor, "audit test evidence");
  return { store, foundation, governance, evidence };
}

test("claim verification requires audited evidence and persists only VERIFIED claims", () => {
  const { governance, store, evidence } = setup();
  const result = governance.verifyClaim({
    id: "claim:uniform-wall",
    statement: "Wall thickness should be uniform.",
    evidenceIds: [evidence.aggregateId],
    status: "VERIFIED",
    fingerprint: "ignored",
  }, { actor: verifier, reason: "engineering verification" });
  assert.equal(result.verdict, "VERIFIED");
  assert.equal(store.get("CLAIM", "claim:uniform-wall")?.state, "VERIFIED");
});

test("UNKNOWN claim status fails closed", () => {
  const { governance, evidence } = setup();
  assert.throws(() => governance.verifyClaim({
    statement: "unknown proposition",
    evidenceIds: [evidence.aggregateId],
    status: "UNKNOWN",
    fingerprint: "ignored",
  }, { actor: verifier, reason: "attempt" }), /V8_CLAIM_UNKNOWN/);
});

test("un-audited evidence cannot become a verified claim", () => {
  const store = new InMemoryFoundationStore();
  const foundation = new FoundationService(store);
  const governance = new TruthGovernance(foundation);
  const source = createSource({ kind: "PUBLIC_WEB", locator: "https://example.test", access: "PAYLOAD_ALLOWED", title: "Example", version: "1" });
  foundation.registerSource(source, system, "register");
  const snapshot = foundation.captureSnapshot({ source, capturedAt: "2026-09-03T00:00:00.000Z", locator: source.locator, content: "fact", metadataOnly: false }, system, "capture");
  foundation.sealSnapshot(snapshot.aggregateId, auditor, "seal");
  const evidence = foundation.ingestEvidence({ sourceId: source.id, snapshotId: snapshot.aggregateId, locator: "p1", excerpt: "fact", ingestion: "INGESTED", capturedAt: snapshot.recordedAt }, system, "ingest");
  const result = governance.verifyClaim({ statement: "fact", evidenceIds: [evidence.aggregateId], status: "VERIFIED", fingerprint: "ignored" }, { actor: verifier, reason: "verify" });
  assert.equal(result.verdict, "REQUIRES_REVIEW");
  assert.equal(store.get("CLAIM", result.claim.id), null);
});

test("rejected verification never writes a claim record", () => {
  const { governance, store } = setup();
  const result = governance.verifyClaim({ statement: "fact", evidenceIds: ["missing-evidence"], status: "VERIFIED", fingerprint: "ignored" }, { actor: verifier, reason: "verify" });
  assert.equal(result.verdict, "REJECTED");
  assert.equal(store.history("CLAIM", result.claim.id).length, 0);
});

test("knowledge approval requires verified claims", () => {
  const { governance, evidence, store } = setup();
  const claim = governance.verifyClaim({ statement: "Wall thickness should be uniform.", evidenceIds: [evidence.aggregateId], status: "VERIFIED", fingerprint: "ignored" }, { actor: verifier, reason: "verify claim" });
  assert.equal(claim.verdict, "VERIFIED");
  const knowledge = governance.approveKnowledge({
    id: "knowledge:uniform-wall",
    proposition: "Uniform wall thickness is an approved engineering principle.",
    claimIds: [claim.claim.id],
    status: "APPROVED",
    fingerprint: "ignored",
  }, { actor: verifier, reason: "approve knowledge" });
  assert.equal(knowledge.verdict, "APPROVED");
  assert.equal(store.get("KNOWLEDGE", "knowledge:uniform-wall")?.state, "VERIFIED");
});

test("knowledge with UNKNOWN status fails closed before persistence", () => {
  const { governance, evidence } = setup();
  const claim = governance.verifyClaim({ statement: "fact", evidenceIds: [evidence.aggregateId], status: "VERIFIED", fingerprint: "ignored" }, { actor: verifier, reason: "verify" });
  assert.equal(claim.verdict, "VERIFIED");
  assert.throws(() => governance.approveKnowledge({ proposition: "fact", claimIds: [claim.claim.id], status: "UNKNOWN", fingerprint: "ignored" }, { actor: verifier, reason: "approve" }), /V8_KNOWLEDGE_UNKNOWN/);
});

test("governance actions require an explicit audit reason", () => {
  const { governance, evidence } = setup();
  assert.throws(() => governance.verifyClaim({ statement: "fact", evidenceIds: [evidence.aggregateId], status: "VERIFIED", fingerprint: "ignored" }, { actor: verifier, reason: "   " }), /V8_GOVERNANCE_REASON_REQUIRED/);
});

test("same claim and knowledge semantics remain deterministic", () => {
  const { governance, evidence } = setup();
  const a = governance.verifyClaim({ statement: "fact", evidenceIds: [evidence.aggregateId], status: "VERIFIED", fingerprint: "x" }, { actor: verifier, reason: "verify" });
  assert.equal(a.verdict, "VERIFIED");
  const knowledgeA = governance.approveKnowledge({ proposition: "approved fact", claimIds: [a.claim.id], status: "APPROVED", fingerprint: "x" }, { actor: verifier, reason: "approve" });
  assert.equal(knowledgeA.verdict, "APPROVED");
  assert.equal(a.claim.fingerprint, governance.claims.verify({ statement: "fact", evidenceIds: [evidence.aggregateId], status: "VERIFIED", fingerprint: "different" }).claim.fingerprint);
  assert.equal(knowledgeA.knowledge.fingerprint, createKnowledge({ proposition: "approved fact", claimIds: [a.claim.id], status: "APPROVED" }).fingerprint);
});
