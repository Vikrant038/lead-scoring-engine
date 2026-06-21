/**
 * CLI entry point (F-01). Loads env, runs the batch pipeline over ./input.
 * TODO: wire to runBatch() in Phase 3.
 */
async function main(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Lead Scoring Engine — CLI scaffold. Pipeline not yet implemented (Phase 3).');
}

if (require.main === module) {
  main().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { main };
