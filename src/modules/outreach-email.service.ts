/**
 * Outreach email generator (F-14). Drafts a bucket-toned email for scored leads. Returns null
 * when the LLM is unavailable, when the bucket is NOT FIT (FR-14-005), or on generation failure.
 */
import type { Profile } from '../domain/types';
import type { Bucket, EmailSettings, OutreachEmail, ProfileResult } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import type { EmailInput, LLMClient } from '../llm/llm-client.interface';
import type { EmailGenerator } from './profiler.service';

/** FR-14-005: per-bucket tone guidance. */
const TONE_BY_BUCKET: Record<Bucket, string> = {
  HIGH: 'warm and direct; suggest a specific call or meeting',
  MEDIUM: 'nurturing; mention a potential synergy and ask for advice',
  LOW: 'light touch; share something valuable with no hard ask',
  'NOT FIT': '',
};

/** FR-14-010: defaults when the user has not configured email settings. */
const FALLBACK_SETTINGS: EmailSettings = {
  senderName: 'Your Name',
  company: 'Your Company',
  tone: 'professional',
};

const MAX_SKILLS = 5;

export class OutreachEmailService implements EmailGenerator {
  constructor(
    private readonly llm: LLMClient,
    private readonly logger: Logger,
  ) {}

  async generate(
    profile: Profile,
    result: ProfileResult,
    settings: EmailSettings | undefined,
  ): Promise<OutreachEmail | null> {
    if (!this.llm.available || !result.bucket || result.bucket === 'NOT FIT') {
      return null; // FR-14-005
    }

    const effective = settings ?? FALLBACK_SETTINGS;
    const input: EmailInput = {
      name: profile.name,
      education: profile.education?.[0] ?? '',
      company: profile.company_details?.name ?? this.firstCompany(result) ?? '',
      role: this.firstRole(profile) ?? '',
      skills: (profile.skills ?? []).slice(0, MAX_SKILLS),
      icpScore: result.icp_score ?? 0,
      bucket: result.bucket,
      personaFit: result.persona_fit?.fit_score,
      tone: `${effective.tone}; ${TONE_BY_BUCKET[result.bucket]}`,
      senderName: effective.senderName,
      senderCompany: effective.company,
    };

    const response = await this.llm.generateEmail(input);
    if (response.success && response.data) {
      return response.data;
    }
    this.logger.warn('email generation failed');
    return null; // FR-14-007
  }

  private firstRole(profile: Profile): string | undefined {
    const job = profile.jobs?.[0];
    if (!job) {
      return undefined;
    }
    return job.includes('@') ? job.split('@')[0].trim() : job.trim();
  }

  private firstCompany(result: ProfileResult): string | undefined {
    return result.signals?.experience?.companies[0]?.name;
  }
}
