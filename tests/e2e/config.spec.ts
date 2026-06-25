import { expect, test } from '@playwright/test';

test.describe('Journey 3: configuration editor', () => {
  test('saves a valid config edit and resets to defaults', async ({ page }) => {
    await page.goto('/config');
    await expect(page.getByRole('heading', { name: 'Configuration' })).toBeVisible();

    await page.click('#toggle-raw-btn');
    const textarea = page.locator('#config-json');
    const raw = await textarea.inputValue();
    const config = JSON.parse(raw);
    config.processing.pollIntervalMs = 4000;
    await textarea.fill(JSON.stringify(config, null, 2));

    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#status')).toHaveText('Saved.', { timeout: 10_000 });

    await page.getByRole('button', { name: 'Reset to Defaults' }).click();
    await expect(page.locator('#status')).toHaveText('Reset to defaults.', { timeout: 10_000 });
  });

  test('rejects an invalid config edit with an error message', async ({ page }) => {
    await page.goto('/config');
    await page.click('#toggle-raw-btn');
    await page.locator('#config-json').fill('{ "not": "a valid config" }');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#status')).not.toHaveText('Saved.', { timeout: 10_000 });
  });
});
