/**
 * Zod schema + inferred type for the runtime configuration (single source of truth, CODING 1.10).
 * Used to validate edits posted to the web Config Editor (FR-11-003) before they are applied.
 * Mandatory top-level keys: scoring, tiers, buckets, processing, paths, llm, features.
 */
import { z } from 'zod';

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
      provider: z.enum(['none', 'gemini', 'openai']),
      timeout: z.number().positive(),
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
