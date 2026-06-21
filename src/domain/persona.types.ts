/**
 * Persona types (F-12). `Persona` is inferred from the Zod schema (single source of truth).
 */
import type { z } from 'zod';
import type { personaSchema } from '../schemas/persona.schema';

export type Persona = z.infer<typeof personaSchema>;

export type PersonaFitBucket = 'Excellent Fit' | 'Good Fit' | 'Partial Fit' | 'Not a Fit';

export interface PersonaFitResult {
  persona_name: string;
  fit_score: number;
  bucket: PersonaFitBucket;
  gap_analysis: string[];
}
