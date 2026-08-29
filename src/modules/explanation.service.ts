/**
 * AI score explanation (F-13). Produces a short narrative explaining a lead's ICP score.
 * Returns null when the LLM is unavailable (FR-13-005) and a fixed fallback string when a call
 * fails (FR-13-004).
 */
import type { Profile } from '../domain/types';
import type { ProfileResult } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import type { ExplanationInput, LLMClient } from '../llm/llm-client.interface';
import type { ExplanationGenerator } from './profiler.service';

const EMPTY_SCORES = { education: 0, experience: 0, thinking: 0, recencyBonus: 0 };

export class ExplanationService implements ExplanationGenerator {
  constructor(
    private readonly llm: LLMClient,
    private readonly logger: Logger,
  ) {}

  async generate(profile: Profile, result: ProfileResult): Promise<string | null> {
    if (!this.llm.available) {
      return null; // FR-13-005
    }

    const input: ExplanationInput = {
      name: profile.name,
      education: profile.education ?? [],
      companies: result.signals?.experience?.companies.map((company) => company.name) ?? [],
      skills: profile.skills ?? [],
      componentScores: result.component_scores ?? EMPTY_SCORES,
      finalScore: result.icp_score ?? 0,
      bucket: result.bucket ?? 'NOT FIT',
      priority: result.priority ?? '',
    };

    const response = await this.llm.generateExplanation(input);
    if (response.success && response.data) {
      return response.data;
    }
    this.logger.warn('explanation generation failed');
    return 'Unable to generate explanation.'; // FR-13-004
  }
}
