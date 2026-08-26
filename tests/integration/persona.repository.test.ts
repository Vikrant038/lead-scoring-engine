import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Writable } from 'node:stream';
import { PersonaRepository } from '../../src/repositories/persona.repository';
import { NotFoundError, ValidationError } from '../../src/lib/errors/domain-errors';
import { createLogger } from '../../src/lib/logger/logger';

const silentLogger = createLogger(
  { level: 'error' },
  new Writable({ write: (_c, _e, cb) => cb() }),
);

const validPersona = { name: 'Ideal CTO', description: 'Tech leader', skills_must_have: ['AI'] };

describe('PersonaRepository (integration)', () => {
  let dir: string;
  let repo: PersonaRepository;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'persona-'));
    repo = new PersonaRepository(dir, silentLogger);
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('should save and load a valid persona', () => {
    repo.save('cto', validPersona);
    expect(fs.existsSync(path.join(dir, 'cto.json'))).toBe(true);
    expect(repo.get('cto').name).toBe('Ideal CTO');
  });

  it('should reject an invalid persona with ValidationError', () => {
    expect(() => repo.save('bad', { description: 'missing name' })).toThrow(ValidationError);
  });

  it('should throw NotFound for a missing persona', () => {
    expect(() => repo.get('nope')).toThrow(NotFoundError);
  });

  it('should throw NotFound when deleting a missing persona', () => {
    expect(() => repo.delete('ghost')).toThrow(NotFoundError);
  });

  it('should list valid personas and skip invalid files', () => {
    repo.save('cto', validPersona);
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ invalid');
    const summaries = repo.list();
    expect(summaries).toHaveLength(1);
    expect(summaries[0]).toMatchObject({ id: 'cto', name: 'Ideal CTO' });
  });

  it('should soft-delete a persona into .trash (FR-12-007)', () => {
    repo.save('cto', validPersona);
    repo.delete('cto');
    expect(fs.existsSync(path.join(dir, 'cto.json'))).toBe(false);
    expect(fs.existsSync(path.join(dir, '.trash', 'cto.json'))).toBe(true);
    expect(() => repo.get('cto')).toThrow(NotFoundError);
  });

  it('should confine a hostile persona id (SEC-06)', () => {
    repo.save('../../escape', validPersona);
    expect(fs.existsSync(path.join(dir, 'escape.json'))).toBe(true);
    expect(fs.existsSync(path.join(path.dirname(dir), 'escape.json'))).toBe(false);
  });

  it('should return an empty list when the personas directory does not exist', () => {
    const missing = new PersonaRepository(path.join(dir, 'nope'), silentLogger);
    expect(missing.list()).toEqual([]);
  });

  it('should ignore non-json files in the personas directory', () => {
    repo.save('cto', validPersona);
    fs.writeFileSync(path.join(dir, 'README.txt'), 'not a persona');
    expect(repo.list()).toHaveLength(1);
  });

  it('should throw ValidationError when an existing persona file is structurally invalid', () => {
    // Valid JSON but missing the required `name` field.
    fs.writeFileSync(path.join(dir, 'weird.json'), JSON.stringify({ foo: 1 }));
    expect(() => repo.get('weird')).toThrow(ValidationError);
  });

  it('should create the personas directory on demand and reuse .trash across deletes', () => {
    const fresh = new PersonaRepository(path.join(dir, 'sub'), silentLogger);
    fresh.ensureDirectory();
    expect(fs.existsSync(path.join(dir, 'sub'))).toBe(true);

    repo.save('a', validPersona);
    repo.save('b', validPersona);
    repo.delete('a');
    repo.delete('b'); // .trash already exists on the second delete
    expect(fs.existsSync(path.join(dir, '.trash', 'b.json'))).toBe(true);
  });

  it('should throw ValidationError when attempting to delete default-icp', () => {
    expect(() => repo.delete('default-icp')).toThrow(ValidationError);
  });
});
