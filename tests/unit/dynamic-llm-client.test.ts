/**
 * Unit tests for the dynamic (web-side) LLM factory selection logic.
 * Tests provider selection without real API calls.
 */
import { createDynamicLlmClient } from '../../src/llm/llm-client.factory';
import { NullProvider } from '../../src/llm/null.provider';
import { defaultConfig } from '../../src/config/config';
import { silentLogger } from '../helpers/test-deps';
import type { LLMClient } from '../../src/llm/llm-client.interface';
import type { AppConfig } from '../../src/config/config';

function buildClient(
  configOverrides: Record<string, unknown> = {},
  env: Record<string, string | undefined> = {},
  fallback?: LLMClient,
): LLMClient {
  const config: AppConfig = {
    ...defaultConfig,
    llm: { ...defaultConfig.llm, ...configOverrides },
  };
  return createDynamicLlmClient(
    config,
    env as Record<string, string>,
    silentLogger,
    fallback ?? new NullProvider(),
  );
}

describe('createDynamicLlmClient', () => {
  it('returns available=false when no provider configured (falls through to NullProvider)', () => {
    const client = buildClient({ provider: 'none', apiKey: undefined });
    expect(client.available).toBe(false);
  });

  it('falls back to defaultLlm when provider is "gemini" but no key exists', () => {
    const null2 = new NullProvider();
    const client = buildClient({ provider: 'gemini', apiKey: undefined }, {}, null2);
    expect(client.available).toBe(null2.available);
  });

  it('falls back to defaultLlm when provider is "openai" but no key exists', () => {
    const null2 = new NullProvider();
    const client = buildClient({ provider: 'openai', apiKey: undefined }, {}, null2);
    expect(client.available).toBe(null2.available);
  });

  it('resolves to Ollama provider when provider is "ollama"', () => {
    const client = buildClient({ provider: 'ollama' });
    expect(client.available).toBe(true);
  });

  it('uses the config apiKey over the env key when both exist', () => {
    const client = buildClient(
      { provider: 'groq', apiKey: 'cfg_key' },
      { GROQ_API_KEY: 'env_key' },
    );
    expect(client.available).toBe(true);
  });

  it('uses the env key when the config apiKey is absent', () => {
    const client = buildClient(
      { provider: 'groq', apiKey: undefined },
      { GROQ_API_KEY: 'env_key' },
    );
    expect(client.available).toBe(true);
  });
});
