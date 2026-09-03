#!/usr/bin/env node
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

const root = path.resolve(process.env.NEXMOLD_ROOT ?? path.dirname(path.dirname(fileURLToPath(import.meta.url))));
const dist = path.resolve(process.env.NEXMOLD_DIST ?? path.join(root, "dist"));
const epoch = process.env.NEXMOLD_BUILD_EPOCH;
const manifestPath = path.resolve(
  process.env.NEXMOLD_V8_HTML_MANIFEST ??
    (epoch ? path.join(root, ".nexmold", "releases", epoch, "html-manifest.json") : ""),
);

function fail(code, message) { throw new Error(`[${code}] ${message}`); }
function assert(condition, code, message) { if (!condition) fail(code, message); }
function sha256File(file) { return createHash("sha256").update(fs.readFileSync(file)).digest("hex"); }
function importBuilt(relative) {
  const file = path.join(root, ".v8-build", "src", "v8", relative);
  assert(fs.existsSync(file), "V8_09_COMPILED_MODULE_MISSING", file);
  return import(`${pathToFileURL(file).href}?v8_09=${Date.now()}`);
}

for (const required of ["tsconfig.v8.json", "dist"]) {
  assert(fs.existsSync(path.join(root, required)), "V8_09_REQUIRED_PATH_MISSING", required);
}
assert(manifestPath && fs.existsSync(manifestPath), "V8_09_HTML_MANIFEST_MISSING", "Real V7.14 HTML manifest is required.");

execFileSync(process.execPath, [path.join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.v8.json"], {
  cwd: root,
  stdio: "inherit",
});

const [{ project }, { releasePreflight }, { createProductionManifest, assertProductionManifest }] = await Promise.all([
  importBuilt("projection/projector.js"),
  importBuilt("release/preflight.js"),
  importBuilt("production/adapter.js"),
]);

const htmlManifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
assert(htmlManifest.schema === "nexmold.v7.14.html-manifest.v2", "V8_09_HTML_MANIFEST_SCHEMA", "Unexpected HTML manifest schema.");
assert(Array.isArray(htmlManifest.entries) && htmlManifest.entries.length > 0, "V8_09_HTML_MANIFEST_EMPTY", "No real HTML artifacts recorded.");
assert(htmlManifest.count === htmlManifest.entries.length, "V8_09_HTML_MANIFEST_COUNT", "HTML manifest count mismatch.");

const entries = [...htmlManifest.entries].sort((a, b) => a.path.localeCompare(b.path));
const seenRoutes = new Set();
for (const entry of entries) {
  assert(typeof entry.path === "string" && entry.path.length > 0, "V8_09_ARTIFACT_PATH_INVALID", "HTML manifest contains an invalid path.");
  const target = path.resolve(dist, entry.path);
  const relative = path.relative(dist, target);
  assert(!relative.startsWith("..") && !path.isAbsolute(relative), "V8_09_ARTIFACT_PATH_ESCAPE", entry.path);
  assert(fs.existsSync(target), "V8_09_ARTIFACT_MISSING", entry.path);
  assert(sha256File(target) === entry.sha256, "V8_09_ARTIFACT_HASH_MISMATCH", entry.path);
  assert(typeof entry.route === "string" && entry.route.startsWith("/"), "V8_09_ARTIFACT_ROUTE_INVALID", entry.path);
  assert(!seenRoutes.has(entry.route), "V8_09_DUPLICATE_ROUTE", entry.route);
  seenRoutes.add(entry.route);
}

const first = entries[0];
const html = fs.readFileSync(path.resolve(dist, first.path), "utf8");
const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? first.route)
  .replace(/<[^>]+>/g, "").trim() || first.route;
const publication = Object.freeze({
  id: "publication:v8-09-real-production",
  subjectId: "production-artifact",
  title,
  body: `artifact:${first.path}:${first.sha256}`,
  contentFingerprint: "a".repeat(64),
  lineage: [],
  eligibilityRecordId: "eligibility:v8-09-real-production",
  policyId: "policy:v8-09-real-production",
  policyFingerprint: "b".repeat(64),
});

const projection = project({ artifact: publication, route: first.route });
const paths = entries.map((entry) => entry.path);
const release = releasePreflight({ projection, requiredPaths: paths, generatedPaths: paths });
const production = createProductionManifest({ release, projection, expectedPaths: paths });
assertProductionManifest(production);

assert(production.manifest.length === entries.length, "V8_09_PRODUCTION_MANIFEST_COUNT", "Production manifest count mismatch.");
for (const entry of entries) assert(production.manifest.includes(entry.path), "V8_09_PRODUCTION_ARTIFACT_MISSING", entry.path);

let rejected = false;
try { createProductionManifest({ release, projection: { ...projection, fingerprint: "c".repeat(64) }, expectedPaths: paths }); } catch { rejected = true; }
assert(rejected, "V8_09_FORGED_PROJECTION_ACCEPTED", "Forged projection fingerprint was accepted.");

rejected = false;
try { createProductionManifest({ release, projection, expectedPaths: [...paths, "__forged__.html"] }); } catch { rejected = true; }
assert(rejected, "V8_09_FORGED_ARTIFACT_ACCEPTED", "Forged artifact path was accepted.");

console.log("V8-09 PRODUCTION INTEGRATION PASS");
console.log(`Real dist artifacts: ${entries.length}`);
console.log("dist SHA-256 verification: PASS");
console.log("Projection -> ReleasePreflight: PASS");
console.log("ReleasePreflight -> Production Boundary: PASS");
console.log("Canonical release identity: PASS");
console.log("Canonical production manifest: PASS");
console.log("Fail-closed forgery checks: PASS");
