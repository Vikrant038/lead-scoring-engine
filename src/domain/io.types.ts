/**
 * I/O-facing composite types: profiles annotated with identity/source, and the batch summary.
 */
import type { Profile } from './profile.types';
import type { Bucket, ProfileResult } from './result.types';

/** An input profile annotated with its assigned record id and source filename (F-08). */
export type InputProfile = Profile & { _recordId: string; _sourceFile: string };

/** Aggregate batch result written to `batch_summary_{timestamp}.json` (FR-07-002). */
export interface BatchSummary {
  total: number;
  processed: number;
  rejected: number;
  errors: number;
  bucketDistribution: Record<Bucket, number>;
  averageScore: number;
  generatedAt: string;
  results: ProfileResult[];
}
