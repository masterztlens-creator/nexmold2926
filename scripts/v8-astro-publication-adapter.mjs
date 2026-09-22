#!/usr/bin/env node

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(
  process.env.NEXMOLD_ROOT ?? process.cwd(),
);

const HANDOFF_PATH = path.join(
  ROOT,
  ".nexmold",
  "v8-real-publication-handoff.json",
);

const GENERATED_ROOT = path.join(
  ROOT,
  "src",
  "pages",
);

const GENERATED_MARKER =
  "NEXMOLD_V8_PUBLICATION_ARTIFACT";

const GENERATED_ROUTES = new Set([
  "/knowledge/plastic-injection-molding-wall-thickness/",
  "/de/wissen/plastic-injection-molding-wall-thickness/",
  "/fr/knowledge/plastic-injection-molding-wall-thickness/",
]);

function fail(code, message) {
  throw new Error(`[${code}] ${message}`);
}

function sha256Text(value) {
  return createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function canonicalJson(value) {
  return JSON.stringify(value);
}

function readHandoff() {
  if (!fs.existsSync(HANDOFF_PATH)) {
    fail(
      "V8_ASTRO_PUBLICATION_HANDOFF_MISSING",
      path.relative(ROOT, HANDOFF_PATH),
    );
  }

  let handoff;

  try {
    handoff = JSON.parse(
      fs.readFileSync(HANDOFF_PATH, "utf8"),
    );
  } catch (error) {
    fail(
      "V8_ASTRO_PUBLICATION_HANDOFF_INVALID_JSON",
      error instanceof Error
        ? error.message
        : String(error),
    );
  }

  return handoff;
}

function assertNonEmptyString(
  value,
  name,
) {
  assert.equal(
    typeof value,
    "string",
    `${name} must be a string`,
  );

  assert.ok(
    value.trim().length > 0,
    `${name} must not be empty`,
  );
}

function validateRoute(route) {
  assertNonEmptyString(
    route,
    "canonicalRoute",
  );

  assert.ok(
    route.startsWith("/"),
    `Route must start with '/': ${route}`,
  );

  assert.ok(
    route.endsWith("/"),
    `Route must end with '/': ${route}`,
  );

  assert.ok(
    !route.includes(".."),
    `Route traversal forbidden: ${route}`,
  );

  assert.ok(
    !route.includes("\\"),
    `Backslash forbidden in route: ${route}`,
  );
}

function validatePage(
  page,
  index,
  handoff,
) {
  assert.ok(
    page &&
      typeof page === "object",
    `pages[${index}] must be an object`,
  );

  assertNonEmptyString(
    page.locale,
    `pages[${index}].locale`,
  );

  assertNonEmptyString(
    page.region,
    `pages[${index}].region`,
  );

  validateRoute(
    page.canonicalRoute,
  );

  assert.ok(
    GENERATED_ROUTES.has(
      page.canonicalRoute,
    ),
    `Unexpected V8 publication route: ${page.canonicalRoute}`,
  );

  assertNonEmptyString(
    page.title,
    `pages[${index}].title`,
  );

  assertNonEmptyString(
    page.body,
    `pages[${index}].body`,
  );

  assertNonEmptyString(
    page.contentId,
    `pages[${index}].contentId`,
  );

  assertNonEmptyString(
    page.decisionId,
    `pages[${index}].decisionId`,
  );

  assertNonEmptyString(
    page.projectionId,
    `pages[${index}].projectionId`,
  );

  assertNonEmptyString(
    page.regionalProjectionId,
    `pages[${index}].regionalProjectionId`,
  );

  for (
    const [
      name,
      value,
    ] of [
      [
        "projectionFingerprint",
        page.projectionFingerprint,
      ],
      [
        "regionalProjectionFingerprint",
        page.regionalProjectionFingerprint,
      ],
      [
        "routeMetadataFingerprint",
        page.routeMetadataFingerprint,
      ],
    ]
  ) {
    assert.ok(
      /^[a-f0-9]{64}$/.test(
        String(value),
      ),
      `Invalid ${name}: ${page.canonicalRoute}`,
    );
  }

  assert.ok(
    Array.isArray(
      page.alternates,
    ),
    `alternates must be an array: ${page.canonicalRoute}`,
  );

  assert.equal(
    page.contentId,
    handoff.contentId,
    `Content identity mismatch: ${page.canonicalRoute}`,
  );

  assert.equal(
    page.decisionId,
    handoff.decisionId,
    `Decision identity mismatch: ${page.canonicalRoute}`,
  );

  assert.equal(
    page.projectionId,
    handoff.projectionId,
    `Projection identity mismatch: ${page.canonicalRoute}`,
  );

  assert.equal(
    page.projectionFingerprint,
    handoff.projectionFingerprint,
    `Projection fingerprint mismatch: ${page.canonicalRoute}`,
  );

  for (
    const alternate of page.alternates
  ) {
    assert.ok(
      alternate &&
        typeof alternate === "object",
      `Invalid alternate: ${page.canonicalRoute}`,
    );

    assertNonEmptyString(
      alternate.locale,
      `alternate.locale:${page.canonicalRoute}`,
    );

    validateRoute(
      alternate.route,
    );
  }
}

function validateHandoff(handoff) {
  assert.equal(
    handoff?.schema,
    "nexmold.v8.real-publication-handoff.v1",
    "Unsupported V8 publication handoff schema",
  );

  assertNonEmptyString(
    handoff.contentId,
    "handoff.contentId",
  );

  assertNonEmptyString(
    handoff.decisionId,
    "handoff.decisionId",
  );

  assertNonEmptyString(
    handoff.projectionId,
    "handoff.projectionId",
  );

  assert.ok(
    /^[a-f0-9]{64}$/.test(
      String(
        handoff.projectionFingerprint,
      ),
    ),
    "Invalid handoff projection fingerprint",
  );

  assertNonEmptyString(
    handoff.scopeId,
    "handoff.scopeId",
  );

  assertNonEmptyString(
    handoff.contextId,
    "handoff.contextId",
  );

  assert.ok(
    /^[a-f0-9]{64}$/.test(
      String(
        handoff.fingerprint,
      ),
    ),
    "Invalid handoff fingerprint",
  );

  const {
    fingerprint,
    ...payload
  } = handoff;

  assert.equal(
    fingerprint,
    sha256Text(
      canonicalJson(
        payload,
      ),
    ),
    "V8 publication handoff fingerprint verification failed",
  );

  assert.ok(
    Array.isArray(
      handoff.pages,
    ),
    "handoff.pages must be an array",
  );

  assert.equal(
    handoff.pages.length,
    GENERATED_ROUTES.size,
    "Unexpected V8 publication page count",
  );

  const routes =
    handoff.pages.map(
      (page) =>
        page.canonicalRoute,
    );

  assert.equal(
    new Set(routes).size,
    routes.length,
    "Duplicate V8 publication routes detected",
  );

  for (
    const [
      index,
      page,
    ] of handoff.pages.entries()
  ) {
    validatePage(
      page,
      index,
      handoff,
    );
  }

  for (
    const route of GENERATED_ROUTES
  ) {
    assert.ok(
      routes.includes(route),
      `Required V8 publication route missing: ${route}`,
    );
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeJsString(value) {
  return JSON.stringify(
    String(value),
  );
}

function routeToSourcePath(route) {
  const clean =
    route
      .replace(/^\/+/, "")
      .replace(/\/+$/, "");

  if (!clean) {
    fail(
      "V8_ASTRO_PUBLICATION_ROOT_ROUTE_FORBIDDEN",
      route,
    );
  }

  return path.join(
    GENERATED_ROOT,
    ...clean.split("/"),
    "index.astro",
  );
}

function renderPage(page) {
  const title =
    escapeJsString(
      page.title,
    );

  const locale =
    escapeJsString(
      page.locale,
    );

  const canonical =
    `https://www.nexmold.com${page.canonicalRoute}`;

  const canonicalJs =
    escapeJsString(
      canonical,
    );

  const alternateLinks =
    page.alternates
      .map(
        (alternate) =>
          `  <link rel="alternate" hreflang=${escapeJsString(
            alternate.locale,
          )} href=${escapeJsString(
            `https://www.nexmold.com${alternate.route}`,
          )} />`,
      )
      .join("\n");

  const paragraphs =
    page.body
      .split(/\r?\n/)
      .map(
        (line) =>
          line.trim(),
      )
      .filter(
        (line) =>
          line.length > 0,
      );

  const paragraphMarkup =
    paragraphs
      .map(
        (paragraph) =>
          `      <p>${escapeHtml(paragraph)}</p>`,
      )
      .join("\n");

  return `---
/*
 * ${GENERATED_MARKER}
 *
 * Source:
 *   .nexmold/v8-real-publication-handoff.json
 *
 * This file is generated by:
 *   scripts/v8-astro-publication-adapter.mjs
 *
 * DO NOT EDIT MANUALLY.
 */

const title = ${title};
const locale = ${locale};
const canonical = ${canonicalJs};
---

<!doctype html>
<html lang={locale}>
<head>
  <meta charset="utf-8" />
  <meta
    name="viewport"
    content="width=device-width, initial-scale=1"
  />

  <title>{title} | NEXMOLD</title>

  <meta
    name="description"
    content={title}
  />

  <link
    rel="canonical"
    href={canonical}
  />

${alternateLinks}

  <meta
    name="robots"
    content="index,follow,max-image-preview:large"
  />
</head>

<body>
  <main>
    <article>
      <header>
        <h1>{title}</h1>
      </header>

      <section>
${paragraphMarkup}
      </section>
    </article>
  </main>
</body>
</html>
`;
}

function removeOwnedFile(file) {
  if (!fs.existsSync(file)) {
    return;
  }

  const content =
    fs.readFileSync(
      file,
      "utf8",
    );

  if (
    !content.includes(
      GENERATED_MARKER,
    )
  ) {
    fail(
      "V8_ASTRO_PUBLICATION_OWNERSHIP_VIOLATION",
      `Refusing to overwrite non-V8 file: ${path.relative(ROOT, file)}`,
    );
  }

  fs.rmSync(
    file,
    {
      force: true,
    },
  );
}

function prepareTarget(file) {
  if (
    fs.existsSync(file)
  ) {
    removeOwnedFile(file);
  }

  fs.mkdirSync(
    path.dirname(file),
    {
      recursive: true,
    },
  );
}

function writePage(page) {
  const target =
    routeToSourcePath(
      page.canonicalRoute,
    );

  prepareTarget(
    target,
  );

  fs.writeFileSync(
    target,
    renderPage(page),
    "utf8",
  );

  return target;
}

function verifyGeneratedPage(
  page,
  file,
) {
  assert.ok(
    fs.existsSync(file),
    `Generated file missing: ${file}`,
  );

  const content =
    fs.readFileSync(
      file,
      "utf8",
    );

  assert.ok(
    content.includes(
      GENERATED_MARKER,
    ),
    `Generated marker missing: ${file}`,
  );

  assert.ok(
    content.includes(
      page.title,
    ),
    `Generated title missing: ${file}`,
  );

  assert.ok(
    content.includes(
      page.canonicalRoute,
    ),
    `Generated canonical route missing: ${file}`,
  );
}

function main() {
  console.log(
    "[V8-ASTRO-PUBLICATION] START",
  );

  const handoff =
    readHandoff();

  validateHandoff(
    handoff,
  );

  console.log(
    `[V8-ASTRO-PUBLICATION] handoff=${handoff.fingerprint}`,
  );

  console.log(
    `[V8-ASTRO-PUBLICATION] pages=${handoff.pages.length}`,
  );

  const generated =
    handoff.pages.map(
      (page) => {
        const file =
          writePage(
            page,
          );

        verifyGeneratedPage(
          page,
          file,
        );

        return file;
      },
    );

  assert.equal(
    generated.length,
    handoff.pages.length,
    "Generated page count mismatch",
  );

  console.log(
    `[V8-ASTRO-PUBLICATION] generated=${generated.length}`,
  );

  for (
    const file of generated
  ) {
    console.log(
      `[V8-ASTRO-PUBLICATION] ${path.relative(ROOT, file).split(path.sep).join("/")}`,
    );
  }

  console.log(
    "[V8-ASTRO-PUBLICATION] PASS",
  );
}

main();