import fs from "node:fs";
import path from "node:path";

const root = path.resolve(new URL("..", import.meta.url).pathname);
const file = path.join(root, "package", "src", "regional", "v714-runtime-publication-gate.ts");
const source = fs.readFileSync(file, "utf8");

const required = [
  "const checkedClaims = value.checkedClaims;",
  "const checkedEvidence = value.checkedEvidence;",
  'typeof checkedClaims === "number"',
  'typeof checkedEvidence === "number"',
  "Number.isInteger(checkedClaims)",
  "Number.isInteger(checkedEvidence)",
];
for (const token of required) {
  if (!source.includes(token)) throw new Error(`Missing token: ${token}`);
}
if (source.includes("value.checkedClaims >= 0") || source.includes("value.checkedEvidence >= 0")) {
  throw new Error("Unsafe direct comparison against unknown properties remains");
}
console.log("V7.14 runtime gate fix verification: PASS");
