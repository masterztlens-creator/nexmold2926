import { execFileSync } from "node:child_process";
const args = ["--experimental-strip-types", "tests/v8/foundation/foundation-production.test.mjs"];
execFileSync(process.execPath, args, { stdio: "inherit" });
console.log("PASS V8_FOUNDATION_PRODUCTION_GATE");
