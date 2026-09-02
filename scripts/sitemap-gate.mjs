/**
 * NEXMOLD V7.14
 * Sitemap Gate
 *
 * Phase 1: source/config validation only.
 * Does not modify Astro configuration.
 * Does not generate or publish sitemap files.
 *
 * Contract:
 *   runSitemapGate(context)
 */

import fs from 'node:fs';
import path from 'node:path';

export function runSitemapGate(context = {}) {
  const root =
    typeof context === 'string'
      ? context
      : context?.projectRoot ?? context?.root ?? process.cwd();

  const checks = [];

  const astroConfig = path.join(root, 'astro.config.mjs');
  const sitemapSource = path.join(root, 'src', 'pages', 'sitemap.xml.ts');

  checks.push({
    id: 'astro-config',
    passed: fs.existsSync(astroConfig)
  });

  checks.push({
    id: 'sitemap-source',
    passed: fs.existsSync(sitemapSource)
  });

  const configText = fs.existsSync(astroConfig)
    ? fs.readFileSync(astroConfig, 'utf8')
    : '';

  checks.push({
    id: 'astro-sitemap-integration',
    passed: configText.includes('@astrojs/sitemap')
  });

  const failed = checks.filter(check => !check.passed);

  const result = {
    gate: 'sitemap',
    passed: failed.length === 0,
    phase: 'source-validation',
    root,
    checks
  };

  if (!result.passed) {
    console.error(
      '[V7.14 Sitemap Gate] FAILED: ' +
      failed.map(check => check.id).join(', ')
    );
  }

  return Object.freeze(result);
}
