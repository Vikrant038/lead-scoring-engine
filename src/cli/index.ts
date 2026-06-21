/**
 * CLI entry point (F-01). Loads env, composes logger + LLM client, runs the batch over the
 * configured input directory, and prints a ranked report (FR-01-001/010).
 */
import { config as loadEnv } from 'dotenv';
import { defaultConfig } from '../config/config';
import type { AppConfig } from '../config/config.schema';
import type { BatchSummary } from '../domain/io.types';
import { createLogger, type Logger, type LogLevel } from '../lib/logger/logger';
import { createLlmClient, type LlmEnv } from '../llm/llm-client.factory';
import { runBatch, type RunBatchResult } from '../batch/run-batch';

const TOP_N = 10;

export interface CliDeps {
  config?: AppConfig;
  logger?: Logger;
  env?: LlmEnv & { LOG_LEVEL?: string };
  print?: (line: string) => void;
}

/** Build the ranked, human-readable batch report (FR-01-010). Pure for easy testing. */
export function formatReport(summary: BatchSummary): string {
  const lines: string[] = [];
  const rule = '='.repeat(48);
  lines.push(rule, 'ICP PROFILER — BATCH SUMMARY', rule);
  lines.push(
    `Total: ${summary.total} | Processed: ${summary.processed} | ` +
      `Rejected: ${summary.rejected} | Errors: ${summary.errors}`,
  );
  lines.push(`Average ICP score: ${summary.averageScore}/100`, '');

  lines.push('Bucket distribution:');
  for (const [bucket, count] of Object.entries(summary.bucketDistribution)) {
    lines.push(`  ${bucket.padEnd(8)} ${count}`);
  }
  lines.push('');

  const top = summary.results
    .filter((result) => typeof result.icp_score === 'number')
    .sort((a, b) => (b.icp_score ?? 0) - (a.icp_score ?? 0))
    .slice(0, TOP_N);
  lines.push(`Top ${top.length} leads:`);
  if (top.length === 0) {
    lines.push('  (no scored leads)');
  }
  top.forEach((result, index) => {
    lines.push(
      `  ${index + 1}. ${result.profile_name} — ${result.icp_score}/100 ` +
        `(${result.bucket}) [${result._recordId}]`,
    );
  });
  return lines.join('\n');
}

export async function runCli(deps: CliDeps = {}): Promise<RunBatchResult> {
  const config = deps.config ?? defaultConfig;
  const env = deps.env ?? (process.env as LlmEnv & { LOG_LEVEL?: string });
  const logger = deps.logger ?? createLogger({ level: (env.LOG_LEVEL as LogLevel) ?? 'info' });
  const print =
    deps.print ??
    ((line: string): void => {
      process.stdout.write(`${line}\n`);
    });

  const llm = createLlmClient(env, config.llm.timeout, logger);
  const result = await runBatch({
    inputDir: config.paths.inputDir,
    outputDir: config.paths.outputDir,
    config,
    logger,
    llm,
  });
  print(formatReport(result.summary));
  return result;
}

/* istanbul ignore next -- entry glue, exercised by `npm start` not unit tests */
async function main(): Promise<void> {
  loadEnv(); // FR-01-001
  await runCli();
}

/* istanbul ignore next -- direct-execution guard */
if (require.main === module) {
  main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
