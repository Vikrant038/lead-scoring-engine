import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../../src/config/config';
import { NullProvider } from '../../src/llm/null.provider';
import { PersonaRepository } from '../../src/repositories/persona.repository';
import type { AppConfig } from '../../src/config/config';
import type { ProfileResult } from '../../src/domain/types';
import type { RunBatchResult } from '../../src/batch/run-batch';
import { parseDemoArgs } from '../../src/demo/demo-args';
import { loadFallbackProfiles, writeDemoInput } from '../../src/demo/demo-input';
import { buildDemoReport, highestScored, topPersonaMatches } from '../../src/demo/demo-report';
import {
  loadDemoPersona,
  resolveProfiles,
  runDemo,
  type DemoContext,
} from '../../src/demo/run-demo';
import { fakeLlm, silentLogger } from '../helpers/test-deps';

const FALLBACK_PATH = path.join(process.cwd(), 'data', 'demo-fallback.json');

describe('parseDemoArgs', () => {
  it('applies defaults when no flags are passed', () => {
    expect(parseDemoArgs([])).toEqual({
      count: 15,
      noAi: false,
      output: './demo-output',
      quiet: false,
      html: false,
    });
  });

  it('parses all flags', () => {
    const opts = parseDemoArgs([
      '--count',
      '8',
      '--persona',
      'cto',
      '--output',
      '/tmp/out',
      '--no-ai',
      '--quiet',
    ]);
    expect(opts).toEqual({
      count: 8,
      persona: 'cto',
      output: '/tmp/out',
      noAi: true,
      quiet: true,
      html: false,
    });
  });

  it('ignores an invalid count and a value-less persona/output', () => {
    expect(parseDemoArgs(['--count', 'abc']).count).toBe(15);
    expect(parseDemoArgs(['--count', '-3']).count).toBe(15);
    expect(parseDemoArgs(['--persona']).persona).toBeUndefined();
    expect(parseDemoArgs(['--output']).output).toBe('./demo-output');
    expect(parseDemoArgs(['--unknown']).count).toBe(15);
  });
});

describe('demo-input', () => {
  it('loads and validates the packaged fallback dataset', () => {
    const profiles = loadFallbackProfiles(FALLBACK_PATH);
    expect(profiles.length).toBeGreaterThanOrEqual(15);
    expect(profiles[0].name).toBeTruthy();
  });

  it('throws on an invalid fallback dataset', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-in-'));
    const bad = path.join(root, 'bad.json');
    fs.writeFileSync(bad, JSON.stringify([{ notName: 1 }]));
    expect(() => loadFallbackProfiles(bad)).toThrow(/demo-fallback/);
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('writes profiles to an isolated demo-input file', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-in-'));
    const target = writeDemoInput(
      [{ name: 'X', education: ['e'], jobs: ['j @ Z'] }],
      path.join(root, 'demo-input'),
    );
    expect(fs.existsSync(target)).toBe(true);
    expect(JSON.parse(fs.readFileSync(target, 'utf8'))[0].name).toBe('X');
    fs.rmSync(root, { recursive: true, force: true });
  });
});

describe('demo-report', () => {
  function result(overrides: Partial<RunBatchResult> = {}): RunBatchResult {
    return {
      summary: {
        total: 2,
        processed: 2,
        rejected: 0,
        errors: 0,
        bucketDistribution: { HIGH: 1, MEDIUM: 1, LOW: 0, 'NOT FIT': 0 },
        averageScore: 70,
        generatedAt: '2026-01-01T00:00:00.000Z',
        results: [],
      },
      results: [],
      summaryPath: '/out/summary.json',
      csvPath: '/out/scores.csv',
      ...overrides,
    };
  }

  const leadA = {
    _recordId: 'a',
    profile_name: 'Alice',
    status: 'PROCESSED',
    icp_score: 90,
    bucket: 'HIGH',
    persona_fit: {
      persona_name: 'CTO',
      fit_score: 95,
      bucket: 'Excellent Fit',
      gap_analysis: ['missing skill: Rust'],
    },
    outreach_email: { subject: 'Hi Alice', body: 'Line 1\nLine 2' },
    timestamp: 't',
  } as ProfileResult;
  const leadB = {
    _recordId: 'b',
    profile_name: 'Bob',
    status: 'PROCESSED',
    icp_score: 60,
    bucket: 'MEDIUM',
    persona_fit: { persona_name: 'CTO', fit_score: 50, bucket: 'Partial Fit', gap_analysis: [] },
    timestamp: 't',
  } as ProfileResult;

  it('ranks persona matches and finds the highest scored lead', () => {
    expect(topPersonaMatches([leadB, leadA]).map((r) => r._recordId)).toEqual(['a', 'b']);
    expect(topPersonaMatches([leadB, leadA], 1).map((r) => r._recordId)).toEqual(['a']);
    expect(highestScored([leadB, leadA])?._recordId).toBe('a');
    expect(highestScored([])).toBeUndefined();
  });

  it('renders core stats, persona matches, gaps, and a sample email', () => {
    const lines = buildDemoReport(result({ results: [leadA, leadB] }), 'CTO').join('\n');
    expect(lines).toContain('Total leads: 2');
    expect(lines).toContain('Top persona matches (CTO):');
    expect(lines).toContain('1. Alice — 95/100 (Excellent Fit)');
    expect(lines).toContain('Gaps: missing skill: Rust');
    expect(lines).toContain('Sample outreach email — Alice:');
    expect(lines).toContain('Subject: Hi Alice');
    expect(lines).toContain('Summary: /out/summary.json');
  });

  it('notes when no persona fits exist and omits the email block', () => {
    const lines = buildDemoReport(result({ results: [] }), 'CTO').join('\n');
    expect(lines).toContain('(no persona fits computed)');
    expect(lines).not.toContain('Sample outreach email');
  });

  it('omits the persona section entirely when no persona is active', () => {
    const lines = buildDemoReport(result({ results: [leadB] }));
    expect(lines.join('\n')).not.toContain('Top persona matches');
  });
});

