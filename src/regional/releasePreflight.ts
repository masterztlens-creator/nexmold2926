/** NEXMOLD V7.14 — Regional release preflight. */
import type { RegionalCompileResult } from "./types.ts";

export interface RegionalReleasePreflightResult {
  readonly passed: boolean;
  readonly checks: readonly {
    readonly id: string;
    readonly passed: boolean;
  }[];
}

export function runRegionalReleasePreflight(
  result: RegionalCompileResult,
): RegionalReleasePreflightResult {
  const artifact = result.artifact;
  const route = result.route;
  const hreflang = result.hreflang;

  const checks = [
    { id: "eligibility-present", passed: Boolean(result.eligibility) },
    { id: "eligible-status", passed: result.eligibility.status === "ELIGIBLE" },
    {
      id: "artifact-present-for-eligible",
      passed: result.eligibility.status !== "ELIGIBLE" || artifact !== null,
    },
    {
      id: "route-present-for-eligible",
      passed: result.eligibility.status !== "ELIGIBLE" || route !== null,
    },
    {
      id: "hreflang-present-for-eligible",
      passed: result.eligibility.status !== "ELIGIBLE" || hreflang !== null,
    },
    {
      id: "artifact-route-identity",
      passed:
        artifact === null ||
        route === null ||
        (artifact === route.artifact &&
          artifact.pageId === route.pageId &&
          artifact.locale === route.locale &&
          artifact.region === route.region),
    },
    {
      id: "artifact-hash-identity",
      passed:
        artifact === null ||
        route === null ||
        artifact.pageContentHash === route.contentHash,
    },
    {
      id: "artifact-canonical-identity",
      passed:
        artifact === null ||
        route === null ||
        artifact.canonicalUrl === route.canonicalUrl,
    },
    {
      id: "blocked-has-zero-public-projections",
      passed:
        result.eligibility.status === "ELIGIBLE" ||
        (artifact === null && route === null && hreflang === null),
    },
  ];

  return Object.freeze({
    passed: checks.every((check) => check.passed),
    checks,
  });
}
