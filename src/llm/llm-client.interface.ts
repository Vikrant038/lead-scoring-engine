/**
 * LLMClient contract (ASSUMPTION-3). All methods return a result envelope so callers can fall
 * back to rule-based logic on failure without exceptions crossing module boundaries (MAIN-04).
 */
import type { Profile } from '../domain/profile.types';
import type { OutreachEmail } from '../domain/result.types';
import type { ComponentScores, Tier } from '../domain/scoring.types';

export interface LlmResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface ExplanationInput {
  name: string;
  education: string[];
  companies: string[];
  skills: string[];
  componentScores: ComponentScores;
  finalScore: number;
  bucket: string;
  priority: string;
}

export interface EmailInput {
  name: string;
  education: string;
  company: string;
  role: string;
  skills: string[];
  icpScore: number;
  bucket: string;
  personaFit?: number;
  tone: string;
  senderName: string;
  senderCompany: string;
}

export interface GenerateProfilesInput {
  count: number;
  personaDescription?: string;
}

export interface LLMClient {
  /** Whether a real AI provider is configured. When false, callers use rule-based logic. */
  readonly available: boolean;
  classifyUniversity(name: string, searchContext?: string): Promise<LlmResult<Tier>>;
  classifyCompany(name: string, searchContext?: string): Promise<LlmResult<Tier>>;
  generateExplanation(input: ExplanationInput): Promise<LlmResult<string>>;
  generateEmail(input: EmailInput): Promise<LlmResult<OutreachEmail>>;
  generateProfiles(input: GenerateProfilesInput): Promise<LlmResult<Profile[]>>;
}
