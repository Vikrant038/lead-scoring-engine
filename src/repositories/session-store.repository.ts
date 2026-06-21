/**
 * Session-scoped directory resolution (F-16). Each browser session gets an isolated silo under
 * `data/sessions/{sessionId}/{input,output}`; session ids pass through the path-guard so a
 * crafted cookie cannot escape the sessions root (SEC-06).
 */
import fs from 'node:fs';
import path from 'node:path';
import type { Logger } from '../lib/logger/logger';
import { resolveWithin } from '../lib/security/path-guard';

export interface SessionDirs {
  base: string;
  inputDir: string;
  outputDir: string;
}

export class SessionStoreRepository {
  constructor(
    private readonly sessionsRoot: string,
    private readonly logger: Logger,
  ) {}

  /** Resolve (without creating) the confined directories for a session id (FR-16-002). */
  resolve(sessionId: string): SessionDirs {
    const base = resolveWithin(this.sessionsRoot, sessionId);
    return {
      base,
      inputDir: path.join(base, 'input'),
      outputDir: path.join(base, 'output'),
    };
  }

  /** Resolve and create the session's input/output directories if absent (FR-16-003). */
  ensure(sessionId: string): SessionDirs {
    const dirs = this.resolve(sessionId);
    for (const dir of [dirs.inputDir, dirs.outputDir]) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    return dirs;
  }

  /** Delete a session's data silo (FR-16-010 "Clear My Data"). */
  clear(sessionId: string): void {
    const dirs = this.resolve(sessionId);
    fs.rmSync(dirs.base, { recursive: true, force: true });
    this.logger.info({ sessionId }, 'cleared session data');
  }
}
