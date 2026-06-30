import { YoucomProvider } from '../../src/llm/you.provider';
import { silentLogger } from '../helpers/test-deps';

describe('YoucomProvider', () => {
  let provider: YoucomProvider;
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
    provider = new YoucomProvider('test-key', 5000, silentLogger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('classifyUniversity', () => {
    it('should return the tier on a successful structured response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: JSON.stringify({ tier: 'tier_1' }),
          },
        }),
      });

      const result = await provider.classifyUniversity('Stanford University');
      expect(result.success).toBe(true);
      expect(result.data).toBe('tier_1');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.you.com/v1/research',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"research_effort":"lite"'),
        }),
      );
    });

    it('should handle searchContext if passed', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: JSON.stringify({ tier: 'tier_2' }),
          },
        }),
      });

      const result = await provider.classifyUniversity(
        'Stanford University',
        'Some search context',
      );
      expect(result.success).toBe(true);
      expect(result.data).toBe('tier_2');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.you.com/v1/research',
        expect.objectContaining({
          body: expect.stringContaining('Some search context'),
        }),
      );
    });

    it('should return failure if response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: 'not json',
          },
        }),
      });

      const result = await provider.classifyUniversity('Stanford University');
      expect(result.success).toBe(false);
      expect(result.error).toContain('failed to parse JSON');
    });
  });

  describe('classifyCompany', () => {
    it('should return the tier on a successful structured response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: JSON.stringify({ tier: 'tier_2' }),
          },
        }),
      });

      const result = await provider.classifyCompany('Stripe');
      expect(result.success).toBe(true);
      expect(result.data).toBe('tier_2');
    });

    it('should return failure if response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: 'not json',
          },
        }),
      });

      const result = await provider.classifyCompany('Stripe');
      expect(result.success).toBe(false);
      expect(result.error).toContain('failed to parse JSON');
    });
  });

  describe('generateExplanation', () => {
    it('should return the text explanation', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: 'This is an explanation.',
          },
        }),
      });

      const result = await provider.generateExplanation({
        name: 'Jane Doe',
        education: [],
        companies: [],
        skills: [],
        componentScores: { education: 90, experience: 80, thinking: 70 },
        finalScore: 80,
        bucket: 'HIGH',
        priority: 'P1',
      });
      expect(result.success).toBe(true);
      expect(result.data).toBe('This is an explanation.');
      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.you.com/v1/research',
        expect.objectContaining({
          body: expect.stringContaining('"research_effort":"deep"'),
        }),
      );
    });
  });

  describe('generateEmail', () => {
    it('should return subject and body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: JSON.stringify({ subject: 'Hello', body: 'This is the email body.' }),
          },
        }),
      });

      const result = await provider.generateEmail({
        name: 'Jane Doe',
        education: 'Stanford',
        company: 'Google',
        role: 'Engineer',
        skills: [],
        icpScore: 90,
        bucket: 'HIGH',
        tone: 'professional',
        senderName: 'Alice',
        senderCompany: 'Acme',
      });
      expect(result.success).toBe(true);
      expect(result.data).toEqual({
        subject: 'Hello',
        body: 'This is the email body.',
      });
    });

    it('should return failure if response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: 'not json',
          },
        }),
      });

      const result = await provider.generateEmail({
        name: 'Jane Doe',
        education: 'Stanford',
        company: 'Google',
        role: 'Engineer',
        skills: [],
        icpScore: 90,
        bucket: 'HIGH',
        tone: 'professional',
        senderName: 'Alice',
        senderCompany: 'Acme',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('failed to parse JSON');
    });

    it('should handle API HTTP failure', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await provider.generateEmail({
        name: 'Jane Doe',
        education: 'Stanford',
        company: 'Google',
        role: 'Engineer',
        skills: [],
        icpScore: 90,
        bucket: 'HIGH',
        tone: 'professional',
        senderName: 'Alice',
        senderCompany: 'Acme',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });

    it('should handle fetch exception', async () => {
      mockFetch.mockRejectedValueOnce(new Error('network error'));

      const result = await provider.generateEmail({
        name: 'Jane Doe',
        education: 'Stanford',
        company: 'Google',
        role: 'Engineer',
        skills: [],
        icpScore: 90,
        bucket: 'HIGH',
        tone: 'professional',
        senderName: 'Alice',
        senderCompany: 'Acme',
      });
      expect(result.success).toBe(false);
      expect(result.error).toBe('network error');
    });

    it('should handle missing output content', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({}),
      });

      const result = await provider.generateEmail({
        name: 'Jane Doe',
        education: 'Stanford',
        company: 'Google',
        role: 'Engineer',
        skills: [],
        icpScore: 90,
        bucket: 'HIGH',
        tone: 'professional',
        senderName: 'Alice',
        senderCompany: 'Acme',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('empty response');
    });
  });

  describe('generateProfiles', () => {
    it('should parse and return validated profiles', async () => {
      const validProfile = {
        name: 'John Doe',
        education: ['BS @ MIT'],
        jobs: ['Engineer @ Apple'],
        skills: ['Swift'],
        company_details: { name: 'Apple', category: 'tech' },
      };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: JSON.stringify({ profiles: [validProfile] }),
          },
        }),
      });

      const result = await provider.generateProfiles({ count: 1, personaDescription: 'Developer' });
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      expect(result.data?.[0].name).toBe('John Doe');
    });

    it('should return failure if response is not valid JSON', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          output: {
            content: 'not json',
          },
        }),
      });

      const result = await provider.generateProfiles({ count: 1 });
      expect(result.success).toBe(false);
      expect(result.error).toContain('failed to parse JSON');
    });
  });
});
