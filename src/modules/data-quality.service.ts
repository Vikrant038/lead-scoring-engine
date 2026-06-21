/**
 * Data Quality validation (F-02). Scores profile completeness and decides whether to process.
 * Pure (no LLM): base 100, minus 30 per missing required field (name, education, jobs).
 */
import type { Profile } from '../domain/profile.types';
import type { DataQualitySignal } from '../domain/scoring.types';
import type { Logger } from '../lib/logger/logger';

const MISSING_FIELD_PENALTY = 30;
const PROCESS_THRESHOLD = 40;
const COMPLETENESS_FIELDS = 5;

export class DataQualityService {
  constructor(private readonly logger: Logger) {}

  check(profile: Profile): DataQualitySignal {
    const missingFields: string[] = [];
    if (!this.hasName(profile)) missingFields.push('name');
    if (!this.hasEntries(profile.education)) missingFields.push('education');
    if (!this.hasEntries(profile.jobs)) missingFields.push('jobs');

    const score = Math.max(0, 100 - missingFields.length * MISSING_FIELD_PENALTY);
    const completeness = this.completeness(profile);
    const shouldProcess = score >= PROCESS_THRESHOLD;

    this.logger.debug({ score, shouldProcess, missingFields }, 'data quality checked');
    return { score, completeness, shouldProcess, missingFields };
  }

  private hasName(profile: Profile): boolean {
    return typeof profile.name === 'string' && profile.name.trim().length > 0;
  }

  private hasEntries(value: unknown): boolean {
    return Array.isArray(value) && value.length >= 1;
  }

  private hasObject(value: unknown): boolean {
    return !!value && typeof value === 'object' && Object.keys(value).length > 0;
  }

  /** FR-02-003: fraction of the five top-level fields that are non-empty. */
  private completeness(profile: Profile): number {
    const present = [
      this.hasName(profile),
      this.hasEntries(profile.education),
      this.hasEntries(profile.jobs),
      this.hasEntries(profile.skills),
      this.hasObject(profile.company_details),
    ].filter(Boolean).length;
    return present / COMPLETENESS_FIELDS;
  }
}
