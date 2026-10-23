import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, signIn } from '../support/operator';
import { pngFile } from '../support/files';
import { back, fillBasicInfo, fillBrandIdentity, fillStructuredInputs, next, stepCounter } from '../support/onboarding';

// Onboarding step 4 — Assets & Links: social handles, logo and website. Everything is optional.
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function openStep4(page: import('@playwright/test').Page) {
  const op = await provisionOperator('onb-assets', { stage: 'verified' });
  await signIn(page, op, '/onboarding');
  await fillBasicInfo(page);
  await next(page).click();
  await fillBrandIdentity(page);
  await next(page).click();
  await fillStructuredInputs(page);
  await next(page).click();
  await expect(page.getByRole('heading', { name: 'Assets and links' })).toBeVisible();
}

test.describe('Step 4 — Assets & Links', () => {
  test('is reachable with every field empty, and Continue is already enabled', async ({ page }) => {
    await openStep4(page);
    await expect(page.getByText('Step 4 · All optional')).toBeVisible();
    await expect(stepCounter(page, 4)).toBeVisible();
    await expect(next(page)).toBeEnabled();
    for (const p of ['Instagram', 'TikTok', 'Facebook']) {
      await expect(page.getByLabel(`${p} handle or page name`)).toHaveValue('');
    }
    await expect(page.getByPlaceholder('https://')).toHaveValue('');
  });

  test('social handles and website accept text', async ({ page }) => {
    await openStep4(page);
    await page.getByLabel('Instagram handle or page name').fill('@e2e_reef');
    await page.getByLabel('TikTok handle or page name').fill('@e2ereef');
    await page.getByLabel('Facebook handle or page name').fill('E2E Reef Expeditions');
    await page.getByPlaceholder('https://').fill('https://reef.example.com');
    await expect(page.getByLabel('Instagram handle or page name')).toHaveValue('@e2e_reef');
    await expect(page.getByPlaceholder('https://')).toHaveValue('https://reef.example.com');
  });

  test('choosing a logo shows a preview and "click to replace"', async ({ page }) => {
    await openStep4(page);
    await expect(page.getByText('Drop your logo')).toBeVisible();
    await page.getByTestId('logo-input').setInputFiles(pngFile());
    await expect(page.getByAltText('Logo preview')).toBeVisible();
    await expect(page.getByText('Logo added — click to replace')).toBeVisible();
    await expect(page.getByAltText('Logo preview')).toHaveAttribute('src', /^data:image\/png;base64,/);
  });

  test('the upload zone opens the file chooser from the keyboard', async ({ page }) => {
    await openStep4(page);
    const zone = page.getByRole('button', { name: 'Upload logo' });
    await zone.focus();
    const chooser = page.waitForEvent('filechooser');
    await page.keyboard.press('Enter');
    expect((await chooser).isMultiple()).toBe(false);
  });

  test('a logo can be dropped on the zone', async ({ page }) => {
    await openStep4(page);
    const dataTransfer = await page.evaluateHandle(() => {
      const dt = new DataTransfer();
      const bytes = Uint8Array.from(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='), (c) => c.charCodeAt(0));
      dt.items.add(new File([bytes], 'dropped.png', { type: 'image/png' }));
      return dt;
    });
    await page.getByRole('button', { name: 'Upload logo' }).dispatchEvent('drop', { dataTransfer });
    await expect(page.getByAltText('Logo preview')).toBeVisible();
  });

  test('Back and Continue keep the entries', async ({ page }) => {
    await openStep4(page);
    await page.getByLabel('Instagram handle or page name').fill('@e2e_reef');
    await page.getByTestId('logo-input').setInputFiles(pngFile());
    await expect(page.getByAltText('Logo preview')).toBeVisible();
    await back(page).click();
    await next(page).click();
    await expect(page.getByLabel('Instagram handle or page name')).toHaveValue('@e2e_reef');
    await expect(page.getByAltText('Logo preview')).toBeVisible();
  });

  test('Continue opens the analysis step', async ({ page }) => {
    await openStep4(page);
    await next(page).click();
    await expect(page.getByRole('heading', { name: 'Categories and uniqueness' })).toBeVisible();
    await expect(stepCounter(page, 5)).toBeVisible();
  });
});
