/**
 * OpenAI provider (chat completions REST API).
 */
import type { LlmResult } from './llm-client.interface';
import { BaseLlmProvider } from './base.provider';

interface OpenAiResponse {
  choices?: { message?: { content?: string } }[];
}

export class OpenAIProvider extends BaseLlmProvider {
  protected async request(system: string, user: string): Promise<LlmResult<string>> {
    const response = await this.postJson(
      'https://api.openai.com/v1/chat/completions',
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
      },
    );
    if (!response.success) {
      return { success: false, error: response.error };
    }
    const text = (response.data as OpenAiResponse)?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return { success: false, error: 'empty OpenAI response' };
    }
    return { success: true, data: text };
  }
}
