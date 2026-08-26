/**
 * Serper.dev Google Search service (Step 2).
 * Queries the Serper.dev REST API and formats organic search snippets
 * to serve as real-time context for LLM classifications.
 */
import type { Logger } from '../logger/logger';

export class SerperService {
  private readonly cache = new Map<string, string>();
  private readonly maxCacheSize = 200;

  constructor(
    private readonly apiKey: string | undefined,
    private readonly logger: Logger,
  ) {}

  /** Perform a Google search and return a formatted markdown string of snippets. */
  async search(rawQuery: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.debug({ query: rawQuery }, 'Serper API key not configured; skipping search');
      return '';
    }

    // Sanitize query: strip control characters, trim, cap length
    const query = rawQuery
      .split('')
      .filter((c) => c.charCodeAt(0) >= 32 && c.charCodeAt(0) !== 127)
      .join('')
      .trim()
      .slice(0, 100);
    if (!query) {
      return '';
    }

    if (this.cache.has(query)) {
      return this.cache.get(query)!;
    }

    try {
      this.logger.debug({ query }, 'executing Serper Google search');
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ q: query, num: 4 }),
      });
      if (!response.ok) {
        throw new Error(`Serper API returned HTTP ${response.status}`);
      }
      const data = (await response.json()) as {
        organic?: { title: string; snippet: string }[];
      };
      const snippets =
        data.organic?.map((item) => `- ${item.title}: ${item.snippet}`).join('\n') || '';

      if (this.cache.size >= this.maxCacheSize) {
        const firstKey = this.cache.keys().next().value;
        if (firstKey) this.cache.delete(firstKey);
      }
      this.cache.set(query, snippets);
      return snippets;
    } catch (error) {
      this.logger.warn({ query, error: (error as Error).message }, 'Serper search failed');
      return '';
    }
  }
}
