import { createHash } from "node:crypto";
import { canonicalize, fingerprint, type Fingerprint } from "../domain/primitives.js";

export function contentFingerprint(value: unknown): Fingerprint {
  const input = JSON.stringify(canonicalize(value));
  return fingerprint(createHash("sha256").update(input, "utf8").digest("hex"));
}
