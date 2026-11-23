import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { PROFILE_ANSWERS, provisionOperator, signIn } from '../support/operator';
import {
  EXPECTED_UVP, SI, back, expectedStory, fillBasicInfo, fillBrandIdentity, fillStructuredInputs, next,
  stepCounter, storyParagraph, uvpParagraph,
} from '../support/onboarding';

// Onboarding step 3 — Structured Inputs: short answers composed into the Business Story and UVP
// template paragraphs (frontend/components/module-1/structured-profile/profileTemplates.ts).
type Page = import('@playwright/test').Page;

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

async function openStep3(page: Page) {
  const op = await provisionOperator('onb-structured', { stage: 'verified' });
  await signIn(page, op, '/onboarding');
  await fillBasicInfo(page);
  await next(page).click();
  await fillBrandIdentity(page);
  await next(page).click();
  await expect(page.getByText('Tell your story in a few short answers')).toBeVisible();
}

const field = (page: Page, key: keyof typeof SI) => page.getByLabel(SI[key], { exact: true });
const hint = (page: Page, key: keyof typeof SI) => page.getByTestId(`hint-${key}`);

test.describe('Step 3 — Structured Inputs', () => {
  test('starts with minimum hints, locked paragraphs and Continue disabled', async ({ page }) => {
    await openStep3(page);
    await expect(page.getByText('Step 3 · Required')).toBeVisible();
    await expect(stepCounter(page, 3)).toBeVisible();
    await expect(hint(page, 'storyLocation')).toHaveText('At least 3 characters');
    await expect(hint(page, 'uvpGuestBenefit')).toHaveText('At least 20 characters');
    await expect(storyParagraph(page)).toBeDisabled();
    await expect(uvpParagraph(page)).toBeDisabled();
    await expect(next(page)).toBeDisabled();
  });

  test('shows the business name and core services from steps 1–2', async ({ page }) => {
    await openStep3(page);
    await expect(page.getByTestId('story-business-name')).toHaveText('E2E Reef Expeditions');
    await expect(page.getByText('Guided reef dives', { exact: true })).toBeVisible();
  });

  test('a short answer is flagged with its character count', async ({ page }) => {
    await openStep3(page);
    await field(page, 'storyLocation').fill('Ce');
    await expect(hint(page, 'storyLocation')).toContainText('2 / 3 characters');
    await expect(hint(page, 'storyLocation')).toHaveClass(/bad/);
    await field(page, 'storyLocation').fill('Ceb');
    await expect(hint(page, 'storyLocation')).toHaveClass(/good/);
  });

  test('the minimums are exact: 19 characters fails, 20 passes', async ({ page }) => {
    await openStep3(page);
    await fillStructuredInputs(page, { storyExperience: 'x'.repeat(19) });
    await expect(next(page)).toBeDisabled();
    await field(page, 'storyExperience').fill('x'.repeat(20));
    await expect(next(page)).toBeEnabled();
  });

  test('every answer is required — a complete UVP does not cover a missing story answer', async ({ page }) => {
    await openStep3(page);
    await fillStructuredInputs(page, { storyFacilities: '' });
    await expect(uvpParagraph(page)).toHaveValue(EXPECTED_UVP);
    await expect(storyParagraph(page)).toBeDisabled();
    await expect(next(page)).toBeDisabled();
  });

  test('the answers compose both paragraphs and Continue opens step 4', async ({ page }) => {
    await openStep3(page);
    await fillStructuredInputs(page);
    await expect(storyParagraph(page)).toHaveValue(expectedStory('Guided reef dives'));
    await expect(uvpParagraph(page)).toHaveValue(EXPECTED_UVP);
    await next(page).click();
    await expect(page.getByRole('heading', { name: 'Assets and links' })).toBeVisible();
  });

  test('a hand-edited paragraph stops following the answers until Regenerate', async ({ page }) => {
    await openStep3(page);
    await fillStructuredInputs(page);
    await storyParagraph(page).fill('Our own story, in our own words.');
    await expect(page.getByText('Edited manually')).toBeVisible();

    await field(page, 'storyLocation').fill('Basdiot, Moalboal');
    await expect(storyParagraph(page)).toHaveValue('Our own story, in our own words.');

    await page.getByRole('button', { name: 'Regenerate from fields' }).click();
    await expect(storyParagraph(page)).toHaveValue(
      expectedStory('Guided reef dives').replace('Panagsama Beach, Moalboal', 'Basdiot, Moalboal'),
    );
  });

  test('Back keeps the answers and a hand-edited paragraph', async ({ page }) => {
    await openStep3(page);
    await fillStructuredInputs(page);
    await uvpParagraph(page).fill('Edited UVP.');
    await back(page).click();
    await next(page).click();
    await expect(field(page, 'storyLocation')).toHaveValue(PROFILE_ANSWERS.storyLocation);
    await expect(uvpParagraph(page)).toHaveValue('Edited UVP.');
    await expect(storyParagraph(page)).toHaveValue(expectedStory('Guided reef dives'));
  });
});
