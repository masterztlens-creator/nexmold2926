import assert from "node:assert/strict";
import test from "node:test";
import { createProductionManifest, assertProductionManifest } from "../../.v8-build/src/v8/production/adapter.js";
import { project } from "../../.v8-build/src/v8/projection/projector.js";
import { releasePreflight } from "../../.v8-build/src/v8/release/preflight.js";

function fixture() {
  const projection = project({
    artifact: Object.freeze({
      id: "publication:v8-09-integration",
      subjectId: "integration",
      title: "V8-09 Production Integration",
      body: "Real artifact boundary fixture.",
      contentFingerprint: "a".repeat(64),
      lineage: [],
      eligibilityRecordId: "eligibility:v8-09-integration",
      policyId: "policy:v8-09-integration",
      policyFingerprint: "b".repeat(64),
    }),
    route: "/v8-09-production-integration/",
  });
  const paths = ["v8-09-production-integration/index.html"];
  const release = releasePreflight({ projection, requiredPaths: paths, generatedPaths: paths });
  return { projection, paths, release };
}

test("V8 production chain is canonical and fail-closed", () => {
  const { projection, paths, release } = fixture();
  const production = createProductionManifest({ release, projection, expectedPaths: paths });
  assert.equal(production.schema, "nexmold.v8.production-manifest.v1");
  assert.deepEqual(assertProductionManifest(production), { passed: true, releaseId: release.id });
  assert.throws(() => createProductionManifest({ release, projection: { ...projection, fingerprint: "c".repeat(64) }, expectedPaths: paths }), /V8_PRODUCTION_PROJECTION_FINGERPRINT_MISMATCH/);
  assert.throws(() => createProductionManifest({ release, projection, expectedPaths: [...paths, "forged/index.html"] }), /V8_PRODUCTION_MANIFEST_MISMATCH/);
  assert.throws(() => assertProductionManifest({ ...production, releaseFingerprint: "d".repeat(64) }), /V8_PRODUCTION_RELEASE_IDENTITY_INVALID/);
});
