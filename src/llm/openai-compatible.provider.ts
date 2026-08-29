/**
 * Shared provider for OpenAI-compatible chat-completions APIs (OpenAI, Groq, and any future
 * compatible host). Subclasses supply the endpoint URL and any extra body fields.
 */
import type { LlmResult } from './llm-client.interface';
import { BaseLlmProvider } from './base.provider';

interface ChatCompletionsResponse {
  choices?: { message?: { content?: string } }[];
}

export abstract class OpenAiCompatibleProvider extends BaseLlmProvider {
  /** The chat-completions endpoint for this host. */
  protected abstract readonly endpointUrl: string;

  protected async request(system: string, user: string): Promise<LlmResult<string>> {
    const response = await this.postJson(
      this.endpointUrl,
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: this.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        temperature: 0,
        ...this.extraBodyFields(),
      },
    );
    if (!response.success) {
      return { success: false, error: response.error };
    }
    const text = (response.data as ChatCompletionsResponse)?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return { success: false, error: `empty ${this.providerName} response` };
    }
    return { success: true, data: text };
  }

  /** Provider label used in error messages. */
  protected abstract get providerName(): string;

  /** Host-specific body overrides (e.g. Groq's model fallback is handled by re-requesting). */
  protected extraBodyFields(): Record<string, unknown> {
    return {};
  }
}
