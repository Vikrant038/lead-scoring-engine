/**
 * LLM client factory (§2.5). Selects a provider from `AI_PROVIDER` + the matching API key;
 * falls back to the NullProvider (rule-based degradation) when AI is disabled or unconfigured.
 */
import type { Logger } from '../lib/logger/logger';
import { GeminiProvider } from './gemini.provider';
import type { LLMClient } from './llm-client.interface';
import { NullProvider } from './null.provider';
import { OpenAIProvider } from './openai.provider';

const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
} as const;

export interface LlmEnv {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
}

export function createLlmClient(env: LlmEnv, timeoutMs: number, logger: Logger): LLMClient {
  const provider = (env.AI_PROVIDER ?? 'none').toLowerCase();

  if (provider === 'gemini' && env.GEMINI_API_KEY) {
    logger.info('using Gemini LLM provider');
    return new GeminiProvider(env.GEMINI_API_KEY, DEFAULT_MODELS.gemini, timeoutMs, logger);
  }

  if (provider === 'openai' && env.OPENAI_API_KEY) {
    logger.info('using OpenAI LLM provider');
    return new OpenAIProvider(env.OPENAI_API_KEY, DEFAULT_MODELS.openai, timeoutMs, logger);
  }

  logger.info('no AI provider configured; using rule-based fallback');
  return new NullProvider();
}
