/**
 * LLM client factory (§2.5). Selects a provider from config (or env) + the matching API key;
 * falls back to the NullProvider (rule-based degradation) when AI is disabled or unconfigured.
 * `createLlmClient` is used by the CLI; `DynamicLlmClient` wraps it so the web app can re-select
 * the provider on every request from the mutable Config Editor settings.
 */
import type { AppConfig } from '../config/config';
import type { Logger } from '../lib/logger/logger';
import { GeminiProvider } from './gemini.provider';
import {
  GroqProvider,
  GROQ_DEFAULT_PRIMARY_MODEL,
  GROQ_DEFAULT_FALLBACK_MODEL,
} from './groq.provider';
import type { LLMClient } from './llm-client.interface';
import { NullProvider } from './null.provider';
import { OpenAIProvider } from './openai.provider';
import { YoucomProvider } from './you.provider';
import { OllamaProvider } from './ollama.provider';

const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
  groq: GROQ_DEFAULT_PRIMARY_MODEL,
} as const;

const DEFAULT_OLLAMA = { host: 'http://localhost:11434', model: 'gemma2:2b' } as const;

export interface LlmEnv {
  AI_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
  GROQ_FALLBACK_MODEL?: string;
  YOUCOM_API_KEY?: string;
  OLLAMA_HOST?: string;
  OLLAMA_MODEL?: string;
}

/** Build the concrete provider for an explicitly-selected, fully-configured provider. */
function buildProvider(
  provider: string,
  key: string | undefined,
  timeoutMs: number,
  env: LlmEnv,
  logger: Logger,
): LLMClient | undefined {
  switch (provider) {
    case 'groq':
      if (!key) return undefined;
      return new GroqProvider(
        key,
        env.GROQ_MODEL ?? GROQ_DEFAULT_PRIMARY_MODEL,
        env.GROQ_FALLBACK_MODEL ?? GROQ_DEFAULT_FALLBACK_MODEL,
        timeoutMs,
        logger,
      );
    case 'gemini':
      return key ? new GeminiProvider(key, DEFAULT_MODELS.gemini, timeoutMs, logger) : undefined;
    case 'openai':
      return key ? new OpenAIProvider(key, DEFAULT_MODELS.openai, timeoutMs, logger) : undefined;
    case 'youcom':
      return key ? new YoucomProvider(key, timeoutMs, logger) : undefined;
    case 'ollama':
      return new OllamaProvider(
        env.OLLAMA_HOST ?? DEFAULT_OLLAMA.host,
        env.OLLAMA_MODEL ?? DEFAULT_OLLAMA.model,
        timeoutMs,
        logger,
      );
    default:
      return undefined;
  }
}

/** Env-only auto-detect order used when no explicit provider is configured. */
const AUTO_DETECT_ORDER = [
  { provider: 'groq', key: (env: LlmEnv) => env.GROQ_API_KEY },
  { provider: 'youcom', key: (env: LlmEnv) => env.YOUCOM_API_KEY },
  { provider: 'gemini', key: (env: LlmEnv) => env.GEMINI_API_KEY },
  { provider: 'openai', key: (env: LlmEnv) => env.OPENAI_API_KEY },
] as const;

function selectClient(
  requested: string,
  apiKey: string | undefined,
  timeoutMs: number,
  env: LlmEnv,
  logger: Logger,
  fallback: LLMClient,
): LLMClient {
  // 1. Explicitly configured provider (if key is present, or for ollama which has no key)
  const explicit = buildProvider(requested, apiKey, timeoutMs, env, logger);
  if (explicit) {
    logger.info({ provider: requested }, 'using configured LLM provider');
    return explicit;
  }

  // 2. Auto-detection: requested provider is 'none' or missing its key, but other keys exist
  for (const { provider, key } of AUTO_DETECT_ORDER) {
    const providerKey = key(env);
    const detected = buildProvider(provider, providerKey, timeoutMs, env, logger);
    if (detected) {
      logger.info({ provider }, 'falling back to auto-detected LLM provider');
      return detected;
    }
  }

  logger.info('no AI provider configured; using rule-based fallback');
  return fallback;
}

/** CLI-side factory: reads provider + key from env only. */
export function createLlmClient(env: LlmEnv, timeoutMs: number, logger: Logger): LLMClient {
  const provider = (env.AI_PROVIDER ?? 'none').toLowerCase();
  const envKeyFor: Record<string, keyof LlmEnv> = {
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    youcom: 'YOUCOM_API_KEY',
  };
  return selectClient(
    provider,
    env[envKeyFor[provider] ?? ''],
    timeoutMs,
    env,
    logger,
    new NullProvider(),
  );
}

/** Web-side factory: reads provider + key from the mutable config, env as fallback. */
export function createDynamicLlmClient(
  config: AppConfig,
  env: LlmEnv,
  logger: Logger,
  fallback: LLMClient,
): LLMClient {
  const provider = (config.llm?.provider ?? 'none').toLowerCase();
  const envKeyFor: Record<string, keyof LlmEnv> = {
    groq: 'GROQ_API_KEY',
    gemini: 'GEMINI_API_KEY',
    openai: 'OPENAI_API_KEY',
    youcom: 'YOUCOM_API_KEY',
  };
  return selectClient(
    provider,
    config.llm?.apiKey || env[envKeyFor[provider] ?? ''],
    config.llm?.timeout ?? 15000,
    env,
    logger,
    fallback,
  );
}
