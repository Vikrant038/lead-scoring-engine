/**
 * Shared web application context wired in the composition root and passed to controllers.
 */
import type { ConfigService } from '../config/config.service';
import type { Logger } from '../lib/logger/logger';
import type { LLMClient } from '../llm/llm-client.interface';
import type { EmailGenerator } from '../modules/profiler.service';
import type { PersonaRepository } from '../repositories/persona.repository';
import type { SessionStoreRepository } from '../repositories/session-store.repository';
import type { QueueService } from './services/queue.service';

export interface WebContext {
  /** Mutable runtime configuration (F-11); modules always read the current value via `get()`. */
  configService: ConfigService;
  logger: Logger;
  llm: LLMClient;
  queue: QueueService;
  sessionStore: SessionStoreRepository;
  personaRepo: PersonaRepository;
  /** Standalone outreach-email generator for on-demand regeneration (FR-14-012). */
  emailGenerator: EmailGenerator;
}
