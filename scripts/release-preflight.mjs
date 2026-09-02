#!/usr/bin/env node
/** NEXMOLD V7.14 — production release preflight. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = process.cwd();

function fail(message) {
  throw new Error(`[V7.14 Release Preflight] FAILED: ${message}`);
}

function check(id, passed) {
  return { id, passed: Boolean(passed) };
}

export function runReleasePreflight(context = {}) {
  const root = path.resolve(
    typeof context === "string"
      ? context
      : context?.projectRoot ?? context?.root ?? ROOT,
  );

  const requiredFiles = [
    "package.json",
    "astro.config.mjs",
    "src/regional/types.ts",
    "src/regional/epistemic-firewall.ts",
    "src/regional/regionalPublishArtifact.ts",
    "src/regional/publication-gate.ts",
    "src/regional/regionalCompiler.ts",
    "src/regional/Producer.ts",
    "src/regional/releasePreflight.ts",
    "src/regional/article-producer.ts",
    "src/regional/article-renderer.ts",
    "scripts/v714-regional-gate.mjs",
    "scripts/v714-article-factory.mjs",
    "build-orchestrator.mjs",
  ];

  const checks = requiredFiles.map((relativePath) =>
    check(`exists:${relativePath}`, fs.existsSync(path.join(root, relativePath))),
  );

  const packageJson = JSON.parse(
    fs.readFileSync(path.join(root, "package.json"), "utf8"),
  );

  checks.push(
    check(
      "engine:node>=22.12.0",
      /^>=22\.12\.0/.test(String(packageJson.engines?.node ?? "")),
    ),
    check("script:v714:build", packageJson.scripts?.["v714:build"] === "node build-orchestrator.mjs"),
    check("script:v714:regional", typeof packageJson.scripts?.["v714:regional"] === "string"),
  );

  const failed = checks.filter((item) => !item.passed);
  if (failed.length) {
    fail(failed.map((item) => item.id).join(", "));
  }

  return Object.freeze({
    gate: "release-preflight",
    passed: true,
    root,
    checks,
  });
}

const currentFile = path.resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1] ? path.resolve(process.argv[1]) : "";

if (invokedFile === currentFile) {
  try {
    const result = runReleasePreflight(process.cwd());
    console.log(JSON.stringify({
      schema: "nexmold.v7.14.release-preflight.v2",
      ...result,
    }, null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
