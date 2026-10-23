import type { Page } from '@playwright/test';
import { api } from '../support/api';
import { E2E_PASSWORD, latestEmailCode, requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, AI_WAIT } from '../support/fixtures';
import { PROFILE_DESCRIPTION, PROFILE_UVP, provisionOperator, signIn, uniqueEmail } from '../support/operator';
import { pngFile } from '../support/files';
import { OB, back, categoryChips, fillBasicInfo, fillBrandIdentity, fillStructuredInputs, finish, next, reachAnalysis } from '../support/onboarding';

// The whole onboarding flow end to end, plus behaviours that span steps.
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

test.describe('Onboarding journey', () => {
  test('@ai a new account signs up, verifies, completes all five steps and lands on the dashboard', async ({ page }) => {
    test.setTimeout(AI_WAIT * 4);
    const email = uniqueEmail('onb-journey');

    // Create account → verify email
    await page.goto('/login');
    await page.getByRole('tab', { name: 'Create account' }).click();
    await page.getByLabel('First name').fill('Ana');
    await page.getByLabel('Last name').fill('Reyes');
    await page.getByLabel('Contact number').fill('+63 917 123 4567');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(E2E_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Create account' }).click();
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 30_000 });
    await page.getByLabel('Verification code').fill(await latestEmailCode(email));
    await page.getByRole('button', { name: 'Verify email' }).click();
    await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });

    // Steps 1–4
    await fillBasicInfo(page, { slogan: 'Dive the wall at dawn.' });
    await next(page).click();
    await fillBrandIdentity(page, { vibes: ['Adventurous', 'Eco-Conscious'], services: ['Guided reef dives', 'Sardine run snorkelling'] });
    await next(page).click();
    await fillStructuredInputs(page);
    await next(page).click();
    await page.getByLabel('Instagram handle or page name').fill('@e2e_reef');
    await page.getByPlaceholder('https://').fill('https://reef.example.com');
    await page.getByTestId('logo-input').setInputFiles(pngFile());
    await next(page).click();

    // Step 5
    await expect(categoryChips(page).first()).toBeVisible({ timeout: AI_WAIT });
    const names = await categoryChips(page).evaluateAll((els) =>
      els.filter((e) => e.getAttribute('aria-pressed') === 'true').map((e) => (e.textContent ?? '').replace(/\d+%$/, '').trim()),
    );
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();
    await expect(page.getByTestId('score-primary').or(page.getByTestId('cohort-context')).first()).toBeVisible({ timeout: AI_WAIT });
    await finish(page).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });

    // What the server stored matches what was entered.
    const token = JSON.parse((await page.evaluate(() => localStorage.getItem('ceview.auth')))!).accessToken;
    const saved = await api(token).getOrThrow('/api/business-profile');
    expect(saved.businessName).toBe('E2E Reef Expeditions');
    expect(saved.categories).toEqual(names);
    expect(saved.coreServices).toEqual(['Guided reef dives', 'Sardine run snorkelling']);
    expect(saved.description).toBe(PROFILE_DESCRIPTION);
    expect(saved.uvp).toBe(PROFILE_UVP);
    expect(saved.imagePreview).toMatch(/^data:image\/png;base64,/);
    expect(saved.uniquenessScore).toBeGreaterThanOrEqual(0);
    expect(saved.uniquenessScore).toBeLessThanOrEqual(1);
  });

  test('reloading in the middle restarts the wizard from step 1 with an empty draft', async ({ page }) => {
    const op = await provisionOperator('onb-reload', { stage: 'verified' });
    await signIn(page, op, '/onboarding');
    await fillBasicInfo(page, { name: 'Will Be Lost' });
    await next(page).click();
    await expect(page.getByText('Step 2 of 5')).toBeVisible();
    await page.reload();
    await expect(page.getByText('Step 1 of 5')).toBeVisible();
    await expect(page.getByPlaceholder(OB.businessName)).toHaveValue('');
  });

  test('going back through every step keeps all the answers', async ({ page }) => {
    const op = await provisionOperator('onb-roundtrip', { stage: 'verified' });
    // Step 5 classifies on arrival; answer it locally so this walk doesn't spend a Space run.
    await page.route('**/api/classification/analyze', (route) =>
      route.fulfill({ json: { categories: [{ name: 'Culinary & Gastronomy', percentage: 100 }] } }),
    );
    await signIn(page, op, '/onboarding');
    await fillBasicInfo(page, { name: 'Round Trip Co', industry: 'Culinary & Gastronomy', slogan: 'Eat well' });
    await next(page).click();
    await fillBrandIdentity(page, { vibes: ['Romantic'], services: ['Tasting menu'] });
    await next(page).click();
    await fillStructuredInputs(page);
    await next(page).click();
    await next(page).click(); // step 5
    for (let i = 0; i < 4; i++) await back(page).click();
    await expect(page.getByPlaceholder(OB.businessName)).toHaveValue('Round Trip Co');
    await expect(page.locator('select')).toHaveValue('Culinary & Gastronomy');
    await expect(page.getByPlaceholder(OB.slogan)).toHaveValue('Eat well');
    await next(page).click();
    await expect(page.getByRole('button', { name: 'Romantic', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('button', { name: 'Remove Tasting menu' })).toBeVisible();
  });
});

