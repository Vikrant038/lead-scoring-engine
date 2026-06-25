import type { Profile } from '../domain/profile.types';
import type { OutreachEmail } from '../domain/result.types';
import type { Tier } from '../domain/scoring.types';
import type { Logger } from '../lib/logger/logger';
import { ConfigService } from '../config/config.service';
import { GeminiProvider } from './gemini.provider';
import { OpenAIProvider } from './openai.provider';

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

    if (provider === 'gemini') {
      const key = apiKey || this.env.GEMINI_API_KEY;
      if (key) {
        return new GeminiProvider(key, DEFAULT_MODELS.gemini, timeoutMs, this.logger);
      }
    } else if (provider === 'openai') {
      const key = apiKey || this.env.OPENAI_API_KEY;
      if (key) {
        return new OpenAIProvider(key, DEFAULT_MODELS.openai, timeoutMs, this.logger);
      }
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
