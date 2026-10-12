import { expect, type Locator, type Page } from '@playwright/test';

export async function closeDialog(page: Page, dialog: Locator) {
  const close = dialog.getByRole('button', { name: 'Close', exact: true });
  if (await close.count()) await close.click();
  else {
    // Vaul drawers have no visible Close control. Keep the app unchanged and
    // retry Escape until the dismiss layer is ready.
    await dismissWithEscape(page, dialog);
  }
  await expect(dialog).toHaveCount(0);
}
export async function dismissWithEscape(page: Page, surface: Locator) {
  await expect(async () => {
    await page.keyboard.press('Escape');
    await expect(surface).toHaveCount(0, { timeout: 250 });
  }).toPass({ timeout: 5000 });
}