describe('run-demo', () => {
  let root: string;
  let config: AppConfig;

  function context(overrides: Partial<DemoContext>): DemoContext {
    return {
      options: { count: 3, noAi: false, output: path.join(root, 'out'), quiet: true, html: false },
      config,
      logger: silentLogger,
      llm: new NullProvider(),
      print: jest.fn(),
      fallbackPath: FALLBACK_PATH,
      ...overrides,
    };
  }

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'demo-'));
    config = {
      ...defaultConfig,
      paths: { ...defaultConfig.paths, personasDir: path.join(root, 'personas') },
    };
  });
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

  it('loads a configured persona and degrades when it is missing', () => {
    new PersonaRepository(config.paths.personasDir, silentLogger).save('cto', {
      name: 'CTO',
      description: 'tech leaders',
      skills_must_have: ['Leadership'],
    });
    expect(
      loadDemoPersona(
        context({
          options: { count: 3, persona: 'cto', noAi: true, output: root, quiet: true, html: false },
        }),
      )?.name,
    ).toBe('CTO');
    expect(
      loadDemoPersona(
        context({
          options: {
            count: 3,
            persona: 'ghost',
            noAi: true,
            output: root,
            quiet: true,
            html: false,
          },
        }),
      ),
    ).toBeUndefined();
    expect(loadDemoPersona(context({}))).toBeUndefined();
  });

  it('uses the fallback dataset when AI is disabled', async () => {
    const { profiles, source } = await resolveProfiles(
      context({ options: { count: 3, noAi: true, output: root, quiet: true, html: false } }),
    );
    expect(source).toBe('fallback');
    expect(profiles.length).toBeGreaterThanOrEqual(15);
  });

  it('uses AI-generated profiles when available, and falls back on failure', async () => {
    const aiLeads = [
      { name: 'Gen One', education: ['MBA @ Harvard University'], jobs: ['CTO @ Google'] },
    ];
    const ok = await resolveProfiles(
      context({
        llm: fakeLlm({ generateProfiles: async () => ({ success: true, data: aiLeads }) }),
      }),
    );
    expect(ok.source).toBe('ai');
    expect(ok.profiles[0].name).toBe('Gen One');

    const degraded = await resolveProfiles(context({ llm: fakeLlm() })); // generateProfiles → FAIL
    expect(degraded.source).toBe('fallback');
  });

  it('runs the full batch end-to-end and prints a report (no AI)', async () => {
    const print = jest.fn();
    const ctx = context({
      options: { count: 3, noAi: true, output: path.join(root, 'out'), quiet: true, html: false },
      print,
    });
    const result = await runDemo(ctx);
    expect(result.summary.total).toBeGreaterThanOrEqual(15);
    expect(fs.existsSync(result.csvPath)).toBe(true);
    expect(fs.existsSync(path.join(root, 'out', 'demo-input', 'demo-leads.json'))).toBe(true);
    expect(print).toHaveBeenCalledWith(
      expect.stringContaining('=== Lead Scoring Demo Results ==='),
    );
  });

  it('scores against a persona when one is provided', async () => {
    new PersonaRepository(config.paths.personasDir, silentLogger).save('cto', {
      name: 'CTO',
      description: 'tech leaders',
      skills_must_have: ['Leadership'],
    });
    const ctx = context({
      options: {
        count: 3,
        persona: 'cto',
        noAi: true,
        output: path.join(root, 'out'),
        quiet: true,
      },
    });
    const result = await runDemo(ctx);
    expect(result.results.some((r) => r.persona_fit)).toBe(true);
  });
});
