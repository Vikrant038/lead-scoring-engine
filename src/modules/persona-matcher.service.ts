/**
 * Persona matching (F-12, FR-12-013..023). Scores a lead's extracted signals against a persona
 * across education, experience (roles/companies/years) and skills, then buckets the fit and
 * builds a gap analysis. Pure (no LLM). `match()` is the entry point; sub-scorers are exposed
 * for focused testing.
 */
import type { AppConfig } from '../config/config.schema';
import type { Persona, PersonaFitBucket, PersonaFitResult } from '../domain/persona.types';
import type { CompanyTier, Tier } from '../domain/scoring.types';
import type { Logger } from '../lib/logger/logger';

/** Default experience sub-weights (FR-12-018). */
const EXPERIENCE_WEIGHTS = { roles: 0.4, companies: 0.4, years: 0.2 } as const;
const YEARS_ABSENT_SCORE = 50;
const TIER_RANK: Record<Tier, number> = { tier_1: 1, tier_2: 2, tier_3: 3, unknown: 4 };

export interface PersonaMatchInput {
  educationTier: Tier;
  companies: CompanyTier[];
  jobs: string[];
  skills: string[];
  yearsExperience?: number;
}

export class PersonaMatcherService {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
  ) {}

  match(persona: Persona, input: PersonaMatchInput): PersonaFitResult {
    const education = this.educationScore(persona, input.educationTier);
    const experience = this.experienceScore(persona, input);
    const skills = this.skillsScore(persona, input.skills);
    const fitScore = this.combine(persona, { education, experience, skills });
    const result: PersonaFitResult = {
      persona_name: persona.name,
      fit_score: fitScore,
      bucket: this.bucket(fitScore),
      gap_analysis: this.gapAnalysis(persona, input, education),
    };
    this.logger.debug({ persona: persona.name, fitScore }, 'persona matched');
    return result;
  }

  /** FR-12-014: 100 if tier in preferred (or no preference), 60 if exactly one tier below, else 30. */
  educationScore(persona: Persona, tier: Tier): number {
    const preferred = persona.education?.preferred_tiers;
    if (!preferred || preferred.length === 0) {
      return 100;
    }
    if (preferred.includes(tier)) {
      return 100;
    }
    const rank = TIER_RANK[tier];
    const isNextBelow = preferred.some((pref) => {
      const prefRank = TIER_RANK[pref as Tier];
      return prefRank !== undefined && rank === prefRank + 1;
    });
    return isNextBelow ? 60 : 30;
  }

  /** FR-12-015/016/017/018: weighted blend of role, company, and years sub-scores. */
  experienceScore(persona: Persona, input: PersonaMatchInput): number {
    const experience = persona.experience;
    const roles = this.roleScore(experience?.roles_must_include ?? [], input.jobs);
    const companies = this.companyScore(input.companies);
    const years = this.yearsScore(experience?.min_years_experience, input.yearsExperience);
    return (
      roles * EXPERIENCE_WEIGHTS.roles +
      companies * EXPERIENCE_WEIGHTS.companies +
      years * EXPERIENCE_WEIGHTS.years
    );
  }

  /** FR-12-015: percentage of required roles fuzzily found in the lead's job titles. */
  roleScore(required: string[], jobs: string[]): number {
    if (required.length === 0) {
      return 100;
    }
    const found = required.filter((role) =>
      jobs.some((job) => job.toLowerCase().includes(role.toLowerCase())),
    );
    return (found.length / required.length) * 100;
  }

  /** FR-12-016: (tier1*1 + tier2*0.5) / total companies, scaled to 0-100; 0 when no companies. */
  companyScore(companies: CompanyTier[]): number {
    if (companies.length === 0) {
      return 0;
    }
    const tier1 = companies.filter((company) => company.tier === 'tier_1').length;
    const tier2 = companies.filter((company) => company.tier === 'tier_2').length;
    return ((tier1 * 1.0 + tier2 * 0.5) / companies.length) * 100;
  }

  /** FR-12-017: proportional to min_years; 50 when years unknown; 100 when no requirement. */
  yearsScore(minYears: number | undefined, years: number | undefined): number {
    if (minYears === undefined) {
      return 100;
    }
    if (years === undefined) {
      return YEARS_ABSENT_SCORE;
    }
    return Math.min(100, (years / minYears) * 100);
  }

  /** FR-12-019: percentage of must-have skills present (exact, or substring for multi-word). */
  skillsScore(persona: Persona, skills: string[]): number {
    const required = persona.skills_must_have ?? [];
    if (required.length === 0) {
      return 100;
    }
    const found = required.filter((skill) => this.hasSkill(skill, skills));
    return (found.length / required.length) * 100;
  }

  private hasSkill(required: string, skills: string[]): boolean {
    const needle = required.toLowerCase();
    if (needle.includes(' ')) {
      return skills.join(' ').toLowerCase().includes(needle);
    }
    return skills.some((skill) => skill.toLowerCase() === needle);
  }

  /** FR-12-020: persona-weighted (or default-ICP-weighted) average, rounded to one decimal. */
  private combine(
    persona: Persona,
    scores: { education: number; experience: number; skills: number },
  ): number {
    const weights = persona.weights ?? this.config.scoring.weights;
    const sum = weights.education + weights.experience + weights.thinking;
    const value =
      (scores.education * weights.education +
        scores.experience * weights.experience +
        scores.skills * weights.thinking) /
      sum;
    return Math.round(value * 10) / 10;
  }

  /** FR-12-021: bucket the fit score using configurable thresholds. */
  bucket(score: number): PersonaFitBucket {
    const thresholds = this.config.personaFit;
    if (score >= thresholds.excellent) return 'Excellent Fit';
    if (score >= thresholds.good) return 'Good Fit';
    if (score >= thresholds.partial) return 'Partial Fit';
    return 'Not a Fit';
  }

  /** FR-12-022: list missing skills, missing roles, and below-preference notes. */
  private gapAnalysis(
    persona: Persona,
    input: PersonaMatchInput,
    educationScore: number,
  ): string[] {
    const gaps: string[] = [];

    for (const skill of persona.skills_must_have ?? []) {
      if (!this.hasSkill(skill, input.skills)) {
        gaps.push(`Missing skill: ${skill}`);
      }
    }

    for (const role of persona.experience?.roles_must_include ?? []) {
      const present = input.jobs.some((job) => job.toLowerCase().includes(role.toLowerCase()));
      if (!present) {
        gaps.push(`Missing role: ${role}`);
      }
    }

    const preferred = persona.education?.preferred_tiers;
    if (preferred && preferred.length > 0 && educationScore < 100) {
      gaps.push(`Education tier ${input.educationTier} below preferred (${preferred.join('/')})`);
    }

    const hasPreferredCompany = input.companies.some(
      (company) => company.tier === 'tier_1' || company.tier === 'tier_2',
    );
    if (!hasPreferredCompany) {
      gaps.push('No tier-1/tier-2 companies');
    }

    return gaps;
  }
}
