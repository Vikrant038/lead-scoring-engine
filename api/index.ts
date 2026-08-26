/**
 * Vercel Serverless Function entry point.
 * Exports the Express app instance configured for serverless execution.
 */
import path from 'node:path';
import fs from 'node:fs';
import type { Request, Response } from 'express';
import { defaultConfig } from '../src/config/config';
import { createLogger, type LogLevel } from '../src/lib/logger/logger';
import { createLlmClient } from '../src/llm/llm-client.factory';
import { buildContext, createApp } from '../src/web/server';
import { migrate } from '../src/db/migrate';

let cachedApp: ((req: Request, res: Response) => void) | null = null;
let initError: Error | null = null;

function getApp() {
  if (initError) throw initError;
  if (cachedApp) return cachedApp;

  try {
    if (process.env.VERCEL) {
      const tmpDir = path.join('/tmp', 'icp-data');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
    }

    const logger = createLogger({ level: (process.env.LOG_LEVEL as LogLevel) ?? 'info' });

    try {
      migrate();
    } catch (error) {
      logger.warn(
        { error: (error as Error).message },
        'Serverless DB migration skipped or deferred',
      );
    }

    const secret = process.env.SESSION_SECRET || 'vercel_serverless_session_secret_default_key_123';
    const llm = createLlmClient(process.env, defaultConfig.llm.timeout, logger);
    cachedApp = createApp(buildContext(defaultConfig, logger, llm), secret);
    return cachedApp;
  } catch (err) {
    initError = err as Error;
    throw err;
  }
}

export default function handler(req: Request, res: Response): void {
  try {
    const app = getApp();
    app(req, res);
  } catch (err: unknown) {
    const error = err as Error;
    res.status(500).json({
      success: false,
      error: 'Vercel Initialization Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}
