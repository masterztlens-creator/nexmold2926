/**
 * NEXMOLD V7.14
 * Route Conflict Gate
 *
 * File:
 *   scripts/route-conflict-check.mjs
 *
 * Purpose:
 *   Detect Astro route conflicts before production publication.
 *
 * Design principles:
 *   1. Read-only
 *   2. No page/CSS modification
 *   3. No dependency on Astro internals
 *   4. Deterministic output
 *   5. Non-zero exit code on hard conflict
 *   6. Safe for Windows / PowerShell
 *
 * Supported route forms:
 *   src/pages/index.astro
 *   src/pages/about.astro
 *   src/pages/about/index.astro
 *   src/pages/[slug].astro
 *   src/pages/[...slug].astro
 *   src/pages/[lang]/index.astro
 *   src/pages/[lang]/[slug].astro
 *
 * Exit codes:
 *   0 = PASS
 *   1 = ROUTE CONFLICT
 *   2 = SCRIPT ERROR
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * ------------------------------------------------------------
 * Configuration
 * ------------------------------------------------------------
 *
 * IMPORTANT:
 * This script lives at:
 *
 *   E:\nexmold\scripts
 *
 * Therefore:
 *
 *   __dirname        = E:\nexmold\scripts
 *   ../..            = E:\nexmold
 *   src/pages        = E:\nexmold\src\pages
 */

const PROJECT_ROOT = path.resolve(__dirname, "..");

const DEFAULT_PAGES_DIR = path.join(
  PROJECT_ROOT,
  "src",
  "pages"
);

const PAGES_DIR = process.env.NEXMOLD_PAGES_DIR
  ? path.resolve(PROJECT_ROOT, process.env.NEXMOLD_PAGES_DIR)
  : DEFAULT_PAGES_DIR;

const EXTENSIONS = new Set([
  ".astro",
  ".md",
  ".mdx",
]);

const IGNORED_FILE_NAMES = new Set([
  "404.astro",
  "500.astro",
]);

const IGNORED_DIRECTORIES = new Set([
  "node_modules",
  ".git",
  "dist",
  ".astro",
]);

/**
 * ------------------------------------------------------------
 * Output helpers
 * ------------------------------------------------------------
 */

function log(message = "") {
  console.log(message);
}

function warn(message = "") {
  console.warn(message);
}

function error(message = "") {
  console.error(message);
}

function separator() {
  log("------------------------------------------------------------");
}

/**
 * ------------------------------------------------------------
 * File system
 * ------------------------------------------------------------
 */

function assertPagesDirectory() {
  if (!fs.existsSync(PAGES_DIR)) {
    throw new Error(
      `Pages directory does not exist:\n${PAGES_DIR}`
    );
  }

  const stat = fs.statSync(PAGES_DIR);

  if (!stat.isDirectory()) {
    throw new Error(
      `Pages path is not a directory:\n${PAGES_DIR}`
    );
  }
}

