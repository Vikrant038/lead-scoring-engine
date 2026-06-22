/**
 * Demo input preparation (FR-15-005/006). Loads the packaged fallback dataset and writes the
 * chosen profiles to an isolated demo-input directory so the demo never touches real session data.
 */
import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import type { Profile } from '../domain/profile.types';
import { ValidationError } from '../lib/errors/domain-errors';
import { profileSchema } from '../schemas/profile.schema';

const fallbackSchema = z.array(profileSchema).min(1);

export const DEMO_INPUT_FILE = 'demo-leads.json';

/** Load and validate the packaged fallback profiles (FR-15-005). */
export function loadFallbackProfiles(fallbackPath: string): Profile[] {
  const parsed = fallbackSchema.safeParse(JSON.parse(fs.readFileSync(fallbackPath, 'utf8')));
  if (!parsed.success) {
    throw new ValidationError('demo-fallback', 'fallback dataset is not a valid profile array');
  }
  return parsed.data;
}

/** Write the demo profiles to a single JSON file in an isolated input directory (FR-15-006). */
export function writeDemoInput(profiles: Profile[], demoInputDir: string): string {
  fs.mkdirSync(demoInputDir, { recursive: true });
  const target = path.join(demoInputDir, DEMO_INPUT_FILE);
  fs.writeFileSync(target, JSON.stringify(profiles, null, 2));
  return target;
}
