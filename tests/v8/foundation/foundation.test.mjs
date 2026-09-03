import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FoundationService, InMemoryFoundationStore, JsonlFoundationStore, createSource } from "../../../.v8-build/src/v8/index.js";

const actor = { id: "test-system", role: "SYSTEM" };
const auditor = { id: "test-auditor", role: "AUDITOR" };

function source() {
  return createSource({ kind: "PUBLIC_WEB", locator: "https://example.test/spec", access: "PAYLOAD_ALLOWED", title: "Example", version: "1" });
}

test("Source → Snapshot → Evidence → Claim lineage is enforced", () => {
  const store = new InMemoryFoundationStore();
  const svc = new FoundationService(store);
  const s = source();
  svc.registerSource(s, actor);
  const snap = svc.captureSnapshot({ source: s, capturedAt: "2026-09-03T00:00:00.000Z", locator: s.locator, content: "fact", metadataOnly: false }, actor);
  assert.throws(() => svc.ingestEvidence({ sourceId: s.id, locator: "p1", excerpt: "fact", ingestion: "INGESTED", capturedAt: snap.recordedAt, snapshotId: snap.aggregateId }, actor), /SNAPSHOT_NOT_SEALED/);
  svc.sealSnapshot(snap.aggregateId, actor);
  const ev = svc.ingestEvidence({ sourceId: s.id, locator: "p1", excerpt: "fact", ingestion: "INGESTED", capturedAt: snap.recordedAt, snapshotId: snap.aggregateId }, actor);
  svc.auditEvidence(ev.aggregateId, auditor);
  const claim = svc.createClaim({ id: "claim-1", statement: "fact", evidenceIds: [ev.aggregateId], status: "VERIFIED", fingerprint: "ignored" }, auditor);
  assert.equal(claim.state, "VERIFIED");
  assert.equal(claim.lineage[0].type, "SOURCE");
  assert.equal(claim.lineage.at(-1).type, "EVIDENCE");
});

test("append-only versioning rejects gaps and illegal transitions", () => {
  const store = new InMemoryFoundationStore();
  const svc = new FoundationService(store);
  const s = source();
  svc.registerSource(s, actor);
  assert.throws(() => store.append({ aggregateType: "SOURCE", aggregateId: s.id, version: 3, state: "RETIRED", payload: s, lineage: [], actor, reason: "bad" }), /VERSION_GAP/);
  assert.throws(() => store.append({ aggregateType: "SOURCE", aggregateId: s.id, version: 2, state: "VERIFIED", payload: s, lineage: [], actor, reason: "bad" }), /INVALID_TRANSITION/);
});

test("metadata-only Source cannot persist payload", () => {
  const store = new InMemoryFoundationStore();
  const svc = new FoundationService(store);
  const s = createSource({ kind: "STANDARD_METADATA", locator: "std:123", access: "METADATA_ONLY", title: "Restricted standard", version: "2026" });
  svc.registerSource(s, actor);
  assert.throws(() => svc.captureSnapshot({ source: s, capturedAt: "2026-09-03T00:00:00.000Z", locator: s.locator, content: "restricted bytes", metadataOnly: true }, actor), /METADATA_PAYLOAD_FORBIDDEN/);
});

test("tamper detection works across persisted JSONL history", () => {
  const dir = mkdtempSync(join(tmpdir(), "nexmold-v8-02-"));
  const file = join(dir, "foundation.jsonl");
  const first = new JsonlFoundationStore(file);
  const svc = new FoundationService(first);
  const s = source();
  svc.registerSource(s, actor);
  assert.equal(first.auditTrail().length, 1);
  const raw = readFileSync(file, "utf8");
  const tampered = raw.replace("Example", "Tampered");
  writeFileSync(file, tampered);
  assert.throws(() => new JsonlFoundationStore(file).auditTrail(), /PERSISTED_RECORD_INVALID|FINGERPRINT_MISMATCH|CHAIN_BROKEN/);
});

test("audit boundary requires a valid actor and reason", () => {
  const store = new InMemoryFoundationStore();
  const svc = new FoundationService(store);
  const s = source();
  assert.throws(() => svc.registerSource(s, { id: "", role: "SYSTEM" }), /AUDIT_ACTOR_REQUIRED/);
  assert.throws(() => svc.registerSource(s, actor, "   "), /reason must be non-empty/);
  assert.throws(() => store.append({ aggregateType: "SOURCE", aggregateId: "bad", version: 1, state: "REGISTERED", payload: {}, lineage: [], actor: { id: "x", role: "HACK" }, reason: "test" }), /AUDIT_ROLE_INVALID/);
});

test("returned history is deeply immutable", () => {
  const store = new InMemoryFoundationStore();
  const svc = new FoundationService(store);
  const s = source();
  const record = svc.registerSource(s, actor);
  assert.equal(Object.isFrozen(record), true);
  assert.equal(Object.isFrozen(record.payload), true);
  assert.throws(() => { record.payload.title = "mutated"; }, TypeError);
});
