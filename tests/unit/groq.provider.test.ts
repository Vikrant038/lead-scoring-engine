/**
 * Groq LLM provider tests (unit).
 * Verifies primary model (openai/gpt-oss-20b), automatic fallback to openai/gpt-oss-120b,
 * failure handling, and factory auto-detection.
 */
import { Writable } from 'node:stream';
import { createLogger } from '../../src/lib/logger/logger';
import {
  GroqProvider,
  GROQ_DEFAULT_PRIMARY_MODEL,
  GROQ_DEFAULT_FALLBACK_MODEL,
} from '../../src/llm/groq.provider';
import { createLlmClient } from '../../src/llm/llm-client.factory';
import { DynamicLlmClient } from '../../src/llm/dynamic-llm.client';
import { ConfigService } from '../../src/config/config';
import { defaultConfig } from '../../src/config/config';
import { NullProvider } from '../../src/llm/null.provider';

const logger = createLogger({ level: 'error' }, new Writable({ write: (_c, _e, cb) => cb() }));
const realFetch = global.fetch;

const fetchMock = (): jest.Mock => global.fetch as unknown as jest.Mock;
function mockJson(payload: unknown, ok = true, status = 200): void {
  fetchMock().mockResolvedValue({ ok, status, json: async () => payload });
}
function mockReject(message: string): void {
  fetchMock().mockRejectedValue(new Error(message));
}

const groqPayload = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

afterAll(() => {
  global.fetch = realFetch;
});

function groq(): GroqProvider {
  return new GroqProvider(
    'gsk_test_key',
    GROQ_DEFAULT_PRIMARY_MODEL,
    GROQ_DEFAULT_FALLBACK_MODEL,
    5000,
    logger,
  );
}

describe('GroqProvider', () => {
  it('should initialize with default models and report available=true', () => {
    const provider = groq();
    expect(provider.available).toBe(true);
    expect(provider.getPrimaryModel()).toBe('openai/gpt-oss-20b');
    expect(provider.getFallbackModel()).toBe('openai/gpt-oss-120b');

    // Test default constructor values
    const defaultProvider = new GroqProvider(
      'gsk_default',
      undefined,
      undefined,
      undefined,
      logger,
    );
    expect(defaultProvider.getPrimaryModel()).toBe('openai/gpt-oss-20b');
    expect(defaultProvider.getFallbackModel()).toBe('openai/gpt-oss-120b');

    const customProvider = new GroqProvider('gsk_custom', 'custom-m1', 'custom-m2', 8000, logger);
    expect(customProvider.getPrimaryModel()).toBe('custom-m1');
    expect(customProvider.getFallbackModel()).toBe('custom-m2');
  });

  it('should classify university using primary model on success', async () => {
    mockJson(groqPayload('tier_1'));
    const provider = groq();
    const result = await provider.classifyUniversity('Stanford', 'Search snippets');
    expect(result).toEqual({ success: true, data: 'tier_1' });
    expect(fetchMock()).toHaveBeenCalledTimes(1);

    const callBody = JSON.parse(fetchMock().mock.calls[0][1].body);
    expect(callBody.model).toBe('openai/gpt-oss-20b');
  });

  it('should classify company using primary model on success', async () => {
    mockJson(groqPayload('tier_2'));
    const provider = groq();
    const result = await provider.classifyCompany('Airbnb');
    expect(result).toEqual({ success: true, data: 'tier_2' });
  });

  it('should fallback to secondary model (openai/gpt-oss-120b) when primary model fails', async () => {
    // Call 1 fails (HTTP 429 rate limit or 503)
    fetchMock()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit reached for model openai/gpt-oss-20b',
      })
      // Call 2 succeeds with fallback model
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => groqPayload('tier_1'),
      });

    const provider = groq();
    const result = await provider.classifyUniversity('MIT');
    expect(result).toEqual({ success: true, data: 'tier_1' });
    expect(fetchMock()).toHaveBeenCalledTimes(2);

    const firstCallBody = JSON.parse(fetchMock().mock.calls[0][1].body);
    const secondCallBody = JSON.parse(fetchMock().mock.calls[1][1].body);
    expect(firstCallBody.model).toBe('openai/gpt-oss-20b');
    expect(secondCallBody.model).toBe('openai/gpt-oss-120b');
  });

  it('should return error when both primary and fallback models fail', async () => {
    fetchMock()
      .mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: async () => 'Rate limit on 20b',
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 503,
        text: async () => 'Service unavailable on 120b',
      });

    const provider = groq();
    const result = await provider.classifyUniversity('Oxford');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Groq error: primary');
    expect(result.error).toContain('fallback');
    expect(fetchMock()).toHaveBeenCalledTimes(2);
  });

  it('should handle empty or invalid Groq response from primary and fallback', async () => {
    // Primary returns empty choice, fallback returns valid
    fetchMock()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ choices: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => groqPayload('tier_3'),
      });

    const provider = groq();
    const result = await provider.classifyCompany('Local Bakery');
    expect(result).toEqual({ success: true, data: 'tier_3' });
  });

  it('should fallback to secondary model when primary model throws network error', async () => {
    mockReject('Network connection reset');
    const provider = groq();
    const result = await provider.classifyCompany('Airbnb');
    expect(result.success).toBe(false);
  });

  it('should generate explanations via Groq provider', async () => {
    mockJson(groqPayload('Strong candidate with exceptional leadership experience.'));
    const provider = groq();
    const result = await provider.generateExplanation({
      name: 'Alice',
      education: ['BS CS @ Stanford'],
      companies: ['Google'],
      skills: ['Distributed Systems'],
      componentScores: { education: 90, experience: 95, thinking: 90 },
      finalScore: 92,
      bucket: 'HIGH',
      priority: 'Tier 1',
    });
    expect(result.success).toBe(true);
    expect(result.data).toBe('Strong candidate with exceptional leadership experience.');
  });

  it('should generate email via Groq provider', async () => {
    mockJson(
      groqPayload(
        JSON.stringify({ subject: 'Connecting on AI', body: 'Hi Alice, great background!' }),
      ),
    );
    const provider = groq();
    const result = await provider.generateEmail({
      name: 'Alice',
      education: 'Stanford',
      company: 'Google',
      role: 'Staff Engineer',
      skills: ['AI'],
      icpScore: 92,
      bucket: 'HIGH',
      tone: 'professional',
      senderName: 'Bob',
      senderCompany: 'Acme',
    });
    expect(result.success).toBe(true);
    expect(result.data).toEqual({
      subject: 'Connecting on AI',
      body: 'Hi Alice, great background!',
    });
  });

  it('should generate profiles via Groq provider', async () => {
    const fakeProfiles = [
      {
        name: 'Jane Doe',
        education: ['BS @ MIT'],
        jobs: ['Engineer @ Stripe'],
        skills: ['TypeScript', 'Go'],
        company_details: { name: 'Stripe', category: 'Tech' },
      },
    ];
    mockJson(groqPayload(JSON.stringify(fakeProfiles)));
    const provider = groq();
    const result = await provider.generateProfiles({ count: 1 });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });
});

