/**
 * Persona file repository (F-12). CRUD over JSON files in `personas/`; deletes are soft (moved to
 * `personas/.trash/`). All ids pass through the path-guard; contents are validated by the schema.
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Persona } from '../domain/types';
import type { Logger } from '../lib/logger/logger';
import { NotFoundError, ValidationError } from '../lib/errors/domain-errors';
import { personaSchema } from '../schemas/persona.schema';
import { resolveWithin, sanitiseId } from '../lib/security/path-guard';

export interface PersonaSummary {
  id: string;
  name: string;
  description: string;
  lastModified: string;
}

export class PersonaRepository {
  constructor(
    private readonly personasDir: string,
    private readonly logger: Logger,
  ) {}

  ensureDirectory(): void {
    if (!fs.existsSync(this.personasDir)) {
      fs.mkdirSync(this.personasDir, { recursive: true });
    }
  }

  /** List valid persona files with metadata (FR-12-003). Invalid files are logged and skipped. */
  list(): PersonaSummary[] {
    if (!fs.existsSync(this.personasDir)) {
      return [];
    }
    const summaries: PersonaSummary[] = [];
    for (const file of fs.readdirSync(this.personasDir)) {
      if (!file.endsWith('.json')) {
        continue;
      }
      const id = file.replace(/\.json$/i, '');
      const filePath = path.join(this.personasDir, file);
      const parsed = personaSchema.safeParse(this.readJson(filePath));
      if (!parsed.success) {
        this.logger.warn({ file }, 'skipping invalid persona file');
        continue;
      }
      summaries.push({
        id,
        name: parsed.data.name,
        description: parsed.data.description,
        lastModified: fs.statSync(filePath).mtime.toISOString(),
      });
    }
    return summaries;
  }

  /** Load and validate a persona by id (FR-12-011). NotFound if absent, Validation if malformed. */
  get(id: string): Persona {
    const target = resolveWithin(this.personasDir, `${sanitiseId(id)}.json`);
    if (!fs.existsSync(target)) {
      throw new NotFoundError('Persona', id);
    }
    const parsed = personaSchema.safeParse(this.readJson(target));
    if (!parsed.success) {
      throw new ValidationError('persona', parsed.error.issues[0]?.message ?? 'invalid persona');
    }
    return parsed.data;
  }

  /** Validate and persist a persona under `{id}.json` (FR-12-004/006). */
  save(id: string, raw: unknown): Persona {
    const parsed = personaSchema.safeParse(raw);
    if (!parsed.success) {
      const reason = parsed.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new ValidationError('persona', reason);
    }
    this.ensureDirectory();
    const target = resolveWithin(this.personasDir, `${sanitiseId(id)}.json`);
    fs.writeFileSync(target, JSON.stringify(parsed.data, null, 2));
    return parsed.data;
  }

  /** Soft-delete a persona by moving it to `.trash/` (FR-12-007). */
  delete(id: string): void {
    const safeId = sanitiseId(id);
    if (safeId === 'default-icp') {
      throw new ValidationError('persona', 'cannot delete default system persona');
    }
    const source = resolveWithin(this.personasDir, `${safeId}.json`);
    if (!fs.existsSync(source)) {
      throw new NotFoundError('Persona', id);
    }
    const trashDir = path.join(this.personasDir, '.trash');
    if (!fs.existsSync(trashDir)) {
      fs.mkdirSync(trashDir, { recursive: true });
    }
    fs.renameSync(source, path.join(trashDir, `${safeId}.json`));
    this.logger.info({ id: safeId }, 'persona moved to trash');
  }

  private readJson(filePath: string): unknown {
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch {
      return null;
    }
  }
}
