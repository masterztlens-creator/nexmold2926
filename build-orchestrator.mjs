#!/usr/bin/env node
/**
 * NEXMOLD V7.14 — fail-closed production build orchestrator.
 *
 * Mandatory order:
 *   PRECHECK
 *   -> CORE GATE
 *   -> REGIONAL PRODUCTION GATE
 *   -> V7.15 INTEGRATION GATE
 *   -> TYPECHECK
 *   -> CONTRACT TESTS
 *   -> ARTICLE FACTORY
 *   -> ROUTE CONFLICT GATE
 *   -> CLEAN BUILD
 *   -> ARTIFACT AUDIT
 *   -> V8 ACTUAL DIST CLOSURE
 *   -> V8-09 PRODUCTION INTEGRATION
 *   -> RUNTIME GATE
 *   -> SITEMAP GATE
 *   -> RELEASE PREFLIGHT
 *   -> CLOSURE/RELEASE IDENTITY
 *   -> RELEASE MANIFEST
 *   -> LKG ADVANCE
 *
 * No mandatory gate may silently pass by returning null/undefined.
 */

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";

const ROOT = path.resolve(
  process.env.NEXMOLD_ROOT ??
    path.dirname(fileURLToPath(import.meta.url)),
);

const DIST = path.resolve(
  ROOT,
  "dist",
);

const CONTROL = path.resolve(
  ROOT,
  ".nexmold",
);

const RELEASES = path.join(
  CONTROL,
  "releases",
);

const LKG = path.join(
  CONTROL,
  "last-known-good.json",
);

const V8_CLOSURE_PATH = path.join(
  CONTROL,
  "v8-actual-dist-production-closure.json",
);

const epoch =
  process.env.NEXMOLD_BUILD_EPOCH ??
  `${new Date()
    .toISOString()
    .replace(/[-:.]/g, "")}-${process.pid}-${randomUUID().slice(0, 8)}`;

const RELEASE_DIR = path.join(
  RELEASES,
  epoch,
);

const BUILD_LOG = path.join(
  RELEASE_DIR,
  "build.log",
);

const BUILD_COMMAND =
  process.env.NEXMOLD_BUILD_COMMAND ??
  "npx astro build";

const TYPECHECK_COMMAND =
  process.env.NEXMOLD_TYPECHECK_COMMAND ??
  "npx astro check";

const TEST_COMMAND =
  process.env.NEXMOLD_TEST_COMMAND ??
  "node --experimental-strip-types tests/contracts/v714-contracts.mjs && node --experimental-strip-types tests/contracts/v714-regression.mjs && node --experimental-strip-types tests/contracts/v715-integration.mjs";

const ARTICLE_FACTORY_COMMAND =
  process.env.NEXMOLD_V714_ARTICLE_FACTORY_COMMAND ??
  "node --experimental-strip-types scripts/v714-article-factory.mjs";

const CLEAN_DIST =
  ![
    "0",
    "false",
    "no",
    "off",
  ].includes(
    String(
      process.env.NEXMOLD_CLEAN_DIST ?? "true",
    ).toLowerCase(),
  );

const KILL_SWITCH =
  [
    "1",
    "true",
    "yes",
    "on",
  ].includes(
    String(
      process.env.NEXMOLD_KILL_SWITCH ?? "false",
    ).toLowerCase(),
  );

const GATES = Object.freeze({
  core: [
    "scripts/v714-core-gate.mjs",
    "runV714CoreGate",
  ],

  regional: [
    "scripts/v714-regional-gate.mjs",
    "runV714RegionalGate",
  ],

  v715: [
    "scripts/v715-integration-gate.mjs",
    "runV715IntegrationGate",
  ],

  runtime: [
    "scripts/runtime-gate.mjs",
    "runRuntimeGate",
  ],

  sitemap: [
    "scripts/sitemap-gate.mjs",
    "runSitemapGate",
  ],

  release: [
    "scripts/release-preflight.mjs",
    "runReleasePreflight",
  ],
});

const summary = [];

function ensureRoot(file) {
  const candidate = path.resolve(file);
  const relative = path.relative(
    ROOT,
    candidate,
  );

  if (
    relative.startsWith("..") ||
    path.isAbsolute(relative)
  ) {
    throw new Error(
      `Path escapes project root: ${file}`,
    );
  }
}

