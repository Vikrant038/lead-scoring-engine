import type { Profile } from '../../src/domain/profile.types';
import type { ProfileResult } from '../../src/domain/result.types';
import type { EmailInput } from '../../src/llm/llm-client.interface';
import { NullProvider } from '../../src/llm/null.provider';
import { ExplanationService } from '../../src/modules/explanation.service';
import { OutreachEmailService } from '../../src/modules/outreach-email.service';
import { fakeLlm, silentLogger } from '../helpers/test-deps';

const profile: Profile = {
  name: 'Jane',
  education: ['MBA @ Harvard'],
  jobs: ['CTO @ Google'],
  skills: ['AI', 'Leadership'],
};

const result = (bucket: ProfileResult['bucket']): ProfileResult => ({
  _recordId: 'r1',
  profile_name: 'Jane',
  status: 'PROCESSED',
  icp_score: 92,
  bucket,
  priority: 'Immediate Outreach',
  signals: {
    experience: {
      companies: [{ name: 'Google', tier: 'tier_1' }],
      tier1Count: 1,
      tier2Count: 0,
      score: 70,
    },
  },
  component_scores: { education: 100, experience: 70, thinking: 90, recencyBonus: 5 },
  persona_fit: { persona_name: 'CTO', fit_score: 88, bucket: 'Good Fit', gap_analysis: [] },
  timestamp: '',
});

describe('ExplanationService (F-13)', () => {
  it('should return null when the LLM is unavailable (FR-13-005)', async () => {
    const service = new ExplanationService(new NullProvider(), silentLogger);
    expect(await service.generate(profile, result('HIGH'))).toBeNull();
  });

  it('should return the generated narrative on success', async () => {
    const llm = fakeLlm({
      generateExplanation: async () => ({ success: true, data: 'Strong lead.' }),
    });
    const service = new ExplanationService(llm, silentLogger);
    expect(await service.generate(profile, result('HIGH'))).toBe('Strong lead.');
  });

  it('should return a fallback string on failure (FR-13-004)', async () => {
    const service = new ExplanationService(fakeLlm(), silentLogger); // generateExplanation -> failure
    expect(await service.generate(profile, result('HIGH'))).toBe('Unable to generate explanation.');
  });

  it('should tolerate a sparse result/profile when building the prompt', async () => {
    const llm = fakeLlm({ generateExplanation: async () => ({ success: true, data: 'ok' }) });
    const service = new ExplanationService(llm, silentLogger);
    const sparse: ProfileResult = {
      _recordId: 'r',
      profile_name: 'X',
      status: 'PROCESSED',
      timestamp: '',
    };
    expect(await service.generate({ name: 'X' }, sparse)).toBe('ok');
  });
});

describe('OutreachEmailService (F-14)', () => {
  it('should return null when unavailable or NOT FIT (FR-14-005)', async () => {
    expect(
      await new OutreachEmailService(new NullProvider(), silentLogger).generate(
        profile,
        result('HIGH'),
        undefined,
      ),
    ).toBeNull();

    const available = fakeLlm({
      generateEmail: async () => ({ success: true, data: { subject: 'S', body: 'B' } }),
    });
    expect(
      await new OutreachEmailService(available, silentLogger).generate(
        profile,
        result('NOT FIT'),
        undefined,
      ),
    ).toBeNull();
  });

  it('should generate an email with bucket tone and settings fallback (FR-14-010)', async () => {
    // Arrange — capture the prompt input the service builds
    let captured: EmailInput | undefined;
    const llm = fakeLlm({
      generateEmail: async (input) => {
        captured = input;
        return { success: true, data: { subject: 'Hi', body: 'Body' } };
      },
    });
    const service = new OutreachEmailService(llm, silentLogger);

    // Act — no settings -> fallback identity
    const email = await service.generate(profile, result('HIGH'), undefined);

    // Assert
    expect(email).toEqual({ subject: 'Hi', body: 'Body' });
    expect(captured?.senderName).toBe('Your Name');
    expect(captured?.senderCompany).toBe('Your Company');
    expect(captured?.role).toBe('CTO');
    expect(captured?.company).toBe('Google');
    expect(captured?.tone).toContain('warm and direct'); // HIGH bucket mapping
    expect(captured?.personaFit).toBe(88);
  });

  it('should honour provided settings and map MEDIUM tone', async () => {
    let captured: EmailInput | undefined;
    const llm = fakeLlm({
      generateEmail: async (input) => {
        captured = input;
        return { success: true, data: { subject: 'S', body: 'B' } };
      },
    });
    const service = new OutreachEmailService(llm, silentLogger);
    await service.generate(profile, result('MEDIUM'), {
      senderName: 'Sam',
      company: 'Acme',
      tone: 'casual',
    });
    expect(captured?.senderName).toBe('Sam');
    expect(captured?.tone).toContain('casual');
    expect(captured?.tone).toContain('nurturing');
  });

  it('should prefer company_details, handle role without "@", and map LOW tone', async () => {
    let captured: EmailInput | undefined;
    const llm = fakeLlm({
      generateEmail: async (input) => {
        captured = input;
        return { success: true, data: { subject: 'S', body: 'B' } };
      },
    });
    const service = new OutreachEmailService(llm, silentLogger);
    await service.generate(
      { name: 'Bob', jobs: ['Founder'], company_details: { name: 'Acme Inc' }, education: [] },
      result('LOW'),
      undefined,
    );
    expect(captured?.company).toBe('Acme Inc'); // company_details precedence
    expect(captured?.role).toBe('Founder'); // no "@" -> whole title
    expect(captured?.education).toBe(''); // empty education
    expect(captured?.tone).toContain('light touch'); // LOW bucket mapping
  });

  it('should yield an empty role when the lead has no jobs', async () => {
    let captured: EmailInput | undefined;
    const llm = fakeLlm({
      generateEmail: async (input) => {
        captured = input;
        return { success: true, data: { subject: 'S', body: 'B' } };
      },
    });
    await new OutreachEmailService(llm, silentLogger).generate(
      { name: 'NoJobs' },
      result('HIGH'),
      undefined,
    );
    expect(captured?.role).toBe('');
  });

  it('should return null when generation fails', async () => {
    const service = new OutreachEmailService(fakeLlm(), silentLogger); // generateEmail -> failure
    expect(await service.generate(profile, result('HIGH'), undefined)).toBeNull();
  });
});
