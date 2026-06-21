/**
 * Zod schema for input lead profiles (single source of truth — CODING 1.10, GUARDRAILS 2.1).
 * Lead data is heterogeneous (manually curated from RocketReach etc.), so unknown fields are
 * passed through; the fields the pipeline consumes are type-validated.
 */
import { z } from 'zod';

export const companyDetailsSchema = z.object({
  name: z.string().optional(),
  category: z.string().optional(),
});

export const profileSchema = z
  .object({
    _recordId: z.string().min(1).optional(),
    name: z.string().min(1, 'name is required'),
    education: z.array(z.string()).optional(),
    jobs: z.array(z.string()).optional(),
    skills: z.array(z.string()).optional(),
    company_details: companyDetailsSchema.optional(),
    lastActive: z.string().optional(),
    years_experience: z.number().nonnegative().optional(),
  })
  .passthrough();
