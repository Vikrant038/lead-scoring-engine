import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../../src/config/config';
import { NullProvider } from '../../src/llm/null.provider';
import { runBatch } from '../../src/batch/run-batch';
import { silentLogger, tierLlm } from '../helpers/test-deps';

describe('runBatch (integration)', () => {
  let root: string;
  let inputDir: string;
  let outputDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'batch-'));
    inputDir = path.join(root, 'input');
    outputDir = path.join(root, 'output');
    fs.mkdirSync(inputDir, { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should process every profile, write outputs, and summarise correctly', async () => {
    // Arrange — one strong single profile + an array (one scorable, one rejected)
    fs.writeFileSync(
      path.join(inputDir, 'p1.json'),
      JSON.stringify({
        name: 'Jane',
        education: ['MBA @ Harvard University'],
        jobs: ['CTO @ Google'],
        skills: ['AI'],
      }),
    );
    fs.writeFileSync(
      path.join(inputDir, 'p2.json'),
      JSON.stringify([
        { name: 'Bob', education: ['Local College'], jobs: ['Worker @ X'] },
        { name: '   ' }, // rejected: missing name/education/jobs
      ]),
    );

    // Act
    const { summary, summaryPath, csvPath } = await runBatch({
      inputDir,
      outputDir,
      config: defaultConfig,
      logger: silentLogger,
      llm: new NullProvider(),
      batchDelayMs: 0,
      now: new Date('2026-06-21T10:00:00.000Z'),
    });

    // Assert — counts
    expect(summary.total).toBe(3);
    expect(summary.processed).toBe(2);
    expect(summary.rejected).toBe(1);
    expect(summary.errors).toBe(0);

    // Assert — files written
    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(fs.existsSync(csvPath)).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'p1_result.json'))).toBe(true);
    expect(fs.existsSync(path.join(outputDir, 'p2_1_result.json'))).toBe(true);

    // Assert — strong lead processed and persisted with a numeric score and tier_1 education
    const p1 = JSON.parse(fs.readFileSync(path.join(outputDir, 'p1_result.json'), 'utf8'));
    expect(p1.status).toBe('PROCESSED');
    expect(p1.signals.education.tier).toBe('tier_1');
    expect(typeof p1.icp_score).toBe('number');
    expect(p1.icp_score).toBeGreaterThan(0);
  });

  it('should apply the inter-profile delay when the LLM is active', async () => {
    fs.writeFileSync(
      path.join(inputDir, 'a.json'),
      JSON.stringify({ name: 'A', education: ['x'], jobs: ['y @ Z'] }),
    );
    fs.writeFileSync(
      path.join(inputDir, 'b.json'),
      JSON.stringify({ name: 'B', education: ['x'], jobs: ['y @ Z'] }),
    );

    const { summary } = await runBatch({
      inputDir,
      outputDir,
      config: defaultConfig,
      logger: silentLogger,
      llm: tierLlm('tier_2'), // available -> delay path runs
      batchDelayMs: 1,
    });
    expect(summary.processed).toBe(2);
  });

  it('should return zeroed summary when there is no input', async () => {
    const { summary } = await runBatch({
      inputDir,
      outputDir,
      config: defaultConfig,
      logger: silentLogger,
      llm: new NullProvider(),
      batchDelayMs: 0,
    });
    expect(summary).toMatchObject({ total: 0, processed: 0, averageScore: 0 });
  });
});
