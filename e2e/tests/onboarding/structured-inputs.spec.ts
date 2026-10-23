import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { PROFILE_DESCRIPTION, PROFILE_UVP, provisionOperator, signIn } from '../support/operator';
import { OB, back, fillBasicInfo, fillBrandIdentity, next, stepCounter } from '../support/onboarding';

// Onboarding step 3 — Structured Inputs: the description (≥ 50 words) and UVP (≥ 30 words) floors.
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i + 1}`).join(' ');

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function openStep3(page: import('@playwright/test').Page) {
  const op = await provisionOperator('onb-structured', { stage: 'verified' });
  await signIn(page, op, '/onboarding');
  await fillBasicInfo(page);
  await next(page).click();
  await fillBrandIdentity(page);
  await next(page).click();
  await expect(page.getByText('The two fields the AI leans on hardest')).toBeVisible();
}

const descHint = (page: import('@playwright/test').Page) => page.getByTestId('hint-description');
const uvpHint = (page: import('@playwright/test').Page) => page.getByTestId('hint-uvp');

test.describe('Step 3 — Structured Inputs', () => {
  test('starts empty with a "Min N words" hint on each field and Continue disabled', async ({ page }) => {
    await openStep3(page);
    await expect(page.getByText('Step 3 · Required')).toBeVisible();
    await expect(stepCounter(page, 3)).toBeVisible();
    await expect(descHint(page)).toHaveText('Min 50 words');
    await expect(uvpHint(page)).toHaveText('Min 30 words');
    await expect(next(page)).toBeDisabled();
  });

  test('the description hint counts words and says how many more are needed', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.description).fill(words(12));
    await expect(descHint(page)).toContainText('12 / 50 words — 38 more needed');
    await expect(descHint(page)).toHaveClass(/bad/);
  });

  test('the UVP hint counts words and says how many more are needed', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.uvp).fill(words(7));
    await expect(uvpHint(page)).toContainText('7 / 30 words — 23 more needed');
    await expect(uvpHint(page)).toHaveClass(/bad/);
  });

  test('the thresholds are exact: 49 words fails, 50 passes (description)', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.uvp).fill(words(30));
    await page.getByPlaceholder(OB.description).fill(words(49));
    await expect(descHint(page)).toContainText('49 / 50 words — 1 more needed');
    await expect(next(page)).toBeDisabled();
    await page.getByPlaceholder(OB.description).fill(words(50));
    await expect(descHint(page)).toContainText('50 words — threshold met');
    await expect(descHint(page)).toHaveClass(/good/);
    await expect(next(page)).toBeEnabled();
  });

  test('the thresholds are exact: 29 words fails, 30 passes (UVP)', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.description).fill(words(50));
    await page.getByPlaceholder(OB.uvp).fill(words(29));
    await expect(uvpHint(page)).toContainText('29 / 30 words — 1 more needed');
    await expect(next(page)).toBeDisabled();
    await page.getByPlaceholder(OB.uvp).fill(words(30));
    await expect(uvpHint(page)).toContainText('30 words — threshold met');
    await expect(next(page)).toBeEnabled();
  });

  test('each field must clear its own floor — a long description does not cover a short UVP', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.description).fill(words(200));
    await expect(next(page)).toBeDisabled();
    await page.getByPlaceholder(OB.description).fill('');
    await page.getByPlaceholder(OB.uvp).fill(words(200));
    await expect(next(page)).toBeDisabled();
  });

  test('extra spaces and line breaks do not inflate the word count', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.description).fill(`   one   two\n\n three   `);
    await expect(descHint(page)).toContainText('3 / 50 words');
  });

  test('real copy clears both floors and Continue opens step 4', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.description).fill(PROFILE_DESCRIPTION);
    await page.getByPlaceholder(OB.uvp).fill(PROFILE_UVP);
    await expect(descHint(page)).toHaveClass(/good/);
    await expect(uvpHint(page)).toHaveClass(/good/);
    await next(page).click();
    await expect(page.getByRole('heading', { name: 'Assets and links' })).toBeVisible();
  });

  test('Back keeps what was typed', async ({ page }) => {
    await openStep3(page);
    await page.getByPlaceholder(OB.description).fill(PROFILE_DESCRIPTION);
    await page.getByPlaceholder(OB.uvp).fill(PROFILE_UVP);
    await back(page).click();
    await next(page).click();
    await expect(page.getByPlaceholder(OB.description)).toHaveValue(PROFILE_DESCRIPTION);
    await expect(page.getByPlaceholder(OB.uvp)).toHaveValue(PROFILE_UVP);
  });
});
