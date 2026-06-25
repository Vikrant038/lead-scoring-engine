/**
 * Default runtime configuration (§5.4). Seeded tier lists (ASSUMPTION-1) and bucket ranges
 * (ASSUMPTION-2) are editable via the web Config Editor. Validated by `appConfigSchema`.
 */
import type { AppConfig } from './config.schema';

export const defaultConfig: AppConfig = {
  scoring: {
    // FR-06-001 weights.
    weights: { education: 0.2, experience: 0.35, thinking: 0.4 },
    // FR-03-005 education tier -> score mapping.
    tierScores: { tier_1: 100, tier_2: 70, tier_3: 40, unknown: 20 },
  },
  // ASSUMPTION-1: seeded, editable tier lists (case-insensitive matching done by services).
  tiers: {
    universities: {
      tier_1: [
        'Harvard University',
        'Stanford University',
        'Massachusetts Institute of Technology',
        'University of Oxford',
        'University of Cambridge',
        'IIT Bombay',
        'IIT Delhi',
        'IIM Ahmedabad',
      ],
      tier_2: [
        'University of Leeds',
        'University of Michigan',
        'Boston University',
        'Delhi University',
        'BITS Pilani',
        'NIT Trichy',
      ],
      tier_3: [],
    },
    companies: {
      tier_1: ['Google', 'Microsoft', 'Apple', 'Amazon', 'Meta', 'Netflix', 'Stripe', 'Razorpay'],
      tier_2: ['Uber', 'Flipkart', 'Perfios', 'Pine Labs', 'Swiggy', 'Zomato', 'PayPal'],
      tier_3: [],
    },
  },
  // ASSUMPTION-2: bucket ranges scanned top-down (FR-06-004).
  buckets: [
    { min: 90, max: 100, bucket: 'HIGH', priority: 'Immediate Outreach', conversion: '40-60%' },
    { min: 80, max: 89, bucket: 'HIGH', priority: 'Priority Outreach', conversion: '30-45%' },
    { min: 70, max: 79, bucket: 'MEDIUM', priority: 'Nurture', conversion: '20-30%' },
    { min: 60, max: 69, bucket: 'MEDIUM', priority: 'Nurture', conversion: '15-25%' },
    { min: 40, max: 59, bucket: 'LOW', priority: 'Long-term Development', conversion: '5-15%' },
    { min: 0, max: 39, bucket: 'NOT FIT', priority: 'Exclude', conversion: '0-5%' },
  ],
  // F-05 keyword lists.
  thinking: {
    visionaryKeywords: [
      'innovation',
      'strategy',
      'thought leader',
      'ai',
      'machine learning',
      'data-driven',
      'scalable',
      'vision',
      'transformation',
    ],
    leadershipKeywords: ['chief', 'vp', 'head'],
  },
  // FR-06-002 recency bonus window.
  recency: { months: 6, bonus: 5 },
  // FR-12-021 persona fit thresholds.
  personaFit: { excellent: 90, good: 75, partial: 50 },
  processing: { batchDelayMs: 2000, pollIntervalMs: 2000 },
  llm: { provider: 'none', timeout: 15000, apiKey: undefined },
  paths: {
    inputDir: './input',
    outputDir: './output',
    logDir: './logs',
    personasDir: './personas',
  },
  features: { enableScoreExplanation: true, enableEmailGeneration: true },
};
