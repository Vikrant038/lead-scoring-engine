/**
 * Null provider: the always-unavailable LLM client used when no AI key is configured.
 * Every method reports failure so callers transparently fall back to rule-based logic (§2.5).
 */
import type { Profile } from '../domain/types';
import type { OutreachEmail } from '../domain/types';
import type { Tier } from '../domain/types';
import type { LLMClient, LlmResult } from './llm-client.interface';

const FAILURE = { success: false as const, error: 'AI provider not configured' };

export class NullProvider implements LLMClient {
  readonly available = false;

  classifyUniversity(_name: string, _searchContext?: string): Promise<LlmResult<Tier>> {
    return Promise.resolve(FAILURE);
  }

  classifyCompany(_name: string, _searchContext?: string): Promise<LlmResult<Tier>> {
    return Promise.resolve(FAILURE);
  }

  generateExplanation(): Promise<LlmResult<string>> {
    return Promise.resolve(FAILURE);
  }

  generateEmail(): Promise<LlmResult<OutreachEmail>> {
    return Promise.resolve(FAILURE);
  }

  generateProfiles(): Promise<LlmResult<Profile[]>> {
    return Promise.resolve(FAILURE);
  }
}
