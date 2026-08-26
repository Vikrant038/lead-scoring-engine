/* eslint-disable no-console */
import { chromium } from 'playwright';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { defaultConfig } from '../src/config/config';
import { createLogger } from '../src/lib/logger/logger';
import { createLlmClient } from '../src/llm/llm-client.factory';
import { buildContext, createApp } from '../src/web/server';
import { migrate, seedDemoUserViaApi } from '../src/db/migrate';

async function main() {
  const imagesDir = path.join(process.cwd(), 'docs', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }

  const PORT = 3000;
  process.env.BETTER_AUTH_URL = `http://localhost:${PORT}`;
  migrate();
  const logger = createLogger({ level: 'silent' });
  const llm = createLlmClient(process.env, defaultConfig.llm.timeout, logger);
  const app = createApp(buildContext(defaultConfig, logger, llm), 'screenshot_secret_123');

  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(PORT, resolve));
  console.log(`Server listening on port ${PORT}`);

  try {
    await seedDemoUserViaApi(PORT);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.log('Seeding note:', msg);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
    colorScheme: 'dark',
  });

  const page = await context.newPage();

  // 1. Login
  console.log('Logging in...');
  await page.goto(`http://localhost:${PORT}/auth/login`);
  await page.fill('#email', 'demo@example.com');
  await page.fill('#password', 'password');
  await page.click('#sign-in-btn');
  await page.waitForURL((url) => url.pathname === '/', { timeout: 10000 });
  await page.waitForTimeout(1000);

  // 2. Take Main Dashboard Screenshot
  console.log('Capturing main dashboard screenshot...');
  const mainPath = path.join(imagesDir, 'app-main.png');
  await page.screenshot({ path: mainPath, fullPage: false });
  console.log(`Saved: ${mainPath}`);

  // 3. Scroll down slightly and capture dropzone
  await page.evaluate(() => window.scrollBy(0, 450));
  await page.waitForTimeout(500);
  const dropzonePath = path.join(imagesDir, 'app-dropzone.png');
  await page.screenshot({ path: dropzonePath, fullPage: false });
  console.log(`Saved: ${dropzonePath}`);

  // 4. Trigger Instant Demo Batch via API
  console.log('Triggering demo batch...');
  const demoBtn = page.locator('#demo-batch-btn, button:has-text("Run Instant Demo")').first();
  if (await demoBtn.isVisible()) {
    await demoBtn.click();
    // Wait for the queue/SSE to process
    await page.waitForTimeout(6000);
  }

  // 5. Navigate to History & Take Screenshot with populated leads
  console.log('Capturing history dashboard screenshot...');
  await page.goto(`http://localhost:${PORT}/history`);
  await page.waitForTimeout(2000);
  const historyPath = path.join(imagesDir, 'app-history.png');
  await page.screenshot({ path: historyPath, fullPage: false });
  console.log(`Saved: ${historyPath}`);

  await browser.close();
  server.close();
  console.log('Screenshots generated successfully!');
}

main().catch((err) => {
  console.error('Error generating screenshots:', err);
  process.exit(1);
});