test.describe('Onboarding journey (classification and scoring replies stubbed)', () => {
  // Same two stubs as analysis.spec.ts, so these cover the save path without spending AI runs.
  async function stubAi(page: Page) {
    await page.route('**/api/classification/analyze', (route) =>
      route.fulfill({ json: { categories: [{ name: 'Adventure & Nature', percentage: 70 }, { name: 'Coastal & Island', percentage: 30 }] } }),
    );
    await page.route('**/api/classification/uniqueness', (route) =>
      route.fulfill({
        json: {
          overallScore: 64.4, semanticsScore: 41, categoryScore: 77, semanticPercentile: 64.4, cohortSize: 18,
          cohortMedianScore: 50, cohortCategories: ['Adventure & Nature'], categoryDensity: 'dense',
          sufficientCohort: true, descriptionFeedback: '', categoryFeedback: '',
        },
      }),
    );
  }

  async function finishWizard(page: Page, opts: { slogan?: string; website?: string; logo?: boolean } = {}) {
    await fillBasicInfo(page, { slogan: opts.slogan });
    await next(page).click();
    await fillBrandIdentity(page);
    await next(page).click();
    await fillStructuredInputs(page);
    await next(page).click();
    if (opts.website) await page.getByPlaceholder('https://').fill(opts.website);
    if (opts.logo) await page.getByTestId('logo-input').setInputFiles(pngFile());
    await next(page).click();
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();
    await expect(page.getByTestId('score-primary')).toBeVisible();
    await finish(page).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
  }

  test('the score is saved on the 0–1 scale, with the selected categories and the logo', async ({ page }) => {
    const op = await provisionOperator('onb-save', { stage: 'verified' });
    await stubAi(page);
    await signIn(page, op, '/onboarding');
    await finishWizard(page, { logo: true });
    const saved = await api(op.token).getOrThrow('/api/business-profile');
    expect(saved.uniquenessScore).toBeCloseTo(0.644, 2);
    expect(saved.categories).toEqual(['Adventure & Nature', 'Coastal & Island']);
    expect(saved.imagePreview).toMatch(/^data:image\/png;base64,/);
    expect(saved.businessProfileId).toBeTruthy();
  });

  test('Finish shows "Finishing…" and a failed save keeps the wizard open with a toast', async ({ page }) => {
    const op = await provisionOperator('onb-save-fails', { stage: 'verified' });
    await stubAi(page);
    await page.route('**/api/business-profile', (route) =>
      route.request().method() === 'PUT' ? route.fulfill({ status: 500, json: { error: 'boom' } }) : route.continue(),
    );
    await signIn(page, op, '/onboarding');
    await fillBasicInfo(page);
    await next(page).click();
    await fillBrandIdentity(page);
    await next(page).click();
    await fillStructuredInputs(page);
    await next(page).click();
    await next(page).click();
    await page.getByRole('button', { name: 'Compute uniqueness score' }).click();
    await expect(page.getByTestId('score-primary')).toBeVisible();
    await finish(page).click();
    await expect(page.getByText('Could not save your profile — please try again.')).toBeVisible();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(finish(page)).toBeEnabled();
  });

  // KNOWN GAP: steps 1 and 4 collect a slogan, vibes, social handles and a website, but Finish saves
  // only name, categories, services, description, UVP, logo and score (BusinessProfileDto has no
  // field for the rest), so they vanish — and Settings → Business Profile then shows them empty.
  test.fail('the slogan and website entered during onboarding appear in Settings → Business Profile', async ({ page }) => {
    const op = await provisionOperator('onb-lost-fields', { stage: 'verified' });
    await stubAi(page);
    await signIn(page, op, '/onboarding');
    await finishWizard(page, { slogan: 'Dive the wall at dawn.', website: 'https://reef.example.com' });
    await page.goto('/settings/profile');
    await expect(page.getByPlaceholder('Add a short slogan for your business…')).toHaveValue('Dive the wall at dawn.');
    await expect(page.getByLabel('Website')).toHaveValue('https://reef.example.com');
  });
});