function log(message) {
  const line =
    `${new Date().toISOString()} ${message}`;

  console.log(line);

  if (
    fs.existsSync(RELEASE_DIR)
  ) {
    fs.appendFileSync(
      BUILD_LOG,
      `${line}\n`,
      "utf8",
    );
  }
}

function section(label) {
  console.log(
    `\n=======================================================`,
  );

  console.log(
    `[NEXMOLD][V7.14] ${label}`,
  );

  console.log(
    `=======================================================`,
  );
}

function pass(
  label,
  detail = "",
) {
  summary.push({
    label,
    status: "PASS",
    detail,
  });

  console.log(
    `PASS  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

function skip(
  label,
  detail = "",
) {
  summary.push({
    label,
    status: "SKIPPED",
    detail,
  });

  console.warn(
    `SKIP  ${label}${detail ? ` — ${detail}` : ""}`,
  );
}

function fail(
  label,
  detail = "",
) {
  summary.push({
    label,
    status: "FAIL",
    detail,
  });

  throw new Error(
    `[${label}] ${detail}`,
  );
}

function writeJson(
  file,
  value,
) {
  fs.mkdirSync(
    path.dirname(file),
    {
      recursive: true,
    },
  );

  const temp =
    `${file}.tmp-${process.pid}-${Date.now()}`;

  fs.writeFileSync(
    temp,
    `${JSON.stringify(
      value,
      null,
      2,
    )}\n`,
    "utf8",
  );

  fs.rmSync(
    file,
    {
      force: true,
    },
  );

  fs.renameSync(
    temp,
    file,
  );
}

function sha256File(file) {
  return createHash("sha256")
    .update(
      fs.readFileSync(file),
    )
    .digest("hex");
}

function collectFiles(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }

  const output = [];

  for (
    const entry of fs.readdirSync(
      dir,
      {
        withFileTypes: true,
      },
    )
  ) {
    const full =
      path.join(
        dir,
        entry.name,
      );

    if (
      entry.isDirectory()
    ) {
      output.push(
        ...collectFiles(full),
      );
    } else {
      output.push(full);
    }
  }

  return output.sort();
}

function routeForHtml(relativePath) {
  const value =
    relativePath
      .split(path.sep)
      .join("/");

  if (
    value === "index.html"
  ) {
    return "/";
  }

  if (
    value.endsWith(
      "/index.html",
    )
  ) {
    return `/${value.slice(
      0,
      -"/index.html".length,
    )}/`;
  }

  return `/${value.slice(
    0,
    -".html".length,
  )}`;
}

function normalizeGateResult(result) {
  if (
    result === null ||
    result === undefined
  ) {
    return {
      ok: false,
      detail:
        "Gate returned null/undefined; fail closed.",
    };
  }

  if (
    typeof result === "boolean"
  ) {
    return {
      ok: result,
      detail: String(result),
    };
  }

  if (
    typeof result !== "object"
  ) {
    return {
      ok: false,
      detail:
        `Unsupported gate result: ${typeof result}`,
    };
  }

  const object = result;

  if (
    object.ok === false ||
    object.pass === false ||
    object.passed === false ||
    object.success === false ||
    object.status === "FAIL" ||
    object.status === "FAILED"
  ) {
    return {
      ok: false,
      detail:
        object.detail ??
        object.message ??
        JSON.stringify(object),
    };
  }

  if (
    object.ok !== true &&
    object.pass !== true &&
    object.passed !== true &&
    object.success !== true &&
    object.status !== "PASS" &&
    object.status !== "PASSED" &&
    object.status !== "VERIFIED"
  ) {
    return {
      ok: false,
      detail:
        `Gate returned an unrecognized success state: ${JSON.stringify(object)}`,
    };
  }

  return {
    ok: true,
    detail:
      object.detail ??
      object.message ??
      object.status ??
      "PASS",
  };
}

async function runExportedGate(
  relativePath,
  exportName,
  label,
) {
  const modulePath =
    path.resolve(
      ROOT,
      relativePath,
    );

  ensureRoot(
    modulePath,
  );

  if (
    !fs.existsSync(modulePath)
  ) {
    fail(
      label,
      `Missing gate: ${relativePath}`,
    );
  }

  const module =
    await import(
      `${pathToFileURL(modulePath).href}?v714_epoch=${encodeURIComponent(epoch)}`
    );

  const gate =
    module[exportName];

  if (
    typeof gate !== "function"
  ) {
    fail(
      label,
      `Missing export ${exportName}`,
    );
  }

  let result;

  try {
    result = await gate({
      root: ROOT,
      projectRoot: ROOT,
      dist: DIST,
      controlDir: CONTROL,
      releasesDir: RELEASES,
      releaseDir: RELEASE_DIR,
      epoch,
      buildEpoch: epoch,
    });
  } catch (error) {
    fail(
      label,
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  const normalized =
    normalizeGateResult(
      result,
    );

  if (
    !normalized.ok
  ) {
    fail(
      label,
      normalized.detail,
    );
  }

  pass(
    label,
    normalized.detail,
  );

  return result;
}

async function runCommand(
  command,
  label,
) {
  log(
    `[${label}] $ ${command}`,
  );

  await new Promise(
    (
      resolve,
      reject,
    ) => {
      const child =
        spawn(
          command,
          {
            cwd: ROOT,
            env: {
              ...process.env,
              NEXMOLD_BUILD_EPOCH:
                epoch,
            },
            shell: true,
            windowsHide: true,
            stdio: [
              "ignore",
              "pipe",
              "pipe",
            ],
          },
        );

      child.stdout.on(
        "data",
        (chunk) => {
          const text =
            chunk.toString();

          process.stdout.write(
            text,
          );

          if (
            fs.existsSync(
              RELEASE_DIR,
            )
          ) {
            fs.appendFileSync(
              BUILD_LOG,
              text,
              "utf8",
            );
          }
        },
      );

      child.stderr.on(
        "data",
        (chunk) => {
          const text =
            chunk.toString();

          process.stderr.write(
            text,
          );

          if (
            fs.existsSync(
              RELEASE_DIR,
            )
          ) {
            fs.appendFileSync(
              BUILD_LOG,
              text,
              "utf8",
            );
          }
        },
      );

      child.on(
        "error",
        reject,
      );

      child.on(
        "close",
        (code) => {
          if (
            code === 0
          ) {
            resolve();
          } else {
            reject(
              new Error(
                `${label} exited with code ${code}`,
              ),
            );
          }
        },
      );
    },
  );
}

async function runV8ProductionGate() {
  const gate =
    path.join(
      ROOT,
      "scripts",
      "v8-production-gate.mjs",
    );

  if (
    !fs.existsSync(gate)
  ) {
    fail(
      "V8_09_PRODUCTION_INTEGRATION",
      "scripts/v8-production-gate.mjs missing",
    );
  }

  const manifestPath =
    path.join(
      RELEASE_DIR,
      "html-manifest.json",
    );

  if (
    !fs.existsSync(DIST)
  ) {
    fail(
      "V8_09_PRODUCTION_INTEGRATION",
      "dist directory missing",
    );
  }

  if (
    !fs.existsSync(
      manifestPath,
    )
  ) {
    fail(
      "V8_09_PRODUCTION_INTEGRATION",
      `HTML manifest missing: ${path.relative(
        ROOT,
        manifestPath,
      )}`,
    );
  }

  await runCommand(
    `node ${JSON.stringify(gate)}`,
    "V8_09_PRODUCTION_INTEGRATION",
  );

  pass(
    "V8_09_PRODUCTION_INTEGRATION",
    "Real dist + HTML manifest passed V8 Production Boundary.",
  );
}

function auditDist() {
  if (
    !fs.existsSync(DIST)
  ) {
    fail(
      "BUILD",
      "dist directory missing after build",
    );
  }

  const htmlFiles =
    collectFiles(DIST)
      .filter(
        (file) =>
          path
            .extname(file)
            .toLowerCase() === ".html",
      );

  if (
    !htmlFiles.length
  ) {
    fail(
      "HTML_MANIFEST",
      "No HTML artifacts produced",
    );
  }

  const entries =
    htmlFiles.map(
      (file) => {
        const relativePath =
          path
            .relative(
              DIST,
              file,
            )
            .split(path.sep)
            .join("/");

        const html =
          fs.readFileSync(
            file,
            "utf8",
          );

        if (
          !/^\s*<!doctype html>/i.test(
            html,
          )
        ) {
          console.warn(
            `WARN  HTML_DOCTYPE — ${relativePath}`,
          );
        }

        if (
          !/<html\b/i.test(html) ||
          !/<\/html>/i.test(html)
        ) {
          fail(
            "HTML_INTEGRITY",
            `Malformed HTML: ${relativePath}`,
          );
        }

        return {
          path: relativePath,
          route:
            routeForHtml(
              relativePath,
            ),
          bytes:
            Buffer.byteLength(
              html,
              "utf8",
            ),
          sha256:
            sha256File(file),
        };
      },
    );

  const routes =
    entries.map(
      (entry) =>
        entry.route,
    );

  const duplicates =
    routes.filter(
      (
        route,
        index,
      ) =>
        routes.indexOf(
          route,
        ) !== index,
    );

  if (
    duplicates.length
  ) {
    fail(
      "HTML_ROUTE_DUPLICATE",
      [
        ...new Set(
          duplicates,
        ),
      ].join(", "),
    );
  }

  const setHash =
    createHash("sha256")
      .update(
        entries
          .map(
            (entry) =>
              `${entry.route}|${entry.path}|${entry.sha256}`,
          )
          .sort()
          .join("\n"),
        "utf8",
      )
      .digest("hex");

  const manifest = {
    schema:
      "nexmold.v7.14.html-manifest.v2",
    epoch,
    count:
      entries.length,
    setSha256:
      setHash,
    entries,
  };

  writeJson(
    path.join(
      RELEASE_DIR,
      "html-manifest.json",
    ),
    manifest,
  );

  pass(
    "HTML_MANIFEST",
    `Recorded ${entries.length} HTML artifacts; setSha256=${setHash}`,
  );

  return manifest;
}

function auditForbiddenArtifacts() {
  const forbidden =
    new Set([
      ".env",
      ".env.local",
      ".env.production",
      ".npmrc",
      "id_rsa",
      "id_ed25519",
    ]);

  const hits =
    collectFiles(DIST)
      .filter(
        (file) =>
          forbidden.has(
            path
              .basename(file)
              .toLowerCase(),
          ),
      );

  if (
    hits.length
  ) {
    fail(
      "ARTIFACT_SECRETS",
      hits
        .map(
          (file) =>
            path.relative(
              DIST,
              file,
            ),
        )
        .join(", "),
    );
  }

  pass(
    "ARTIFACT_SECRETS",
    "No forbidden secret/config files in dist.",
  );
}

function auditSmokeRoutes() {
  const routes = [
    "/",
    "/404.html",
    "/sitemap.xml",
    "/services/custom-injection-molding",
    "/knowledge-hub/",
    "/industries/v714/",
  ];

  for (
    const route of routes
  ) {
    let target;

    if (
      route === "/"
    ) {
      target =
        path.join(
          DIST,
          "index.html",
        );
    } else if (
      route === "/sitemap.xml"
    ) {
      const sitemapXml =
        path.join(
          DIST,
          "sitemap.xml",
        );

      const sitemapIndex =
        path.join(
          DIST,
          "sitemap-index.xml",
        );

      if (
        fs.existsSync(
          sitemapXml,
        )
      ) {
        target =
          sitemapXml;
      } else if (
        fs.existsSync(
          sitemapIndex,
        )
      ) {
        target =
          sitemapIndex;
      } else {
        fail(
          "STATIC_SMOKE",
          `${route} -> expected ${path.relative(
            ROOT,
            sitemapXml,
          )} or ${path.relative(
            ROOT,
            sitemapIndex,
          )}`,
        );
      }
    } else {
      const clean =
        route.replace(
          /^\/+/,
          "",
        );

      target =
        route.endsWith("/")
          ? path.join(
              DIST,
              clean,
              "index.html",
            )
          : route.endsWith(".html")
            ? path.join(
                DIST,
                clean,
              )
            : path.join(
                DIST,
                clean,
                "index.html",
              );
    }

    if (
      !fs.existsSync(target)
    ) {
      fail(
        "STATIC_SMOKE",
        `${route} -> ${path.relative(
          ROOT,
          target,
        )}`,
      );
    }
  }

  pass(
    "STATIC_SMOKE",
    `Validated ${routes.length} local smoke routes.`,
  );
}

/**
 * Read and validate the persisted V8 actual-dist closure.
 *
 * This is deliberately kept at the orchestrator/release boundary.
 * The V8 release domain itself remains unchanged.
 */
function readClosureReleaseIdentity() {
  if (
    !fs.existsSync(
      V8_CLOSURE_PATH,
    )
  ) {
    throw new Error(
      `V8 actual-dist production closure missing: ${path.relative(
        ROOT,
        V8_CLOSURE_PATH,
      )}`,
    );
  }

  let closure;

  try {
    closure =
      JSON.parse(
        fs.readFileSync(
          V8_CLOSURE_PATH,
          "utf8",
        ),
      );
  } catch (error) {
    throw new Error(
      `V8 actual-dist production closure is invalid JSON: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );
  }

  if (
    !closure ||
    typeof closure !== "object" ||
    Array.isArray(closure)
  ) {
    throw new Error(
      "V8 actual-dist production closure must be a JSON object",
    );
  }

  if (
    closure.schema !==
    "nexmold.v8.actual-dist-production-closure.v1"
  ) {
    throw new Error(
      `Unexpected V8 closure schema: ${closure.schema}`,
    );
  }

  if (
    closure.buildEpoch !==
    epoch
  ) {
    throw new Error(
      `V8 closure epoch mismatch: expected ${epoch}, received ${closure.buildEpoch}`,
    );
  }

  if (
    !closure.projection ||
    typeof closure.projection !== "object"
  ) {
    throw new Error(
      "V8 closure projection identity is missing",
    );
  }

  if (
    typeof closure.projection.id !== "string" ||
    !closure.projection.id
  ) {
    throw new Error(
      "V8 closure projection.id is missing",
    );
  }

  if (
    typeof closure.projection.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(
      closure.projection.fingerprint,
    )
  ) {
    throw new Error(
      "V8 closure projection.fingerprint is invalid",
    );
  }

  if (
    !closure.release ||
    typeof closure.release !== "object"
  ) {
    throw new Error(
      "V8 closure release identity is missing",
    );
  }

  if (
    typeof closure.release.id !== "string" ||
    !closure.release.id
  ) {
    throw new Error(
      "V8 closure release.id is missing",
    );
  }

  if (
    typeof closure.release.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(
      closure.release.fingerprint,
    )
  ) {
    throw new Error(
      "V8 closure release.fingerprint is invalid",
    );
  }

  /*
   * IMPORTANT:
   *
   * The V8 actual-dist closure persists release.manifest as
   * manifest-entry objects:
   *
   *   {
   *     path,
   *     route,
   *     bytes,
   *     sha256
   *   }
   *
   * The V8 ReleaseArtifact contract, however, requires:
   *
   *   readonly string[]
   *
   * Therefore this boundary converts the persisted closure
   * manifest into the canonical release path manifest.
   *
   * The closure producer remains unchanged.
   * The V8 release domain remains unchanged.
   */
  if (
    !Array.isArray(closure.release.manifest) ||
    closure.release.manifest.length === 0
  ) {
    throw new Error(
      "V8 closure release.manifest is missing or invalid",
    );
  }

  const releaseManifest =
    closure.release.manifest
      .map((entry) => {
        if (
          !entry ||
          typeof entry !== "object" ||
          Array.isArray(entry)
        ) {
          throw new Error(
            "V8 closure release.manifest entry is invalid",
          );
        }

        if (
          typeof entry.path !== "string" ||
          !entry.path.trim()
        ) {
          throw new Error(
            "V8 closure release.manifest entry.path is missing or invalid",
          );
        }

        return entry.path.trim();
      })
      .sort();

  if (
    new Set(releaseManifest).size !==
    releaseManifest.length
  ) {
    throw new Error(
      "V8 closure release.manifest contains duplicate paths",
    );
  }

  if (
    !closure.productionExecution ||
    typeof closure.productionExecution !== "object"
  ) {
    throw new Error(
      "V8 closure production execution identity is missing",
    );
  }

  if (
    typeof closure.productionExecution.executionId !== "string" ||
    !closure.productionExecution.executionId
  ) {
    throw new Error(
      "V8 closure productionExecution.executionId is missing",
    );
  }

  if (
    typeof closure.productionExecution.executionFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(
      closure.productionExecution.executionFingerprint,
    )
  ) {
    throw new Error(
      "V8 closure productionExecution.executionFingerprint is invalid",
    );
  }

  if (
    !closure.productionConsumption ||
    typeof closure.productionConsumption !== "object"
  ) {
    throw new Error(
      "V8 closure production consumption identity is missing",
    );
  }

  if (
    typeof closure.productionConsumption.consumptionId !== "string" ||
    !closure.productionConsumption.consumptionId
  ) {
    throw new Error(
      "V8 closure productionConsumption.consumptionId is missing",
    );
  }

  if (
    typeof closure.productionConsumption.consumptionFingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(
      closure.productionConsumption.consumptionFingerprint,
    )
  ) {
    throw new Error(
      "V8 closure productionConsumption.consumptionFingerprint is invalid",
    );
  }

  if (
    closure.productionConsumption.executionId !==
    closure.productionExecution.executionId
  ) {
    throw new Error(
      "V8 closure execution/consumption identity mismatch",
    );
  }

  const closureFingerprint =
    sha256File(
      V8_CLOSURE_PATH,
    );

  if (
    !/^[a-f0-9]{64}$/.test(
      closureFingerprint,
    )
  ) {
    throw new Error(
      "Calculated closure fingerprint is invalid",
    );
  }

  return Object.freeze({
    path:
      path
        .relative(
          ROOT,
          V8_CLOSURE_PATH,
        )
        .split(path.sep)
        .join("/"),

    fingerprint:
      closureFingerprint,

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

    releaseManifest:
      Object.freeze(
        releaseManifest,
      ),

    productionExecutionId:
      closure.productionExecution.executionId,

    productionExecutionFingerprint:
      closure.productionExecution.executionFingerprint,

    productionConsumptionId:
      closure.productionConsumption.consumptionId,

    productionConsumptionFingerprint:
      closure.productionConsumption.consumptionFingerprint,
  });
}

