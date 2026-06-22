import { expect, test } from '@playwright/test';

test.describe('Journey 4: email settings', () => {
  test('saves sender details and clears the default-settings banner', async ({ page }) => {
    await page.goto('/email-settings');
    await expect(page.getByRole('heading', { name: 'Email settings' })).toBeVisible();

    await page.locator('#senderName').fill('Dana Rep');
    await page.locator('#company').fill('Acme Inc');
    await page.locator('#tone').fill('friendly');
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.locator('#status')).toHaveText('Saved.', { timeout: 10_000 });

    // Re-opening the page now shows the saved values (not the defaults).
    await page.goto('/email-settings');
    await expect(page.locator('#senderName')).toHaveValue('Dana Rep');
    await expect(page.getByText('Using default values')).toHaveCount(0);
  });
});
