import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const forbidden = [
  "src/regional",
  "src/v7",
  "v714",
  "v715"
];

function walk(dir) {
  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else if (/\.(ts|mts|mjs)$/.test(entry.name)) {
      result.push(full);
    }
  }

  return result;
}

test("V8 source contains no forbidden legacy dependency references", () => {
  const files = walk("src/v8");
  const violations = [];

  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");

    for (const token of forbidden) {
      if (source.includes(token)) {
        violations.push(`${file}: ${token}`);
      }
    }
  }

  assert.deepEqual(violations, []);
});