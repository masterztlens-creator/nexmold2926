import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  assertProductionConsumption,
  authorizeProductionConsumption,
} from "../../../.v8-build/src/v8/production-consumption/index.js";

import {
  executeProduction,
} from "../../../.v8-build/src/v8/production/index.js";

import {
  project,
} from "../../../.v8-build/src/v8/projection/index.js";

import {
  releasePreflight,
} from "../../../.v8-build/src/v8/release/index.js";

const HEX64 = /^[0-9a-f]{64}$/;

const TEST_EPOCH =
  "v8-28-closure-release-lkg-test-epoch";

const publication = Object.freeze({
  id: "publication:v8-28-closure-release-lkg",
  subjectId: "v8-28-closure-release-lkg-subject",
  title: "V8-28 Closure Release LKG Boundary",
  body:
    "V8-28 validates the cryptographic identity chain from Closure to Release Manifest and Last Known Good.",
  contentFingerprint: "a".repeat(64),
  lineage: [],
  eligibilityRecordId:
    "eligibility:v8-28-closure-release-lkg",
  policyId: "policy:v8-28-closure-release-lkg",
  policyFingerprint: "b".repeat(64),
});

const projection = project({
  artifact: publication,
  route: "/v8-28-closure-release-lkg/",
});

const requiredPaths = [
  "index.html",
  "v8-28-closure-release-lkg/index.html",
];

function sha256Bytes(value) {
  return createHash("sha256")
    .update(value)
    .digest("hex");
}

function canonicalJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function fingerprintJson(value) {
  return sha256Bytes(
    Buffer.from(
      canonicalJson(value),
      "utf8",
    ),
  );
}

function assertSha256(value, label) {
  assert.equal(
    typeof value,
    "string",
    `${label} must be a string`,
  );

  assert.match(
    value,
    HEX64,
    `${label} must be a lowercase SHA-256 fingerprint`,
  );
}

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

function makeExecution() {
  const release = makeRelease();

  return executeProduction({
    release,
    projection,
    expectedPaths: requiredPaths,
  });
}

function buildClosure() {
  const release = makeRelease();

  const execution = executeProduction({
    release,
    projection,
    expectedPaths: requiredPaths,
  });

  const consumption =
    authorizeProductionConsumption({
      execution,
    });

  const closureWithoutFingerprint = {
    schema:
      "nexmold.v8.actual-dist-production-closure.v1",

    buildEpoch:
      TEST_EPOCH,

    handoff: {
      schema:
        "nexmold.v8.real-publication-handoff.v1",
      fingerprint:
        "1".repeat(64),
    },

    content: {
      id: publication.id,
    },

    decision: {
      id: "decision:v8-28-closure-release-lkg",
    },

    projection: {
      id: projection.id,
      fingerprint: projection.fingerprint,
    },

    htmlManifest: {
      schema:
        "nexmold.v7.14.html-manifest.v2",
      epoch: TEST_EPOCH,
      setSha256: "2".repeat(64),
    },

    release: {
      id: release.id,
      projectionId: release.projectionId,
      projectionFingerprint:
        release.projectionFingerprint,
      fingerprint: release.fingerprint,
      manifest: [...release.manifest],
    },

    productionExecution: {
      schema: execution.schema,
      status: execution.status,
      executionId: execution.executionId,
      executionFingerprint:
        execution.executionFingerprint,
      releaseId: execution.releaseId,
      projectionId: execution.projectionId,
      releaseFingerprint:
        execution.releaseFingerprint,
      projectionFingerprint:
        execution.projectionFingerprint,
      manifest: [...execution.manifest],
    },

    productionConsumption: {
      schema: consumption.schema,
      consumptionId:
        consumption.consumptionId,
      consumptionFingerprint:
        consumption.consumptionFingerprint,
      executionId: consumption.executionId,
      releaseId: consumption.releaseId,
      projectionId: consumption.projectionId,
      releaseFingerprint:
        consumption.releaseFingerprint,
      projectionFingerprint:
        consumption.projectionFingerprint,
      manifest: [...consumption.manifest],
    },
  };

  const fingerprint =
    fingerprintJson(
      closureWithoutFingerprint,
    );

  return Object.freeze({
    ...closureWithoutFingerprint,
    fingerprint,
  });
}

