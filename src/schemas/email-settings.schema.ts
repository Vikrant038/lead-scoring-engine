/**
 * Zod schema for per-session outreach email settings (FR-14-009).
 */
import { z } from 'zod';

export const emailSettingsSchema = z.object({
  senderName: z.string().min(1),
  company: z.string().min(1),
  tone: z.string().min(1),
});
