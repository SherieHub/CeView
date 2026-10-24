import { requireBackend, requireTestSupport } from '../support/stack';
import { api } from '../support/api';
import { test, expect, useOperator } from '../support/fixtures';
import { provisionOperator, signIn } from '../support/operator';
import { seedDemandWindow } from '../support/demandWindow';
import { completeOnboardingStubbed } from '../support/onboarding';
import { openDashboard } from '../support/dashboard';

// The welcome tour: shown once, on the dashboard an operator reaches by finishing onboarding.
const returning = useOperator('dash-tour-returning', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const tour = (page: import('@playwright/test').Page) => page.getByRole('dialog', { name: 'Welcome tour' });

/** A brand-new operator walks the wizard (AI replies stubbed) and lands on the dashboard. */
async function finishOnboarding(page: import('@playwright/test').Page, tag: string) {
  const op = await provisionOperator(tag, { stage: 'verified', categories: ['Coastal & Island'] });
  // Give the new profile a forecast first, so landing on the dashboard doesn't start the live pipeline.
  await api().postOrThrow('/api/test-support/business-profile', {
    email: op.email, businessName: 'Tour Co', categories: ['Coastal & Island'], coreServices: [], description: '', uvp: '', uniquenessScore: null,
  });
  await seedDemandWindow(op, { category: 'Coastal & Island' });
  await signIn(page, op, '/onboarding');
  await completeOnboardingStubbed(page);
  return op;
}

test.describe('Welcome tour', () => {
  test('is not shown to a returning operator', async ({ page }) => {
    await openDashboard(page, returning.current);
    await expect(tour(page)).toBeHidden();
  });

  test('opens right after onboarding with four slides, and Next / Back move through them', async ({ page }) => {
    await finishOnboarding(page, 'tour-slides');
    await expect(tour(page)).toBeVisible();
    const slides = ['Dashboard', 'Content Studio', 'Calendar', 'Performance'];
    await expect(tour(page).getByRole('heading', { name: slides[0] })).toBeVisible();
    await expect(tour(page).getByRole('button', { name: 'Back' })).toHaveCount(0);
    for (let i = 1; i < slides.length; i++) {
      await tour(page).getByRole('button', { name: 'Next' }).click();
      await expect(tour(page).getByRole('heading', { name: slides[i] })).toBeVisible();
    }
    // The last slide swaps Next for Get started.
    await expect(tour(page).getByRole('button', { name: 'Next' })).toHaveCount(0);
    await expect(tour(page).getByRole('button', { name: 'Get started' })).toBeVisible();
    await tour(page).getByRole('button', { name: 'Back' }).click();
    await expect(tour(page).getByRole('heading', { name: 'Calendar' })).toBeVisible();
  });

  test('"Get started" closes it', async ({ page }) => {
    await finishOnboarding(page, 'tour-done');
    for (let i = 0; i < 3; i++) await tour(page).getByRole('button', { name: 'Next' }).click();
    await tour(page).getByRole('button', { name: 'Get started' }).click();
    await expect(tour(page)).toBeHidden();
  });

  test('"Skip tour" closes it at any slide, and a reload does not bring it back', async ({ page }) => {
    await finishOnboarding(page, 'tour-skip');
    await tour(page).getByRole('button', { name: 'Next' }).click();
    await tour(page).getByRole('button', { name: 'Skip tour' }).click();
    await expect(tour(page)).toBeHidden();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Surge Alerts', exact: true })).toBeVisible();
    await expect(tour(page)).toBeHidden();
  });

  test('Escape closes it', async ({ page }) => {
    await finishOnboarding(page, 'tour-escape');
    await expect(tour(page)).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(tour(page)).toBeHidden();
  });

  test('is not shown again when the same operator signs in later', async ({ page }) => {
    const op = await finishOnboarding(page, 'tour-once');
    await page.keyboard.press('Escape');
    await openDashboard(page, op);
    await expect(tour(page)).toBeHidden();
  });
});
