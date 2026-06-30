/**
 * Output result types (F-07) and per-session email settings (FR-14-009).
 */
import type { z } from 'zod';
import type { emailSettingsSchema } from '../schemas/email-settings.schema';
import type {
  ComponentScores,
  EducationSignal,
  ExperienceSignal,
  ThinkingSignal,
} from './scoring.types';
import type { PersonaFitResult } from './persona.types';

export type Bucket = 'HIGH' | 'MEDIUM' | 'LOW' | 'NOT FIT';
export type ProcessingStatus = 'PROCESSED' | 'REJECTED' | 'ERROR';

export type EmailSettings = z.infer<typeof emailSettingsSchema>;

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
