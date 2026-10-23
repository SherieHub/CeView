import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, signIn } from '../support/operator';
import { expectNoHorizontalOverflow } from '../support/ui';
import { OB, back, next, stepCounter } from '../support/onboarding';

// Onboarding step 1 — Basic Info. Every test opens /onboarding as a fresh verified operator that
// has no business profile yet (the draft lives only in memory, so each one starts empty).
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function openWizard(page: import('@playwright/test').Page) {
  const op = await provisionOperator('onb-basic', { stage: 'verified' });
  await signIn(page, op, '/onboarding');
  await expect(page.getByText('Tell us about your business')).toBeVisible();
  return op;
}

test.describe('Step 1 — Basic Info', () => {
  test('opens on step 1 with Back disabled and Continue disabled', async ({ page }) => {
    await openWizard(page);
    await expect(page.getByText('Step 1 — Required')).toBeVisible();
    await expect(stepCounter(page, 1)).toBeVisible();
    await expect(back(page)).toBeDisabled();
    await expect(next(page)).toBeDisabled();
  });

  test('the progress tracker marks step 1 current and steps 2–5 pending', async ({ page }) => {
    await openWizard(page);
    const steps = page.getByRole('list', { name: 'Onboarding progress' }).getByRole('listitem');
    await expect(steps).toHaveCount(5);
    await expect(steps.nth(0)).toHaveAttribute('aria-current', 'step');
    await expect(steps.nth(0)).toHaveAttribute('data-state', 'current');
    for (const i of [1, 2, 3, 4]) await expect(steps.nth(i)).toHaveAttribute('data-state', 'pending');
    const titles = await steps.locator('b').allInnerTexts();
    expect(titles).toEqual(['Basic Info', 'Brand Identity', 'Structured Inputs', 'Assets & Links', 'Analysis']);
  });

  test('offers the seven tourism categories', async ({ page }) => {
    await openWizard(page);
    const options = await page.locator('select option').allInnerTexts();
    expect(options).toEqual([
      'Select your primary category…',
      'Coastal & Island',
      'Adventure & Nature',
      'Cultural & Heritage',
      'Theme Parks / Entertainment',
      'Urban & City',
      'Culinary & Gastronomy',
      'Accommodation & Staycation',
    ]);
  });

  test('Continue needs a business name longer than one character AND a category', async ({ page }) => {
    await openWizard(page);
    await page.getByPlaceholder(OB.businessName).fill('A');
    await page.locator('select').selectOption('Coastal & Island');
    await expect(next(page)).toBeDisabled();

    await page.getByPlaceholder(OB.businessName).fill('AB');
    await expect(next(page)).toBeEnabled();

    await page.getByPlaceholder(OB.businessName).fill('   ');
    await expect(next(page)).toBeDisabled();

    await page.getByPlaceholder(OB.businessName).fill('Reef Co');
    await page.locator('select').selectOption('');
    await expect(next(page)).toBeDisabled();
  });

  test('the slogan is optional', async ({ page }) => {
    await openWizard(page);
    await page.getByPlaceholder(OB.businessName).fill('Reef Co');
    await page.locator('select').selectOption('Coastal & Island');
    await expect(page.getByPlaceholder(OB.slogan)).toHaveValue('');
    await expect(next(page)).toBeEnabled();
  });

  test('Continue moves to step 2 and the tracker marks step 1 done', async ({ page }) => {
    await openWizard(page);
    await page.getByPlaceholder(OB.businessName).fill('Reef Co');
    await page.locator('select').selectOption('Coastal & Island');
    await next(page).click();
    await expect(page.getByText('How should you sound and what do you sell?')).toBeVisible();
    await expect(stepCounter(page, 2)).toBeVisible();
    const steps = page.getByRole('list', { name: 'Onboarding progress' }).getByRole('listitem');
    await expect(steps.nth(0)).toHaveAttribute('data-state', 'done');
    await expect(steps.nth(1)).toHaveAttribute('data-state', 'current');
  });

  test('Back from step 2 returns to step 1 with the answers kept', async ({ page }) => {
    await openWizard(page);
    await page.getByPlaceholder(OB.businessName).fill('Reef Co');
    await page.locator('select').selectOption('Coastal & Island');
    await page.getByPlaceholder(OB.slogan).fill('Dive the wall');
    await next(page).click();
    await back(page).click();
    await expect(page.getByPlaceholder(OB.businessName)).toHaveValue('Reef Co');
    await expect(page.locator('select')).toHaveValue('Coastal & Island');
    await expect(page.getByPlaceholder(OB.slogan)).toHaveValue('Dive the wall');
  });

  test('@mobile the card, fields and footer fit a phone screen', async ({ page }) => {
    await openWizard(page);
    await expectNoHorizontalOverflow(page);
    await page.getByPlaceholder(OB.businessName).fill('Reef Co');
    await page.locator('select').selectOption('Coastal & Island');
    await expect(next(page)).toBeEnabled();
    await next(page).scrollIntoViewIfNeeded();
    await expect(next(page)).toBeInViewport();
    await expect(back(page)).toBeInViewport();
  });
});
