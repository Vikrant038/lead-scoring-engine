/**
 * Profiler orchestrator (F-01, FR-01-007/008). Runs the pipeline
 * Data Quality -> Education -> Experience -> Thinking -> Scorer, then optional persona matching,
 * AI explanation, and outreach email, assembling a ProfileResult. Rejected profiles short-circuit.
 */
import type { AppConfig } from '../config/config.schema';
import type { InputProfile } from '../domain/types';
import type { Persona } from '../domain/types';
import type { Profile } from '../domain/types';
import type { EmailSettings, OutreachEmail, ProfileResult } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import type { DataQualityService } from './data-quality.service';
import type { EducationService } from './education.service';
import type { ExperienceService } from './experience.service';
import type { ThinkingQualityService } from './thinking-quality.service';
import type { ScorerService } from './scorer.service';
import type { PersonaMatcherService } from './persona-matcher.service';

/** Optional AI post-processors (implemented in Unit 9, injected here). */
export interface ExplanationGenerator {
  generate(profile: Profile, result: ProfileResult): Promise<string | null>;
}
export interface EmailGenerator {
  generate(
    profile: Profile,
    result: ProfileResult,
    settings: EmailSettings | undefined,
  ): Promise<OutreachEmail | null>;
}

export interface PipelineServices {
  dataQuality: DataQualityService;
  education: EducationService;
  experience: ExperienceService;
  thinking: ThinkingQualityService;
  scorer: ScorerService;
  personaMatcher: PersonaMatcherService;
  explanation?: ExplanationGenerator;
  email?: EmailGenerator;
}

export interface ProfileOptions {
  persona?: Persona;
  emailSettings?: EmailSettings;
}

export class ProfilerService {
  constructor(
    private readonly config: AppConfig,
    private readonly logger: Logger,
    private readonly services: PipelineServices,
  ) {}

  async profile(input: InputProfile, options: ProfileOptions = {}): Promise<ProfileResult> {
    const base = {
      _recordId: input._recordId,
      _sourceFile: input._sourceFile,
      profile_name: input.name,
      timestamp: new Date().toISOString(),
    };

    try {
      const quality = this.services.dataQuality.check(input);
      if (!quality.shouldProcess) {
        const missing = quality.missingFields.join(', ') || 'none';
        return {
          ...base,
          status: 'REJECTED',
          reason: `Data quality too low (${quality.score}/100); missing: ${missing}`,
        };
      }

      const education = await this.services.education.extract(input.education);
      const experience = await this.services.experience.extract(input.jobs);
      const thinking = this.services.thinking.analyze(input.jobs, input.skills);
      const outcome = this.services.scorer.score(
        { education: education.score, experience: experience.score, thinking: thinking.score },
        input,
      );

      const result: ProfileResult = {
        ...base,
        status: 'PROCESSED',
        icp_score: outcome.icpScore,
        bucket: outcome.bucket,
        priority: outcome.priority,
        expected_conversion: outcome.expectedConversion,
        signals: { education, experience, thinking_quality: thinking },
        component_scores: outcome.componentScores,
      };

      if (options.persona) {
        result.persona_fit = this.services.personaMatcher.match(options.persona, {
          educationTier: education.tier,
          companies: experience.companies,
          jobs: input.jobs ?? [],
          skills: input.skills ?? [],
          yearsExperience: input.years_experience,
        });
      }

      if (this.config.features.enableScoreExplanation && this.services.explanation) {
        result.explanation = await this.services.explanation.generate(input, result);
      }

      if (
        this.config.features.enableEmailGeneration &&
        this.services.email &&
        result.bucket !== 'NOT FIT'
      ) {
        result.outreach_email = await this.services.email.generate(
          input,
          result,
          options.emailSettings,
        );
      }

      return result;
    } catch (error) {
      this.logger.error(
        { recordId: input._recordId, error: (error as Error).message },
        'profiling failed',
      );
      return { ...base, status: 'ERROR', error: (error as Error).message };
    }
  }
}
