import { expect, test } from '@playwright/test';
import { SAMPLE_LEAD, expectLeadInHistory, uploadJson, loginDemoUser } from './helpers';

test.describe('Journey 5: clear my data (F-16-010)', () => {
  test.beforeEach(async ({ page }) => {
    await loginDemoUser(page);
  });

  test('uploads a lead then wipes the session silo', async ({ page }) => {
    await uploadJson(page, 'e2e-clear.json', SAMPLE_LEAD);
    await expectLeadInHistory(page, 'E2E Lead');

    page.on('dialog', (dialog) => dialog.accept());
    await page.getByRole('button', { name: 'Clear my data' }).click();

    await expect(async () => {
      await page.goto('/history');
      await expect(page.getByText('No leads scored yet')).toBeVisible();
    }).toPass({ timeout: 10_000 });
  });
});
