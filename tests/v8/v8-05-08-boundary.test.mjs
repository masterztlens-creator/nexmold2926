import test from "node:test";
import assert from "node:assert/strict";
import * as V from "../../.v8-build/src/v8/index.js";

test("Evidence rejects duplicate refs and source/snapshot mismatch", () => {
  const store = new V.InMemoryFoundationStore();
  const gate = new V.EvidenceGate(store);
  assert.equal(gate.check(["x", "x"]).passed, false);
});

test("Projection gate rejects forged id and content", () => {
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
  const projection = V.project({ artifact, route: "/x" });
  assert.throws(
    () => new V.ProjectionGate().check(artifact, { ...projection, id: "projection:forged" }),
    /V8_PROJECTION_ID_MISMATCH/,
  );
});

test("Release gate is cryptographically closed over projection identity and manifest", () => {
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
