/**
 * Self-demo entry point (F-15). Generates/loads synthetic leads and runs the full pipeline.
 * TODO: implement arg parsing, lead generation, and colourful summary in Phase 3.
 */
async function runDemo(): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('Lead Scoring Engine — demo scaffold. Not yet implemented (Phase 3).');
}

if (require.main === module) {
  runDemo().catch((error: unknown) => {
    // eslint-disable-next-line no-console
    console.error('Demo failed:', error);
    process.exit(1);
  });
}

export { runDemo };
