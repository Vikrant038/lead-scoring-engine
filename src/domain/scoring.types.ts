/**
 * Internal scoring signal types produced by the pipeline services (F-02..F-06).
 */
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
