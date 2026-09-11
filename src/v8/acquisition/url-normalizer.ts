/** Normalize URL syntax only; query semantics are preserved. */
export function normalizeSourceUrl(input: string): string {
  let parsed: URL;
  try { parsed = new URL(input); } catch { throw new Error("V8_ACQUISITION_INVALID_URL"); }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("V8_ACQUISITION_UNSUPPORTED_URL");
  }
  parsed.hostname = parsed.hostname.toLowerCase();
  if ((parsed.protocol === "http:" && parsed.port === "80") ||
      (parsed.protocol === "https:" && parsed.port === "443")) parsed.port = "";
  if (parsed.pathname === "") parsed.pathname = "/";
  parsed.hash = "";
  return parsed.toString();
}
