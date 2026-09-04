import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

test("V8 next chain is declared", async () => {
  const packageJson = JSON.parse(
    fs.readFileSync("package.json", "utf8")
  );

  assert.equal(
    packageJson.scripts["v8:next"],
    "node scripts/v8-next-gate.mjs"
  );

  assert.equal(
    packageJson.scripts["v8:operational"],
    "node scripts/v8-operational-gate.mjs"
  );

  assert.equal(
    packageJson.scripts["v8:integrity"],
    "node scripts/v8-integrity-gate.mjs"
  );

  assert.equal(
    packageJson.scripts["v8:repro"],
    "node scripts/v8-reproducibility-gate.mjs"
  );

  assert.equal(
    packageJson.scripts["v8:artifact"],
    "node scripts/v8-artifact-gate.mjs"
  );
});