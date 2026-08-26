/**
 * File persistence repository (F-07, F-08). Reads input profiles, assigns record ids, and writes
 * per-lead results, the batch summary, and the CSV export. All output paths pass through the
 * path-guard (SEC-05/06). Synchronous fs is acceptable at this scale (PERF-06).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { InputProfile, BatchSummary } from '../domain/io.types';
import type { ProfileResult } from '../domain/result.types';
import type { Logger } from '../lib/logger/logger';
import { NotFoundError } from '../lib/errors/domain-errors';
import { resolveWithin, resultFileName } from '../lib/security/path-guard';

const CSV_COLUMNS = [
  'Record ID',
  'Name',
  'ICP Score',
  'Bucket',
  'Priority',
  'Expected Conversion',
  'Education Score',
  'Experience Score',
  'Thinking Score',
  'Explanation',
  'Persona Fit Score',
  'Email Subject',
  'Email Body',
] as const;

export interface FileHandlerPaths {
  inputDir: string;
  outputDir: string;
}

function sanitizeJson<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeJson(item)) as unknown as T;
  }
  const clean: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (key !== '__proto__' && key !== 'constructor' && key !== 'prototype') {
      clean[key] = sanitizeJson(val);
    }
  }
  return clean as T;
}

export class FileHandlerRepository {
  constructor(
    private readonly paths: FileHandlerPaths,
    private readonly logger: Logger,
  ) {}

  /** Create the input and output directories if absent (FR-01-002). */
  ensureDirectories(): void {
    for (const dir of [this.paths.inputDir, this.paths.outputDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        this.logger.info({ dir }, 'created directory');
      }
    }
  }

  /**
   * Read every `.json` file in the input directory and flatten to a list of profiles, each
   * annotated with a record id (FR-01-003/004, FR-08). Invalid JSON files are logged and skipped.
   */
  readInputFiles(): InputProfile[] {
    if (!fs.existsSync(this.paths.inputDir)) {
      return [];
    }
    const files = fs.readdirSync(this.paths.inputDir).filter((file) => file.endsWith('.json'));
    const profiles: InputProfile[] = [];

    for (const file of files) {
      const stem = file.replace(/\.json$/i, '');
      let data: unknown;
      try {
        const raw = fs.readFileSync(resolveWithin(this.paths.inputDir, file), 'utf8');
        data = sanitizeJson(JSON.parse(raw));
      } catch (error) {
        this.logger.warn({ file, error: (error as Error).message }, 'skipping invalid JSON file');
        continue;
      }

      if (Array.isArray(data)) {
        data.forEach((entry, index) => {
          profiles.push(this.annotate(entry, this.recordIdFor(entry, `${stem}_${index}`), file));
        });
      } else {
        profiles.push(this.annotate(data, this.recordIdFor(data, stem), file));
      }
    }

    return profiles;
  }

  /** Read and annotate the profiles from a single input file (used by the web job processor). */
  readSingleFile(fileName: string): InputProfile[] {
    const filePath = resolveWithin(this.paths.inputDir, fileName);
    if (!fs.existsSync(filePath)) {
      return [];
    }
    const stem = fileName.replace(/\.json$/i, '');
    const data: unknown = sanitizeJson(JSON.parse(fs.readFileSync(filePath, 'utf8')));
    if (Array.isArray(data)) {
      return data.map((entry, index) =>
        this.annotate(entry, this.recordIdFor(entry, `${stem}_${index}`), fileName),
      );
    }
    return [this.annotate(data, this.recordIdFor(data, stem), fileName)];
  }

  /** Write a single lead result to `{recordId}_result.json` (FR-07-001). */
  writeProfileResult(result: ProfileResult): void {
    const target = resolveWithin(this.paths.outputDir, resultFileName(result._recordId));
    fs.writeFileSync(target, JSON.stringify(result, null, 2));
  }

  /** Write the batch summary to `batch_summary_{timestamp}.json` (FR-07-002). */
  writeSummary(summary: BatchSummary, now: Date = new Date()): string {
    const target = resolveWithin(this.paths.outputDir, `batch_summary_${this.timestamp(now)}.json`);
    fs.writeFileSync(target, JSON.stringify(summary, null, 2));
    return target;
  }

  /** Write the CSV export to `icp_scores_{timestamp}.csv` (FR-07-003). */
  writeCsvExport(results: ProfileResult[], now: Date = new Date()): string {
    const target = resolveWithin(this.paths.outputDir, `icp_scores_${this.timestamp(now)}.csv`);
    const rows = results.map((result) => this.toCsvRow(result));
    const content = [CSV_COLUMNS.join(','), ...rows].join('\n');
    fs.writeFileSync(target, content);
    return target;
  }

  /** Read one stored result by record id (for download/history); NotFound if absent. */
  readResult(recordId: string): ProfileResult {
    const target = resolveWithin(this.paths.outputDir, resultFileName(recordId));
    if (!fs.existsSync(target)) {
      throw new NotFoundError('Result', recordId);
    }
    return sanitizeJson(JSON.parse(fs.readFileSync(target, 'utf8'))) as ProfileResult;
  }

  /** Resolve the absolute file path for a record id's result (for streamed downloads). */
  resultPath(recordId: string): string {
    const target = resolveWithin(this.paths.outputDir, resultFileName(recordId));
    if (!fs.existsSync(target)) {
      throw new NotFoundError('Result', recordId);
    }
    return target;
  }

  /** Read all stored results in the output directory (F-17 history). */
  listResults(): ProfileResult[] {
    if (!fs.existsSync(this.paths.outputDir)) {
      return [];
    }
    return fs
      .readdirSync(this.paths.outputDir)
      .filter((file) => file.endsWith('_result.json'))
      .map((file) => {
        const raw = fs.readFileSync(path.join(this.paths.outputDir, file), 'utf8');
        return sanitizeJson(JSON.parse(raw)) as ProfileResult;
      });
  }

  private recordIdFor(entry: unknown, fallback: string): string {
    if (entry && typeof entry === 'object' && '_recordId' in entry) {
      const existing = (entry as Record<string, unknown>)._recordId;
      if (typeof existing === 'string' && existing.length > 0) {
        return existing;
      }
    }
    return fallback;
  }

  private annotate(entry: unknown, recordId: string, sourceFile: string): InputProfile {
    const base = entry && typeof entry === 'object' ? (entry as Record<string, unknown>) : {};
    return { ...base, _recordId: recordId, _sourceFile: sourceFile } as InputProfile;
  }

  private timestamp(date: Date): string {
    return date.toISOString().replace(/[:.]/g, '-');
  }

  private toCsvRow(result: ProfileResult): string {
    const fields: (string | number | undefined)[] = [
      result._recordId,
      result.profile_name,
      result.icp_score,
      result.bucket,
      result.priority,
      result.expected_conversion,
      result.component_scores?.education,
      result.component_scores?.experience,
      result.component_scores?.thinking,
      result.explanation ?? undefined,
      result.persona_fit?.fit_score,
      result.outreach_email?.subject,
      result.outreach_email?.body,
    ];
    return fields.map((field) => this.escapeCsv(field)).join(',');
  }

  private escapeCsv(field: string | number | undefined): string {
    if (field === undefined || field === null) {
      return '';
    }
    let value = String(field);
    // Neutralize CSV formula injection (DDE / Excel formula execution)
    if (/^[=+\-@\t\r]/.test(value)) {
      value = `'${value}`;
    }
    if (/[",\n\r]/.test(value)) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}