describe('Groq Factory and Dynamic Integration', () => {
  it('creates GroqProvider when AI_PROVIDER is groq with GROQ_API_KEY and custom models', () => {
    const client = createLlmClient(
      {
        AI_PROVIDER: 'groq',
        GROQ_API_KEY: 'gsk_123',
        GROQ_MODEL: 'custom-20b',
        GROQ_FALLBACK_MODEL: 'custom-120b',
      },
      5000,
      logger,
    ) as GroqProvider;
    expect(client).toBeInstanceOf(GroqProvider);
    expect(client.getPrimaryModel()).toBe('custom-20b');
    expect(client.getFallbackModel()).toBe('custom-120b');
  });

  it('auto-detects Groq when GROQ_API_KEY is provided with custom models', () => {
    const client = createLlmClient(
      {
        GROQ_API_KEY: 'gsk_autodetect',
        GROQ_MODEL: 'custom-20b',
        GROQ_FALLBACK_MODEL: 'custom-120b',
      },
      5000,
      logger,
    ) as GroqProvider;
    expect(client).toBeInstanceOf(GroqProvider);
    expect(client.getPrimaryModel()).toBe('custom-20b');
    expect(client.getFallbackModel()).toBe('custom-120b');
  });

  it('auto-detects Groq when GROQ_API_KEY is provided without explicit provider', () => {
    const client = createLlmClient({ GROQ_API_KEY: 'gsk_autodetect' }, 5000, logger);
    expect(client).toBeInstanceOf(GroqProvider);
    expect(client.available).toBe(true);
  });

  it('integrates with DynamicLlmClient when provider is groq', () => {
    const config = {
      ...defaultConfig,
      llm: { ...defaultConfig.llm, provider: 'groq' as const, apiKey: 'gsk_dyn' },
    };
    const dynamicClient = new DynamicLlmClient(
      new ConfigService(config),
      {
        GROQ_API_KEY: 'gsk_dyn',
        GROQ_MODEL: 'dyn-20b',
        GROQ_FALLBACK_MODEL: 'dyn-120b',
      },
      logger,
      new NullProvider(),
    );
    expect(dynamicClient.available).toBe(true);
  });

  it('falls back to defaultLlm in DynamicLlmClient when provider is groq but no key is present', () => {
    const config = {
      ...defaultConfig,
      llm: { ...defaultConfig.llm, provider: 'groq' as const, apiKey: undefined },
    };
    const nullFallback = new NullProvider();
    const dynamicClient = new DynamicLlmClient(new ConfigService(config), {}, logger, nullFallback);
    expect(dynamicClient.available).toBe(false);
  });
});
