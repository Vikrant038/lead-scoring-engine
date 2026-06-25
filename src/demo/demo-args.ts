/**
 * Demo CLI argument parsing (FR-15-002). Pure and dependency-free for deterministic testing.
 */
export interface DemoOptions {
  /** Number of synthetic leads to generate (default 15). */
  count: number;
  /** Optional persona id to score against. */
  persona?: string;
  /** Skip AI entirely and use the packaged fallback dataset. */
  noAi: boolean;
  /** Output directory for results (default ./demo-output). */
  output: string;
  /** Suppress info-level logging. */
  quiet: boolean;
  /** Generate a standalone HTML report after scoring. */
  html: boolean;
}

const DEFAULT_COUNT = 15;
const DEFAULT_OUTPUT = './demo-output';

export function parseDemoArgs(argv: string[]): DemoOptions {
  const options: DemoOptions = {
    count: DEFAULT_COUNT,
    noAi: false,
    output: DEFAULT_OUTPUT,
    quiet: false,
    html: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    switch (arg) {
      case '--count': {
        const value = Number(argv[i + 1]);
        if (Number.isInteger(value) && value > 0) {
          options.count = value;
        }
        i += 1;
        break;
      }
      case '--persona': {
        if (argv[i + 1]) {
          options.persona = argv[i + 1];
        }
        i += 1;
        break;
      }
      case '--output': {
        if (argv[i + 1]) {
          options.output = argv[i + 1];
        }
        i += 1;
        break;
      }
      case '--no-ai':
        options.noAi = true;
        break;
      case '--quiet':
        options.quiet = true;
        break;
      case '--html':
        options.html = true;
        break;
      default:
        break;
    }
  }

  return options;
}
