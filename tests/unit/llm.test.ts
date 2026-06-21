/**
 * LLM provider tests. Native `fetch` (undici) is mocked directly: MSW v2 ships ESM-only internals
 * incompatible with the CommonJS ts-jest setup, and Nock does not intercept undici's fetch. Mocking
 * `global.fetch` is the reliable way to stub these REST calls deterministically.
 */
import { Writable } from 'node:stream';
import { createLogger } from '../../src/lib/logger/logger';
import { BaseLlmProvider } from '../../src/llm/base.provider';
import { GeminiProvider } from '../../src/llm/gemini.provider';
import { OpenAIProvider } from '../../src/llm/openai.provider';
import { NullProvider } from '../../src/llm/null.provider';
import { createLlmClient } from '../../src/llm/llm-client.factory';
import type { LlmResult } from '../../src/llm/llm-client.interface';

const logger = createLogger({ level: 'error' }, new Writable({ write: (_c, _e, cb) => cb() }));
const realFetch = global.fetch;

const fetchMock = (): jest.Mock => global.fetch as unknown as jest.Mock;
function mockJson(payload: unknown, ok = true, status = 200): void {
  fetchMock().mockResolvedValue({ ok, status, json: async () => payload });
}
function mockReject(message: string): void {
  fetchMock().mockRejectedValue(new Error(message));
}

const geminiPayload = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });
const openaiPayload = (content: string) => ({ choices: [{ message: { content } }] });

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});
afterAll(() => {
  global.fetch = realFetch;
});

function gemini(): GeminiProvider {
  return new GeminiProvider('test-key', 'gemini-1.5-flash', 5000, logger);
}
function openai(): OpenAIProvider {
  return new OpenAIProvider('test-key', 'gpt-4o-mini', 5000, logger);
}

describe('NullProvider', () => {
  it('should report unavailable and fail every call', async () => {
    const provider = new NullProvider();
    expect(provider.available).toBe(false);
    const calls = await Promise.all([
      provider.classifyUniversity('Harvard'),
      provider.classifyCompany('Google'),
      provider.generateProfiles({ count: 1 }),
      provider.generateExplanation({
        name: 'X',
        education: [],
        companies: [],
        skills: [],
        componentScores: { education: 0, experience: 0, thinking: 0, recencyBonus: 0 },
        finalScore: 0,
        bucket: 'NOT FIT',
        priority: 'Exclude',
      }),
      provider.generateEmail({
        name: 'X',
        education: '',
        company: '',
        role: '',
        skills: [],
        icpScore: 0,
        bucket: 'NOT FIT',
        tone: 'professional',
        senderName: 'Me',
        senderCompany: 'Us',
      }),
    ]);
    expect(calls.every((result) => result.success === false)).toBe(true);
  });
});

describe('createLlmClient factory', () => {
  it('should return NullProvider when AI is disabled or the key is missing', () => {
    expect(createLlmClient({ AI_PROVIDER: 'none' }, 5000, logger).available).toBe(false);
    expect(createLlmClient({ AI_PROVIDER: 'gemini' }, 5000, logger)).toBeInstanceOf(NullProvider);
  });

  it('should select the provider matching AI_PROVIDER + key', () => {
    const g = createLlmClient({ AI_PROVIDER: 'gemini', GEMINI_API_KEY: 'k' }, 5000, logger);
    const o = createLlmClient({ AI_PROVIDER: 'openai', OPENAI_API_KEY: 'k' }, 5000, logger);
    expect(g).toBeInstanceOf(GeminiProvider);
    expect(o).toBeInstanceOf(OpenAIProvider);
    expect(g.available).toBe(true);
  });

  it('should fall back to NullProvider when openai is selected without a key', () => {
    expect(createLlmClient({ AI_PROVIDER: 'openai' }, 5000, logger)).toBeInstanceOf(NullProvider);
  });

  it('should default AI_PROVIDER to none when unset', () => {
    expect(createLlmClient({}, 5000, logger).available).toBe(false);
  });
});

class FailingProvider extends BaseLlmProvider {
  protected request(): Promise<LlmResult<string>> {
    return Promise.resolve({ success: false }); // no error message -> exercises "no response" fallbacks
  }
}