async function main() {
  console.log(
    "=======================================================",
  );

  console.log(
    "[NEXMOLD][V7.14] PRODUCTION BUILD ORCHESTRATOR",
  );

  console.log(
    "=======================================================",
  );

  console.log(
    `Epoch: ${epoch}`,
  );

  console.log(
    `Root : ${ROOT}`,
  );

  console.log(
    `Dist : ${DIST}`,
  );

  fs.mkdirSync(
    RELEASE_DIR,
    {
      recursive: true,
    },
  );

  fs.writeFileSync(
    BUILD_LOG,
    "",
    "utf8",
  );

  for (
    const required of [
      "package.json",
      "astro.config.mjs",
      "src",
      "public",
    ]
  ) {
    if (
      !fs.existsSync(
        path.join(
          ROOT,
          required,
        ),
      )
    ) {
      fail(
        "PRECHECK",
        `Missing ${required}`,
      );
    }
  }

  if (
    KILL_SWITCH
  ) {
    fail(
      "GLOBAL_KILL_SWITCH",
      "NEXMOLD_KILL_SWITCH is enabled",
    );
  }

  pass(
    "GLOBAL_KILL_SWITCH",
    "OFF",
  );

  pass(
    "PRECHECK",
    "Required project structure present.",
  );

  section(
    "V7.14_CORE_GATE",
  );

  await runExportedGate(
    ...GATES.core,
    "V714_CORE_GATE",
  );

  section(
    "V7.14_REGIONAL_PRODUCTION_GATE",
  );

  await runExportedGate(
    ...GATES.regional,
    "V714_REGIONAL_PRODUCTION_GATE",
  );

  section(
    "V7.15_INTEGRATION_GATE",
  );

  await runExportedGate(
    ...GATES.v715,
    "V715_INTEGRATION_GATE",
  );

  section(
    "AUDIT",
  );

  await runCommand(
    TYPECHECK_COMMAND,
    "TYPECHECK",
  );

  pass(
    "TYPE_CONTRACTS",
    "astro check passed.",
  );

  await runCommand(
    TEST_COMMAND,
    "CONTRACT_TESTS",
  );

  pass(
    "CONTRACT_TESTS",
    "V7.14 contract suite passed.",
  );

  section(
    "V7.14_ARTICLE_FACTORY",
  );

  await runCommand(
    ARTICLE_FACTORY_COMMAND,
    "V714_ARTICLE_FACTORY",
  );

  pass(
    "V714_ARTICLE_FACTORY",
    "Regional -> ArticleProducer -> Renderer chain passed.",
  );

  section(
    "ROUTE_CONFLICT_GATE",
  );

  const routeGate =
    path.join(
      ROOT,
      "scripts",
      "route-conflict-check.mjs",
    );

  if (
    fs.existsSync(
      routeGate,
    )
  ) {
    await runCommand(
      "node scripts/route-conflict-check.mjs",
      "ROUTE_CONFLICT_GATE",
    );

    pass(
      "ROUTE_CONFLICT_GATE",
      "Route conflict gate passed.",
    );
  } else {
    fail(
      "ROUTE_CONFLICT_GATE",
      "scripts/route-conflict-check.mjs missing",
    );
  }

  section(
    "EPOCH",
  );

  if (
    CLEAN_DIST
  ) {
    fs.rmSync(
      DIST,
      {
        recursive: true,
        force: true,
      },
    );
  }

  fs.mkdirSync(
    DIST,
    {
      recursive: true,
    },
  );

  pass(
    "EPOCH",
    `Clean build epoch ${epoch} prepared.`,
  );

  section(
    "V8_ASTRO_PUBLICATION_ADAPTER",
  );

  await runCommand(
    "node scripts/v8-astro-publication-adapter.mjs",
    "V8_ASTRO_PUBLICATION_ADAPTER",
  );

  pass(
    "V8_ASTRO_PUBLICATION_ADAPTER",
    "Real Internet V8 publication artifact materialized for Astro.",
  );

  section(
    "BUILD",
  );

  await runCommand(
    BUILD_COMMAND,
    "BUILD",
  );

  pass(
    "BUILD",
    "Astro production build completed.",
  );

  section(
    "ARTIFACT_AUDIT",
  );

  const manifest =
    auditDist();

  auditForbiddenArtifacts();
  auditSmokeRoutes();

  section(
    "V8_ACTUAL_DIST_CLOSURE",
  );

  await runCommand(
    "node scripts/v8-actual-dist-closure-gate.mjs",
    "V8_ACTUAL_DIST_CLOSURE",
  );

  section(
    "V8_09_PRODUCTION_INTEGRATION",
  );

  await runV8ProductionGate();

  section(
    "V7.14_POST_BUILD_GATES",
  );

  await runExportedGate(
    ...GATES.runtime,
    "RUNTIME_GATE",
  );

  await runExportedGate(
    ...GATES.sitemap,
    "SITEMAP_GATE",
  );

  section(
    "RELEASE_PREFLIGHT",
  );

  await runExportedGate(
    ...GATES.release,
    "RELEASE_PREFLIGHT",
  );

  const canonicalReleaseModulePath =
    path.resolve(
      ROOT,
      ".v8-build",
      "src",
      "v8",
      "release",
      "preflight.js",
    );

  ensureRoot(
    canonicalReleaseModulePath,
  );

  if (
    !fs.existsSync(
      canonicalReleaseModulePath,
    )
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Compiled V8 release preflight module is missing: .v8-build/src/v8/release/preflight.js",
    );
  }

  const canonicalReleaseModule =
    await import(
      `${pathToFileURL(canonicalReleaseModulePath).href}?release_epoch=${encodeURIComponent(epoch)}`
    );

  const releasePreflight =
    canonicalReleaseModule.releasePreflight;

  if (
    typeof releasePreflight !== "function"
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Compiled V8 releasePreflight() export is missing.",
    );
  }

  const closureIdentity =
    readClosureReleaseIdentity();

  const canonicalRelease =
    releasePreflight({
      projection: Object.freeze({
        id:
          closureIdentity.projectionId,
        fingerprint:
          closureIdentity.projectionFingerprint,
      }),
      requiredPaths:
        closureIdentity.releaseManifest,
      generatedPaths:
        closureIdentity.releaseManifest,
    });

  if (
    !canonicalRelease ||
    typeof canonicalRelease !== "object" ||
    typeof canonicalRelease.id !== "string" ||
    !canonicalRelease.id ||
    typeof canonicalRelease.fingerprint !== "string" ||
    !/^[a-f0-9]{64}$/.test(
      canonicalRelease.fingerprint,
    )
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "V8 releasePreflight() did not return a canonical ReleaseArtifact.",
    );
  }

  if (
    canonicalRelease.id !==
    closureIdentity.releaseId
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Canonical V8 ReleaseArtifact id does not match the persisted closure release identity.",
    );
  }

  if (
    canonicalRelease.fingerprint !==
    closureIdentity.releaseFingerprint
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Canonical V8 ReleaseArtifact fingerprint does not match the persisted closure release identity.",
    );
  }

  if (
    canonicalRelease.projectionId !==
    closureIdentity.projectionId
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Canonical V8 ReleaseArtifact projectionId does not match the persisted closure projection identity.",
    );
  }

  if (
    canonicalRelease.projectionFingerprint !==
    closureIdentity.projectionFingerprint
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Canonical V8 ReleaseArtifact projectionFingerprint does not match the persisted closure projection fingerprint.",
    );
  }

  if (
    JSON.stringify([
      ...canonicalRelease.manifest,
    ]) !==
    JSON.stringify([
      ...closureIdentity.releaseManifest,
    ])
  ) {
    fail(
      "RELEASE_PREFLIGHT",
      "Canonical V8 ReleaseArtifact manifest does not match the persisted closure release manifest.",
    );
  }

  pass(
    "RELEASE_PREFLIGHT",
    `Canonical V8 ReleaseArtifact ${canonicalRelease.id} verified against persisted closure identity.`,
  );

  section(
    "CLOSURE_RELEASE_IDENTITY",
  );

  if (
    closureIdentity.buildEpoch !==
    epoch
  ) {
    fail(
      "CLOSURE_RELEASE_IDENTITY",
      "Closure buildEpoch does not match orchestrator epoch.",
    );
  }

  if (
    closureIdentity.releaseId !==
    canonicalRelease.id
  ) {
    fail(
      "CLOSURE_RELEASE_IDENTITY",
      "Closure releaseId does not match canonical V8 ReleaseArtifact.",
    );
  }

  if (
    closureIdentity.releaseFingerprint !==
    canonicalRelease.fingerprint
  ) {
    fail(
      "CLOSURE_RELEASE_IDENTITY",
      "Closure releaseFingerprint does not match canonical V8 ReleaseArtifact.",
    );
  }

  pass(
    "CLOSURE_RELEASE_IDENTITY",
    `Closure ${closureIdentity.fingerprint} bound to Release ${canonicalRelease.id}.`,
  );

  const releaseManifest = {
    schema:
      "nexmold.v7.14.release-manifest.v3",

    status:
      "VERIFIED",

    epoch,

    verifiedAt:
      new Date().toISOString(),

    htmlManifest:
      `releases/${epoch}/html-manifest.json`,

    htmlCount:
      manifest.count,

    htmlSetSha256:
      manifest.setSha256,

    closure:
      closureIdentity,

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

    gates:
      summary,
  };

  const releaseManifestPath =
    path.join(
      RELEASE_DIR,
      "manifest.json",
    );

  writeJson(
    releaseManifestPath,
    releaseManifest,
  );

  writeJson(
    LKG,
    {
      schema:
        "nexmold.v7.14.last-known-good.v3",

      epoch,

      verifiedAt:
        new Date().toISOString(),

      releaseManifest:
        `releases/${epoch}/manifest.json`,

      htmlSetSha256:
        manifest.setSha256,

      htmlCount:
        manifest.count,

      closure:
        closureIdentity,
    },
  );

  writeJson(
    path.join(
      CONTROL,
      "release-state.json",
    ),
    {
      schema:
        "nexmold.v7.14.release-state.v2",

      status:
        "VERIFIED",

      epoch,

      summary,

      lkgAdvanced:
        true,
    },
  );

  section(
    "RELEASE",
  );

  console.log(
    "[NEXMOLD][V7.15] FROZEN & VERIFIED",
  );

  console.log(
    `Release epoch : ${epoch}`,
  );

  console.log(
    `HTML artifacts: ${manifest.count}`,
  );

  console.log(
    `HTML set hash : ${manifest.setSha256}`,
  );

  console.log(
    `Closure hash  : ${closureIdentity.fingerprint}`,
  );

  console.log(
    `Release ID    : ${canonicalRelease.id}`,
  );

  console.log(
    `Release hash  : ${canonicalRelease.fingerprint}`,
  );
}

export {
  main as runBuildOrchestrator,
};

main().catch(
  (error) => {
    try {
      fs.mkdirSync(
        RELEASE_DIR,
        {
          recursive: true,
        },
      );

      writeJson(
        path.join(
          CONTROL,
          "release-state.json",
        ),
        {
          schema:
            "nexmold.v7.14.release-state.v2",

          status:
            "FAILED",

          epoch,

          error:
            error instanceof Error
              ? error.message
              : String(error),

          lkgAdvanced:
            false,
        },
      );
    } catch {}

    console.error(
      `\n[NEXMOLD][V7.14][RELEASE] FAILED: ${
        error instanceof Error
          ? error.message
          : String(error)
      }`,
    );

    process.exitCode = 1;
  },
);