import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });

const required = [
  "src/v8/production/types.ts",
  "src/v8/production/adapter.ts",
  "src/v8/production/index.ts",
  "tests/v8/production-boundary.test.mjs",
];
for (const path of required) {
  if (!existsSync(join(root, path))) throw new Error(`V8_09_REQUIRED_FILE_MISSING: ${path}`);
}

run(process.execPath, [join(root, "node_modules", "typescript", "bin", "tsc"), "-p", "tsconfig.v8.json"]);
run(process.execPath, ["--test", join(root, "tests/v8/production-boundary.test.mjs")]);

console.log("V8-09 PRODUCTION BOUNDARY PASS");
console.log("Release identity: PASS");
console.log("Projection identity: PASS");
console.log("Canonical manifest: PASS");
console.log("Fail-closed forgery checks: PASS");
