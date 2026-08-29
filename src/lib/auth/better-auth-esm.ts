/**
 * CJS entry points for Better Auth. The package ships ESM-only types resolved via
 * `dist/index.d.mts`; named imports are re-exported here so consumers share one interop
 * surface and Jest can map every symbol through a single moduleNameMapper entry.
 */
import * as betterAuthModule from 'better-auth';
import * as drizzleAdapterModule from 'better-auth/adapters/drizzle';
import * as nodeModule from 'better-auth/node';

export const betterAuth = betterAuthModule.betterAuth;
export const drizzleAdapter = drizzleAdapterModule.drizzleAdapter;
export const toNodeHandler = nodeModule.toNodeHandler;
export const fromNodeHeaders = nodeModule.fromNodeHeaders;
