/**
 * Demo summary report (FR-15-008/009/010). Pure string-building so the console output is fully
 * testable; the demo entry point colourises and prints the returned lines.
 */
import type { Bucket, ProfileResult } from '../domain/types';
import type { PersonaFitResult } from '../domain/types';
import type { RunBatchResult } from '../batch/run-batch';

const BUCKETS: Bucket[] = ['HIGH', 'MEDIUM', 'LOW', 'NOT FIT'];
const TOP_MATCHES = 3;

type PersonaScored = ProfileResult & { persona_fit: PersonaFitResult };
type IcpScored = ProfileResult & { icp_score: number };

/** Leads with a persona fit, ranked by fit score (FR-15-008). */
export function topPersonaMatches(results: ProfileResult[], limit = TOP_MATCHES): PersonaScored[] {
  return results
    .filter((result): result is PersonaScored => Boolean(result.persona_fit))
    .sort((a, b) => b.persona_fit.fit_score - a.persona_fit.fit_score)
    .slice(0, limit);
}

/** The highest ICP-scored lead, if any were scored (FR-15-009). */
export function highestScored(results: ProfileResult[]): IcpScored | undefined {
  return results
    .filter((result): result is IcpScored => typeof result.icp_score === 'number')
    .sort((a, b) => b.icp_score - a.icp_score)[0];
}

export function buildDemoReport(result: RunBatchResult, persona?: string): string[] {
  const { summary, results, summaryPath, csvPath } = result;
  const lines: string[] = [];

  lines.push('=== Lead Scoring Demo Results ===');
  lines.push(`Total leads: ${summary.total}`);
  lines.push(
    `Processed: ${summary.processed}  Rejected: ${summary.rejected}  Errors: ${summary.errors}`,
  );
  lines.push('Bucket distribution:');
  for (const bucket of BUCKETS) {
    lines.push(`  ${bucket.padEnd(8)} ${summary.bucketDistribution[bucket]}`);
  }
  lines.push(`Average ICP score: ${summary.averageScore}/100`);

  if (persona) {
    lines.push(`Top persona matches (${persona}):`);
    const top = topPersonaMatches(results);
    if (top.length === 0) {
      lines.push('  (no persona fits computed)');
    }
    top.forEach((entry, index) => {
      const fit = entry.persona_fit;
      lines.push(`  ${index + 1}. ${entry.profile_name} — ${fit.fit_score}/100 (${fit.bucket})`);
      if (fit.gap_analysis.length > 0) {
        lines.push(`     Gaps: ${fit.gap_analysis.join('; ')}`);
      }
    });
  }

  const best = highestScored(results);
  if (best?.outreach_email) {
    lines.push(`Sample outreach email — ${best.profile_name}:`);
    lines.push(`  Subject: ${best.outreach_email.subject}`);
    for (const bodyLine of best.outreach_email.body.split('\n')) {
      lines.push(`  ${bodyLine}`);
    }
  }

  lines.push('Result files:');
  lines.push(`  Summary: ${summaryPath}`);
  lines.push(`  CSV:     ${csvPath}`);
  return lines;
}
