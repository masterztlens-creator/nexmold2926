import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const dist = path.join(root, "dist");

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

if (!fs.existsSync(dist)) {
  console.error("[V8][ARTIFACT][FAIL] dist/ does not exist");
  process.exit(1);
}

const files = walk(dist);
const html = files.filter((file) => file.endsWith(".html"));

if (html.length === 0) {
  console.error("[V8][ARTIFACT][FAIL] No HTML artifacts found");
  process.exit(1);
}

const manifestDir = path.join(root, ".nexmold", "v8", "manifests");
fs.mkdirSync(manifestDir, { recursive: true });

const artifacts = files.map((file) => {
  const stat = fs.statSync(file);

  return {
    path: path.relative(root, file).replaceAll(path.sep, "/"),
    size: stat.size
  };
});

const manifest = {
  schemaVersion: "1",
  generatedAt: new Date().toISOString(),
  htmlCount: html.length,
  artifactCount: artifacts.length,
  artifacts
};

fs.writeFileSync(
  path.join(manifestDir, "artifact-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

console.log(
  `[NEXMOLD][V8] ARTIFACT GATE PASS — ${html.length} HTML files`
);