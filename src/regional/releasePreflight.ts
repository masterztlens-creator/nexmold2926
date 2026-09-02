/** NEXMOLD V7.14 鈥?pure regional release preflight. */
import type { RegionalCompileResult } from './types.ts';

export interface RegionalReleasePreflightResult {
  readonly passed: boolean;
  readonly checks: readonly { readonly id: string; readonly passed: boolean }[];
}

export function runRegionalReleasePreflight(result: RegionalCompileResult): RegionalReleasePreflightResult {
  const checks = [
    { id: 'eligibility-present', passed: Boolean(result.eligibility) },
    { id: 'eligible-status', passed: result.eligibility.status === 'ELIGIBLE' },
    { id: 'artifact-present-for-eligible', passed: result.eligibility.status !== 'ELIGIBLE' || result.artifact !== null },
    { id: 'route-present-for-eligible', passed: result.eligibility.status !== 'ELIGIBLE' || result.route !== null },
    { id: 'hreflang-present-for-eligible', passed: result.eligibility.status !== 'ELIGIBLE' || result.hreflang !== null },
    { id: 'artifact-route-identity', passed: result.artifact === null || result.route === null || result.artifact.pageId === result.route.pageId },
    { id: 'artifact-hash-identity', passed: result.artifact === null || result.route === null || result.artifact.pageContentHash === result.route.contentHash },
  ];
  return Object.freeze({ passed: checks.every((x) => x.passed), checks });
}


