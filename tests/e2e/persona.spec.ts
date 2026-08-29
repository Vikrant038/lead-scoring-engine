import { expect, test } from '@playwright/test';
import { SAMPLE_PERSONA, loginDemoUser } from './helpers';

test.describe('Journey 2: persona management', () => {
  test.beforeEach(async ({ page }) => {
    await loginDemoUser(page);
  });

  test('uploads a persona, activates it, and sees it on the home dropdown', async ({ page }) => {
    await page.goto('/personas');
    await expect(page.getByRole('heading', { name: 'Personas' })).toBeVisible();

    await page.setInputFiles('#persona-file', {
      name: 'e2e-persona.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(SAMPLE_PERSONA)),
    });
    await page.getByRole('button', { name: 'Upload' }).click();

    // Page reloads with the new persona row.
    await expect(page.getByText('E2E Persona')).toBeVisible({ timeout: 10_000 });

    // Activate it, then confirm the home dropdown offers it. The radio's change handler
    // POSTs /api/set-persona and then reloads the page; wait for both so the reload
    // cannot abort the navigation below.
    const activated = page.waitForResponse((r) => r.url().includes('/api/set-persona'));
    await page.locator('.set-persona').first().check();
    await activated;
    await page.waitForLoadState('networkidle');
    await page.goto('/');
    await expect(page.locator('#persona-select')).toContainText('E2E Persona');
  });
});
