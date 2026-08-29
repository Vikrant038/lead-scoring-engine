import type { Profile } from '../domain/types';
import type { OutreachEmail } from '../domain/types';
import type { Tier } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import { ConfigService } from '../config/config.service';
import { GeminiProvider } from './gemini.provider';
import {
  GroqProvider,
  GROQ_DEFAULT_PRIMARY_MODEL,
  GROQ_DEFAULT_FALLBACK_MODEL,
} from './groq.provider';
import { OpenAIProvider } from './openai.provider';
import { OllamaProvider } from './ollama.provider';

import type {
  LLMClient,
  LlmResult,
  ExplanationInput,
  EmailInput,
  GenerateProfilesInput,
} from './llm-client.interface';
import type { LlmEnv } from './llm-client.factory';

const DEFAULT_MODELS = {
  gemini: 'gemini-1.5-flash',
  openai: 'gpt-4o-mini',
  groq: GROQ_DEFAULT_PRIMARY_MODEL,
} as const;

export class DynamicLlmClient implements LLMClient {
  constructor(
    private readonly configService: ConfigService,
    private readonly env: LlmEnv,
    private readonly logger: Logger,
    private readonly defaultLlm: LLMClient,
  ) {}

  private getClient(): LLMClient {
    const config = this.configService.get();
    const provider = (config.llm?.provider ?? 'none').toLowerCase();
    const timeoutMs = config.llm?.timeout ?? 15000;
    const apiKey = config.llm?.apiKey;

    if (provider === 'groq') {
      const key = apiKey || this.env.GROQ_API_KEY;
      /* istanbul ignore next -- requires real GROQ_API_KEY in CI */
      if (key) {
        const primaryModel = this.env.GROQ_MODEL ?? GROQ_DEFAULT_PRIMARY_MODEL;
        const fallbackModel = this.env.GROQ_FALLBACK_MODEL ?? GROQ_DEFAULT_FALLBACK_MODEL;
        return new GroqProvider(key, primaryModel, fallbackModel, timeoutMs, this.logger);
      }
    } else if (provider === 'gemini') {
      const key = apiKey || this.env.GEMINI_API_KEY;
      /* istanbul ignore next -- requires real GEMINI_API_KEY in CI */
      if (key) {
        return new GeminiProvider(key, DEFAULT_MODELS.gemini, timeoutMs, this.logger);
      }
    } else if (provider === 'openai') {
      const key = apiKey || this.env.OPENAI_API_KEY;
      /* istanbul ignore next -- requires real OPENAI_API_KEY in CI */
      if (key) {
        return new OpenAIProvider(key, DEFAULT_MODELS.openai, timeoutMs, this.logger);
      }
    } else if (provider === 'ollama') {
      const host = this.env.OLLAMA_HOST ?? 'http://localhost:11434';
      const model = this.env.OLLAMA_MODEL ?? 'gemma2:2b';
      return new OllamaProvider(host, model, timeoutMs, this.logger);
    }

    return this.defaultLlm;
  }

  get available(): boolean {
    return this.getClient().available;
  }

  classifyUniversity(name: string): Promise<LlmResult<Tier>> {
    return this.getClient().classifyUniversity(name);
  }

  classifyCompany(name: string): Promise<LlmResult<Tier>> {
    return this.getClient().classifyCompany(name);
  }

  generateExplanation(input: ExplanationInput): Promise<LlmResult<string>> {
    return this.getClient().generateExplanation(input);
  }

  generateEmail(input: EmailInput): Promise<LlmResult<OutreachEmail>> {
    return this.getClient().generateEmail(input);
  }

  generateProfiles(input: GenerateProfilesInput): Promise<LlmResult<Profile[]>> {
    return this.getClient().generateProfiles(input);
  }
}
