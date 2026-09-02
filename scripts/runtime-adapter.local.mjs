/**
 * NEXMOLD V7.14
 * Local Runtime Adapter
 *
 * Purpose:
 * - Provide a stable build-time/runtime environment contract.
 * - Never alter Astro pages, layouts, components, or CSS.
 * - Never publish data by itself.
 * - Fail closed when explicitly required environment values are invalid.
 *
 * This project uses Astro static output, so this adapter is intentionally
 * kept outside src/ and is NOT bundled into the website.
 */

const VALID_MODES = new Set([
  'development',
  'preview',
  'production'
]);

const VALID_OUTPUTS = new Set([
  'static'
]);

function normalize(value, fallback) {
  const normalized = String(value ?? '').trim();
  return normalized || fallback;
}

export function getRuntimeContext(env = process.env) {
  const mode = normalize(
    env.NEXMOLD_RUNTIME_MODE,
    env.NODE_ENV === 'production' ? 'production' : 'development'
  );

  const output = normalize(
    env.NEXMOLD_OUTPUT,
    'static'
  );

  const context = {
    mode,
    output,
    ci: String(env.CI ?? '').toLowerCase() === 'true',
    allowPublish: String(env.NEXMOLD_ALLOW_PUBLISH ?? '').toLowerCase() === 'true',
    bypassGates: String(env.NEXMOLD_BYPASS_GATES ?? '').toLowerCase() === 'true'
  };

  return Object.freeze(context);
}

export function assertRuntimeContext(context = getRuntimeContext()) {
  if (!VALID_MODES.has(context.mode)) {
    throw new Error(
      `[V7.14 Runtime Gate] Invalid runtime mode: ${context.mode}`
    );
  }

  if (!VALID_OUTPUTS.has(context.output)) {
    throw new Error(
      `[V7.14 Runtime Gate] Invalid Astro output mode: ${context.output}`
    );
  }

  if (context.bypassGates && context.mode === 'production') {
    throw new Error(
      '[V7.14 Runtime Gate] Production gate bypass is forbidden.'
    );
  }

  return context;
}

export function getSafeRuntimeContext(env = process.env) {
  return assertRuntimeContext(getRuntimeContext(env));
}
