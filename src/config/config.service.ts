/**
 * Mutable configuration holder (F-11). Modules read the current config via `get()`; the web
 * Config Editor applies validated edits via `update()` (FR-11-004) and restores defaults via
 * `reset()` (FR-11-005). Invalid edits throw InvalidConfigError -> HTTP 400 (FR-11-003).
 */
import { InvalidConfigError } from '../lib/errors/domain-errors';
import { defaultConfig } from './config';
import { appConfigSchema, type AppConfig } from './config.schema';

export class ConfigService {
  private current: AppConfig;

  constructor(initial: AppConfig = defaultConfig) {
    this.current = structuredClone(initial);
  }

  /** The configuration currently in effect. */
  get(): AppConfig {
    return this.current;
  }

  /**
   * Validate and apply a new configuration. Throws InvalidConfigError with a descriptive,
   * field-pointed message if validation fails (FR-11-003).
   */
  update(raw: unknown): AppConfig {
    const result = appConfigSchema.safeParse(raw);
    if (!result.success) {
      const reason = result.error.issues
        .map((issue) => `${issue.path.join('.') || '<root>'}: ${issue.message}`)
        .join('; ');
      throw new InvalidConfigError(reason);
    }
    this.current = result.data;
    return this.current;
  }

  /** Restore the configuration shipped with the application (FR-11-005). */
  reset(): AppConfig {
    this.current = structuredClone(defaultConfig);
    return this.current;
  }
}
