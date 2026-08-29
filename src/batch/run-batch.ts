/**
 * Reusable batch pipeline (MAIN-03, F-01). Composes the pipeline services and processes every
 * input profile sequentially, writing per-lead results, a batch summary, and a CSV export.
 * Shared by the CLI (Unit 8) and the demo (Unit 12).
 */
import type { AppConfig } from '../config/config.schema';
import type { BatchSummary } from '../domain/types';
import type { Bucket, ProfileResult } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import type { LLMClient } from '../llm/llm-client.interface';
import { FileHandlerRepository } from '../repositories/file-handler.repository';
import { DataQualityService } from '../modules/data-quality.service';
import { EducationService } from '../modules/education.service';
import { ExperienceService } from '../modules/experience.service';
import { ThinkingQualityService } from '../modules/thinking-quality.service';
import { ScorerService } from '../modules/scorer.service';
import { PersonaMatcherService } from '../modules/persona-matcher.service';
import { ExplanationService } from '../modules/explanation.service';
import { OutreachEmailService } from '../modules/outreach-email.service';
import {
  ProfilerService,
  type EmailGenerator,
  type ExplanationGenerator,
  type ProfileOptions,
} from '../modules/profiler.service';

export interface PipelineExtras {
  explanation?: ExplanationGenerator;
  email?: EmailGenerator;
}

/** Compose a ProfilerService with all pipeline collaborators (reused by CLI, demo, and web). */
export function createProfiler(
  config: AppConfig,
  logger: Logger,
  llm: LLMClient,
  extras: PipelineExtras = {},
): ProfilerService {
  const serperApiKey = process.env.SERPER_API_KEY;
  return new ProfilerService(config, logger, {
    dataQuality: new DataQualityService(logger),
    education: new EducationService(config, logger, llm, serperApiKey),
    experience: new ExperienceService(config, logger, llm, serperApiKey),
    thinking: new ThinkingQualityService(config, logger),
    scorer: new ScorerService(config, logger),
    personaMatcher: new PersonaMatcherService(config, logger),
    // Auto-wire the AI post-processors; they self-degrade to null when the LLM is unavailable
    // (FR-13-005/FR-14), so callers get AI for free when a key is configured.
    explanation: extras.explanation ?? new ExplanationService(llm, logger),
    email: extras.email ?? new OutreachEmailService(llm, logger),
  });
}

export interface RunBatchOptions extends ProfileOptions, PipelineExtras {
  inputDir: string;
  outputDir: string;
  config: AppConfig;
  logger: Logger;
  llm: LLMClient;
  /** Override the inter-profile delay (defaults to config.processing.batchDelayMs). */
  batchDelayMs?: number;
  now?: Date;
}

export interface RunBatchResult {
  summary: BatchSummary;
  results: ProfileResult[];
  summaryPath: string;
  csvPath: string;
}

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

export async function runBatch(options: RunBatchOptions): Promise<RunBatchResult> {
  const { config, logger, llm, inputDir, outputDir } = options;
  const now = options.now ?? new Date();
  const delay = options.batchDelayMs ?? config.processing.batchDelayMs;

  const fileHandler = new FileHandlerRepository({ inputDir, outputDir }, logger);
  fileHandler.ensureDirectories();
  const profiler = createProfiler(config, logger, llm, {
    explanation: options.explanation,
    email: options.email,
  });

  const profiles = fileHandler.readInputFiles();
  logger.info({ count: profiles.length }, 'processing batch');
  const results: ProfileResult[] = [];

  for (let index = 0; index < profiles.length; index += 1) {
    const result = await profiler.profile(profiles[index], {
      persona: options.persona,
      emailSettings: options.emailSettings,
    });
    fileHandler.writeProfileResult(result);
    results.push(result);

    if (delay > 0 && llm.available && index < profiles.length - 1) {
      await sleep(delay);
    }
  }

  const summary = summarise(profiles.length, results, now);
  const summaryPath = fileHandler.writeSummary(summary, now);
  const csvPath = fileHandler.writeCsvExport(results, now);
  return { summary, results, summaryPath, csvPath };
}

function summarise(total: number, results: ProfileResult[], now: Date): BatchSummary {
  const bucketDistribution: Record<Bucket, number> = { HIGH: 0, MEDIUM: 0, LOW: 0, 'NOT FIT': 0 };
  let processed = 0;
  let rejected = 0;
  let errors = 0;
  const scores: number[] = [];

  for (const result of results) {
    if (result.status === 'REJECTED') {
      rejected += 1;
    } else if (result.status === 'ERROR') {
      errors += 1;
    } else {
      processed += 1;
      if (result.bucket) bucketDistribution[result.bucket] += 1;
      if (typeof result.icp_score === 'number') scores.push(result.icp_score);
    }
  }

  const averageScore =
    scores.length > 0
      ? Math.round((scores.reduce((sum, value) => sum + value, 0) / scores.length) * 10) / 10
      : 0;

  return {
    total,
    processed,
    rejected,
    errors,
    bucketDistribution,
    averageScore,
    generatedAt: now.toISOString(),
    results,
  };
}
