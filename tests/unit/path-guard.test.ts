import path from 'node:path';
import { ForbiddenError } from '../../src/lib/errors/domain-errors';
import { resolveWithin, resultFileName, sanitiseId } from '../../src/lib/security/path-guard';

describe('path-guard', () => {
  it('should strip directory components and separators from an id (SEC-05)', () => {
    expect(sanitiseId('../../etc/passwd')).toBe('passwd');
    expect(sanitiseId('a/b/c')).toBe('c');
    expect(sanitiseId('safe_id')).toBe('safe_id');
  });

  it('should build a safe result filename from a hostile recordId', () => {
    expect(resultFileName('../../secret')).toBe('secret_result.json');
    expect(resultFileName('rec_001')).toBe('rec_001_result.json');
  });

  it('should resolve a sanitised path inside the base directory', () => {
    const base = '/data/sessions/s1/output';
    const resolved = resolveWithin(base, 'rec_001_result.json');
    expect(resolved).toBe(path.join(base, 'rec_001_result.json'));
  });

  it('should reduce traversal segments to safe names confined to the base dir (SEC-06)', () => {
    // Arrange — each reduces (via basename) to a plain filename under base.
    const base = '/data/sessions/s1/output';
    const attempts = ['../../etc/passwd', '/etc/shadow', 'a/../../b', '..\\..\\win'];
    // Act / Assert
    for (const attempt of attempts) {
      const resolved = resolveWithin(base, attempt);
      expect(resolved.startsWith(base + path.sep)).toBe(true);
    }
  });

  it('should throw ForbiddenError when a segment resolves outside the base (e.g. "..")', () => {
    // Defense-in-depth: a bare ".." survives basename and would escape, so the guard rejects it.
    expect(() => resolveWithin('/data/sessions/s1/output', '..')).toThrow(ForbiddenError);
  });
});
