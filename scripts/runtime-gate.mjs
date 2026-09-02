/**
 * NEXMOLD V7.14
 * Runtime Gate
 *
 * Static Astro deployment gate.
 */

import { getSafeRuntimeContext } from './runtime-adapter.local.mjs';

export function runRuntimeGate(env = process.env) {
  const context = getSafeRuntimeContext(env);

  const checks = [
    {
      id: 'runtime-context',
      passed: Boolean(context.mode),
    },
    {
      id: 'static-output',
      passed: context.output === 'static',
    },
    {
      id: 'production-bypass',
      passed: !(context.mode === 'production' && context.bypassGates),
    },
  ];

  const failed = checks.filter((check) => !check.passed);

  const result = {
    gate: 'runtime',
    passed: failed.length === 0,
    mode: context.mode,
    output: context.output,
    checks,
  };

  if (!result.passed) {
    throw new Error(
      '[V7.14 Runtime Gate] FAILED: ' +
        failed.map((check) => check.id).join(', '),
    );
  }

  return Object.freeze(result);
}