function walkDirectory(directory) {
  const results = [];

  const entries = fs.readdirSync(directory, {
    withFileTypes: true,
  });

  entries.sort((a, b) =>
    a.name.localeCompare(
      b.name,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    )
  );

  for (const entry of entries) {
    const fullPath = path.join(
      directory,
      entry.name
    );

    if (entry.isDirectory()) {
      if (IGNORED_DIRECTORIES.has(entry.name)) {
        continue;
      }

      results.push(
        ...walkDirectory(fullPath)
      );

      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    if (
      IGNORED_FILE_NAMES.has(entry.name)
    ) {
      continue;
    }

    if (
      entry.name.startsWith("_")
    ) {
      continue;
    }

    const extension = path.extname(
      entry.name
    ).toLowerCase();

    if (!EXTENSIONS.has(extension)) {
      continue;
    }

    results.push(fullPath);
  }

  return results;
}

/**
 * ------------------------------------------------------------
 * Path helpers
 * ------------------------------------------------------------
 */

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function relativeToPages(filePath) {
  return toPosix(
    path.relative(
      PAGES_DIR,
      filePath
    )
  );
}

function stripExtension(fileName) {
  return fileName.replace(
    /\.(astro|md|mdx)$/i,
    ""
  );
}

function isDynamicSegment(segment) {
  return (
    segment.startsWith("[") &&
    segment.endsWith("]")
  );
}

function isRestSegment(segment) {
  return (
    segment.startsWith("[...") &&
    segment.endsWith("]")
  );
}

function isOptionalRestSegment(segment) {
  return (
    segment.startsWith("[[...") &&
    segment.endsWith("]]")
  );
}

/**
 * ------------------------------------------------------------
 * Astro route conversion
 * ------------------------------------------------------------
 */

function fileToRoute(filePath) {
  let relative = relativeToPages(
    filePath
  );

  relative = relative.replace(
    /^\/+/,
    ""
  );

  const rawParts = relative
    .split("/")
    .filter(Boolean);

  if (rawParts.length === 0) {
    return {
      route: "/",
      dynamic: false,
      dynamicKind: null,
    };
  }

  const last =
    rawParts[rawParts.length - 1];

  const lastWithoutExtension =
    stripExtension(last);

  rawParts[
    rawParts.length - 1
  ] = lastWithoutExtension;

  let parts = rawParts;

  /**
   * index.astro represents the
   * parent route.
   *
   * Example:
   *
   *   about/index.astro
   *   -> /about
   */
  if (
    parts[parts.length - 1] ===
    "index"
  ) {
    parts = parts.slice(
      0,
      -1
    );
  }

  if (parts.length === 0) {
    return {
      route: "/",
      dynamic: false,
      dynamicKind: null,
    };
  }

  const routeParts = [];
  let dynamic = false;
  let dynamicKind = null;

  for (const segment of parts) {
    if (
      isOptionalRestSegment(segment)
    ) {
      dynamic = true;
      dynamicKind = "rest-optional";

      routeParts.push(
        segment
      );

      continue;
    }

    if (
      isRestSegment(segment)
    ) {
      dynamic = true;
      dynamicKind = "rest";

      routeParts.push(
        segment
      );

      continue;
    }

    if (
      isDynamicSegment(segment)
    ) {
      dynamic = true;

      if (
        dynamicKind === null
      ) {
        dynamicKind = "dynamic";
      }

      routeParts.push(
        segment
      );

      continue;
    }

    routeParts.push(segment);
  }

  return {
    route:
      "/" +
      routeParts.join("/"),

    dynamic,

    dynamicKind,
  };
}

/**
 * ------------------------------------------------------------
 * Route classification
 * ------------------------------------------------------------
 */

function normalizeRoute(
  route
) {
  if (
    route === ""
  ) {
    return "/";
  }

  if (
    route.length > 1 &&
    route.endsWith("/")
  ) {
    return route.slice(
      0,
      -1
    );
  }

  return route;
}

function routeSegments(route) {
  return normalizeRoute(route)
    .split("/")
    .filter(Boolean);
}

/**
 * ------------------------------------------------------------
 * Static route expansion
 * ------------------------------------------------------------
 *
 * Dynamic routes are compared against
 * concrete static routes.
 *
 * Example:
 *
 *   /about
 *   /[lang]
 *
 * means /[lang] can potentially match
 * /about.
 */

function dynamicMatchesStatic(
  dynamicRoute,
  staticRoute
) {
  const dynamicParts =
    routeSegments(
      dynamicRoute
    );

  const staticParts =
    routeSegments(
      staticRoute
    );

  if (
    dynamicParts.length !==
    staticParts.length
  ) {
    return false;
  }

  for (
    let i = 0;
    i < dynamicParts.length;
    i++
  ) {
    const dynamicPart =
      dynamicParts[i];

    const staticPart =
      staticParts[i];

    if (
      isRestSegment(
        dynamicPart
      ) ||
      isOptionalRestSegment(
        dynamicPart
      )
    ) {
      return true;
    }

    if (
      isDynamicSegment(
        dynamicPart
      )
    ) {
      continue;
    }

    if (
      dynamicPart !==
      staticPart
    ) {
      return false;
    }
  }

  return true;
}

/**
 * ------------------------------------------------------------
 * Dynamic route conflict detection
 * ------------------------------------------------------------
 */

function dynamicRoutesConflict(
  first,
  second
) {
  const a =
    routeSegments(
      first.route
    );

  const b =
    routeSegments(
      second.route
    );

  if (
    a.length !== b.length
  ) {
    return false;
  }

  let compatible = true;

  for (
    let i = 0;
    i < a.length;
    i++
  ) {
    const left = a[i];
    const right = b[i];

    const leftDynamic =
      isDynamicSegment(left);

    const rightDynamic =
      isDynamicSegment(right);

    const leftRest =
      isRestSegment(left) ||
      isOptionalRestSegment(left);

    const rightRest =
      isRestSegment(right) ||
      isOptionalRestSegment(right);

    if (
      leftRest ||
      rightRest
    ) {
      continue;
    }

    if (
      leftDynamic ||
      rightDynamic
    ) {
      continue;
    }

    if (
      left !== right
    ) {
      compatible = false;
      break;
    }
  }

  return compatible;
}

/**
 ------------------------------------------------------------
 * Route owner representation
 * ------------------------------------------------------------
 */

function createRouteOwner(
  filePath
) {
  const routeInfo =
    fileToRoute(filePath);

  return {
    route:
      routeInfo.route,

    rel:
      relativeToPages(
        filePath
      ),

    dynamic:
      routeInfo.dynamic,

    dynamicKind:
      routeInfo.dynamicKind,
  };
}

/**
 * ------------------------------------------------------------
 * Sorting
 * ------------------------------------------------------------
 */

function compareRouteOwners(
  a,
  b
) {
  if (
    a.route !== b.route
  ) {
    return a.route.localeCompare(
      b.route,
      undefined,
      {
        numeric: true,
        sensitivity: "base",
      }
    );
  }

  if (
    a.dynamic !== b.dynamic
  ) {
    return a.dynamic
      ? 1
      : -1;
  }

  return a.rel.localeCompare(
    b.rel,
    undefined,
    {
      numeric: true,
      sensitivity: "base",
    }
  );
}

/**
 * ------------------------------------------------------------
 * Main analysis
 * ------------------------------------------------------------
 */

function analyzeRoutes(
  owners
) {
  const conflicts = [];
  const shadowedRoutes = [];
  const warnings = [];

  /**
   * Exact route duplicates.
   */
  const routeMap =
    new Map();

  for (const owner of owners) {
    const route =
      normalizeRoute(
        owner.route
      );

    if (
      !routeMap.has(route)
    ) {
      routeMap.set(
        route,
        []
      );
    }

    routeMap
      .get(route)
      .push(owner);
  }

  for (
    const [
      route,
      routeOwners,
    ] of routeMap
  ) {
    if (
      routeOwners.length > 1
    ) {
      conflicts.push({
        type:
          "DUPLICATE_ROUTE",

        route,

        owners:
          routeOwners.map(
            (item) => item.rel
          ),
      });
    }
  }

  /**
   * Static routes versus dynamic routes.
   */
  const staticOwners =
    owners.filter(
      (owner) =>
        !owner.dynamic
    );

  const dynamicOwners =
    owners.filter(
      (owner) =>
        owner.dynamic
    );

  for (
    const staticOwner of staticOwners
  ) {
    for (
      const dynamicOwner of dynamicOwners
    ) {
      if (
        staticOwner.route ===
        "/"
      ) {
        continue;
      }

      if (
        dynamicMatchesStatic(
          dynamicOwner.route,
          staticOwner.route
        )
      ) {
        const warning = {
          type:
            "STATIC_SHADOWS_DYNAMIC",

          staticRoute:
            staticOwner.route,

          staticOwner:
            staticOwner.rel,

          dynamicRoute:
            dynamicOwner.route,

          dynamicOwner:
            dynamicOwner.rel,
        };

        shadowedRoutes.push(
          warning
        );

        warnings.push(
          warning
        );
      }
    }
  }

  /**
   * Dynamic versus dynamic.
   */
  for (
    let i = 0;
    i < dynamicOwners.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < dynamicOwners.length;
      j++
    ) {
      const first =
        dynamicOwners[i];

      const second =
        dynamicOwners[j];

      if (
        first.route ===
        second.route
      ) {
        continue;
      }

      if (
        dynamicRoutesConflict(
          first,
          second
        )
      ) {
        conflicts.push({
          type:
            "DYNAMIC_ROUTE_CONFLICT",

          routeA:
            first.route,

          ownerA:
            first.rel,

          routeB:
            second.route,

          ownerB:
            second.rel,
        });
      }
    }
  }

  return {
    conflicts,
    shadowedRoutes,
    warnings,
  };
}

