/**
 * Local Ollama provider (chat API).
 */
import type { LlmResult } from './llm-client.interface';
import { BaseLlmProvider } from './base.provider';
import type { Logger } from '../lib/logger/logger';

interface OllamaResponse {
  message?: { content?: string };
}

export class OllamaProvider extends BaseLlmProvider {
  constructor(
    private readonly host: string,
    model: string,
    timeoutMs: number,
    logger: Logger,
  ) {
    // Ollama does not require an API key, so we pass an empty string
    super('', model, timeoutMs, logger);
  }

  protected async request(system: string, user: string): Promise<LlmResult<string>> {
    const url = `${this.host.replace(/\/$/, '')}/api/chat`;
    const systemLower = system.toLowerCase();
    const useJson =
      systemLower.includes('return only a json') || systemLower.includes('return only the json');

    const response = await this.postJson(
      url,
      {},
      {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        stream: false,
        format: useJson ? 'json' : undefined,
        options: {
          temperature: 0,
          num_predict: 1024,
        },
      },
    );
    if (!response.success) {
      return { success: false, error: response.error };
    }
    const text = (response.data as OllamaResponse)?.message?.content;
    if (typeof text !== 'string') {
      return { success: false, error: 'empty Ollama response' };
    }
    return { success: true, data: text };
  }
}
