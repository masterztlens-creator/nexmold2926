import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const packagePath = path.join(root, "package.json");
const lockPath = path.join(root, "package-lock.json");
const v8Root = path.join(root, "src", "v8");
const reportDir = path.join(root, ".nexmold", "v8", "reports");
const reportPath = path.join(reportDir, "v8-operational-report.json");

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else {
      result.push(full);
    }
  }

  return result;
}

function fail(message) {
  console.error(`[V8][OPERATIONAL][FAIL] ${message}`);
  process.exit(1);
}

const pkg = readJson(packagePath);
const lock = readJson(lockPath);

if (pkg.name !== "nexmold-v8-full") {
  fail(`Invalid package name: ${pkg.name}`);
}

if (pkg.engines?.node !== ">=22.12.0") {
  fail(`Invalid Node engine: ${pkg.engines?.node}`);
}

if (pkg.devDependencies?.typescript !== "6.0.3") {
  fail(`Invalid TypeScript version: ${pkg.devDependencies?.typescript}`);
}

if (lock.lockfileVersion !== 3) {
  fail(`Invalid lockfileVersion: ${lock.lockfileVersion}`);
}

if (lock.packages?.[""]?.devDependencies?.typescript !== "6.0.3") {
  fail("package-lock root TypeScript contract mismatch");
}

const requiredLayers = [
  "constitution",
  "domain",
  "foundation",
  "governance",
  "semantic",
  "evidence",
  "eligibility",
  "publication",
  "projection",
  "release",
  "production",
  "operational"
];

for (const layer of requiredLayers) {
  const dir = path.join(v8Root, layer);

  if (!fs.existsSync(dir)) {
    fail(`Missing V8 layer: src/v8/${layer}`);
  }
}

const files = walk(v8Root).filter((file) => /\.(ts|mts|mjs)$/.test(file));
const forbidden = [];

for (const file of files) {
  const source = fs.readFileSync(file, "utf8");

  if (
    /src\/regional|src\/v7|v714|v715/.test(source)
  ) {
    forbidden.push(path.relative(root, file));
  }
}

if (forbidden.length > 0) {
  fail(`Forbidden legacy references:\n${forbidden.join("\n")}`);
}

const report = {
  gate: "V8_OPERATIONAL",
  status: "PASS",
  package: pkg.name,
  nodeEngine: pkg.engines.node,
  typescript: pkg.devDependencies.typescript,
  lockfileVersion: lock.lockfileVersion,
  requiredLayers,
  scannedFiles: files.map((file) => path.relative(root, file)),
  forbiddenReferences: []
};

fs.mkdirSync(reportDir, { recursive: true });
fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);

console.log("[NEXMOLD][V8] OPERATIONAL GATE PASS");
console.log(`[NEXMOLD][V8] Report: ${path.relative(root, reportPath)}`);