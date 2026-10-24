import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, signIn } from '../support/operator';
import { OB, back, fillBasicInfo, next, stepCounter } from '../support/onboarding';

// Onboarding step 2 — Brand Identity (vibes + core-service tags).
const VIBES = [
  'Serene & Restorative',
  'Adventurous',
  'Luxury & Exclusive',
  'Family-Friendly',
  'Eco-Conscious',
  'Local & Authentic',
  'Youthful & Social',
  'Romantic',
];

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function openStep2(page: import('@playwright/test').Page) {
  const op = await provisionOperator('onb-brand', { stage: 'verified' });
  await signIn(page, op, '/onboarding');
  await fillBasicInfo(page);
  await next(page).click();
  await expect(page.getByText('How should you sound and what do you sell?')).toBeVisible();
}

const vibe = (page: import('@playwright/test').Page, name: string) => page.getByRole('button', { name, exact: true });

test.describe('Step 2 — Brand Identity', () => {
  test('shows the eyebrow, step counter and all eight vibes unpressed', async ({ page }) => {
    await openStep2(page);
    await expect(page.getByText('Step 2 — Required')).toBeVisible();
    await expect(stepCounter(page, 2)).toBeVisible();
    for (const v of VIBES) await expect(vibe(page, v)).toHaveAttribute('aria-pressed', 'false');
  });

  test('Continue needs at least one vibe AND at least one service', async ({ page }) => {
    await openStep2(page);
    await expect(next(page)).toBeDisabled();

    await vibe(page, 'Adventurous').click();
    await expect(next(page)).toBeDisabled(); // vibe only

    await page.getByPlaceholder(OB.service).fill('Guided reef dives');
    await page.getByPlaceholder(OB.service).press('Enter');
    await expect(next(page)).toBeEnabled();

    await vibe(page, 'Adventurous').click(); // un-pick the only vibe
    await expect(next(page)).toBeDisabled(); // service only
  });

  test('vibes toggle on and off and can be combined', async ({ page }) => {
    await openStep2(page);
    await vibe(page, 'Romantic').click();
    await vibe(page, 'Family-Friendly').click();
    await expect(vibe(page, 'Romantic')).toHaveAttribute('aria-pressed', 'true');
    await expect(vibe(page, 'Family-Friendly')).toHaveAttribute('aria-pressed', 'true');
    await vibe(page, 'Romantic').click();
    await expect(vibe(page, 'Romantic')).toHaveAttribute('aria-pressed', 'false');
    await expect(vibe(page, 'Family-Friendly')).toHaveAttribute('aria-pressed', 'true');
  });

  test('Enter adds a service tag and clears the field', async ({ page }) => {
    await openStep2(page);
    const input = page.getByPlaceholder(OB.service);
    await input.fill('Island hopping');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Island hopping' })).toBeVisible();
    await expect(input).toHaveValue('');
    await input.fill('Sunset cruise');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Sunset cruise' })).toBeVisible();
  });

  test('surrounding spaces are trimmed from a tag', async ({ page }) => {
    await openStep2(page);
    const input = page.getByPlaceholder(OB.service);
    await input.fill('  Kayak rental  ');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: 'Remove Kayak rental' })).toBeVisible();
  });

  test('a blank service is not added', async ({ page }) => {
    await openStep2(page);
    const input = page.getByPlaceholder(OB.service);
    await input.fill('    ');
    await input.press('Enter');
    await expect(page.getByRole('button', { name: /^Remove / })).toHaveCount(0);
  });

  test('a duplicate service is not added twice', async ({ page }) => {
    await openStep2(page);
    const input = page.getByPlaceholder(OB.service);
    for (let i = 0; i < 2; i++) {
      await input.fill('Snorkelling');
      await input.press('Enter');
    }
    await expect(page.getByRole('button', { name: 'Remove Snorkelling' })).toHaveCount(1);
  });

  test('Remove deletes a tag, and removing the last one disables Continue', async ({ page }) => {
    await openStep2(page);
    await vibe(page, 'Adventurous').click();
    const input = page.getByPlaceholder(OB.service);
    await input.fill('Snorkelling');
    await input.press('Enter');
    await expect(next(page)).toBeEnabled();
    await page.getByRole('button', { name: 'Remove Snorkelling' }).click();
    await expect(page.getByRole('button', { name: 'Remove Snorkelling' })).toHaveCount(0);
    await expect(next(page)).toBeDisabled();
  });

  test('Back keeps the vibes and services, and step 1 keeps its answers', async ({ page }) => {
    await openStep2(page);
    await vibe(page, 'Adventurous').click();
    const input = page.getByPlaceholder(OB.service);
    await input.fill('Snorkelling');
    await input.press('Enter');
    await back(page).click();
    await expect(page.getByPlaceholder(OB.businessName)).toHaveValue('E2E Reef Expeditions');
    await next(page).click();
    await expect(vibe(page, 'Adventurous')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Remove Snorkelling' })).toBeVisible();
  });
});
