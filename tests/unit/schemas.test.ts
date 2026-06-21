import { emailSettingsSchema } from '../../src/schemas/email-settings.schema';
import { personaSchema } from '../../src/schemas/persona.schema';
import { profileSchema } from '../../src/schemas/profile.schema';
import { uploadedProfilesSchema } from '../../src/schemas/upload.schema';

describe('profileSchema', () => {
  it('should accept a valid profile and pass through unknown fields', () => {
    // Arrange
    const input = {
      name: 'Jane Doe',
      education: ['MBA @ Harvard University'],
      jobs: ['PM @ Google'],
      linkedin_url: 'https://example.com', // unknown field tolerated
    };
    // Act
    const result = profileSchema.safeParse(input);
    // Assert
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).linkedin_url).toBe('https://example.com');
    }
  });

  it('should reject a profile without a name', () => {
    const result = profileSchema.safeParse({ education: ['x'] });
    expect(result.success).toBe(false);
  });

  it('should reject a non-string education entry', () => {
    const result = profileSchema.safeParse({ name: 'A', education: [123] });
    expect(result.success).toBe(false);
  });
});

describe('personaSchema', () => {
  it('should accept a minimal persona (name + description only)', () => {
    const result = personaSchema.safeParse({ name: 'CTO', description: 'Ideal CTO' });
    expect(result.success).toBe(true);
  });

  it('should reject unknown keys (strict format)', () => {
    const result = personaSchema.safeParse({ name: 'X', description: 'Y', bogus: true });
    expect(result.success).toBe(false);
  });
});

describe('emailSettingsSchema', () => {
  it('should require non-empty sender, company, and tone', () => {
    expect(
      emailSettingsSchema.safeParse({ senderName: 'A', company: 'B', tone: 'warm' }).success,
    ).toBe(true);
    expect(
      emailSettingsSchema.safeParse({ senderName: '', company: 'B', tone: 'warm' }).success,
    ).toBe(false);
  });
});

describe('uploadedProfilesSchema', () => {
  it('should accept both a single profile and an array of profiles (FR-01-004)', () => {
    expect(uploadedProfilesSchema.safeParse({ name: 'Solo' }).success).toBe(true);
    expect(uploadedProfilesSchema.safeParse([{ name: 'A' }, { name: 'B' }]).success).toBe(true);
  });

  it('should reject an array containing an invalid profile', () => {
    expect(uploadedProfilesSchema.safeParse([{ name: 'A' }, { education: ['x'] }]).success).toBe(
      false,
    );
  });
});
