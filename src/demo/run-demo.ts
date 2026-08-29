/**
 * Self-demo orchestration (F-15). Resolves synthetic leads (AI or fallback), runs the full batch
 * pipeline over an isolated directory (FR-15-011), and prints a summary. All dependencies are
 * injected so the flow is deterministically testable; the thin entry glue lives in `demo.ts`.
 */
import path from 'node:path';
import { runBatch, type RunBatchResult } from '../batch/run-batch';
import type { AppConfig } from '../config/config';
import type { EmailSettings } from '../domain/types';
import type { Persona } from '../domain/types';
import type { Profile } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import type { LLMClient } from '../llm/llm-client.interface';
import { PersonaRepository } from '../repositories/persona.repository';
import type { DemoOptions } from './demo-args';
import { loadFallbackProfiles, writeDemoInput } from './demo-input';
import { buildDemoReport } from './demo-report';

const DEMO_EMAIL_SETTINGS: EmailSettings = {
  senderName: 'Demo User',
  company: 'Demo Co',
  tone: 'professional',
};

export interface DemoContext {
  options: DemoOptions;
  config: AppConfig;
  logger: Logger;
  llm: LLMClient;
  print: (line: string) => void;
  /** Absolute path to the packaged fallback dataset. */
  fallbackPath: string;
}

export type ProfileSource = 'ai' | 'fallback';

/** Load the requested persona, degrading gracefully to none if it is missing (FR-15-007). */
export function loadDemoPersona(ctx: DemoContext): Persona | undefined {
  if (!ctx.options.persona) {
    return undefined;
  }
  try {
    return new PersonaRepository(ctx.config.paths.personasDir, ctx.logger).get(ctx.options.persona);
  } catch {
    ctx.logger.warn({ persona: ctx.options.persona }, 'persona not found; scoring without it');
    return undefined;
  }
}

/** Generate leads via the LLM when available, otherwise use the fallback dataset (FR-15-003/005). */
export async function resolveProfiles(
  ctx: DemoContext,
  persona?: Persona,
): Promise<{ profiles: Profile[]; source: ProfileSource }> {
  if (!ctx.options.noAi && ctx.llm.available) {
    const response = await ctx.llm.generateProfiles({
      count: ctx.options.count,
      personaDescription: persona?.description,
    });
    if (response.success && response.data && response.data.length > 0) {
      return { profiles: response.data, source: 'ai' };
    }
    ctx.logger.warn('AI profile generation failed; falling back to packaged dataset');
  }
  return { profiles: loadFallbackProfiles(ctx.fallbackPath), source: 'fallback' };
}

export async function runDemo(ctx: DemoContext): Promise<RunBatchResult> {
  const persona = loadDemoPersona(ctx);
  const { profiles, source } = await resolveProfiles(ctx, persona);

  const demoInputDir = path.join(ctx.options.output, 'demo-input');
  writeDemoInput(profiles, demoInputDir);

  const result = await runBatch({
    inputDir: demoInputDir,
    outputDir: ctx.options.output,
    config: ctx.config,
    logger: ctx.logger,
    llm: ctx.llm,
    persona,
    emailSettings: DEMO_EMAIL_SETTINGS,
  });

  ctx.print(`Dataset: ${source} (${profiles.length} leads)`);
  for (const line of buildDemoReport(result, ctx.options.persona)) {
    ctx.print(line);
  }
  return result;
}
