import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { FileHandlerRepository } from '../../src/repositories/file-handler.repository';
import { NotFoundError } from '../../src/lib/errors/domain-errors';
import { createLogger } from '../../src/lib/logger/logger';
import type { ProfileResult } from '../../src/domain/types';

const silentLogger = createLogger(
  { level: 'error' },
  new Writable({ write: (_c, _e, cb) => cb() }),
);

function makeResult(recordId: string, overrides: Partial<ProfileResult> = {}): ProfileResult {
  return {
    _recordId: recordId,
    profile_name: 'Jane Doe',
    status: 'PROCESSED',
    icp_score: 88.5,
    bucket: 'HIGH',
    priority: 'Priority Outreach',
    expected_conversion: '30-45%',
    component_scores: { education: 100, experience: 80, thinking: 90, recencyBonus: 5 },
    timestamp: '2026-06-21T10:00:00.000Z',
    ...overrides,
  };
}

describe('FileHandlerRepository (integration)', () => {
  let root: string;
  let repo: FileHandlerRepository;
  let inputDir: string;
  let outputDir: string;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'fh-'));
    inputDir = path.join(root, 'input');
    outputDir = path.join(root, 'output');
    repo = new FileHandlerRepository({ inputDir, outputDir }, silentLogger);
    repo.ensureDirectories();
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should create input and output directories', () => {
    expect(fs.existsSync(inputDir)).toBe(true);
    expect(fs.existsSync(outputDir)).toBe(true);
  });

  it('should assign record ids by filename, array index, and preserve explicit ids (F-08)', () => {
    // Arrange
    fs.writeFileSync(path.join(inputDir, 'solo.json'), JSON.stringify({ name: 'Solo' }));
    fs.writeFileSync(
      path.join(inputDir, 'batch.json'),
      JSON.stringify([{ name: 'X' }, { name: 'Y' }]),
    );
    fs.writeFileSync(
      path.join(inputDir, 'cust.json'),
      JSON.stringify({ _recordId: 'CUST1', name: 'Z' }),
    );
    // Act
    const profiles = repo.readInputFiles();
    const ids = profiles.map((p) => p._recordId).sort();
    // Assert
    expect(ids).toEqual(['CUST1', 'batch_0', 'batch_1', 'solo']);
    expect(profiles.every((p) => typeof p._sourceFile === 'string')).toBe(true);
  });

  it('should ignore non-json and skip invalid json files', () => {
    fs.writeFileSync(path.join(inputDir, 'notes.txt'), 'ignore me');
    fs.writeFileSync(path.join(inputDir, 'broken.json'), '{ not valid json');
    fs.writeFileSync(path.join(inputDir, 'ok.json'), JSON.stringify({ name: 'Ok' }));

    const profiles = repo.readInputFiles();
    expect(profiles).toHaveLength(1);
    expect(profiles[0]._recordId).toBe('ok');
  });

  it('should write and read back a per-lead result, throwing NotFound when missing', () => {
    repo.writeProfileResult(makeResult('rec_001'));
    expect(repo.readResult('rec_001').profile_name).toBe('Jane Doe');
    expect(() => repo.readResult('missing')).toThrow(NotFoundError);
  });

  it('should confine a hostile recordId to the output directory (SEC-06)', () => {
    // Act
    repo.writeProfileResult(makeResult('../../evil'));
    // Assert — file lands inside outputDir, not above it
    expect(fs.existsSync(path.join(outputDir, 'evil_result.json'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'evil_result.json'))).toBe(false);
    expect(repo.readResult('../../evil').status).toBe('PROCESSED');
  });

  it('should export CSV with header and properly escaped fields (FR-07-003)', () => {
    // Arrange — explanation contains comma, quote, and newline
    const tricky = makeResult('rec_csv', { explanation: 'Great fit, "really".\nStrong.' });
    // Act
    const csvPath = repo.writeCsvExport([tricky], new Date('2026-06-21T10:00:00.000Z'));
    const content = fs.readFileSync(csvPath, 'utf8');
    // Assert — assert on full content (the field itself contains a newline)
    expect(content.startsWith('Record ID,Name,ICP Score')).toBe(true);
    expect(content).toContain('"Great fit, ""really"".\nStrong."');
  });

  it('should resolve a result path and read empty lists when dirs are absent', () => {
    // resultPath returns the file once written, throws NotFound otherwise
    expect(() => repo.resultPath('ghost')).toThrow(NotFoundError);
    repo.writeProfileResult(makeResult('present'));
    expect(repo.resultPath('present')).toBe(path.join(outputDir, 'present_result.json'));

    // empty-directory branches
    const emptyRepo = new FileHandlerRepository(
      { inputDir: path.join(root, 'none-in'), outputDir: path.join(root, 'none-out') },
      silentLogger,
    );
    expect(emptyRepo.readInputFiles()).toEqual([]);
    expect(emptyRepo.listResults()).toEqual([]);
  });

  it('should write a summary file and list stored results', () => {
    repo.writeProfileResult(makeResult('a'));
    repo.writeProfileResult(makeResult('b'));
    const summaryPath = repo.writeSummary(
      {
        total: 2,
        processed: 2,
        rejected: 0,
        errors: 0,
        bucketDistribution: { HIGH: 2, MEDIUM: 0, LOW: 0, 'NOT FIT': 0 },
        averageScore: 88.5,
        generatedAt: '2026-06-21T10:00:00.000Z',
        results: [],
      },
      new Date('2026-06-21T10:00:00.000Z'),
    );
    expect(fs.existsSync(summaryPath)).toBe(true);
    expect(
      repo
        .listResults()
        .map((r) => r._recordId)
        .sort(),
    ).toEqual(['a', 'b']);
  });
});
