import test from "node:test";
import assert from "node:assert/strict";

test("V8 operational package contract", async () => {
  const packageJson = await import("../../../../package.json", {
    with: { type: "json" }
  });

  assert.equal(packageJson.default.name, "nexmold-v8-full");
  assert.equal(packageJson.default.engines.node, ">=22.12.0");
  assert.equal(packageJson.default.devDependencies.typescript, "6.0.3");
});

test("V8 operational scripts exist", async () => {
  const fs = await import("node:fs");
  const paths = [
    "scripts/v8-operational-gate.mjs",
    "scripts/v8-integrity-gate.mjs",
    "scripts/v8-reproducibility-gate.mjs",
    "scripts/v8-artifact-gate.mjs",
    "scripts/v8-next-gate.mjs"
  ];

  for (const file of paths) {
    assert.equal(fs.existsSync(file), true, file);
  }
});