/**
 * Shared web application context wired in the composition root and passed to controllers.
 */
import type { AppConfig } from '../config/config.schema';
import type { EmailSettings } from '../domain/result.types';
import type { Logger } from '../lib/logger/logger';
import type { LLMClient } from '../llm/llm-client.interface';
import type { PersonaRepository } from '../repositories/persona.repository';
import type { SessionStoreRepository } from '../repositories/session-store.repository';
import type { QueueService } from './services/queue.service';

export interface WebContext {
  config: AppConfig;
  logger: Logger;
  llm: LLMClient;
  queue: QueueService;
  sessionStore: SessionStoreRepository;
  personaRepo: PersonaRepository;
  /** Resolve per-session email settings (wired in Unit 11; undefined here). */
  emailSettingsFor?: (sessionId: string) => EmailSettings | undefined;
}
