/**
 * Groq provider (OpenAI-compatible chat completions REST API with model fallback).
 * Defaults to primary model 'openai/gpt-oss-20b' and falls back to 'openai/gpt-oss-120b'.
 */
import type { LlmResult } from './llm-client.interface';
import { BaseLlmProvider } from './base.provider';
import type { Logger } from '../lib/logger/logger';

interface GroqResponse {
  choices?: { message?: { content?: string } }[];
}

export const GROQ_DEFAULT_PRIMARY_MODEL = 'openai/gpt-oss-20b';
export const GROQ_DEFAULT_FALLBACK_MODEL = 'openai/gpt-oss-120b';

export class GroqProvider extends BaseLlmProvider {
  constructor(
    apiKey: string,
    model: string = GROQ_DEFAULT_PRIMARY_MODEL,
    private readonly fallbackModel: string = GROQ_DEFAULT_FALLBACK_MODEL,
    timeoutMs: number = 15000,
    logger: Logger,
  ) {
    super(apiKey, model, timeoutMs, logger);
  }

  getPrimaryModel(): string {
    return this.model;
  }

  getFallbackModel(): string {
    return this.fallbackModel;
  }

  private async executeModelRequest(
    modelName: string,
    system: string,
    user: string,
  ): Promise<LlmResult<string>> {
    const response = await this.postJson(
      'https://api.groq.com/openai/v1/chat/completions',
      { Authorization: `Bearer ${this.apiKey}` },
      {
        model: modelName,
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
    const text = (response.data as GroqResponse)?.choices?.[0]?.message?.content;
    if (typeof text !== 'string') {
      return { success: false, error: 'empty Groq response' };
    }
    return { success: true, data: text };
  }

  protected async request(system: string, user: string): Promise<LlmResult<string>> {
    const primaryResult = await this.executeModelRequest(this.model, system, user);
    if (primaryResult.success) {
      return primaryResult;
    }

    this.logger.warn(
      { primaryModel: this.model, fallbackModel: this.fallbackModel, error: primaryResult.error },
      'Groq primary model failed; falling back to secondary model',
    );

    const fallbackResult = await this.executeModelRequest(this.fallbackModel, system, user);
    if (fallbackResult.success) {
      return fallbackResult;
    }

    this.logger.error(
      { primaryError: primaryResult.error, fallbackError: fallbackResult.error },
      'Groq primary and fallback models both failed',
    );

    return {
      success: false,
      error: `Groq error: primary (${primaryResult.error}); fallback (${fallbackResult.error})`,
    };
  }
}
