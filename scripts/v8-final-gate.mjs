import { execFileSync } from "node:child_process";
import { readdirSync, statSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
const run = (cmd, args) => execFileSync(cmd, args, { cwd: root, stdio: "inherit" });
if (statSync(localTsc, { throwIfNoEntry: false })) run(process.execPath, [localTsc, "-p", "tsconfig.v8.json"]);
else run("tsc", ["-p", "tsconfig.v8.json"]);

const tests = [];
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (path.endsWith(".test.mjs")) tests.push(path);
  }
}
walk(join(root, "tests", "v8"));
if (!tests.length) throw new Error("V8_FINAL_NO_TESTS");
run(process.execPath, ["--test", ...tests.sort()]);

const src = join(root, "src", "v8");
const forbidden = /(?:src[\\/]regional|src[\\/]v7|v714|v715)/i;
const bad = [];
function scan(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) scan(path);
    else if (/\.(ts|mjs)$/.test(path) && forbidden.test(readFileSync(path, "utf8"))) bad.push(path.slice(root.length + 1));
  }
}
scan(src);
if (bad.length) throw new Error(`V8_FINAL_CLEAN_ROOM_FAIL: ${bad.join(", ")}`);

const required = ["constitution","domain","foundation","governance","semantic","evidence","eligibility","publication","projection","release"];
for (const layer of required) {
  if (!statSync(join(src, layer)).isDirectory()) throw new Error(`V8_FINAL_LAYER_MISSING: ${layer}`);
}
console.log("V8 FINAL GATE PASS");
console.log("V8-00..V8-08 source layers: PASS");
console.log("Compile: PASS");
console.log("Runtime contracts: PASS");
console.log("Clean room: PASS");
