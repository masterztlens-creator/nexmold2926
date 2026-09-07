import { createHash } from "node:crypto";
import {
  canonicalize,
  fingerprint,
  type Fingerprint,
} from "../domain/primitives.js";

export function contentFingerprint(
  value: unknown,
): Fingerprint {
  return fingerprint(
    createHash("sha256")
      .update(
        JSON.stringify(canonicalize(value)),
        "utf8",
      )
      .digest("hex"),
  );
}

export function rawBytesFingerprint(
  bytes: Uint8Array,
): Fingerprint {
  return fingerprint(
    createHash("sha256")
      .update(
        Buffer.from(
          bytes.buffer,
          bytes.byteOffset,
          bytes.byteLength,
        ),
      )
      .digest("hex"),
  );
}

export const stableFingerprint =
  contentFingerprint;