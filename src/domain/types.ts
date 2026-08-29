/**
 * Domain types (single module). `Profile`, `Persona` and `EmailSettings` are inferred from
 * their Zod schemas — the single source of truth (CODING 1.10).
 */
import type { z } from 'zod';
import type { profileSchema } from '../schemas/profile.schema';
import type { personaSchema } from '../schemas/persona.schema';
import type { emailSettingsSchema } from '../schemas/email-settings.schema';

/** Input lead profile type — inferred from the Zod schema. */
export type Profile = z.infer<typeof profileSchema>;

/** Persona types (F-12). */
export type Persona = z.infer<typeof personaSchema>;

export type PersonaFitBucket = 'Excellent Fit' | 'Good Fit' | 'Partial Fit' | 'Not a Fit';

export interface PersonaFitResult {
  persona_name: string;
  fit_score: number;
  bucket: PersonaFitBucket;
  gap_analysis: string[];
}

/** Per-session outreach email settings (FR-14-009). */
export type EmailSettings = z.infer<typeof emailSettingsSchema>;

/** Internal scoring signal types produced by the pipeline services (F-02..F-06). */
export type Tier = 'tier_1' | 'tier_2' | 'tier_3' | 'unknown';

export interface DataQualitySignal {
  score: number;
  completeness: number;
  shouldProcess: boolean;
  missingFields: string[];
}

export interface EducationSignal {
  university: string;
  tier: Tier;
  score: number;
}

export interface CompanyTier {
  name: string;
  tier: Tier;
}

export interface ExperienceSignal {
  companies: CompanyTier[];
  tier1Count: number;
  tier2Count: number;
  score: number;
}

export interface ThinkingSignal {
  visionaryScore: number;
  leadershipBonus: number;
  score: number;
}

export interface ComponentScores {
  education: number;
  experience: number;
  thinking: number;
  recencyBonus: number;
}

/** Output result types (F-07). */
export type Bucket = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT FIT';
export type ProcessingStatus = 'PROCESSED' | 'REJECTED' | 'ERROR';

export interface OutreachEmail {
  subject: string;
  body: string;
}

export interface ResultSignals {
  education?: EducationSignal;
  experience?: ExperienceSignal;
  thinking_quality?: ThinkingSignal;
}

export interface ProfileResult {
  _recordId: string;
  _sourceFile?: string;
  _batchId?: string;
  _batchName?: string;
  profile_name: string;
  status: ProcessingStatus;
  icp_score?: number;
  bucket?: Bucket;
  priority?: string;
  expected_conversion?: string;
  signals?: ResultSignals;
  component_scores?: ComponentScores;
  explanation?: string | null;
  persona_fit?: PersonaFitResult;
  outreach_email?: OutreachEmail | null;
  reason?: string;
  error?: string;
  timestamp: string;
}

/** I/O composite types: profiles annotated with identity/source, and the batch summary. */

/** An input profile annotated with its assigned record id and source filename (F-08). */
export type InputProfile = Profile & { _recordId: string; _sourceFile: string };

/** Aggregate batch result written to `batch_summary_{timestamp}.json` (FR-07-002). */
export interface BatchSummary {
  total: number;
  processed: number;
  rejected: number;
  errors: number;
  bucketDistribution: Record<Bucket, number>;
  averageScore: number;
  generatedAt: string;
  results: ProfileResult[];
}
