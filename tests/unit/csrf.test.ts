import { generateCsrfToken, verifyCsrfToken } from '../../src/lib/security/csrf';

describe('csrf tokens', () => {
  it('should generate a 64-char hex token (32 random bytes)', () => {
    const token = generateCsrfToken();
    expect(token).toMatch(/^[0-9a-f]{64}$/);
  });

  it('should generate unique tokens', () => {
    expect(generateCsrfToken()).not.toBe(generateCsrfToken());
  });

  it('should verify a matching token', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
  });

  it('should reject a mismatched, missing, or differently-sized token', () => {
    const token = generateCsrfToken();
    expect(verifyCsrfToken(token, generateCsrfToken())).toBe(false);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, 'short')).toBe(false);
  });
});
