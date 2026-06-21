import { Writable } from 'node:stream';
import { createLogger, logFilePath } from '../../src/lib/logger/logger';

/** Collect newline-delimited JSON log lines written by pino. */
function collector(): { stream: Writable; lines: () => Record<string, unknown>[] } {
  const raw: string[] = [];
  const stream = new Writable({
    write(chunk, _enc, cb): void {
      raw.push(chunk.toString());
      cb();
    },
  });
  return {
    stream,
    lines: () =>
      raw
        .join('')
        .split('\n')
        .filter(Boolean)
        .map((line) => JSON.parse(line) as Record<string, unknown>),
  };
}

describe('logger', () => {
  it('should suppress messages below the configured level', () => {
    // Arrange
    const { stream, lines } = collector();
    const logger = createLogger({ level: 'info' }, stream);
    // Act
    logger.debug('hidden');
    logger.info('shown');
    // Assert
    const entries = lines();
    expect(entries).toHaveLength(1);
    expect(entries[0].msg).toBe('shown');
  });

  it('should redact secrets and sensitive payloads (SEC-07)', () => {
    // Arrange
    const { stream, lines } = collector();
    const logger = createLogger({ level: 'info' }, stream);
    // Act
    logger.info({ password: 's3cret', apiKey: 'k', profile: { name: 'Jane' } }, 'op');
    // Assert
    const [entry] = lines();
    expect(entry.password).toBe('[REDACTED]');
    expect(entry.apiKey).toBe('[REDACTED]');
    expect(entry.profile).toBe('[REDACTED]');
  });

  it('should build a dated log file path (FR-09-004)', () => {
    // Arrange
    const date = new Date('2026-06-21T10:00:00.000Z');
    // Act
    const result = logFilePath('/var/logs', date);
    // Assert
    expect(result).toBe('/var/logs/icp-profiler-2026-06-21.log');
  });

  it('should return a usable stdout logger by default and honour LOG_LEVEL', () => {
    // Arrange
    const previous = process.env.LOG_LEVEL;
    process.env.LOG_LEVEL = 'warn';
    try {
      // Act
      const logger = createLogger();
      // Assert
      expect(typeof logger.info).toBe('function');
      expect(logger.level).toBe('warn');
    } finally {
      if (previous === undefined) {
        delete process.env.LOG_LEVEL;
      } else {
        process.env.LOG_LEVEL = previous;
      }
    }
  });
});
