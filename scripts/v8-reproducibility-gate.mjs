import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const root = process.cwd();
const outputDir = path.join(root, ".nexmold", "v8", "manifests");
const outputPath = path.join(outputDir, "build-fingerprint.json");

const inputs = [
  "package.json",
  "package-lock.json",
  "tsconfig.v8.json"
];

function hashFile(file) {
  return crypto
    .createHash("sha256")
    .update(fs.readFileSync(path.join(root, file)))
    .digest("hex");
}

const hashes = Object.fromEntries(
  inputs.map((file) => [file, hashFile(file)])
);

const fingerprint = crypto
  .createHash("sha256")
  .update(inputs.map((file) => `${file}:${hashes[file]}`).join("\n"))
  .digest("hex");

const result = {
  schemaVersion: "1",
  algorithm: "sha256",
  generatedAt: new Date().toISOString(),
  inputs: hashes,
  fingerprint
};

fs.mkdirSync(outputDir, { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);

console.log(`[NEXMOLD][V8] REPRODUCIBILITY GATE PASS`);
console.log(`[NEXMOLD][V8] Fingerprint: ${fingerprint}`);