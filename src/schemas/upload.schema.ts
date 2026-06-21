/**
 * Zod schema for the parsed contents of an uploaded JSON file (FR-01-004, SEC-04).
 * A file may contain a single profile object or an array of them.
 */
import { z } from 'zod';
import { profileSchema } from './profile.schema';

export const uploadedProfilesSchema = z.union([profileSchema, z.array(profileSchema)]);
