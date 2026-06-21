/**
 * Google Gemini provider (generateContent REST API).
 */
import type { LlmResult } from './llm-client.interface';
import { BaseLlmProvider } from './base.provider';

interface GeminiResponse {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
}

export class GeminiProvider extends BaseLlmProvider {
  protected async request(system: string, user: string): Promise<LlmResult<string>> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`;
    const response = await this.postJson(
      url,
      {},
      {
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: 'user', parts: [{ text: user }] }],
        generationConfig: { temperature: 0 },
      },
    );
    if (!response.success) {
      return { success: false, error: response.error };
    }
    const text = (response.data as GeminiResponse)?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string') {
      return { success: false, error: 'empty Gemini response' };
    }
    return { success: true, data: text };
  }
}