/**
 * ------------------------------------------------------------
 * Output
 * ------------------------------------------------------------
 */

function printWarnings(
  warnings
) {
  for (const item of warnings) {
    if (
      item.type ===
      "STATIC_SHADOWS_DYNAMIC"
    ) {
      warn(
        `[V7.14 Route Gate][WARN] ` +
        `STATIC_SHADOWS_DYNAMIC:` +
        `${item.staticRoute}:` +
        `${item.dynamicRoute}`
      );
    }
  }
}

function createReport({
  files,
  owners,
  conflicts,
  shadowedRoutes,
  warnings,
}) {
  const staticRoutes =
    owners.filter(
      (owner) =>
        !owner.dynamic
    );

  const dynamicRoutes =
    owners.filter(
      (owner) =>
        owner.dynamic
    );

  return {
    gate:
      "route-conflict",

    policy:
      "V7.14.1",

    passed:
      conflicts.length === 0,

    filesScanned:
      files.length,

    staticRoutes:
      staticRoutes.length,

    dynamicRoutes:
      dynamicRoutes.length,

    conflicts:
      conflicts.length,

    shadowedRoutes:
      shadowedRoutes.length,

    warnings:
      warnings.length,

    hardConflicts:
      conflicts.length,

    routeOwners:
      [...owners].sort(
        compareRouteOwners
      ),
  };
}

