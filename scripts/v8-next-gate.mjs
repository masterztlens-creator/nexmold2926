import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(process.cwd());

const DIST = path.resolve(
  process.env.NEXMOLD_DIST ?? path.join(ROOT, "dist"),
);

const CONTROL = path.resolve(
  process.env.NEXMOLD_CONTROL ?? path.join(ROOT, ".nexmold"),
);

const CLOSURE_PATH = path.resolve(
  process.env.NEXMOLD_V8_CLOSURE_OUTPUT ??
    path.join(
      CONTROL,
      "v8-actual-dist-production-closure.json",
    ),
);

const LKG_PATH = path.resolve(
  process.env.NEXMOLD_LKG ??
    path.join(
      CONTROL,
      "last-known-good.json",
    ),
);

const SHA256_PATTERN =
  /^[a-f0-9]{64}$/;

const GIT_SHA_PATTERN =
  /^[0-9a-f]{40}$/i;

const commands = [
  [
    "V8 FINAL",
    "scripts/v8-final-gate.mjs",
  ],
  [
    "V8 OPERATIONAL",
    "scripts/v8-operational-gate.mjs",
  ],
  [
    "V8 INTEGRITY",
    "scripts/v8-integrity-gate.mjs",
  ],
  [
    "V8 REPRODUCIBILITY",
    "scripts/v8-reproducibility-gate.mjs",
  ],
];

function fail(
  code,
  message,
) {
  throw new Error(
    `[${code}] ${message}`,
  );
}

function requireCondition(
  condition,
  code,
  message,
) {
  if (!condition) {
    fail(
      code,
      message,
    );
  }
}

function requireString(
  value,
  code,
  message,
) {
  requireCondition(
    typeof value === "string" &&
      value.trim().length > 0,
    code,
    message,
  );

  return value;
}

function requireSha256(
  value,
  code,
  message,
) {
  requireCondition(
    typeof value === "string" &&
      SHA256_PATTERN.test(value),
    code,
    message,
  );

  return value;
}

