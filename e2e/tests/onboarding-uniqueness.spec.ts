import { test, expect } from '@playwright/test';
import { requireBackend } from './support/stack';

test.describe('Step 5 Analysis', () => {
  test.beforeEach(async () => {
    await requireBackend();
  });

  function freshEmail() {
    return `e2e-uniqueness-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ceview.local`;
  }

  async function registerAndReachStepFive(page: any) {
    await page.goto('/');
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('First name').fill('E2E');
    await page.getByLabel('Last name').fill('Tester');
    await page.getByLabel('Contact number').fill('+63 917 000 0000');
    await page.getByPlaceholder('you@example.com').fill(freshEmail());
    await page.getByPlaceholder('••••••••').fill('MoalboalDive2024!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });

    await page.getByPlaceholder('e.g. Sunset Cove Beach Resort').fill('E2E Reef Expeditions');
    await page.locator('select').selectOption('Adventure & Nature');
    await page.getByPlaceholder('One line that captures what you offer').fill('Dive the wall at dawn.');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: 'Adventurous' }).click();
    await page.getByRole('button', { name: 'Eco-Conscious' }).click();
    const service = page.getByPlaceholder('Type a service and press Enter…');
    await service.fill('Guided reef dives');
    await service.press('Enter');
    await page.getByRole('button', { name: 'Continue' }).click();

    await page
      .getByPlaceholder('What is the property, where exactly is it, what does a guest actually experience?')
      .fill(
        'A small freediving and snorkelling outfit on the Moalboal shoreline in Cebu, running two '
        + 'daily boat trips out to the resident sardine ball and the turtle sanctuary just south of '
        + 'Panagsama Beach. Groups are capped at six guests so every diver gets individual attention '
        + 'from an instructor, and every booking includes full gear rental, a shore briefing, and an '
        + 'underwater photo review back at the shop afterwards over coffee.',
      );
    await page
      .getByPlaceholder('What can a guest get here that they genuinely cannot get from the business next door?')
      .fill(
        'We are the only operator on this stretch of coast that logs the sardine ball position every '
        + 'morning before any group leaves the shore, so guests are taken to where the shoal actually '
        + 'is that day rather than to where it usually sits.',
      );
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Categories and uniqueness' })).toBeVisible();
  }

  test('discloses a real cohort and completes onboarding at any score', async ({ page }) => {
    test.setTimeout(180_000);
    await registerAndReachStepFive(page);
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();

    const primary = page.getByTestId('score-primary');
    const cohort = page.getByTestId('cohort-context');
    await expect(primary.or(cohort).first()).toBeVisible({ timeout: 90_000 });

    await expect(cohort).toContainText(/\d+\s+\S+.*business/i);
    await expect(cohort).not.toContainText('undefined');
    await expect(cohort).not.toContainText('NaN');

    await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
  });

  test('a materially more specific UVP moves the score', async ({ page }) => {
    test.setTimeout(240_000);
    await registerAndReachStepFive(page);
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();

    const primary = page.getByTestId('score-primary');
    await expect(primary).toBeVisible({ timeout: 90_000 });
    const before = await primary.innerText();

    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: 'Back' }).click();

    await page
      .getByPlaceholder('What can a guest get here that they genuinely cannot get from the business next door?')
      .fill(
        'We are the only PADI five-star centre in Moalboal with a resident marine biologist on staff, '
        + 'running dawn sardine-run dives from a private shore entry thirty metres from the reef wall, '
        + 'with every dive logged against a twelve-year record of shoal movement along this coast.',
      );

    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await page.getByRole('button', { name: /Recompute score|Compute uniqueness score/ }).click();
    await expect(primary).toBeVisible({ timeout: 90_000 });
    await expect(primary).not.toHaveText(before);
  });
});