/**
 * ------------------------------------------------------------
 * Public API
 * ------------------------------------------------------------
 *
 * V7.14 adversarial harness / orchestrator entrypoint.
 *
 * Returns the complete route report and fails closed when
 * hard route conflicts exist.
 */
export function runRouteConflictCheck(root = process.cwd()) {
  const pagesDirectory = path.join(root, "src", "pages");

  if (!fs.existsSync(pagesDirectory)) {
    throw new Error(
      `[V7.14 Route Gate] pages directory not found: ${pagesDirectory}`
    );
  }

  const files =
    walkDirectory(
      pagesDirectory
    );

  const owners =
    files
      .map(
        createRouteOwner
      )
      .sort(
        compareRouteOwners
      );

  const analysis =
    analyzeRoutes(
      owners
    );

  const report =
    createReport({
      files,
      owners,
      conflicts:
        analysis.conflicts,
      shadowedRoutes:
        analysis.shadowedRoutes,
      warnings:
        analysis.warnings,
    });

  if (
    analysis.conflicts.length >
    0
  ) {
    throw new Error(
      `[V7.14 Route Gate] ROUTE_CONFLICTS:${analysis.conflicts.length}`
    );
  }

  return report;
}

/**
 * ------------------------------------------------------------
 * Main
 * ------------------------------------------------------------
 */

function main() {
  assertPagesDirectory();

  const files =
    walkDirectory(
      PAGES_DIR
    );

  const owners =
    files
      .map(
        createRouteOwner
      )
      .sort(
        compareRouteOwners
      );

  const analysis =
    analyzeRoutes(
      owners
    );

  printWarnings(
    analysis.warnings
  );

  const report =
    createReport({
      files,
      owners,
      conflicts:
        analysis.conflicts,
      shadowedRoutes:
        analysis.shadowedRoutes,
      warnings:
        analysis.warnings,
    });

  separator();

  log(
    JSON.stringify(
      report,
      null,
      2
    )
  );

  if (
    analysis.conflicts.length >
    0
  ) {
    return 1;
  }

  return 0;
}

/**
 * ------------------------------------------------------------
 * Entrypoint
 * ------------------------------------------------------------
 */

try {
  const exitCode =
    main();

  process.exitCode =
    exitCode;
} catch (err) {
  separator();

  error(
    "ROUTE CONFLICT GATE: ERROR"
  );

  separator();

  error(
    err instanceof Error
      ? err.message
      : String(err)
  );

  process.exitCode = 2;
}

