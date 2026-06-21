/**
 * Structured logger (F-09, CODING 4.7, GUARDRAILS 6.4 / SEC-07).
 * - pino JSON output with level filtering.
 * - Redacts secrets and bulky/sensitive fields (profiles, emails) so they never reach logs.
 * - Accepts an optional destination stream for deterministic testing.
 */
import path from 'node:path';
import pino, { type DestinationStream, type Logger as PinoLogger } from 'pino';

export type Logger = PinoLogger;

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LoggerOptions {
  level?: LogLevel;
  pretty?: boolean;
}

/**
 * Paths redacted from every log line. Covers secret-like keys (any depth) plus large/sensitive
 * payloads (raw profiles, generated emails) per SEC-07.
 */
export const REDACT_PATHS: string[] = [
  'password',
  '*.password',
  'token',
  '*.token',
  'apiKey',
  '*.apiKey',
  'secret',
  '*.secret',
  'authorization',
  '*.authorization',
  'GEMINI_API_KEY',
  'OPENAI_API_KEY',
  'SESSION_SECRET',
  'PERPLEXITY_API_KEY',
  'profile',
  '*.profile',
  'outreach_email',
  '*.outreach_email',
  'email.body',
];

/**
 * Build the dated log file path (FR-09-004): `icp-profiler-YYYY-MM-DD.log`.
 */
export function logFilePath(logDir: string, date: Date = new Date()): string {
  const day = date.toISOString().slice(0, 10);
  return path.join(logDir, `icp-profiler-${day}.log`);
}

function baseOptions(level: LogLevel): pino.LoggerOptions {
  return {
    level,
    redact: { paths: REDACT_PATHS, censor: '[REDACTED]' },
  };
}

/**
 * Create a logger. With a `destination` stream the logger writes structured JSON to it
 * (used by tests and file logging); otherwise it writes to stdout (optionally pretty in dev).
 */
export function createLogger(options: LoggerOptions = {}, destination?: DestinationStream): Logger {
  const level: LogLevel =
    options.level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? 'info';

  if (destination) {
    return pino(baseOptions(level), destination);
  }

  if (options.pretty) {
    return pino({ ...baseOptions(level), transport: { target: 'pino-pretty' } });
  }

  return pino(baseOptions(level));
}
