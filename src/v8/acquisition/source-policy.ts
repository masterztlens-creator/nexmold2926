import { normalizeSourceUrl } from "./url-normalizer.js";

export type SourcePolicyStatus = "ELIGIBLE" | "BLOCKED";

export interface SourcePolicyDecision {
  readonly status: SourcePolicyStatus;
  readonly normalizedUrl?: string;
  readonly reason?: string;
}

function isIPv4InRange(
  octets: readonly number[],
  network: readonly number[],
  mask: readonly number[],
): boolean {
  for (let i = 0; i < 4; i += 1) {
    if ((octets[i] & mask[i]) !== (network[i] & mask[i])) {
      return false;
    }
  }

  return true;
}

function parseIPv4(hostname: string): number[] | null {
  const parts = hostname.split(".");

  if (parts.length !== 4) {
    return null;
  }

  const octets = parts.map((part) => {
    if (!/^\d+$/.test(part)) {
      return -1;
    }

    const value = Number(part);

    return Number.isInteger(value) && value >= 0 && value <= 255
      ? value
      : -1;
  });

  return octets.every((value) => value >= 0) ? octets : null;
}

function isBlockedIPv4(hostname: string): boolean {
  const octets = parseIPv4(hostname);

  if (!octets) {
    return false;
  }

  const blockedRanges: readonly [
    readonly number[],
    readonly number[],
  ][] = [
    [[0, 0, 0, 0], [255, 0, 0, 0]],
    [[10, 0, 0, 0], [255, 0, 0, 0]],
    [[100, 64, 0, 0], [255, 192, 0, 0]],
    [[127, 0, 0, 0], [255, 0, 0, 0]],
    [[169, 254, 0, 0], [255, 255, 0, 0]],
    [[172, 16, 0, 0], [255, 240, 0, 0]],
    [[192, 0, 0, 0], [255, 255, 255, 0]],
    [[192, 0, 2, 0], [255, 255, 255, 0]],
    [[192, 168, 0, 0], [255, 255, 0, 0]],
    [[198, 18, 0, 0], [255, 254, 0, 0]],
    [[198, 51, 100, 0], [255, 255, 255, 0]],
    [[203, 0, 113, 0], [255, 255, 255, 0]],
    [[224, 0, 0, 0], [240, 0, 0, 0]],
    [[240, 0, 0, 0], [240, 0, 0, 0]],
  ];

  return blockedRanges.some(([network, mask]) =>
    isIPv4InRange(octets, network, mask),
  );
}

function isBlockedIPv6(hostname: string): boolean {
  const normalized = hostname
    .toLowerCase()
    .replace(/^\[/, "")
    .replace(/\]$/, "");

  if (!normalized.includes(":")) {
    return false;
  }

  if (normalized === "::") {
    return true;
  }

  if (normalized === "::1") {
    return true;
  }

  // IPv4-mapped IPv6 is conservatively blocked.
  if (normalized.startsWith("::ffff:")) {
    return true;
  }

  // fc00::/7 — Unique Local
  // fe80::/10 — Link Local
  // ff00::/8 — Multicast
  const firstGroup = normalized.split(":")[0] || "0";
  const first = Number.parseInt(firstGroup, 16);

  if (!Number.isFinite(first)) {
    return true;
  }

  if ((first & 0xfe00) === 0xfc00) {
    return true;
  }

  if ((first & 0xffc0) === 0xfe80) {
    return true;
  }

  if ((first & 0xff00) === 0xff00) {
    return true;
  }

  return false;
}

function isBlockedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");

  if (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized.endsWith(".local")
  ) {
    return true;
  }

  if (isBlockedIPv4(normalized)) {
    return true;
  }

  if (isBlockedIPv6(normalized)) {
    return true;
  }

  return false;
}

/**
 * Pure, conservative Internet-source eligibility boundary.
 *
 * This policy intentionally operates on the URL itself and does not perform
 * DNS resolution. Therefore it blocks known local/reserved host literals and
 * local-only hostnames, while leaving ordinary DNS names eligible.
 */
export function evaluateSourceUrl(input: string): SourcePolicyDecision {
  try {
    const normalizedUrl = normalizeSourceUrl(input);
    const parsed = new URL(normalizedUrl);

    if (parsed.username || parsed.password) {
      return {
        status: "BLOCKED",
        reason: "V8_ACQUISITION_SOURCE_CREDENTIALS_FORBIDDEN",
      };
    }

    if (isBlockedHostname(parsed.hostname)) {
      return {
        status: "BLOCKED",
        reason: "V8_ACQUISITION_NON_PUBLIC_HOST",
      };
    }

    return {
      status: "ELIGIBLE",
      normalizedUrl,
    };
  } catch (error) {
    return {
      status: "BLOCKED",
      reason:
        error instanceof Error
          ? error.message
          : "V8_ACQUISITION_SOURCE_POLICY_UNKNOWN",
    };
  }
}