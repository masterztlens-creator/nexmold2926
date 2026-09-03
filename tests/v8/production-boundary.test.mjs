import assert from "node:assert/strict";
import test from "node:test";
import { createProductionManifest, assertProductionManifest } from "../../.v8-build/src/v8/production/adapter.js";
import { contentFingerprint } from "../../.v8-build/src/v8/foundation/hash.js";

test("V8 production boundary accepts only exact release/projection identity", () => {
  const projection = Object.freeze({
    id: "projection:v8-production-fixture",
    publicationId: "publication:v8-production-fixture",
    route: "/v8-production-fixture/",
    title: "V8 Production Fixture",
    body: "V8 production boundary fixture.",
    fingerprint: "a".repeat(64),
  });
  const manifest = ["dist/v8-production-fixture/index.html"];
  const payload = { projectionId: projection.id, projectionFingerprint: projection.fingerprint, manifest };
  const fingerprint = contentFingerprint(payload);
  const release = Object.freeze({ id: `release:${fingerprint}`, ...payload, fingerprint });

  const production = createProductionManifest({ release, projection, expectedPaths: manifest });
  assert.equal(production.schema, "nexmold.v8.production-manifest.v1");
  assert.equal(production.releaseId, release.id);
  assert.deepEqual(production.manifest, manifest);
  assert.deepEqual(assertProductionManifest(production), { passed: true, releaseId: release.id });

  assert.throws(() => createProductionManifest({
    release, projection: { ...projection, fingerprint: "b".repeat(64) }, expectedPaths: manifest,
  }), /V8_PRODUCTION_PROJECTION_FINGERPRINT_MISMATCH/);

  assert.throws(() => createProductionManifest({
    release, projection, expectedPaths: ["dist/forged/index.html"],
  }), /V8_PRODUCTION_MANIFEST_MISMATCH/);
});
