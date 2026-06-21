import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { SessionStoreRepository } from '../../src/repositories/session-store.repository';
import { createLogger } from '../../src/lib/logger/logger';

const silentLogger = createLogger(
  { level: 'error' },
  new Writable({ write: (_c, _e, cb) => cb() }),
);

describe('SessionStoreRepository (integration)', () => {
  let root: string;
  let repo: SessionStoreRepository;

  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'sess-'));
    repo = new SessionStoreRepository(root, silentLogger);
  });

  afterEach(() => {
    fs.rmSync(root, { recursive: true, force: true });
  });

  it('should create isolated input/output dirs for a session (FR-16-003)', () => {
    const dirs = repo.ensure('sessionA');
    expect(dirs.base).toBe(path.join(root, 'sessionA'));
    expect(fs.existsSync(dirs.inputDir)).toBe(true);
    expect(fs.existsSync(dirs.outputDir)).toBe(true);
  });

  it('should keep a hostile session id confined to the sessions root (SEC-06)', () => {
    const dirs = repo.resolve('../../../etc');
    expect(dirs.base.startsWith(root + path.sep)).toBe(true);
  });

  it('should isolate two sessions from each other', () => {
    const a = repo.ensure('A');
    const b = repo.ensure('B');
    fs.writeFileSync(path.join(a.inputDir, 'x.json'), '{}');
    expect(fs.existsSync(path.join(b.inputDir, 'x.json'))).toBe(false);
  });

  it('should clear a session silo (FR-16-010)', () => {
    const dirs = repo.ensure('A');
    repo.clear('A');
    expect(fs.existsSync(dirs.base)).toBe(false);
  });
});
