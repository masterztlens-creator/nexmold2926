import assert from "node:assert/strict";
import test from "node:test";
import {
  assertReleaseReady,
  releasePreflight,
} from "../../../.v8-build/src/v8/release/index.js";
import { project } from "../../../.v8-build/src/v8/projection/index.js";

const projection = Object.freeze({
  id: "projection:test",
  publicationId: "publication:test",
  route: "/test",
  title: "Release Test",
  body: "Release test body",
  fingerprint: "a".repeat(64),
});

function release(requiredPaths, generatedPaths) {
  return releasePreflight({
    projection,
    requiredPaths,
    generatedPaths,
  });
}

test("V8-17 Release / Reproducibility", () => {
  const required = ["/a.html", "/b.html"];

  const r1 = release(required, ["/b.html", "/a.html"]);
  const r2 = release(required, ["/a.html", "/b.html"]);

  assert.deepEqual(r1, r2);
  assert.equal(r1.id, `release:${r1.fingerprint}`);
  assert.equal(r1.manifest.join(","), "/a.html,/b.html");
  assert.equal(assertReleaseReady(r1).passed, true);

  assert.throws(
    () => release(required, ["/a.html"]),
    /V8_RELEASE_MISSING_ARTIFACT/,
  );

  assert.throws(
    () => release(required, ["/a.html", "/b.html", "/c.html"]),
    /V8_RELEASE_UNEXPECTED_ARTIFACT/,
  );

  assert.throws(
    () =>
      assertReleaseReady({
        ...r1,
        projectionFingerprint: "b".repeat(64),
      }),
    /V8_RELEASE_FINGERPRINT_MISMATCH/,
  );

  assert.throws(
    () =>
      assertReleaseReady({
        ...r1,
        fingerprint: "b".repeat(64),
      }),
    /V8_RELEASE_FINGERPRINT_MISMATCH/,
  );

  assert.throws(
    () =>
      assertReleaseReady({
        ...r1,
        id: "release:tampered",
      }),
    /V8_RELEASE_ID_MISMATCH/,
  );

  assert.throws(
    () =>
      assertReleaseReady({
        ...r1,
        manifest: ["/b.html", "/a.html"],
      }),
    /V8_RELEASE_MANIFEST_NOT_CANONICAL/,
  );

  assert.throws(
    () =>
      assertReleaseReady({
        ...r1,
        manifest: [],
      }),
    /V8_RELEASE_EMPTY_MANIFEST/,
  );
});

test("V8-17 preserves the legacy Projection contract", () => {
  const artifact = {
    id: "publication:test",
    title: "Release Test",
    body: "Release test body",
  };

  const p = project({
    artifact,
    route: "/test",
  });

  assert.equal(p.publicationId, artifact.id);
  assert.equal(p.title, artifact.title);
  assert.equal(p.body, artifact.body);

  const r = release(["/test"], ["/test"]);
  assert.equal(assertReleaseReady(r).passed, true);
});

