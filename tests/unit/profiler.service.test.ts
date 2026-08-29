import { defaultConfig } from '../../src/config/config';
import type { InputProfile } from '../../src/domain/types';
import { DataQualityService } from '../../src/modules/data-quality.service';
import { EducationService } from '../../src/modules/education.service';
import { ExperienceService } from '../../src/modules/experience.service';
import { ScorerService } from '../../src/modules/scorer.service';
import { ThinkingQualityService } from '../../src/modules/thinking-quality.service';
import { PersonaMatcherService } from '../../src/modules/persona-matcher.service';
import {
  ProfilerService,
  type EmailGenerator,
  type ExplanationGenerator,
  type PipelineServices,
} from '../../src/modules/profiler.service';
import { NullProvider } from '../../src/llm/null.provider';
import { createProfiler } from '../../src/batch/run-batch';
import { fakeLlm, silentLogger } from '../helpers/test-deps';

const input = (overrides: Partial<InputProfile> = {}): InputProfile => ({
  _recordId: 'r1',
  _sourceFile: 'f.json',
  name: 'Jane',
  ...overrides,
});

const strong = input({
  education: ['MBA @ Harvard University'],
  jobs: ['CTO @ Google'],
  skills: ['AI', 'Leadership', 'Strategy'],
});

const notFit = input({
  _recordId: 'nf',
  education: ['Local College'],
  jobs: ['Worker @ SmallCo'],
  skills: [],
});

describe('ProfilerService', () => {
  const profiler = createProfiler(defaultConfig, silentLogger, new NullProvider());

  it('should run the full pipeline and produce a PROCESSED result', async () => {
    const result = await profiler.profile(strong);
    expect(result.status).toBe('PROCESSED');
    expect(result.signals?.education?.tier).toBe('tier_1');
    expect(typeof result.icp_score).toBe('number');
    expect(result.component_scores).toBeDefined();
    expect(result._recordId).toBe('r1');
  });

  it('should reject a low-quality profile without scoring (FR-01-008)', async () => {
    const result = await profiler.profile(input({ name: '   ' }));
    expect(result.status).toBe('REJECTED');
    expect(result.reason).toMatch(/Data quality too low/);
    expect(result.icp_score).toBeUndefined();
  });

  it('should attach persona_fit when a persona is provided', async () => {
    const result = await profiler.profile(strong, {
      persona: { name: 'CTO', description: 'd', skills_must_have: ['AI'] },
    });
    expect(result.persona_fit?.persona_name).toBe('CTO');
  });

  it('should run explanation always and skip email for NOT FIT (FR-14-005)', async () => {
    const explanation: ExplanationGenerator = { generate: async () => 'A solid lead.' };
    const email: EmailGenerator = { generate: async () => ({ subject: 'S', body: 'B' }) };
    const withAi = createProfiler(defaultConfig, silentLogger, new NullProvider(), {
      explanation,
      email,
    });

    const processed = await withAi.profile(strong);
    expect(processed.explanation).toBe('A solid lead.');
    expect(processed.outreach_email).toEqual({ subject: 'S', body: 'B' });

    const excluded = await withAi.profile(notFit);
    expect(excluded.bucket).toBe('NOT FIT');
    expect(excluded.explanation).toBe('A solid lead.'); // explanation still runs
    expect(excluded.outreach_email).toBeUndefined(); // email skipped
  });

  it('should skip AI post-processing when the feature flags are disabled', async () => {
    const config = {
      ...defaultConfig,
      features: { enableScoreExplanation: false, enableEmailGeneration: false },
    };
    const aiLlm = fakeLlm({
      generateExplanation: async () => ({ success: true, data: 'x' }),
      generateEmail: async () => ({ success: true, data: { subject: 's', body: 'b' } }),
    });
    const result = await createProfiler(config, silentLogger, aiLlm).profile(strong);
    expect(result.explanation).toBeUndefined();
    expect(result.outreach_email).toBeUndefined();
  });

  it('should return an ERROR result when a pipeline stage throws', async () => {
    const throwingEducation = {
      extract: async () => {
        throw new Error('boom');
      },
    } as unknown as EducationService;
    const services: PipelineServices = {
      dataQuality: new DataQualityService(silentLogger),
      education: throwingEducation,
      experience: new ExperienceService(defaultConfig, silentLogger, new NullProvider()),
      thinking: new ThinkingQualityService(defaultConfig, silentLogger),
      scorer: new ScorerService(defaultConfig, silentLogger),
      personaMatcher: new PersonaMatcherService(defaultConfig, silentLogger),
    };
    const profilerWithError = new ProfilerService(defaultConfig, silentLogger, services);

    const result = await profilerWithError.profile(strong);
    expect(result).toMatchObject({ status: 'ERROR', error: 'boom' });
  });
});
