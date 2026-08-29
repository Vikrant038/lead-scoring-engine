/**
 * Upload handling: validate the JSON payload (SEC-04), persist it to the session's input
 * directory (F-16), and enqueue a processing job (F-10).
 */
import fs from 'node:fs';
import path from 'node:path';
import { ValidationError } from '../../lib/errors/domain-errors';
import { sanitiseId } from '../../lib/security/path-guard';
import { uploadedProfilesSchema } from '../../schemas/upload.schema';
import type { EmailSettings } from '../../domain/types';
import type { SessionStoreRepository } from '../../repositories/session-store.repository';
import type { Job, QueueService } from './queue.service';

export interface UploadedFile {
  originalname: string;
  buffer: Buffer;
}

export class UploadService {
  constructor(
    private readonly sessionStore: SessionStoreRepository,
    private readonly queue: QueueService,
  ) {}

  accept(
    sessionId: string,
    file: UploadedFile,
    personaId?: string,
    emailSettings?: EmailSettings,
  ): Job {
    const parsed = uploadedProfilesSchema.safeParse(JSON.parse(file.buffer.toString('utf8')));
    if (!parsed.success) {
      throw new ValidationError('file', 'uploaded JSON is not a valid profile or profile array');
    }
    const dirs = this.sessionStore.ensure(sessionId);
    const fileName = `${Date.now()}-${sanitiseId(file.originalname)}`;
    fs.writeFileSync(path.join(dirs.inputDir, fileName), file.buffer);
    return this.queue.enqueue({ sessionId, fileName, personaId, emailSettings });
  }
}
