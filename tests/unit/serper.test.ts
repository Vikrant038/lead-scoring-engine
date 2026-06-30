import { SerperService } from '../../src/lib/search/serper';
import { silentLogger } from '../helpers/test-deps';

describe('SerperService', () => {
  let mockFetch: jest.Mock;

  beforeEach(() => {
    mockFetch = jest.fn();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should skip search and return empty string if apiKey is missing', async () => {
    const service = new SerperService(undefined, silentLogger);
    const result = await service.search('Google');
    expect(result).toBe('');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('should perform search and return formatted snippets on success', async () => {
    const service = new SerperService('test-key', silentLogger);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        organic: [
          { title: 'Google', snippet: 'Search engine.' },
          { title: 'Alphabet', snippet: 'Parent company.' },
        ],
      }),
    });

    const result = await service.search('Google');
    expect(result).toBe('- Google: Search engine.\n- Alphabet: Parent company.');
    expect(mockFetch).toHaveBeenCalledWith(
      'https://google.serper.dev/search',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'X-API-KEY': 'test-key',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: 'Google', num: 4 }),
      }),
    );
  });

  it('should return empty string if organic search results are missing', async () => {
    const service = new SerperService('test-key', silentLogger);
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({}),
    });

    const result = await service.search('Google');
    expect(result).toBe('');
  });

  it('should return empty string on HTTP failure', async () => {
    const service = new SerperService('test-key', silentLogger);
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 403,
    });

    const result = await service.search('Google');
    expect(result).toBe('');
  });

  it('should return empty string on network exception', async () => {
    const service = new SerperService('test-key', silentLogger);
    mockFetch.mockRejectedValueOnce(new Error('network error'));

    const result = await service.search('Google');
    expect(result).toBe('');
  });
});
