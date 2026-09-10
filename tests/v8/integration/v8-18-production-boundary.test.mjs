import assert from "node:assert/strict";
import test from "node:test";
import {
  assertProductionBoundary,
  checkProductionBoundary,
} from "../../../.v8-build/src/v8/production-boundary/index.js";
import {
  assertReleaseReady,
  releasePreflight,
} from "../../../.v8-build/src/v8/release/index.js";
const projection = Object.freeze({
  id: "projection:test",
  publicationId: "publication:test",
  route: "/test",
  title: "Production Boundary Test",
  body: "Production boundary test body",
  fingerprint: "a".repeat(64),
});
function makeRelease(
  requiredPaths = ["/a.html", "/b.html"],
  generatedPaths = ["/a.html", "/b.html"],
) {
  return releasePreflight({
    projection,
    requiredPaths,
    generatedPaths,
  });
}
test("V8-18 Production Boundary", () => {
  const release = makeRelease();
  const result = checkProductionBoundary({
    release,
  });
  assert.equal(result.passed, true);
  assert.equal(result.status, "READY");
  assert.equal(result.releaseId, release.id);
  assert.equal(result.fingerprint, release.fingerprint);
  assert.deepEqual(result.manifest, ["/a.html", "/b.html"]);
  assert.deepEqual(result.reasons, []);
  assert.equal(
    assertProductionBoundary({
      release,
    }).passed,
    true,
  );
  assert.equal(
    assertReleaseReady(release).passed,
    true,
  );
});
test("V8-18 blocks a tampered release fingerprint", () => {
  const release = makeRelease();
  const tampered = Object.freeze({
    ...release,
    fingerprint: "b".repeat(64),
  });
  const result = checkProductionBoundary({
    release: tampered,
  });
  assert.equal(result.passed, false);
  assert.equal(result.status, "BLOCKED");
  assert.throws(
    () =>
      assertProductionBoundary({
        release: tampered,
      }),
    /V8_PRODUCTION_BOUNDARY_BLOCKED/,
  );
});
test("V8-18 blocks a tampered projection fingerprint", () => {
  const release = makeRelease();
  const tampered = Object.freeze({
    ...release,
    projectionFingerprint: "b".repeat(64),
  });
  const result = checkProductionBoundary({
    release: tampered,
  });
  assert.equal(result.passed, false);
  assert.equal(result.status, "BLOCKED");
  assert.match(
    result.reasons[0],
    /V8_RELEASE_FINGERPRINT_MISMATCH/,
  );
});
test("V8-18 blocks a tampered projection identity", () => {
  const release = makeRelease();
  const tampered = Object.freeze({
    ...release,
    projectionId: "projection:tampered",
  });
  const result = checkProductionBoundary({
    release: tampered,
  });
  assert.equal(result.passed, false);
  assert.equal(result.status, "BLOCKED");
});
test("V8-18 blocks an empty manifest", () => {
  const release = makeRelease();
  const tampered = Object.freeze({
    ...release,
    manifest: [],
  });
  const result = checkProductionBoundary({
    release: tampered,
  });
  assert.equal(result.passed, false);
  assert.equal(result.status, "BLOCKED");
  assert.match(
    result.reasons[0],
    /V8_RELEASE_EMPTY_MANIFEST/,
  );
});
test("V8-18 blocks a non-canonical manifest", () => {
  const release = makeRelease();
  const tampered = Object.freeze({
    ...release,
    manifest: ["/b.html", "/a.html"],
  });
  const result = checkProductionBoundary({
    release: tampered,
  });
  assert.equal(result.passed, false);
  assert.equal(result.status, "BLOCKED");
  assert.match(
    result.reasons[0],
    /V8_RELEASE_MANIFEST_NOT_CANONICAL/,
  );
});
test("V8-18 blocks a release with an unexpected artifact", () => {
  assert.throws(
    () =>
      makeRelease(
        ["/a.html", "/b.html"],
        ["/a.html", "/b.html", "/c.html"],
      ),
    /V8_RELEASE_UNEXPECTED_ARTIFACT/,
  );
});
test("V8-18 blocks a release with a missing artifact", () => {
  assert.throws(
    () =>
      makeRelease(
        ["/a.html", "/b.html"],
        ["/a.html"],
      ),
    /V8_RELEASE_MISSING_ARTIFACT/,
  );
});
test("V8-18 does not mutate the ReleaseArtifact", () => {
  const release = makeRelease();
  const before = structuredClone({
    id: release.id,
    projectionId: release.projectionId,
    projectionFingerprint: release.projectionFingerprint,
    fingerprint: release.fingerprint,
    manifest: [...release.manifest],
  });
  const result = assertProductionBoundary({
    release,
  });
  assert.deepEqual(
    {
      id: release.id,
      projectionId: release.projectionId,
      projectionFingerprint: release.projectionFingerprint,
      fingerprint: release.fingerprint,
      manifest: [...release.manifest],
    },
    before,
  );
  assert.equal(result.releaseId, release.id);
});
test("V8-18 boundary exposes only Release as the production input", () => {
  const release = makeRelease();
  const result = checkProductionBoundary({
    release,
  });
  assert.equal("releaseId" in result, true);
  assert.equal("fingerprint" in result, true);
  assert.equal("manifest" in result, true);
  assert.equal("content" in result, false);
  assert.equal("decision" in result, false);
  assert.equal("knowledge" in result, false);
  assert.equal("projection" in result, false);
});
