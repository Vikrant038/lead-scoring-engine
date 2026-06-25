/**
 * Shared E2E helpers (CODING 7.4). Each spec runs in its own browser context, so sessions are
 * naturally isolated (F-16); these helpers drive the real upload + history flow.
 */
import { expect, type Page } from '@playwright/test';

export const SAMPLE_LEAD = {
  name: 'E2E Lead',
  education: ['MBA @ Harvard University'],
  jobs: ['VP Engineering @ Stripe', 'Engineer @ Google'],
  skills: ['AI', 'Strategy', 'Innovation', 'Scalable'],
};

export const SAMPLE_PERSONA = {
  name: 'E2E Persona',
  description: 'tech leaders for e2e',
  skills_must_have: ['AI'],
};

/** Log in using the Demo User button. */
export async function loginDemoUser(page: Page): Promise<void> {
  await page.goto('/auth/login');
  await page.click('#demo-login-btn');
  await page.waitForURL((url) => url.pathname === '/');
}

/** Upload a JSON payload through the home dropzone's hidden file input. */
export async function uploadJson(page: Page, fileName: string, payload: unknown): Promise<void> {
  await page.goto('/');
  await page.setInputFiles('#file-input', {
    name: fileName,
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(payload)),
  });
}

/** Poll the server-rendered history page until the named lead appears (job processed). */
export async function expectLeadInHistory(page: Page, name: string): Promise<void> {
  await expect(async () => {
    await page.goto('/history');
    await expect(page.getByText(name).first()).toBeVisible();
  }).toPass({ timeout: 15_000 });
}
