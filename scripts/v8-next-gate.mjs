import { spawnSync } from "node:child_process";

const commands = [
  ["V8 FINAL", "scripts/v8-final-gate.mjs"],
  ["V8 OPERATIONAL", "scripts/v8-operational-gate.mjs"],
  ["V8 INTEGRITY", "scripts/v8-integrity-gate.mjs"],
  ["V8 REPRODUCIBILITY", "scripts/v8-reproducibility-gate.mjs"]
];

for (const [name, script] of commands) {
  console.log(`\n[NEXMOLD][V8][NEXT] ${name}`);

  const result = spawnSync(
    process.execPath,
    [script],
    {
      cwd: process.cwd(),
      stdio: "inherit"
    }
  );

  if (result.status !== 0) {
    console.error(`[NEXMOLD][V8][NEXT] FAIL: ${name}`);
    process.exit(result.status ?? 1);
  }
}

const artifact = spawnSync(
  process.execPath,
  ["scripts/v8-artifact-gate.mjs"],
  {
    cwd: process.cwd(),
    stdio: "inherit"
  }
);

if (artifact.status !== 0) {
  console.error("[NEXMOLD][V8][NEXT] FAIL: V8 ARTIFACT");
  process.exit(artifact.status ?? 1);
}

console.log("\n==============================================");
console.log("NEXMOLD V8 NEXT GATE PASS");
console.log("FINAL -> OPERATIONAL -> INTEGRITY -> REPRO -> ARTIFACT");
console.log("==============================================");