/**
 * Input lead profile type — inferred from the Zod schema (single source of truth, CODING 1.10).
 */
import type { z } from 'zod';
import type { profileSchema } from '../schemas/profile.schema';

export type Profile = z.infer<typeof profileSchema>;