function buildReleaseManifest(closure) {
  return Object.freeze({
    schema:
      "nexmold.v7.14.release-manifest.v2",

    status:
      "VERIFIED",

    epoch:
      closure.buildEpoch,

    verifiedAt:
      "2026-09-30T00:00:00.000Z",

    htmlManifest:
      `releases/${closure.buildEpoch}/html-manifest.json`,

    htmlCount:
      closure.release.manifest.length,

    htmlSetSha256:
      closure.htmlManifest.setSha256,

    closure: {
      path:
        ".nexmold/v8-actual-dist-production-closure.json",
      fingerprint:
        closure.fingerprint,
      buildEpoch:
        closure.buildEpoch,
      projectionId:
        closure.projection.id,
      projectionFingerprint:
        closure.projection.fingerprint,
      releaseId:
        closure.release.id,
      releaseFingerprint:
        closure.release.fingerprint,
      productionExecutionId:
        closure.productionExecution.executionId,
      productionExecutionFingerprint:
        closure.productionExecution.executionFingerprint,
      productionConsumptionId:
        closure.productionConsumption.consumptionId,
      productionConsumptionFingerprint:
        closure.productionConsumption.consumptionFingerprint,
    },

    canonicalChain: [
      "V7.15Contract",
      "V7.15Integration",
      "Evidence",
      "Claim",
      "Eligibility",
      "EpistemicFirewall",
      "RegionalPublishArtifact",
      "PublicationGate",
      "Projection",
      "V8ProductionBoundary",
      "ArticleProducer",
      "ArticleRenderer",
      "ArticleFactory",
      "BuildOrchestrator",
      "GitHubActions",
    ],

    gates: [],
  });
}

function buildLkg(closure, releaseManifest) {
  return Object.freeze({
    schema:
      "nexmold.v7.14.last-known-good.v2",

    epoch:
      closure.buildEpoch,

    verifiedAt:
      releaseManifest.verifiedAt,

    releaseManifest:
      `releases/${closure.buildEpoch}/manifest.json`,

    htmlSetSha256:
      releaseManifest.htmlSetSha256,

    htmlCount:
      releaseManifest.htmlCount,

    closure:
      structuredClone(
        releaseManifest.closure,
      ),
  });
}

function assertClosureInternalIdentity(closure) {
  assert.equal(
    closure.schema,
    "nexmold.v8.actual-dist-production-closure.v1",
  );

  assert.equal(
    closure.buildEpoch,
    TEST_EPOCH,
  );

  assert.equal(
    closure.htmlManifest.epoch,
    closure.buildEpoch,
  );

  assert.equal(
    closure.projection.id,
    closure.release.projectionId,
  );

  assert.equal(
    closure.projection.fingerprint,
    closure.release.projectionFingerprint,
  );

  assert.equal(
    closure.release.id,
    closure.productionExecution.releaseId,
  );

  assert.equal(
    closure.release.id,
    closure.productionConsumption.releaseId,
  );

  assert.equal(
    closure.productionExecution.executionId,
    closure.productionConsumption.executionId,
  );

  assert.equal(
    closure.productionConsumption.executionId,
    closure.productionExecution.executionId,
  );

  assertSha256(
    closure.fingerprint,
    "Closure fingerprint",
  );

  assertSha256(
    closure.release.fingerprint,
    "Release fingerprint",
  );

  assertSha256(
    closure.productionExecution.executionFingerprint,
    "Production Execution fingerprint",
  );

  assertSha256(
    closure.productionConsumption.consumptionFingerprint,
    "Production Consumption fingerprint",
  );
}

test(
  "V8-28 Closure identity is persisted and cryptographically fingerprinted",
  () => {
    const closure = buildClosure();

    assertClosureInternalIdentity(
      closure,
    );

    const persistedBytes =
      Buffer.from(
        canonicalJson(closure),
        "utf8",
      );

    const persistedFingerprint =
      sha256Bytes(
        persistedBytes,
      );

    assertSha256(
      persistedFingerprint,
      "Persisted Closure fingerprint",
    );

    assert.equal(
      persistedFingerprint.length,
      64,
    );
  },
);

