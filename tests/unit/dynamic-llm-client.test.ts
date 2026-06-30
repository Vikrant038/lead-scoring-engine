/**
 * Unit tests for DynamicLlmClient (Phase 1).
 * Tests the provider-selection logic without real API calls.
 */
import { DynamicLlmClient } from '../../src/llm/dynamic-llm.client';
import { NullProvider } from '../../src/llm/null.provider';
import { ConfigService } from '../../src/config/config.service';
import { defaultConfig } from '../../src/config/config';
import { silentLogger } from '../helpers/test-deps';
import type { LLMClient } from '../../src/llm/llm-client.interface';

function buildClient(
  configOverrides: Record<string, unknown> = {},
  env: Record<string, string | undefined> = {},
  fallback?: LLMClient,
): DynamicLlmClient {
  const config = {
    ...defaultConfig,
    llm: { ...defaultConfig.llm, ...configOverrides },
  };
  return new DynamicLlmClient(
    new ConfigService(config),
    env as Record<string, string>,
    silentLogger,
    fallback ?? new NullProvider(),
  );
}

describe('DynamicLlmClient', () => {
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

  it('delegates classifyUniversity to the inner client', async () => {
    const client = buildClient();
    const result = await client.classifyUniversity('MIT');
    expect(result).toHaveProperty('success');
  });

  it('delegates classifyCompany to the inner client', async () => {
    const client = buildClient();
    const result = await client.classifyCompany('Stripe');
    expect(result).toHaveProperty('success');
  });

  it('delegates generateExplanation to the inner client', async () => {
    const client = buildClient();
    const result = await client.generateExplanation({
      profile: { name: 'Test', education: [], jobs: [] },
      scores: {
        education_score: 50,
        experience_score: 50,
        thinking_quality_score: 50,
        icp_score: 50,
        recency_bonus: 0,
      },
      bucket: 'MEDIUM',
    });
    expect(result).toHaveProperty('success');
  });

  it('delegates generateEmail to the inner client', async () => {
    const client = buildClient();
    const result = await client.generateEmail({
      profile: { name: 'Test', education: [], jobs: [] },
      score: 60,
      bucket: 'MEDIUM',
      senderName: 'A',
      company: 'B',
      tone: 'professional',
    });
    expect(result).toHaveProperty('success');
  });

  it('delegates generateProfiles to the inner client', async () => {
    const client = buildClient();
    const result = await client.generateProfiles({ count: 2, persona: 'cto' });
    expect(result).toHaveProperty('success');
  });
});
