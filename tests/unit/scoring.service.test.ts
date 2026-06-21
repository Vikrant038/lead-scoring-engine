import { defaultConfig } from '../../src/config/config';
import type { Profile } from '../../src/domain/profile.types';
import { DataQualityService } from '../../src/modules/data-quality.service';
import { EducationService } from '../../src/modules/education.service';
import { ExperienceService } from '../../src/modules/experience.service';
import { ThinkingQualityService } from '../../src/modules/thinking-quality.service';
import { ScorerService } from '../../src/modules/scorer.service';
import { NullProvider } from '../../src/llm/null.provider';
import { fakeLlm, silentLogger, tierLlm } from '../helpers/test-deps';

const profile = (overrides: Partial<Profile> = {}): Profile => ({ name: 'Jane', ...overrides });

describe('DataQualityService (F-02)', () => {
  const service = new DataQualityService(silentLogger);

  it('should score a complete profile 100 and mark it processable', () => {
    const result = service.check(
      profile({
        education: ['MBA @ Harvard'],
        jobs: ['CTO @ Google'],
        skills: ['AI'],
        company_details: { name: 'Google' },
      }),
    );
    expect(result).toMatchObject({ score: 100, completeness: 1, shouldProcess: true });
    expect(result.missingFields).toEqual([]);
  });

  it('should subtract 30 per missing required field and list them', () => {
    const result = service.check(profile({ skills: ['AI'] }));
    expect(result.score).toBe(40); // missing education + jobs
    expect(result.missingFields.sort()).toEqual(['education', 'jobs']);
    expect(result.shouldProcess).toBe(true); // 40 is the threshold
  });

  it('should reject a profile below the threshold', () => {
    const result = service.check({ name: '   ' } as Profile);
    expect(result.score).toBe(10); // name + education + jobs missing
    expect(result.shouldProcess).toBe(false);
  });
});

describe('EducationService (F-03)', () => {
  const rules = () => new EducationService(defaultConfig, silentLogger, new NullProvider());

  it('should parse "Degree @ University" and tier via the ruleset', async () => {
    const signal = await rules().extract(['MBA @ Harvard University']);
    expect(signal).toEqual({ university: 'Harvard University', tier: 'tier_1', score: 100 });
  });

  it('should parse "University, Country" and match tier_2', async () => {
    const signal = await rules().extract(['University of Leeds, UK']);
    expect(signal).toMatchObject({ university: 'University of Leeds', tier: 'tier_2', score: 70 });
  });

  it('should default unmatched universities to tier_3', async () => {
    const signal = await rules().extract(['Some Local College']);
    expect(signal).toMatchObject({ tier: 'tier_3', score: 40 });
  });

  it('should return unknown for empty education', async () => {
    expect(await rules().extract([])).toMatchObject({ tier: 'unknown', score: 20 });
  });

  it('should use the LLM tier when available', async () => {
    const service = new EducationService(defaultConfig, silentLogger, tierLlm('tier_1'));
    expect(await service.extract(['Obscure University'])).toMatchObject({ tier: 'tier_1' });
  });

  it('should fall back to rules when the LLM call fails', async () => {
    const service = new EducationService(defaultConfig, silentLogger, fakeLlm());
    expect(await service.extract(['Harvard University'])).toMatchObject({ tier: 'tier_1' });
  });
});

