import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { InMemoryFoundationStore, FoundationService, rawBytesFingerprint } from "../../../src/v8/foundation/index.ts";

const actor = { id: "foundation-test", role: "VERIFIER" };
const bytes = new TextEncoder().encode("NEXMOLD V8 authoritative test document\nTable 1\nMold temperature: 80-100 C");
const hash = createHash("sha256").update(bytes).digest("hex");
assert.equal(rawBytesFingerprint(bytes), hash);

const store = new InMemoryFoundationStore();
const svc = new FoundationService(store);
const source = svc.registerSource({
  id: "SRC-TEST-V8-001", kind: "PUBLIC_WEB", locator: "https://example.com/tds.pdf", access: "PAYLOAD_ALLOWED",
  title: "Official Technical Document", version: "Rev.1", publisher: "Example Manufacturer",
  authority: "MANUFACTURER_PRIMARY", status: "ACTIVE", canonicalUrl: "https://example.com/tds.pdf",
  publicationDate: "2026-09", publicationDatePrecision: "MONTH", retrievedAt: new Date().toISOString(),
  documentHash: hash, language: "en", productGrade: "TEST-GRADE", sourceType: "OFFICIAL_TDS",
}, actor);

const snap = svc.captureSnapshot({ source: source.payload, capturedAt: new Date().toISOString(), locator: "pdf:page=1", metadataOnly: false, rawBytes: bytes, requestedUrl: "https://example.com/tds.pdf", finalUrl: "https://example.com/tds.pdf", redirectChain: ["https://example.com/tds.pdf"], mediaType: "application/pdf", blobLocator: ".nexmold/v8/raw-snapshots/" + hash }, actor);
svc.sealSnapshot(snap.aggregateId, actor);
const ev = svc.ingestEvidence({ sourceId: source.aggregateId, snapshotId: snap.aggregateId, locator: "pdf-page:1#table-1:row-mold-temperature", excerpt: "Mold temperature: 80-100 C", ingestion: "INGESTED", capturedAt: new Date().toISOString(), verificationStatus: "UNVERIFIED", page: 1, table: "Table 1", row: "Mold temperature", parameter: "Mold temperature", value: "80-100", unit: "C", materialGrade: "TEST-GRADE", extractionMethod: "MANUAL_TRANSCRIPTION", extractionConfidence: "HIGH" }, actor);
const verified = svc.verifyEvidence(ev.aggregateId, actor);
assert.equal(verified.state, "VERIFIED");
const claim = svc.createClaim({ id: "CLM-TEST-V8-001", statement: "The document specifies a mold temperature of 80-100 C for TEST-GRADE.", evidenceIds: [ev.aggregateId], status: "VERIFIED", fingerprint: "" , epistemicLevel: "OBSERVATION", isUniversal: false }, actor);
assert.equal(claim.state, "VERIFIED");
assert.equal(claim.payload.evidenceIds[0], ev.aggregateId);
store.verifyChain();
assert.equal(store.auditTrail().filter(r => r.aggregateType === "VERIFICATION").length, 2);
console.log("PASS V8 Foundation production chain");
