/**
 * Express composition root (F-10..F-17). `createApp` assembles middleware + routes from a
 * WebContext; `buildContext` wires the shared services; `main` resolves env and listens.
 * Phase 1: DB migration runs on startup; demo-user is seeded via Better Auth REST API
 * after the server starts listening (ensures correct password hash format).
 */
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import express, { type Express } from 'express';
import { defaultConfig } from '../config/config';
import type { AppConfig } from '../config/config.schema';
import { ConfigService } from '../config/config.service';
import { createLogger, type Logger, type LogLevel } from '../lib/logger/logger';
import { createLlmClient, type LlmEnv } from '../llm/llm-client.factory';
import type { LLMClient } from '../llm/llm-client.interface';
import { OutreachEmailService } from '../modules/outreach-email.service';
import { PersonaRepository } from '../repositories/persona.repository';
import { SessionStoreRepository } from '../repositories/session-store.repository';
import { correlationId } from './middleware/correlation-id.middleware';
import { createSessionMiddleware } from './middleware/session.middleware';
import { securityHeaders } from './middleware/security-headers.middleware';
import { ensureCsrfToken, verifyCsrf } from './middleware/csrf.middleware';
import { createErrorHandler } from './middleware/error-handler.middleware';
import { QueueService } from './services/queue.service';
import { createJobProcessor } from './services/job-processor';
import { createRouter } from './routes/index.routes';
import { DynamicLlmClient } from '../llm/dynamic-llm.client';
import type { WebContext } from './context';
import { migrate, wipeStaleDemoUser, seedDemoUserViaApi } from '../db/migrate';
import { auth } from '../lib/auth/auth';
import { toNodeHandler, fromNodeHeaders } from 'better-auth/node';

const VIEWS_DIR = path.join(process.cwd(), 'src', 'web', 'views');
const PUBLIC_DIR = path.join(process.cwd(), 'public');
const SESSIONS_ROOT = path.join(process.cwd(), 'data', 'sessions');

export function buildContext(config: AppConfig, logger: Logger, llm: LLMClient): WebContext {
  const configService = new ConfigService(config);
  const dynamicLlm = new DynamicLlmClient(configService, process.env, logger, llm);
  const sessionStore = new SessionStoreRepository(SESSIONS_ROOT, logger);
  const personaRepo = new PersonaRepository(configService.get().paths.personasDir, logger);
  const emailGenerator = new OutreachEmailService(dynamicLlm, logger);
  const ctx = {
    configService,
    logger,
    llm: dynamicLlm,
    sessionStore,
    personaRepo,
    emailGenerator,
  } as unknown as WebContext;
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
  app.all('/api/auth/*', toNodeHandler(auth));
  app.use(verifyCsrf); // GUARDRAILS 2.5: guard every mutating route (AJAX sends X-CSRF-Token)
  app.use(async (req, res, next) => {
    try {
      const selectedPersona = req.session?.selectedPersona ?? 'default-icp';
      const personas = ctx.personaRepo.list();
      const activePersonaObj = personas.find((p) => p.id === selectedPersona) || personas[0];
      /* istanbul ignore next -- only reached when no personas exist (seeded always) */
      res.locals.activePersonaName = activePersonaObj ? activePersonaObj.name : 'Default ICP';
      res.locals.selectedPersona = selectedPersona;
      res.locals.personas = personas;
      const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
      res.locals.isAuthenticated = Boolean(session?.user);
      res.locals.userEmail = session?.user?.email ?? '';
      res.locals.user = session?.user ?? null;
      req.user = session?.user ?? null;
      next();
    } catch (err) {
      next(err);
    }
  });
  app.use(createRouter(ctx));
  // 404 handler — serve branded page for HTML requests, JSON for API
  app.use((req, res) => {
    const wantsHtml = req.accepts('html');
    if (wantsHtml) {
      res.status(404).render('404', {
        title: '404 — Not Found',
        csrfToken: res.locals.csrfToken,
        cspNonce: res.locals.cspNonce,
      });
    } else {
      /* istanbul ignore next -- JSON 404 branch hit only by API clients without Accept:text/html */
      res.status(404).json({ success: false, error: { message: 'Not found', code: 'NOT_FOUND' } });
    }
  });
  app.use(createErrorHandler(ctx.logger));
  return app;
}

/* istanbul ignore next -- entry glue: resolves env/secret and starts listening */
async function main(): Promise<void> {
  const env = process.env as LlmEnv & {
    LOG_LEVEL?: string;
    SESSION_SECRET?: string;
    PORT?: string;
  };
  const logger = createLogger({ level: (env.LOG_LEVEL as LogLevel) ?? 'info' });

  // Phase 1: run DB migration and wipe any stale demo user before accepting requests
  migrate();
  wipeStaleDemoUser();
  logger.info('database migration complete');

  let secret = env.SESSION_SECRET;
  if (!secret) {
    secret = randomBytes(32).toString('hex');
    logger.warn('SESSION_SECRET not set; using a random secret (sessions reset on restart)');
  }

  const llm = createLlmClient(env, defaultConfig.llm.timeout, logger);
  const app = createApp(buildContext(defaultConfig, logger, llm), secret);
  const port = Number(env.PORT ?? 3000);
  app.listen(
    port,
    /* istanbul ignore next */
    () => {
      logger.info({ port }, 'ICP Profiler web server started');
      // Seed demo user AFTER server is listening so the Better Auth REST API is reachable.
      // This guarantees the password hash format matches Better Auth's internal verifier.
      seedDemoUserViaApi(port).catch(
        /* istanbul ignore next */
        (err: unknown) => logger.warn({ err }, 'Demo user seed failed — try /auth/register'),
      );
    },
  );
}

/* istanbul ignore next */
if (require.main === module) {
  main();
}
