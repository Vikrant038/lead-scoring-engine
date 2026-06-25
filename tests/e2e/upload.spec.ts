import { expect, test } from '@playwright/test';
import { SAMPLE_LEAD, expectLeadInHistory, uploadJson, loginDemoUser } from './helpers';

test.describe('Journey 1: upload and score a lead', () => {
  test.beforeEach(async ({ page }) => {
    await loginDemoUser(page);
  });

  test('uploads a JSON lead and sees it scored in history', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Upload lead profiles' })).toBeVisible();
    await expect(page.locator('#dropzone')).toBeVisible();

    await uploadJson(page, 'e2e-lead.json', SAMPLE_LEAD);
    await expectLeadInHistory(page, 'E2E Lead');

    // History summary reflects exactly one processed lead with a download link.
    await expect(page.getByText('Total:').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download' }).first()).toBeVisible();
  });

  test('rejects a non-JSON upload with a visible error', async ({ page }) => {
    await page.goto('/');
    await page.setInputFiles('#file-input', {
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not json'),
    });
    await expect(page.locator('#upload-error')).not.toHaveText('', { timeout: 10_000 });
  });
});
