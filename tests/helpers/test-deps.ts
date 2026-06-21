/**
 * Shared test dependencies: a silent logger and configurable fake LLM clients.
 */
import { Writable } from 'node:stream';
import type { Tier } from '../../src/domain/scoring.types';
import { createLogger } from '../../src/lib/logger/logger';
import type { LLMClient } from '../../src/llm/llm-client.interface';

export const silentLogger = createLogger(
  { level: 'error' },
  new Writable({ write: (_c, _e, cb) => cb() }),
);

const FAIL = { success: false as const };

export function fakeLlm(overrides: Partial<LLMClient> = {}): LLMClient {
  return {
    available: true,
    classifyUniversity: async () => FAIL,
    classifyCompany: async () => FAIL,
    generateExplanation: async () => FAIL,
    generateEmail: async () => FAIL,
    generateProfiles: async () => FAIL,
    ...overrides,
  };
}

/** A fake LLM whose tier classifiers always return `tier`. */
export function tierLlm(tier: Tier): LLMClient {
  return fakeLlm({
    classifyUniversity: async () => ({ success: true, data: tier }),
    classifyCompany: async () => ({ success: true, data: tier }),
  });
}
