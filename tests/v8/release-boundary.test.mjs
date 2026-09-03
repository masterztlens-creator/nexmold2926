import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../../.v8-build/src/v8/index.js";

test("release artifact carries projection fingerprint and gate verifies the complete canonical identity", () => {
  const projection = {
    id: "projection:p",
    publicationId: "publication:a",
    route: "/x",
    title: "T",
    body: "B",
    fingerprint: "p".repeat(64),
  };

  const release = V.releasePreflight({
    projection,
    requiredPaths: ["/x"],
    generatedPaths: ["/x"],
  });

  assert.equal(release.projectionFingerprint, projection.fingerprint);
  assert.equal(V.assertReleaseReady(release).passed, true);

  assert.throws(
    () => V.assertReleaseReady({ ...release, projectionFingerprint: "q".repeat(64) }),
    /V8_RELEASE_FINGERPRINT_MISMATCH/,
  );
  assert.throws(
    () => V.assertReleaseReady({ ...release, id: "release:forged" }),
    /V8_RELEASE_ID_MISMATCH/,
  );
});
