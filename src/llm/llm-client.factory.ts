/**
 * LLM client factory (§2.5). Selects a provider from `AI_PROVIDER` + the matching API key;
 * falls back to the NullProvider (rule-based degradation) when AI is disabled or unconfigured.
 */
import type { Logger } from '../lib/logger/logger';
import { GeminiProvider } from './gemini.provider';
import type { LLMClient } from './llm-client.interface';
import { NullProvider } from './null.provider';
import { OpenAIProvider } from './openai.provider';
import { YoucomProvider } from './you.provider';
import { OllamaProvider } from './ollama.provider';

const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
} as const;

export interface LlmEnv {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  YOUCOM_API_KEY?: string;
  OLLAMA_HOST?: string;
  OLLAMA_MODEL?: string;
}

export function createLlmClient(env: LlmEnv, timeoutMs: number, logger: Logger): LLMClient {
  const provider = (env.AI_PROVIDER ?? 'none').toLowerCase();
  const ollamaHost = env.OLLAMA_HOST ?? 'http://localhost:11434';
  const ollamaModel = env.OLLAMA_MODEL ?? 'gemma2:2b';

  // 1. Explicitly configured provider (if key is present, or for ollama which has no key)
  if (provider === 'ollama') {
    logger.info({ host: ollamaHost, model: ollamaModel }, 'using local Ollama LLM provider');
    return new OllamaProvider(ollamaHost, ollamaModel, timeoutMs, logger);
  }

  if (provider === 'gemini' && env.GEMINI_API_KEY) {
    logger.info('using Gemini LLM provider');
    return new GeminiProvider(env.GEMINI_API_KEY, DEFAULT_MODELS.gemini, timeoutMs, logger);
  }

  if (provider === 'openai' && env.OPENAI_API_KEY) {
    logger.info('using OpenAI LLM provider');
    return new OpenAIProvider(env.OPENAI_API_KEY, DEFAULT_MODELS.openai, timeoutMs, logger);
  }

  if (provider === 'youcom' && env.YOUCOM_API_KEY) {
    logger.info('using You.com Research LLM provider');
    return new YoucomProvider(env.YOUCOM_API_KEY, timeoutMs, logger);
  }

  // 2. Fallback / Auto-detection: If the requested provider is 'none' or missing its key,
  // but we have other keys configured, auto-detect and use the available provider.
  if (env.YOUCOM_API_KEY) {
    logger.info('falling back to You.com Research LLM provider (auto-detected key)');
    return new YoucomProvider(env.YOUCOM_API_KEY, timeoutMs, logger);
  }

  if (env.GEMINI_API_KEY) {
    logger.info('falling back to Gemini LLM provider (auto-detected key)');
    return new GeminiProvider(env.GEMINI_API_KEY, DEFAULT_MODELS.gemini, timeoutMs, logger);
  }

  if (env.OPENAI_API_KEY) {
    logger.info('falling back to OpenAI LLM provider (auto-detected key)');
    return new OpenAIProvider(env.OPENAI_API_KEY, DEFAULT_MODELS.openai, timeoutMs, logger);
  }

  logger.info('no AI provider configured; using rule-based fallback');
  return new NullProvider();
}
