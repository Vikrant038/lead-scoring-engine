/**
 * Self-demo entry point (F-15). Wires real env/logger/LLM, then runs the injected demo flow.
 * The orchestration and reporting live in `src/demo/` (unit-tested); this file is entry glue.
 * Phase 0: adds --html flag to produce a standalone HTML report.
 */
import fs from 'node:fs';
import path from 'node:path';
import { config as loadEnv } from 'dotenv';
import { defaultConfig } from './src/config/config';
import { createLogger, type LogLevel } from './src/lib/logger/logger';
import { createLlmClient, type LlmEnv } from './src/llm/llm-client.factory';
import { NullProvider } from './src/llm/null.provider';
import type { LLMClient } from './src/llm/llm-client.interface';
import { parseDemoArgs } from './src/demo/demo-args';
import { runDemo } from './src/demo/run-demo';
import { buildHtmlReport } from './src/demo/demo-html-report';

/* istanbul ignore next -- console output for demo runs */
function print(line: string): void {
  process.stdout.write(`${line}\n`);
}

/* istanbul ignore next -- entry glue: resolves real env/llm and is exercised by `npm run demo` */
async function main(): Promise<void> {
  loadEnv();
  const options = parseDemoArgs(process.argv.slice(2));
  const env = process.env as LlmEnv & { LOG_LEVEL?: string };
  const logger = createLogger({
    level: options.quiet ? 'error' : ((env.LOG_LEVEL as LogLevel) ?? 'info'),
  });

  const llm: LLMClient = options.noAi
    ? new NullProvider()
    : createLlmClient(env, defaultConfig.llm.timeout, logger);
  const aiActive = !options.noAi && llm.available;

  const config = {
    ...defaultConfig,
    features: { enableScoreExplanation: aiActive, enableEmailGeneration: aiActive },
  };

  const result = await runDemo({
    options,
    config,
    logger,
    llm,
    print,
    fallbackPath: path.join(process.cwd(), 'data', 'demo-fallback.json'),
  });

  if (options.html) {
    const html = buildHtmlReport(result, options.persona);
    const reportDir = path.resolve(options.output);
    fs.mkdirSync(reportDir, { recursive: true });
    const reportPath = path.join(reportDir, 'demo-report.html');
    fs.writeFileSync(reportPath, html, 'utf8');
    print(`\n✅ HTML report written to: ${reportPath}`);
    print('   Open it in your browser to see the full report.');
  }
}

/* istanbul ignore next -- direct-execution guard */
if (require.main === module) {
  main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { main };
