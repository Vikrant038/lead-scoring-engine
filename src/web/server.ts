/**
 * Express composition root (F-10..F-17). `createApp` assembles middleware + routes from a
 * WebContext; `buildContext` wires the shared services; `main` resolves env and listens.
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import express, { type Express } from 'express';
import { defaultConfig } from '../config/config';
import type { AppConfig } from '../config/config.schema';
import { createLogger, type Logger, type LogLevel } from '../lib/logger/logger';
import { createLlmClient, type LlmEnv } from '../llm/llm-client.factory';
import type { LLMClient } from '../llm/llm-client.interface';
import { PersonaRepository } from '../repositories/persona.repository';
import { SessionStoreRepository } from '../repositories/session-store.repository';
import { correlationId } from './middleware/correlation-id.middleware';
import { createSessionMiddleware } from './middleware/session.middleware';
import { securityHeaders } from './middleware/security-headers.middleware';
import { ensureCsrfToken } from './middleware/csrf.middleware';
import { createErrorHandler } from './middleware/error-handler.middleware';
import { QueueService } from './services/queue.service';
import { createJobProcessor } from './services/job-processor';
import { createRouter } from './routes/index.routes';
import type { WebContext } from './context';

const VIEWS_DIR = path.join(process.cwd(), 'src', 'web', 'views');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SESSIONS_ROOT = path.join(process.cwd(), 'data', 'sessions');

export function buildContext(config: AppConfig, logger: Logger, llm: LLMClient): WebContext {
  const sessionStore = new SessionStoreRepository(SESSIONS_ROOT, logger);
  const personaRepo = new PersonaRepository(config.paths.personasDir, logger);
  const ctx = { config, logger, llm, sessionStore, personaRepo } as WebContext;
  ctx.queue = new QueueService(createJobProcessor(ctx), logger);
  return ctx;
}

export function createApp(ctx: WebContext, sessionSecret: string): Express {
  const app = express();
  app.set('view engine', 'ejs');
  app.set('views', VIEWS_DIR);

  app.use(securityHeaders);
  app.use(express.static(PUBLIC_DIR));
  app.use(correlationId);
  app.use(createSessionMiddleware(sessionSecret));
  app.use(ensureCsrfToken);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(createRouter(ctx));
  app.use(createErrorHandler(ctx.logger));
  return app;
}

/* istanbul ignore next -- entry glue: resolves env/secret and starts listening */
function main(): void {
  const env = process.env as LlmEnv & {
    LOG_LEVEL?: string;
    SESSION_SECRET?: string;
    PORT?: string;
  };
  const logger = createLogger({ level: (env.LOG_LEVEL as LogLevel) ?? 'info' });

  let secret = env.SESSION_SECRET;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    logger.warn('SESSION_SECRET not set; using a random secret (sessions reset on restart)');
  }

  const llm = createLlmClient(env, defaultConfig.llm.timeout, logger);
  const app = createApp(buildContext(defaultConfig, logger, llm), secret);
  const port = Number(env.PORT ?? 3000);
  app.listen(port, () => logger.info({ port }, 'ICP Profiler web server started'));
}

/* istanbul ignore next */
if (require.main === module) {
  main();
}