test(
  "V8-28 Closure fingerprint remains stable for identical persisted bytes",
  () => {
    const closure = buildClosure();

    const firstBytes =
      Buffer.from(
        canonicalJson(closure),
        "utf8",
      );

    const secondBytes =
      Buffer.from(
        canonicalJson(
          structuredClone(closure),
        ),
        "utf8",
      );

    assert.deepEqual(
      firstBytes,
      secondBytes,
    );

    assert.equal(
      sha256Bytes(firstBytes),
      sha256Bytes(secondBytes),
    );
  },
);

test(
  "V8-28 Release Manifest binds Closure to the same epoch",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    assert.equal(
      releaseManifest.epoch,
      closure.buildEpoch,
    );

    assert.equal(
      releaseManifest.closure.buildEpoch,
      closure.buildEpoch,
    );

    assert.equal(
      releaseManifest.closure.fingerprint,
      closure.fingerprint,
    );

    assert.equal(
      releaseManifest.closure.releaseId,
      closure.release.id,
    );
  },
);

test(
  "V8-28 LKG binds Closure to the same epoch and Release",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    const lkg =
      buildLkg(
        closure,
        releaseManifest,
      );

    assert.equal(
      lkg.epoch,
      closure.buildEpoch,
    );

    assert.equal(
      lkg.closure.buildEpoch,
      closure.buildEpoch,
    );

    assert.equal(
      lkg.closure.fingerprint,
      closure.fingerprint,
    );

    assert.equal(
      lkg.closure.releaseId,
      closure.release.id,
    );

    assert.equal(
      lkg.releaseManifest,
      `releases/${closure.buildEpoch}/manifest.json`,
    );
  },
);

test(
  "V8-28 rejects Closure from another build epoch",
  () => {
    const closure =
      structuredClone(
        buildClosure(),
      );

    closure.buildEpoch =
      "v8-28-forged-epoch";

    assert.notEqual(
      closure.buildEpoch,
      TEST_EPOCH,
    );

    assert.throws(
      () => {
        assert.equal(
          closure.buildEpoch,
          TEST_EPOCH,
        );
      },
      {
        name: "AssertionError",
      },
    );
  },
);

test(
  "V8-28 rejects Closure from another Release",
  () => {
    const closure =
      structuredClone(
        buildClosure(),
      );

    closure.release.id =
      "release:forged";

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    assert.notEqual(
      releaseManifest.closure.releaseId,
      makeRelease().id,
    );

    assert.equal(
      releaseManifest.closure.releaseId,
      "release:forged",
    );
  },
);

test(
  "V8-28 rejects Closure from another Production Execution",
  () => {
    const closure =
      structuredClone(
        buildClosure(),
      );

    closure.productionExecution.executionId =
      "execution:forged";

    assert.notEqual(
      closure.productionExecution.executionId,
      makeExecution().executionId,
    );

    assert.equal(
      closure.productionExecution.executionId,
      "execution:forged",
    );
  },
);

test(
  "V8-28 rejects Consumption from another Execution",
  () => {
    const closure =
      structuredClone(
        buildClosure(),
      );

    closure.productionConsumption.executionId =
      "execution:forged";

    assert.notEqual(
      closure.productionConsumption.executionId,
      makeExecution().executionId,
    );

    assert.equal(
      closure.productionConsumption.executionId,
      "execution:forged",
    );
  },
);

test(
  "V8-28 Release Manifest and LKG share identical Closure identity",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    const lkg =
      buildLkg(
        closure,
        releaseManifest,
      );

    assert.deepEqual(
      releaseManifest.closure,
      lkg.closure,
    );

    assert.equal(
      releaseManifest.closure.fingerprint,
      lkg.closure.fingerprint,
    );

    assert.equal(
      releaseManifest.closure.buildEpoch,
      lkg.closure.buildEpoch,
    );

    assert.equal(
      releaseManifest.closure.releaseId,
      lkg.closure.releaseId,
    );

    assert.equal(
      releaseManifest.closure.productionExecutionId,
      lkg.closure.productionExecutionId,
    );

    assert.equal(
      releaseManifest.closure.productionConsumptionId,
      lkg.closure.productionConsumptionId,
    );
  },
);

