/**
 * Groq provider (OpenAI-compatible chat completions REST API with model fallback).
 * Defaults to primary model 'openai/gpt-oss-20b' and falls back to 'openai/gpt-oss-120b'.
 */
import type { LlmResult } from './llm-client.interface';
import { OpenAiCompatibleProvider } from './openai-compatible.provider';
import type { Logger } from '../lib/logger/logger';

export const GROQ_DEFAULT_PRIMARY_MODEL = 'openai/gpt-oss-20b';
export const GROQ_DEFAULT_FALLBACK_MODEL = 'openai/gpt-oss-120b';

export class GroqProvider extends OpenAiCompatibleProvider {
  protected readonly endpointUrl = 'https://api.groq.com/openai/v1/chat/completions';
  protected get providerName(): string {
    return 'Groq';
  }

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

  protected async request(system: string, user: string): Promise<LlmResult<string>> {
    const primaryResult = await super.request(system, user);
    if (primaryResult.success) {
      return primaryResult;
    }

    this.logger.warn(
      { primaryModel: this.model, fallbackModel: this.fallbackModel, error: primaryResult.error },
      'Groq primary model failed; falling back to secondary model',
    );

    const originalModel = this.model;
    try {
      // Re-issue the same request against the fallback model.
      this.model = this.fallbackModel;
      const fallbackResult = await super.request(system, user);
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
    } finally {
      this.model = originalModel;
    }
  }
}
