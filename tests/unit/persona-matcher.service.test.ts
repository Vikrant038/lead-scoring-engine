import { defaultConfig } from '../../src/config/config';
import type { Persona } from '../../src/domain/persona.types';
import type { CompanyTier } from '../../src/domain/scoring.types';
import {
  PersonaMatcherService,
  type PersonaMatchInput,
} from '../../src/modules/persona-matcher.service';
import { silentLogger } from '../helpers/test-deps';

const matcher = new PersonaMatcherService(defaultConfig, silentLogger);

const persona = (overrides: Partial<Persona> = {}): Persona => ({
  name: 'Ideal CTO',
  description: 'A technical leader',
  ...overrides,
});

const company = (tier: CompanyTier['tier']): CompanyTier => ({ name: `${tier}-co`, tier });

describe('PersonaMatcherService education (FR-12-014)', () => {
  it('should score 100 when tier is preferred or there is no preference', () => {
    expect(
      matcher.educationScore(persona({ education: { preferred_tiers: ['tier_1'] } }), 'tier_1'),
    ).toBe(100);
    expect(matcher.educationScore(persona(), 'tier_3')).toBe(100);
    expect(matcher.educationScore(persona({ education: { preferred_tiers: [] } }), 'tier_3')).toBe(
      100,
    );
  });

  it('should score 60 one tier below preferred and 30 otherwise', () => {
    const p = persona({ education: { preferred_tiers: ['tier_1'] } });
    expect(matcher.educationScore(p, 'tier_2')).toBe(60);
    expect(matcher.educationScore(p, 'tier_3')).toBe(30);
  });
});

describe('PersonaMatcherService role/company/years (FR-12-015/016/017)', () => {
  it('should compute the percentage of required roles found', () => {
    expect(matcher.roleScore([], ['anything'])).toBe(100);
    expect(matcher.roleScore(['CTO', 'VP'], ['CTO @ X'])).toBe(50);
    expect(matcher.roleScore(['CEO'], ['CTO @ X'])).toBe(0);
  });

  it('should weight company tiers and return 0 with no companies', () => {
    expect(matcher.companyScore([])).toBe(0);
    expect(matcher.companyScore([company('tier_1')])).toBe(100);
    expect(matcher.companyScore([company('tier_1'), company('tier_2')])).toBe(75);
    expect(matcher.companyScore([company('tier_3'), company('tier_3')])).toBe(0);
  });

  it('should score years proportionally with sensible defaults', () => {
    expect(matcher.yearsScore(undefined, 3)).toBe(100); // no requirement
    expect(matcher.yearsScore(8, undefined)).toBe(50); // unknown years
    expect(matcher.yearsScore(8, 10)).toBe(100); // capped
    expect(matcher.yearsScore(10, 5)).toBe(50);
  });
});

describe('PersonaMatcherService skills (FR-12-019)', () => {
  it('should match exact single-word and substring multi-word skills', () => {
    expect(matcher.skillsScore(persona(), ['anything'])).toBe(100); // no requirement
    expect(matcher.skillsScore(persona({ skills_must_have: ['AI'] }), ['AI', 'x'])).toBe(100);
    expect(
      matcher.skillsScore(persona({ skills_must_have: ['machine learning'] }), [
        'Machine Learning Expert',
      ]),
    ).toBe(100);
    expect(matcher.skillsScore(persona({ skills_must_have: ['AI', 'ML'] }), ['AI'])).toBe(50);
    expect(matcher.skillsScore(persona({ skills_must_have: ['AI'] }), ['Plumbing'])).toBe(0);
  });
});

describe('PersonaMatcherService bucket (FR-12-021)', () => {
  it('should bucket by configurable thresholds', () => {
    expect(matcher.bucket(95)).toBe('Excellent Fit');
    expect(matcher.bucket(80)).toBe('Good Fit');
    expect(matcher.bucket(60)).toBe('Partial Fit');
    expect(matcher.bucket(40)).toBe('Not a Fit');
  });
});

describe('PersonaMatcherService match (FR-12-020/022/023)', () => {
  const strongPersona = persona({
    education: { preferred_tiers: ['tier_1'] },
    experience: { roles_must_include: ['CTO'], min_years_experience: 8 },
    skills_must_have: ['AI'],
  });

  it('should produce a perfect fit with no gaps for a strong lead', () => {
    const input: PersonaMatchInput = {
      educationTier: 'tier_1',
      companies: [company('tier_1')],
      jobs: ['CTO @ Google'],
      skills: ['AI', 'Leadership'],
      yearsExperience: 10,
    };
    const result = matcher.match(strongPersona, input);
    expect(result).toMatchObject({
      persona_name: 'Ideal CTO',
      fit_score: 100,
      bucket: 'Excellent Fit',
    });
    expect(result.gap_analysis).toEqual([]);
  });

  it('should produce a low fit and a full gap analysis for a weak lead', () => {
    const input: PersonaMatchInput = {
      educationTier: 'tier_3',
      companies: [company('tier_3')],
      jobs: ['Engineer @ X'],
      skills: ['Plumbing'],
      yearsExperience: 1,
    };
    const result = matcher.match(strongPersona, input);
    expect(result.bucket).toBe('Not a Fit');
    expect(result.fit_score).toBeCloseTo(7.2, 1);
    expect(result.gap_analysis).toEqual([
      'Missing skill: AI',
      'Missing role: CTO',
      'Education tier tier_3 below preferred (tier_1)',
      'No tier-1/tier-2 companies',
    ]);
  });

  it('should honour persona-supplied weights (FR-12-020)', () => {
    // Weight everything on education; a tier_1 lead should score 100 regardless of other dims.
    const weighted = persona({
      weights: { education: 1, experience: 0, thinking: 0 },
      education: { preferred_tiers: ['tier_1'] },
      skills_must_have: ['AI'],
    });
    const result = matcher.match(weighted, {
      educationTier: 'tier_1',
      companies: [],
      jobs: [],
      skills: [],
      yearsExperience: undefined,
    });
    expect(result.fit_score).toBe(100);
  });
});