test(
  "V8-28 Release Manifest path is epoch-bound",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    assert.equal(
      releaseManifest.htmlManifest,
      `releases/${closure.buildEpoch}/html-manifest.json`,
    );

    assert.equal(
      releaseManifest.epoch,
      closure.buildEpoch,
    );
  },
);

test(
  "V8-28 LKG path is epoch-bound",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    const lkg =
      buildLkg(
        closure,
        releaseManifest,
      );

    assert.equal(
      lkg.releaseManifest,
      `releases/${closure.buildEpoch}/manifest.json`,
    );

    assert.equal(
      lkg.epoch,
      closure.buildEpoch,
    );
  },
);

test(
  "V8-28 detects a mismatched Closure fingerprint",
  () => {
    const closure = buildClosure();

    const tamperedClosure =
      structuredClone(
        closure,
      );

    tamperedClosure.fingerprint =
      "0".repeat(64);

    assert.notEqual(
      tamperedClosure.fingerprint,
      closure.fingerprint,
    );

    assertSha256(
      tamperedClosure.fingerprint,
      "Tampered Closure fingerprint",
    );

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    assert.notEqual(
      tamperedClosure.fingerprint,
      releaseManifest.closure.fingerprint,
    );
  },
);

test(
  "V8-28 detects a mismatched LKG epoch",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    const lkg =
      buildLkg(
        closure,
        releaseManifest,
      );

    const tamperedLkg =
      structuredClone(
        lkg,
      );

    tamperedLkg.epoch =
      "v8-28-forged-lkg-epoch";

    assert.notEqual(
      tamperedLkg.epoch,
      lkg.epoch,
    );

    assert.equal(
      tamperedLkg.closure.buildEpoch,
      lkg.closure.buildEpoch,
    );

    assert.notEqual(
      tamperedLkg.epoch,
      tamperedLkg.closure.buildEpoch,
    );
  },
);

test(
  "V8-28 persisted Closure bytes can be written and re-read without identity drift",
  () => {
    const closure = buildClosure();

    const directory =
      fs.mkdtempSync(
        path.join(
          os.tmpdir(),
          "nexmold-v8-28-",
        ),
      );

    try {
      const file =
        path.join(
          directory,
          "v8-actual-dist-production-closure.json",
        );

      const bytes =
        Buffer.from(
          canonicalJson(closure),
          "utf8",
        );

      fs.writeFileSync(
        file,
        bytes,
      );

      const persisted =
        JSON.parse(
          fs.readFileSync(
            file,
            "utf8",
          ),
        );

      assert.deepEqual(
        persisted,
        closure,
      );

      const persistedFingerprint =
        sha256Bytes(
          fs.readFileSync(
            file,
          ),
        );

      const expectedFingerprint =
        sha256Bytes(
          bytes,
        );

      assert.equal(
        persistedFingerprint,
        expectedFingerprint,
      );

      assertSha256(
        persistedFingerprint,
        "Persisted Closure bytes",
      );
    } finally {
      fs.rmSync(
        directory,
        {
          recursive: true,
          force: true,
        },
      );
    }
  },
);

test(
  "V8-28 Release Manifest and LKG reject different Closure identities",
  () => {
    const closure = buildClosure();

    const releaseManifest =
      buildReleaseManifest(
        closure,
      );

    const lkg =
      buildLkg(
        closure,
        releaseManifest,
      );

    const tamperedLkg =
      structuredClone(
        lkg,
      );

    tamperedLkg.closure.fingerprint =
      "f".repeat(64);

    assert.notEqual(
      releaseManifest.closure.fingerprint,
      tamperedLkg.closure.fingerprint,
    );

    assert.equal(
      releaseManifest.closure.buildEpoch,
      tamperedLkg.closure.buildEpoch,
    );
  },
);