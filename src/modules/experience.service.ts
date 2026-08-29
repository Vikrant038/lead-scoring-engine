/**
 * Experience signal extraction (F-04). Extracts companies from jobs, classifies each tier
 * (LLM with optional Serper search context when available, else config tier lists),
 * and scores from tier-1/2 counts.
 */
import type { AppConfig } from '../config/config.schema';
import type { CompanyTier, ExperienceSignal, Tier } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import type { LLMClient } from '../llm/llm-client.interface';
import { SerperService } from '../lib/search/serper';

const BASE_SCORE = 60;
const TIER1_WEIGHT = 10;
const TIER2_WEIGHT = 5;
const TIER1_FULL_SCORE_COUNT = 3;

export class ExperienceService {
  private readonly serperService?: SerperService;

  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly llm: LLMClient,
    serperApiKey?: string,
  ) {
    if (serperApiKey) {
      this.serperService = new SerperService(serperApiKey, logger);
    }
  }

  async extract(jobs: string[] | undefined): Promise<ExperienceSignal> {
    const distinct = this.dedupe(this.extractCompanies(jobs ?? []));
    const companies: CompanyTier[] = [];
    for (const name of distinct) {
      companies.push({ name, tier: await this.classifyTier(name) });
    }

    const tier1Count = companies.filter((company) => company.tier === 'tier_1').length;
    const tier2Count = companies.filter((company) => company.tier === 'tier_2').length;

    let score = BASE_SCORE + TIER1_WEIGHT * tier1Count + TIER2_WEIGHT * tier2Count;
    if (tier1Count >= TIER1_FULL_SCORE_COUNT) {
      score = 100;
    }
    score = Math.min(100, score);

    this.logger.debug({ tier1Count, tier2Count, score }, 'experience scored');
    return { companies, tier1Count, tier2Count, score };
  }

  /** FR-04-001: company is the text after '@', else the whole entry. */
  private extractCompanies(jobs: string[]): string[] {
    return jobs
      .map((job) => (job.includes('@') ? (job.split('@').pop() ?? '') : job).trim())
      .filter((name) => name.length > 0);
  }

  private dedupe(names: string[]): string[] {
    const seen = new Map<string, string>();
    for (const name of names) {
      const key = name.toLowerCase();
      if (!seen.has(key)) {
        seen.set(key, name);
      }
    }
    return [...seen.values()];
  }

  private async classifyTier(company: string): Promise<Tier> {
    if (this.llm.available) {
      let searchContext: string | undefined;
      if (this.serperService) {
        searchContext = await this.serperService.search(
          `"${company}" company size headcount funding tier`,
        );
      }
      const result = await this.llm.classifyCompany(company, searchContext);
      if (result.success && result.data) {
        return result.data;
      }
      this.logger.warn('company LLM classification failed; falling back to rules');
    }
    return this.matchTier(company);
  }

  private matchTier(company: string): Tier {
    const lists = this.config.tiers.companies;
    const lower = company.toLowerCase();
    if (lists.tier_1.some((name) => name.toLowerCase() === lower)) return 'tier_1';
    if (lists.tier_2.some((name) => name.toLowerCase() === lower)) return 'tier_2';
    if (lists.tier_3.some((name) => name.toLowerCase() === lower)) return 'tier_3';
    return 'tier_3';
  }
}