describe('BaseLlmProvider failure fallbacks', () => {
  const provider = new FailingProvider('k', 'm', 5000, logger);

  it('should report failure with no error from every method', async () => {
    const results = await Promise.all([
      provider.classifyUniversity('X'),
      provider.generateExplanation({
        name: 'X',
        education: [],
        companies: [],
        skills: [],
        componentScores: { education: 0, experience: 0, thinking: 0, recencyBonus: 0 },
        finalScore: 0,
        bucket: 'NOT FIT',
        priority: '',
      }),
      provider.generateEmail({
        name: 'X',
        education: '',
        company: '',
        role: '',
        skills: [],
        icpScore: 0,
        bucket: 'NOT FIT',
        tone: 'pro',
        senderName: 'A',
        senderCompany: 'B',
      }),
      provider.generateProfiles({ count: 1 }),
    ]);
    expect(results.every((result) => result.success === false)).toBe(true);
  });
});

describe('GeminiProvider', () => {
  it('should classify a university tier from the response', async () => {
    mockJson(geminiPayload('This looks like tier_1.'));
    await expect(gemini().classifyUniversity('Harvard')).resolves.toEqual({
      success: true,
      data: 'tier_1',
    });
  });

  it('should default to "unknown" when no tier keyword is present', async () => {
    mockJson(geminiPayload('no idea'));
    const result = await gemini().classifyCompany('Obscure Co');
    expect(result.data).toBe('unknown');
  });

  it('should fail gracefully on a network error', async () => {
    mockReject('ECONNRESET');
    await expect(gemini().classifyUniversity('X')).resolves.toMatchObject({ success: false });
  });

  it('should fail on an empty response body', async () => {
    mockJson({ candidates: [] });
    await expect(gemini().classifyUniversity('X')).resolves.toMatchObject({ success: false });
  });
});

describe('OpenAIProvider', () => {
  it('should parse an email JSON object (incl. code fences)', async () => {
    mockJson(openaiPayload('```json\n{"subject":"Hi","body":"Hello"}\n```'));
    await expect(
      openai().generateEmail({
        name: 'Jane',
        education: 'MBA',
        company: 'Acme',
        role: 'CTO',
        skills: ['AI'],
        icpScore: 90,
        bucket: 'HIGH',
        tone: 'warm',
        senderName: 'Me',
        senderCompany: 'Us',
      }),
    ).resolves.toEqual({ success: true, data: { subject: 'Hi', body: 'Hello' } });
  });

  it('should fail when the email response is not valid JSON', async () => {
    mockJson(openaiPayload('sorry, no JSON here'));
    const result = await openai().generateEmail({
      name: 'Jane',
      education: 'MBA',
      company: 'Acme',
      role: 'CTO',
      skills: [],
      icpScore: 50,
      bucket: 'LOW',
      tone: 'light',
      senderName: 'Me',
      senderCompany: 'Us',
    });
    expect(result.success).toBe(false);
  });

  it('should fail on a non-2xx status', async () => {
    mockJson(null, false, 500);
    await expect(openai().classifyCompany('Google')).resolves.toMatchObject({ success: false });
  });

  it('should fail on an empty completion and propagate request failures', async () => {
    mockJson(openaiPayload(undefined as unknown as string));
    await expect(openai().classifyUniversity('X')).resolves.toMatchObject({ success: false });

    mockReject('timeout');
    await expect(
      openai().generateExplanation({
        name: 'X',
        education: [],
        companies: [],
        skills: [],
        componentScores: { education: 0, experience: 0, thinking: 0, recencyBonus: 0 },
        finalScore: 0,
        bucket: 'NOT FIT',
        priority: 'Exclude',
      }),
    ).resolves.toMatchObject({ success: false });

    mockReject('timeout');
    await expect(openai().generateProfiles({ count: 1 })).resolves.toMatchObject({
      success: false,
    });
  });

  it('should generate profiles and drop invalid ones (FR-15-003)', async () => {
    const payload = JSON.stringify([
      { name: 'Asha', education: ['MBA @ IIM'], jobs: ['VP @ Razorpay'], skills: ['AI'] },
      { education: ['no name'] },
    ]);
    mockJson(openaiPayload(payload));
    const result = await openai().generateProfiles({ count: 2, personaDescription: 'Ideal CTO' });
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
  });

  it('should fail when the profiles response is not an array', async () => {
    mockJson(openaiPayload('{"not":"an array"}'));
    await expect(openai().generateProfiles({ count: 2 })).resolves.toMatchObject({
      success: false,
    });
  });

  it('should generate a trimmed explanation string', async () => {
    mockJson(openaiPayload('  A strong lead with elite background.  '));
    const result = await openai().generateExplanation({
      name: 'Jane',
      education: ['MBA @ Harvard'],
      companies: ['Google'],
      skills: ['AI'],
      componentScores: { education: 100, experience: 80, thinking: 90, recencyBonus: 5 },
      finalScore: 93,
      bucket: 'HIGH',
      priority: 'Immediate Outreach',
    });
    expect(result).toEqual({ success: true, data: 'A strong lead with elite background.' });
  });
});
