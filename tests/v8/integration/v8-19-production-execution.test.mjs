import assert from "node:assert/strict";
import test from "node:test";

import {
  assertProductionExecution,
  assertProductionManifest,
  createProductionManifest,
  executeProduction,
} from "../../../.v8-build/src/v8/production/index.js";

import {
  project,
} from "../../../.v8-build/src/v8/projection/index.js";

import {
  releasePreflight,
} from "../../../.v8-build/src/v8/release/index.js";

const publication = Object.freeze({
  id: "publication:v8-19-production",
  subjectId: "v8-19-production-subject",
  title: "V8-19 Production Execution",
  body: "Production execution boundary test.",
  contentFingerprint: "a".repeat(64),
  lineage: [],
  eligibilityRecordId: "eligibility:v8-19-production",
  policyId: "policy:v8-19-production",
  policyFingerprint: "b".repeat(64),
});

const projection = project({
  artifact: publication,
  route: "/v8-19-production/",
});

const requiredPaths = [
  "index.html",
  "v8-19-production/index.html",
];

function makeRelease(
  required = requiredPaths,
  generated = requiredPaths,
) {
  return releasePreflight({
    projection,
    requiredPaths: required,
    generatedPaths: generated,
  });
}

test(
  "V8-19 Production Execution PASS",
  () => {
    const release = makeRelease();

    const execution = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.equal(
      execution.schema,
      "nexmold.v8.production-execution.v1",
    );

    assert.equal(
      execution.status,
      "EXECUTED",
    );

    assert.equal(
      execution.releaseId,
      release.id,
    );

    assert.equal(
      execution.projectionId,
      projection.id,
    );

    assert.equal(
      execution.releaseFingerprint,
      release.fingerprint,
    );

    assert.equal(
      execution.projectionFingerprint,
      projection.fingerprint,
    );

    assert.deepEqual(
      execution.manifest,
      requiredPaths,
    );

    assert.equal(
      execution.executionId,
      `execution:${execution.executionFingerprint}`,
    );

    assert.equal(
      execution.executionFingerprint.length,
      64,
    );
  },
);

test(
  "V8-19 execution is deterministic",
  () => {
    const release = makeRelease();

    const first = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    const second = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.deepEqual(
      first,
      second,
    );
  },
);

test(
  "V8-19 preserves Release identity",
  () => {
    const release = makeRelease();

    const before = structuredClone({
      id: release.id,
      projectionId: release.projectionId,
      projectionFingerprint: release.projectionFingerprint,
      fingerprint: release.fingerprint,
      manifest: [...release.manifest],
    });

    const execution = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
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

    assert.equal(
      execution.releaseId,
      release.id,
    );
  },
);

test(
  "V8-19 preserves Projection identity",
  () => {
    const release = makeRelease();

    const before = structuredClone({
      id: projection.id,
      publicationId: projection.publicationId,
      route: projection.route,
      title: projection.title,
      body: projection.body,
      fingerprint: projection.fingerprint,
    });

    const execution = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.deepEqual(
      {
        id: projection.id,
        publicationId: projection.publicationId,
        route: projection.route,
        title: projection.title,
        body: projection.body,
        fingerprint: projection.fingerprint,
      },
      before,
    );

    assert.equal(
      execution.projectionId,
      projection.id,
    );
  },
);

test(
  "V8-19 blocks forged projection fingerprint",
  () => {
    const release = makeRelease();

    const forgedProjection = Object.freeze({
      ...projection,
      fingerprint: "c".repeat(64),
    });

    assert.throws(
      () =>
        executeProduction({
          release,
          projection: forgedProjection,
          expectedPaths: requiredPaths,
        }),
      /V8_PRODUCTION_PROJECTION_FINGERPRINT_MISMATCH/,
    );
  },
);

test(
  "V8-19 blocks forged projection identity",
  () => {
    const release = makeRelease();

    const forgedProjection = Object.freeze({
      ...projection,
      id: "projection:forged",
    });

    assert.throws(
      () =>
        executeProduction({
          release,
          projection: forgedProjection,
          expectedPaths: requiredPaths,
        }),
      /V8_PRODUCTION_PROJECTION_ID_MISMATCH/,
    );
  },
);

