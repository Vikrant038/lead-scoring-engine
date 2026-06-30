/**
 * Serper.dev Google Search service (Step 2).
 * Queries the Serper.dev REST API and formats organic search snippets
 * to serve as real-time context for LLM classifications.
 */
import type { Logger } from '../logger/logger';

export class SerperService {
  constructor(
    private readonly apiKey: string | undefined,
    private readonly logger: Logger,
  ) {}

  /** Perform a Google search and return a formatted markdown string of snippets. */
  async search(query: string): Promise<string> {
    if (!this.apiKey) {
      this.logger.debug({ query }, 'Serper API key not configured; skipping search');
      return '';
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
      const snippets = data.organic?.map((item) => `- ${item.title}: ${item.snippet}`).join('\n');
      return snippets || '';
    } catch (error) {
      this.logger.warn({ query, error: (error as Error).message }, 'Serper search failed');
      return '';
    }
  }
}