function readJson(
  file,
  code,
) {
  requireCondition(
    fs.existsSync(file),
    code,
    `Required JSON file does not exist: ${path.relative(
      ROOT,
      file,
    )}`,
  );

  try {
    return JSON.parse(
      fs.readFileSync(
        file,
        "utf8",
      ),
    );
  } catch (error) {
    fail(
      code,
      `Invalid JSON in ${path.relative(
        ROOT,
        file,
      )}: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }
}

function sha256File(
  file,
) {
  return createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

function currentGitSha() {
  return execFileSync(
    "git",
    [
      "rev-parse",
      "HEAD",
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  ).trim();
}

function assertManifestEntry(
  entry,
  index,
) {
  requireCondition(
    entry !== null &&
      typeof entry === "object",
    "V8_NEXT_CLOSURE_MANIFEST_ENTRY",
    `Release manifest entry ${index} is not an object.`,
  );

  requireString(
    entry.path,
    "V8_NEXT_CLOSURE_MANIFEST_PATH",
    `Release manifest entry ${index} path is missing.`,
  );

  requireSha256(
    entry.sha256,
    "V8_NEXT_CLOSURE_MANIFEST_SHA256",
    `Release manifest entry ${index} SHA-256 is invalid.`,
  );

  requireCondition(
    entry.path.endsWith(
      ".html",
    ),
    "V8_NEXT_CLOSURE_MANIFEST_HTML",
    `Release manifest entry ${index} is not HTML: ${entry.path}`,
  );
}

function validateActualDistClosure() {
  console.log(
    "\n[NEXMOLD][V8][NEXT] ACTUAL DIST PRODUCTION CLOSURE",
  );

  const closure =
    readJson(
      CLOSURE_PATH,
      "V8_NEXT_CLOSURE_MISSING",
    );

  requireCondition(
    closure.schema ===
      "nexmold.v8.actual-dist-production-closure.v1",
    "V8_NEXT_CLOSURE_SCHEMA",
    `Unexpected closure schema: ${closure.schema}`,
  );

  const expectedSourceSha =
    (
      process.env.NEXMOLD_SOURCE_SHA ??
      currentGitSha()
    )
      .trim()
      .toLowerCase();

  requireCondition(
    GIT_SHA_PATTERN.test(
      expectedSourceSha,
    ),
    "V8_NEXT_SOURCE_SHA",
    `Invalid expected source SHA: ${expectedSourceSha}`,
  );

  requireCondition(
    typeof closure.sourceSha ===
      "string" &&
      closure.sourceSha.toLowerCase() ===
        expectedSourceSha,
    "V8_NEXT_CLOSURE_SOURCE_SHA",
    `Closure source SHA mismatch: expected ${expectedSourceSha}, received ${closure.sourceSha}`,
  );

  requireString(
    closure.buildEpoch,
    "V8_NEXT_CLOSURE_BUILD_EPOCH",
    "Closure buildEpoch is missing.",
  );

  requireCondition(
    fs.existsSync(DIST),
    "V8_NEXT_DIST_MISSING",
    `Actual dist directory does not exist: ${DIST}`,
  );

  requireCondition(
    fs.existsSync(LKG_PATH),
    "V8_NEXT_LKG_MISSING",
    `Last-known-good file does not exist: ${path.relative(
      ROOT,
      LKG_PATH,
    )}`,
  );

  readJson(
    LKG_PATH,
    "V8_NEXT_LKG_INVALID",
  );

  const handoff =
    closure.handoff;

  requireCondition(
    handoff?.schema ===
      "nexmold.v8.real-publication-handoff.v1",
    "V8_NEXT_CLOSURE_HANDOFF_SCHEMA",
    `Unexpected closure handoff schema: ${handoff?.schema}`,
  );

  requireSha256(
    handoff?.fingerprint,
    "V8_NEXT_CLOSURE_HANDOFF_FINGERPRINT",
    "Closure handoff fingerprint is invalid.",
  );

  requireString(
    closure.content?.id,
    "V8_NEXT_CLOSURE_CONTENT_ID",
    "Closure content identity is missing.",
  );

  requireString(
    closure.decision?.id,
    "V8_NEXT_CLOSURE_DECISION_ID",
    "Closure decision identity is missing.",
  );

  requireString(
    closure.projection?.id,
    "V8_NEXT_CLOSURE_PROJECTION_ID",
    "Closure projection identity is missing.",
  );

  requireSha256(
    closure.projection?.fingerprint,
    "V8_NEXT_CLOSURE_PROJECTION_FINGERPRINT",
    "Closure projection fingerprint is invalid.",
  );

  const release =
    closure.release;

  requireString(
    release?.id,
    "V8_NEXT_CLOSURE_RELEASE_ID",
    "Closure release identity is missing.",
  );

  requireSha256(
    release?.projectionFingerprint,
    "V8_NEXT_CLOSURE_RELEASE_PROJECTION_FINGERPRINT",
    "Closure release projection fingerprint is invalid.",
  );

  requireSha256(
    release?.fingerprint,
    "V8_NEXT_CLOSURE_RELEASE_FINGERPRINT",
    "Closure release fingerprint is invalid.",
  );

  requireCondition(
    release.projectionId ===
      closure.projection.id,
    "V8_NEXT_CLOSURE_RELEASE_PROJECTION_ID",
    "Closure release projectionId does not match closure projectionId.",
  );

  requireCondition(
    release.projectionFingerprint ===
      closure.projection.fingerprint,
    "V8_NEXT_CLOSURE_RELEASE_PROJECTION_FINGERPRINT_MISMATCH",
    "Closure release projectionFingerprint does not match closure projection fingerprint.",
  );

  const manifest =
    release.manifest;

  requireCondition(
    Array.isArray(manifest) &&
      manifest.length > 0,
    "V8_NEXT_CLOSURE_RELEASE_MANIFEST",
    "Closure release manifest is empty or missing.",
  );

  const seen =
    new Set();

  for (
    let index = 0;
    index < manifest.length;
    index += 1
  ) {
    const entry =
      manifest[index];

    assertManifestEntry(
      entry,
      index,
    );

    requireCondition(
      !path.isAbsolute(
        entry.path,
      ),
      "V8_NEXT_CLOSURE_MANIFEST_ABSOLUTE",
      `Release manifest contains an absolute path: ${entry.path}`,
    );

    requireCondition(
      !entry.path
        .split(
          /[\\/]/u,
        )
        .includes(".."),
      "V8_NEXT_CLOSURE_MANIFEST_TRAVERSAL",
      `Release manifest contains path traversal: ${entry.path}`,
    );

    requireCondition(
      !seen.has(
        entry.path,
      ),
      "V8_NEXT_CLOSURE_MANIFEST_DUPLICATE",
      `Release manifest contains duplicate path: ${entry.path}`,
    );

    seen.add(
      entry.path,
    );

    const actualPath =
      path.resolve(
        DIST,
        entry.path,
      );

    const relative =
      path.relative(
        DIST,
        actualPath,
      );

    requireCondition(
      relative ===
        entry.path ||
        relative.replaceAll(
          "\\",
          "/",
        ) ===
          entry.path,
      "V8_NEXT_CLOSURE_MANIFEST_OUTSIDE_DIST",
      `Release manifest path escapes dist: ${entry.path}`,
    );

    requireCondition(
      fs.existsSync(
        actualPath,
      ) &&
        fs.statSync(
          actualPath,
        ).isFile(),
      "V8_NEXT_CLOSURE_HTML_MISSING",
      `Actual dist file is missing: ${entry.path}`,
    );

    const actualSha =
      sha256File(
        actualPath,
      );

    requireCondition(
      actualSha ===
        entry.sha256,
      "V8_NEXT_CLOSURE_HTML_SHA256",
      `Actual dist SHA-256 mismatch for ${entry.path}: expected ${entry.sha256}, received ${actualSha}`,
    );
  }

  const execution =
    closure.productionExecution;

  requireCondition(
    execution?.schema ===
      "nexmold.v8.production-execution.v1",
    "V8_NEXT_CLOSURE_EXECUTION_SCHEMA",
    `Unexpected production execution schema: ${execution?.schema}`,
  );

  requireCondition(
    execution.status ===
      "EXECUTED",
    "V8_NEXT_CLOSURE_EXECUTION_STATUS",
    `Production execution status is ${execution.status}.`,
  );

  requireString(
    execution.executionId,
    "V8_NEXT_CLOSURE_EXECUTION_ID",
    "Production execution identity is missing.",
  );

  requireSha256(
    execution.executionFingerprint,
    "V8_NEXT_CLOSURE_EXECUTION_FINGERPRINT",
    "Production execution fingerprint is invalid.",
  );

  requireCondition(
    execution.releaseId ===
      release.id,
    "V8_NEXT_CLOSURE_EXECUTION_RELEASE",
    "Production execution release identity mismatch.",
  );

  requireCondition(
    execution.projectionId ===
      closure.projection.id,
    "V8_NEXT_CLOSURE_EXECUTION_PROJECTION",
    "Production execution projection identity mismatch.",
  );

  requireCondition(
    execution.releaseFingerprint ===
      release.fingerprint,
    "V8_NEXT_CLOSURE_EXECUTION_RELEASE_FINGERPRINT",
    "Production execution release fingerprint mismatch.",
  );

  requireCondition(
    execution.projectionFingerprint ===
      closure.projection.fingerprint,
    "V8_NEXT_CLOSURE_EXECUTION_PROJECTION_FINGERPRINT",
    "Production execution projection fingerprint mismatch.",
  );

  const consumption =
    closure.productionConsumption;

  requireCondition(
    consumption?.schema ===
      "nexmold.v8.production-consumption.v1",
    "V8_NEXT_CLOSURE_CONSUMPTION_SCHEMA",
    `Unexpected production consumption schema: ${consumption?.schema}`,
  );

  requireString(
    consumption.consumptionId,
    "V8_NEXT_CLOSURE_CONSUMPTION_ID",
    "Production consumption identity is missing.",
  );

  requireSha256(
    consumption.consumptionFingerprint,
    "V8_NEXT_CLOSURE_CONSUMPTION_FINGERPRINT",
    "Production consumption fingerprint is invalid.",
  );

  requireCondition(
    consumption.executionId ===
      execution.executionId,
    "V8_NEXT_CLOSURE_CONSUMPTION_EXECUTION",
    "Production consumption execution identity mismatch.",
  );

  requireCondition(
    consumption.releaseId ===
      release.id,
    "V8_NEXT_CLOSURE_CONSUMPTION_RELEASE",
    "Production consumption release identity mismatch.",
  );

  requireCondition(
    consumption.projectionId ===
      closure.projection.id,
    "V8_NEXT_CLOSURE_CONSUMPTION_PROJECTION",
    "Production consumption projection identity mismatch.",
  );

  requireCondition(
    consumption.releaseFingerprint ===
      release.fingerprint,
    "V8_NEXT_CLOSURE_CONSUMPTION_RELEASE_FINGERPRINT",
    "Production consumption release fingerprint mismatch.",
  );

  requireCondition(
    consumption.projectionFingerprint ===
      closure.projection.fingerprint,
    "V8_NEXT_CLOSURE_CONSUMPTION_PROJECTION_FINGERPRINT",
    "Production consumption projection fingerprint mismatch.",
  );

  console.log(
    "[V8-ACTUAL-DIST] Closure schema: PASS",
  );

  console.log(
    `[V8-ACTUAL-DIST] sourceSha: ${closure.sourceSha}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] buildEpoch: ${closure.buildEpoch}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] handoff: ${handoff.fingerprint}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] content: ${closure.content.id}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] decision: ${closure.decision.id}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] projection: ${closure.projection.id}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] release: ${release.id}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] releaseFingerprint: ${release.fingerprint}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] productionExecution: ${execution.executionId}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] productionConsumption: ${consumption.consumptionId}`,
  );

  console.log(
    `[V8-ACTUAL-DIST] verified actual HTML files: ${manifest.length}`,
  );

  return {
    closure,
    release,
    manifest,
  };
}

for (
  const [
    name,
    script,
  ] of commands
) {
  console.log(
    `\n[NEXMOLD][V8][NEXT] ${name}`,
  );

  const result =
    spawnSync(
      process.execPath,
      [
        script,
      ],
      {
        cwd: ROOT,
        stdio: "inherit",
      },
    );

  if (
    result.status !==
    0
  ) {
    console.error(
      `[NEXMOLD][V8][NEXT] FAIL: ${name}`,
    );

    process.exit(
      result.status ?? 1,
    );
  }
}

const artifact =
  spawnSync(
    process.execPath,
    [
      "scripts/v8-artifact-gate.mjs",
    ],
    {
      cwd: ROOT,
      stdio: "inherit",
    },
  );

if (
  artifact.status !==
  0
) {
  console.error(
    "[NEXMOLD][V8][NEXT] FAIL: V8 ARTIFACT",
  );

  process.exit(
    artifact.status ?? 1,
  );
}

try {
  validateActualDistClosure();
} catch (error) {
  console.error(
    "\n[NEXMOLD][V8][NEXT] FAIL: ACTUAL DIST PRODUCTION CLOSURE",
  );

  console.error(
    error instanceof Error
      ? error.stack ??
        error.message
      : String(error),
  );

  process.exit(
    1,
  );
}

console.log(
  "\n==============================================",
);

console.log(
  "NEXMOLD V8 NEXT GATE PASS",
);

console.log(
  "FINAL -> OPERATIONAL -> INTEGRITY -> REPRO -> ARTIFACT -> ACTUAL DIST CLOSURE",
);

console.log(
  "==============================================",
);