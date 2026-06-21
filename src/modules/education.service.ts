/**
 * Education signal extraction (F-03). Parses the highest degree, derives the university name,
 * classifies its tier (LLM when available, else config tier lists), and maps it to a sub-score.
 */
import type { AppConfig } from '../config/config.schema';
import type { EducationSignal, Tier } from '../domain/scoring.types';
import type { Logger } from '../lib/logger/logger';
import type { LLMClient } from '../llm/llm-client.interface';

export class EducationService {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly llm: LLMClient,
  ) {}

  async extract(education: string[] | undefined): Promise<EducationSignal> {
    if (!education || education.length === 0) {
      return { university: '', tier: 'unknown', score: this.config.scoring.tierScores.unknown };
    }
    const university = this.extractUniversity(education[0]);
    const tier = await this.classifyTier(university);
    const score = this.config.scoring.tierScores[tier];
    return { university, tier, score };
  }

  /** FR-03-002: text after '@', else before the first comma, else the whole string. */
  private extractUniversity(entry: string): string {
    let value = entry;
    if (value.includes('@')) {
      const parts = value.split('@');
      value = parts[parts.length - 1];
    }
    return value.split(',')[0].trim();
  }

  private async classifyTier(university: string): Promise<Tier> {
    if (this.llm.available) {
      const result = await this.llm.classifyUniversity(university);
      if (result.success && result.data) {
        return result.data;
      }
      this.logger.warn('university LLM classification failed; falling back to rules');
    }
    return this.matchTier(university);
  }

  /** FR-03-004: case-insensitive exact match; unmatched defaults to tier_3. */
  private matchTier(university: string): Tier {
    const lists = this.config.tiers.universities;
    const lower = university.toLowerCase();
    if (lists.tier_1.some((name) => name.toLowerCase() === lower)) return 'tier_1';
    if (lists.tier_2.some((name) => name.toLowerCase() === lower)) return 'tier_2';
    if (lists.tier_3.some((name) => name.toLowerCase() === lower)) return 'tier_3';
    return 'tier_3';
  }
}
