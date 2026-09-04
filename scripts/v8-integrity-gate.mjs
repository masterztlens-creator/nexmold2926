import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const v8Root = path.join(root, "src", "v8");
const manifestDir = path.join(root, ".nexmold", "v8", "manifests");

function walk(dir) {
  const result = [];

  if (!fs.existsSync(dir)) return result;

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

function sha256(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(file))
    .digest("hex");
}

const files = walk(v8Root)
  .filter((file) => /\.(ts|mts|mjs)$/.test(file))
  .sort();

const records = files.map((file) => ({
  path: path.relative(root, file).replaceAll(path.sep, "/"),
  sha256: sha256(file)
}));

const manifest = {
  schemaVersion: "1",
  algorithm: "sha256",
  generatedAt: new Date().toISOString(),
  files: records
};

fs.mkdirSync(manifestDir, { recursive: true });

fs.writeFileSync(
  path.join(manifestDir, "source-manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);

fs.writeFileSync(
  path.join(manifestDir, "integrity-manifest.json"),
  `${JSON.stringify(
    {
      schemaVersion: "1",
      algorithm: "sha256",
      fileCount: records.length,
      root: "src/v8",
      files: records
    },
    null,
    2
  )}\n`
);

console.log(`[NEXMOLD][V8] INTEGRITY GATE PASS — ${records.length} files`);