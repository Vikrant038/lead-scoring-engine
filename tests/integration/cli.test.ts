import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../../src/config/config';
import type { BatchSummary } from '../../src/domain/types';
import type { ProfileResult } from '../../src/domain/types';
import { formatReport, runCli } from '../../src/cli/index';
import { silentLogger } from '../helpers/test-deps';

describe('formatReport (unit)', () => {
  it('should rank scored leads top-down and note when none are scored', () => {
    const result = (recordId: string, score: number): ProfileResult => ({
      _recordId: recordId,
      profile_name: recordId,
      status: 'PROCESSED',
      icp_score: score,
      bucket: 'HIGH',
      timestamp: '',
    });
    const summary: BatchSummary = {
      total: 2,
      processed: 2,
      rejected: 0,
      errors: 0,
      bucketDistribution: { HIGH: 2, MEDIUM: 0, LOW: 0, 'NOT FIT': 0 },
      averageScore: 75,
      generatedAt: '',
      results: [result('low', 60), result('high', 90)],
    };

    const report = formatReport(summary);
    expect(report).toContain('BATCH SUMMARY');
    expect(report).toContain('Average ICP score: 75/100');
    // highest score is ranked first
    expect(report.indexOf('1. high')).toBeLessThan(report.indexOf('2. low'));

    const empty = formatReport({ ...summary, results: [] });
    expect(empty).toContain('(no scored leads)');
  });
});

describe('runCli (integration)', () => {
  let root: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'cli-'));
    fs.mkdirSync(path.join(root, 'input'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should run the batch over the configured input dir and print a report', async () => {
    // Arrange
    fs.writeFileSync(
      path.join(root, 'input', 'lead.json'),
      JSON.stringify({
        name: 'Jane',
        education: ['MBA @ Harvard University'],
        jobs: ['CTO @ Google'],
      }),
    );
    const config = {
      ...defaultConfig,
      paths: {
        ...defaultConfig.paths,
        inputDir: path.join(root, 'input'),
        outputDir: path.join(root, 'output'),
      },
    };
    const printed: string[] = [];

    // Act
    const result = await runCli({
      config,
      logger: silentLogger,
      env: { AI_PROVIDER: 'none' },
      print: (line) => printed.push(line),
    });

    // Assert
    expect(result.summary.total).toBe(1);
    expect(result.summary.processed).toBe(1);
    expect(printed.join('\n')).toContain('1. Jane');
    expect(fs.existsSync(path.join(root, 'output', 'lead_result.json'))).toBe(true);
  });

  it('should produce a zeroed run for an empty input directory', async () => {
    const config = {
      ...defaultConfig,
      paths: {
        ...defaultConfig.paths,
        inputDir: path.join(root, 'input'), // empty -> total 0
        outputDir: path.join(root, 'output'),
      },
    };
    const result = await runCli({
      config,
      logger: silentLogger,
      env: { AI_PROVIDER: 'none' },
      print: () => undefined,
    });
    expect(result.summary.total).toBe(0);
  });
});
