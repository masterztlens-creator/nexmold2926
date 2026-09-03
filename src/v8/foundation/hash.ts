import { createHash } from "node:crypto";
import { canonicalize, fingerprint, type Fingerprint } from "../domain/primitives.js";

/** Deterministic SHA-256 fingerprint over canonical JSON. */
export function contentFingerprint(value: unknown): Fingerprint {
  return fingerprint(
    createHash("sha256")
      .update(JSON.stringify(canonicalize(value)), "utf8")
      .digest("hex"),
  );
}

/** Backward-compatible V8-00/01 public API. */
export const stableFingerprint = contentFingerprint;