test(
  "V8-19 blocks forged Release fingerprint",
  () => {
    const release = makeRelease();

    const forgedRelease = Object.freeze({
      ...release,
      fingerprint: "d".repeat(64),
    });

    assert.throws(
      () =>
        executeProduction({
          release: forgedRelease,
          projection,
          expectedPaths: requiredPaths,
        }),
      /V8_PRODUCTION_RELEASE_FINGERPRINT_MISMATCH/,
    );
  },
);

test(
  "V8-19 blocks forged Release identity",
  () => {
    const release = makeRelease();

    const forgedRelease = Object.freeze({
      ...release,
      id: "release:forged",
    });

    assert.throws(
      () =>
        executeProduction({
          release: forgedRelease,
          projection,
          expectedPaths: requiredPaths,
        }),
      /V8_PRODUCTION_RELEASE_ID_MISMATCH/,
    );
  },
);

test(
  "V8-19 blocks forged artifact paths",
  () => {
    const release = makeRelease();

    assert.throws(
      () =>
        executeProduction({
          release,
          projection,
          expectedPaths: [
            ...requiredPaths,
            "__forged__.html",
          ],
        }),
      /V8_PRODUCTION_MANIFEST_MISMATCH/,
    );
  },
);

test(
  "V8-19 blocks incomplete generated artifact set",
  () => {
    assert.throws(
      () =>
        makeRelease(
          requiredPaths,
          [
            "index.html",
          ],
        ),
      /V8_RELEASE_MISSING_ARTIFACT/,
    );
  },
);

test(
  "V8-19 blocks unexpected generated artifact",
  () => {
    assert.throws(
      () =>
        makeRelease(
          requiredPaths,
          [
            ...requiredPaths,
            "__unexpected__.html",
          ],
        ),
      /V8_RELEASE_UNEXPECTED_ARTIFACT/,
    );
  },
);

test(
  "V8-19 blocks empty production manifest",
  () => {
    const release = makeRelease();

    const forgedRelease = Object.freeze({
      ...release,
      manifest: [],
    });

    assert.throws(
      () =>
        executeProduction({
          release: forgedRelease,
          projection,
          expectedPaths: requiredPaths,
        }),
      /V8_PRODUCTION_EMPTY_MANIFEST/,
    );
  },
);

test(
  "V8-19 blocks non-canonical production manifest",
  () => {
    const release = makeRelease();

    const forgedRelease = Object.freeze({
      ...release,
      manifest: [
        "v8-19-production/index.html",
        "index.html",
      ],
    });

    assert.throws(
      () =>
        executeProduction({
          release: forgedRelease,
          projection,
          expectedPaths: requiredPaths,
        }),
      /V8_PRODUCTION_RELEASE_FINGERPRINT_MISMATCH/,
    );
  },
);

test(
  "V8-19 production manifest remains independently valid",
  () => {
    const release = makeRelease();

    const manifest = createProductionManifest({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.equal(
      assertProductionManifest(manifest).passed,
      true,
    );

    const execution = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.equal(
      execution.releaseId,
      manifest.releaseId,
    );

    assert.equal(
      execution.projectionId,
      manifest.projectionId,
    );

    assert.equal(
      execution.releaseFingerprint,
      manifest.releaseFingerprint,
    );

    assert.deepEqual(
      execution.manifest,
      manifest.manifest,
    );
  },
);

test(
  "V8-19 assertProductionExecution returns validated execution",
  () => {
    const release = makeRelease();

    const execution = assertProductionExecution({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.equal(
      execution.status,
      "EXECUTED",
    );

    assert.equal(
      execution.executionFingerprint.length,
      64,
    );
  },
);

test(
  "V8-19 cannot bypass Release",
  () => {
    assert.throws(
      () =>
        executeProduction({
          release: null,
          projection,
          expectedPaths: requiredPaths,
        }),
    );
  },
);

test(
  "V8-19 execution exposes no Content, Decision, or Knowledge input",
  () => {
    const release = makeRelease();

    const execution = executeProduction({
      release,
      projection,
      expectedPaths: requiredPaths,
    });

    assert.equal(
      "content" in execution,
      false,
    );

    assert.equal(
      "decision" in execution,
      false,
    );

    assert.equal(
      "knowledge" in execution,
      false,
    );

    assert.equal(
      "publication" in execution,
      false,
    );
  },
);