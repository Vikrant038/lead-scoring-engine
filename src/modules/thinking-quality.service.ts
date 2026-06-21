/**
 * Thinking Quality analysis (F-05). Scores visionary/leadership signal from skills and job titles.
 * Pure (no LLM): +10 per distinct visionary keyword (cap 100), +10 leadership bonus (cap 100).
 */
import type { AppConfig } from '../config/config.schema';
import type { ThinkingSignal } from '../domain/scoring.types';
import type { Logger } from '../lib/logger/logger';

const KEYWORD_POINTS = 10;
const LEADERSHIP_BONUS = 10;

export class ThinkingQualityService {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  analyze(jobs: string[] | undefined, skills: string[] | undefined): ThinkingSignal {
    const haystack = [...(skills ?? []), ...(jobs ?? [])].join(' ').toLowerCase();
    const matches = this.config.thinking.visionaryKeywords.filter((keyword) =>
      haystack.includes(keyword.toLowerCase()),
    ).length;
    const visionaryScore = Math.min(100, matches * KEYWORD_POINTS);

    const jobsText = (jobs ?? []).join(' ').toLowerCase();
    const isLeader = this.config.thinking.leadershipKeywords.some((keyword) =>
      jobsText.includes(keyword.toLowerCase()),
    );
    const leadershipBonus = isLeader ? LEADERSHIP_BONUS : 0;

    const score = Math.min(100, visionaryScore + leadershipBonus);
    this.logger.debug({ visionaryScore, leadershipBonus, score }, 'thinking quality scored');
    return { visionaryScore, leadershipBonus, score };
  }
}
