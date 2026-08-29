/**
 * Scorer (F-06). Combines component sub-scores with configurable weights, applies the recency
 * bonus, rounds to one decimal, and assigns bucket/priority/conversion.
 */
import type { AppConfig } from '../config/config.schema';
import type { Profile } from '../domain/types';
import type { Bucket } from '../domain/types';
import type { ComponentScores } from '../domain/types';
import type { Logger } from '../lib/logger/logger';

export interface SubScores {
  education: number;
  experience: number;
  thinking: number;
}

export interface ScoreOutcome {
  icpScore: number;
  bucket: Bucket;
  priority: string;
  expectedConversion: string;
  componentScores: ComponentScores;
}

export class ScorerService {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  score(scores: SubScores, profile: Profile, now: Date = new Date()): ScoreOutcome {
    const weights = this.config.scoring.weights;
    const weighted =
      scores.education * weights.education +
      scores.experience * weights.experience +
      scores.thinking * weights.thinking;

    const recencyBonus = this.isRecentlyActive(profile.lastActive, now)
      ? this.config.recency.bonus
      : 0;

    const icpScore = Math.round((weighted + recencyBonus) * 10) / 10;
    const bucketConfig =
      this.config.buckets.find((range) => icpScore >= range.min && icpScore <= range.max) ??
      this.config.buckets[this.config.buckets.length - 1];

    this.logger.debug({ icpScore, bucket: bucketConfig.bucket }, 'final score computed');
    return {
      icpScore,
      bucket: bucketConfig.bucket,
      priority: bucketConfig.priority,
      expectedConversion: bucketConfig.conversion,
      componentScores: {
        education: scores.education,
        experience: scores.experience,
        thinking: scores.thinking,
        recencyBonus,
      },
    };
  }

  /** FR-06-002: true when `lastActive` is a valid date within the configured recency window. */
  private isRecentlyActive(lastActive: string | undefined, now: Date): boolean {
    if (!lastActive) {
      return false;
    }
    const date = new Date(lastActive);
    if (Number.isNaN(date.getTime())) {
      return false;
    }
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - this.config.recency.months);
    return date >= cutoff && date <= now;
  }
}
