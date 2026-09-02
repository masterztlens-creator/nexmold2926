/**
 * NEXMOLD V7.14
 * Release Preflight
 *
 * Non-destructive production readiness checks.
 *
 * Contract:
 *   runReleasePreflight(context)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function runReleasePreflight(context = {}) {
  const root =
    typeof context === 'string'
      ? context
      : context?.projectRoot ?? context?.root ?? process.cwd();

  const requiredFiles = [
    'package.json',
    'astro.config.mjs',
    'src',
    'public'
  ];

  const checks = requiredFiles.map(relativePath => {
    const target = path.join(root, relativePath);

    return {
      id: 'exists:' + relativePath,
      passed: fs.existsSync(target)
    };
  });

  const failed = checks.filter(check => !check.passed);

  const result = {
    gate: 'release-preflight',
    passed: failed.length === 0,
    root,
    checks
  };

  if (!result.passed) {
    throw new Error(
      '[V7.14 Release Preflight] FAILED: ' +
      failed.map(check => check.id).join(', ')
    );
  }

  return Object.freeze(result);
}

/**
 * CLI entrypoint
 */
const currentFile = path.resolve(fileURLToPath(import.meta.url));
const invokedFile = process.argv[1]
  ? path.resolve(process.argv[1])
  : '';

if (invokedFile === currentFile) {
  try {
    const result = runReleasePreflight(process.cwd());

    console.log(
      JSON.stringify(
        {
          schema: 'nexmold.v7.14.release-preflight.v1',
          ...result
        },
        null,
        2
      )
    );

    process.exitCode = 0;
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : String(error)
    );

    process.exitCode = 1;
  }
}
