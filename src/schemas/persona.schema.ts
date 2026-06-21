/**
 * Zod schema for persona files (FR-12-001). We control this format, so it is strict.
 * Only `name` and `description` are mandatory; matching ignores absent optional fields.
 */
import { z } from 'zod';

export const personaSchema = z
  .object({
    name: z.string().min(1),
    description: z.string(),
    weights: z
      .object({
        education: z.number(),
        experience: z.number(),
        thinking: z.number(),
      })
      .optional(),
    education: z
      .object({
        preferred_tiers: z.array(z.string()),
      })
      .optional(),
    experience: z
      .object({
        roles_must_include: z.array(z.string()).optional(),
        preferred_companies_tiers: z.array(z.string()).optional(),
        min_years_experience: z.number().nonnegative().optional(),
      })
      .optional(),
    skills_must_have: z.array(z.string()).optional(),
  })
  .strict();
