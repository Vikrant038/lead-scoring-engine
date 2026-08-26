/* istanbul ignore file */
/**
 * CJS/ESM interop loader for Better Auth (Phase 1 & Serverless).
 * In test/standard environments, uses standard require/mock.
 * In serverless CJS runtimes, falls back to jiti to bridge pure ESM modules.
 */
function safeRequireBetterAuth() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('better-auth');
    /* istanbul ignore next -- fallback executed only on serverless CJS runtimes */
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUIRE_ESM'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const createJiti = require('jiti');
      const jiti = createJiti(process.cwd());
      return jiti('better-auth');
    }
    throw err;
  }
}

function safeRequireDrizzleAdapter() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('better-auth/adapters/drizzle');
    /* istanbul ignore next -- fallback executed only on serverless CJS runtimes */
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUIRE_ESM'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const createJiti = require('jiti');
      const jiti = createJiti(process.cwd());
      return jiti('better-auth/adapters/drizzle');
    }
    throw err;
  }
}

function safeRequireBetterAuthNode() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('better-auth/node');
    /* istanbul ignore next -- fallback executed only on serverless CJS runtimes */
  } catch (err: unknown) {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: string }).code === 'ERR_REQUIRE_ESM'
    ) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const createJiti = require('jiti');
      const jiti = createJiti(process.cwd());
      return jiti('better-auth/node');
    }
    throw err;
  }
}

export const { betterAuth } = safeRequireBetterAuth() as typeof import('better-auth');
export const { drizzleAdapter } =
  safeRequireDrizzleAdapter() as typeof import('better-auth/adapters/drizzle');
export const { toNodeHandler, fromNodeHeaders } =
  safeRequireBetterAuthNode() as typeof import('better-auth/node');
