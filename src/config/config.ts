/**
 * Runtime configuration (§5.4): Zod schema + defaults + mutable holder.
 * Defaults define the seeded tier lists (ASSUMPTION-1) and bucket ranges (ASSUMPTION-2);
 * both are editable via the web Config Editor and validated by `appConfigSchema` (FR-11-003).
 */
import { z } from 'zod';
import { InvalidConfigError } from '../lib/errors/domain-errors';

const tierListSchema = z.object({
  tier_1: z.array(z.string()),
  tier_2: z.array(z.string()),
  tier_3: z.array(z.string()),
});

export const bucketConfigSchema = z.object({
  min: z.number(),
  max: z.number(),
  bucket: z.enum(['HIGH', 'MEDIUM', 'LOW', 'NOT FIT']),
  priority: z.string(),
  conversion: z.string(),
});

export const appConfigSchema = z
  .object({
    scoring: z.object({
      weights: z.object({
        education: z.number().min(0).max(1),
        experience: z.number().min(0).max(1),
        thinking: z.number().min(0).max(1),
      }),
      tierScores: z.object({
        tier_1: z.number(),
        tier_2: z.number(),
        tier_3: z.number(),
        unknown: z.number(),
      }),
    }),
    tiers: z.object({
      universities: tierListSchema,
      companies: tierListSchema,
    }),
    buckets: z.array(bucketConfigSchema).min(1),
    thinking: z.object({
      visionaryKeywords: z.array(z.string()),
      leadershipKeywords: z.array(z.string()),
    }),
    recency: z.object({
      months: z.number().positive(),
      bonus: z.number(),
    }),
    personaFit: z.object({
      excellent: z.number(),
      good: z.number(),
      partial: z.number(),
    }),
    processing: z.object({
      batchDelayMs: z.number().nonnegative(),
      pollIntervalMs: z.number().positive(),
    }),
    llm: z.object({
      provider: z.enum(['none', 'gemini', 'openai', 'youcom', 'ollama', 'groq']),
      timeout: z.number().positive(),
      apiKey: z.string().optional(),
    }),
    paths: z.object({
      inputDir: z.string(),
      outputDir: z.string(),
      logDir: z.string(),
      personasDir: z.string(),
    }),
    features: z.object({
      enableScoreExplanation: z.boolean(),
      enableEmailGeneration: z.boolean(),
    }),
  })
  .strict();

export type AppConfig = z.infer<typeof appConfigSchema>;
export type BucketConfig = z.infer<typeof bucketConfigSchema>;

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

/**
 * Mutable configuration holder (F-11). Modules read the current config via `get()`; the web
 * Config Editor applies validated edits via `update()` (FR-11-004) and restores defaults via
 * `reset()` (FR-11-005). Invalid edits throw InvalidConfigError -> HTTP 400 (FR-11-003).
 */
export class ConfigService {
  private current: AppConfig;

  constructor(initial: AppConfig = defaultConfig) {
    this.current = structuredClone(initial);
  }

  /** The configuration currently in effect (deep cloned to prevent mutation). */
  get(): AppConfig {
    return structuredClone(this.current);
  }

  /**
   * Validate and apply a new configuration. Throws InvalidConfigError with a descriptive,
   * field-pointed message if validation fails (FR-11-003).
   */
  update(raw: unknown): AppConfig {
    const result = appConfigSchema.safeParse(raw);
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new InvalidConfigError(reason);
    }
    this.current = result.data;
    return this.current;
  }

  /** Restore the configuration shipped with the application (FR-11-005). */
  reset(): AppConfig {
    this.current = structuredClone(defaultConfig);
    return this.current;
  }
}