describe('ExperienceService (F-04)', () => {
  const rules = () => new ExperienceService(defaultConfig, silentLogger, new NullProvider());

  it('should score 60 + 10*tier1 + 5*tier2 from distinct companies', async () => {
    const signal = await rules().extract(['VP @ Razorpay', 'PM @ Flipkart']);
    expect(signal).toMatchObject({ tier1Count: 1, tier2Count: 1, score: 75 });
  });

  it('should set score to 100 when there are 3+ tier-1 companies', async () => {
    const signal = await rules().extract(['a @ Google', 'b @ Microsoft', 'c @ Apple']);
    expect(signal.score).toBe(100);
  });

  it('should deduplicate companies case-insensitively', async () => {
    const signal = await rules().extract(['x @ Google', 'y @ google']);
    expect(signal.companies).toHaveLength(1);
    expect(signal.score).toBe(70); // one tier-1
  });

  it('should treat a job without "@" as the whole company name (tier_3 floor)', async () => {
    const signal = await rules().extract(['Freelancer']);
    expect(signal).toMatchObject({ tier1Count: 0, tier2Count: 0, score: 60 });
  });

  it('should use the LLM tier for companies when available', async () => {
    const service = new ExperienceService(defaultConfig, silentLogger, tierLlm('tier_2'));
    const signal = await service.extract(['a @ Foo', 'b @ Bar']);
    expect(signal).toMatchObject({ tier1Count: 0, tier2Count: 2, score: 70 });
  });
});

describe('ThinkingQualityService (F-05)', () => {
  const service = new ThinkingQualityService(defaultConfig, silentLogger);

  it('should add 10 per distinct visionary keyword plus a leadership bonus', () => {
    const signal = service.analyze(['Chief Product Officer @ X'], ['Innovation', 'Strategy', 'AI']);
    expect(signal).toEqual({ visionaryScore: 30, leadershipBonus: 10, score: 40 });
  });

  it('should cap the combined score at 100', () => {
    const skills = [...defaultConfig.thinking.visionaryKeywords];
    const signal = service.analyze(['VP of Engineering @ Y'], skills);
    expect(signal.score).toBe(100);
  });

  it('should return zeros when nothing matches', () => {
    expect(service.analyze(['Engineer @ Z'], ['Plumbing'])).toEqual({
      visionaryScore: 0,
      leadershipBonus: 0,
      score: 0,
    });
  });

  it('should handle undefined jobs and skills', () => {
    expect(service.analyze(undefined, undefined)).toEqual({
      visionaryScore: 0,
      leadershipBonus: 0,
      score: 0,
    });
  });
});

describe('ScorerService (F-06)', () => {
  const service = new ScorerService(defaultConfig, silentLogger);

  it('should compute the weighted score, round to 1 decimal, and bucket it', () => {
    const outcome = service.score({ education: 100, experience: 80, thinking: 90 }, profile());
    // 100*0.2 + 80*0.35 + 90*0.4 = 84.0
    expect(outcome.icpScore).toBe(84);
    expect(outcome).toMatchObject({ bucket: 'HIGH', priority: 'Priority Outreach' });
    expect(outcome.componentScores.recencyBonus).toBe(0);
  });

  it('should add the recency bonus for recent activity (explicit now)', () => {
    const now = new Date('2026-06-21T00:00:00.000Z');
    const outcome = service.score(
      { education: 100, experience: 80, thinking: 90 },
      profile({ lastActive: '2026-05-01' }),
      now,
    );
    expect(outcome.icpScore).toBe(89); // 84 + 5
    expect(outcome.componentScores.recencyBonus).toBe(5);
  });

  it('should ignore old or invalid lastActive values', () => {
    const now = new Date('2026-06-21T00:00:00.000Z');
    expect(
      service.score(
        { education: 0, experience: 0, thinking: 0 },
        profile({ lastActive: '2020-01-01' }),
        now,
      ).componentScores.recencyBonus,
    ).toBe(0);
    expect(
      service.score(
        { education: 0, experience: 0, thinking: 0 },
        profile({ lastActive: 'not-a-date' }),
        now,
      ).componentScores.recencyBonus,
    ).toBe(0);
  });

  it('should apply the recency window using the system clock (fake timers, CODING 7.2)', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-06-21T00:00:00.000Z'));
    try {
      const outcome = service.score(
        { education: 0, experience: 0, thinking: 0 },
        profile({ lastActive: '2026-05-01' }),
      );
      expect(outcome.componentScores.recencyBonus).toBe(5);
    } finally {
      jest.useRealTimers();
    }
  });

  it('should bucket a zero score as NOT FIT', () => {
    const outcome = service.score({ education: 0, experience: 0, thinking: 0 }, profile());
    expect(outcome.bucket).toBe('NOT FIT');
  });
});
