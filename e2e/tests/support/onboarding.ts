import { expect, type Page } from '@playwright/test';
import { PROFILE_DESCRIPTION, PROFILE_UVP } from './operator';

/** Placeholders / labels of the onboarding wizard (components/module-1/onboarding). */
export const OB = {
  businessName: 'e.g. Sunset Cove Beach Resort',
  slogan: 'One line that captures what you offer',
  service: 'Type a service and press Enter…',
  description: 'What is the property, where exactly is it, what does a guest actually experience?',
  uvp: 'What can a guest get here that they genuinely cannot get from the business next door?',
};

export const next = (page: Page) => page.getByRole('button', { name: /^Continue/ });
export const back = (page: Page) => page.getByRole('button', { name: /^Back/ });
export const finish = (page: Page) => page.getByRole('button', { name: /^Finish/ });
export const stepCounter = (page: Page, n: number) => page.getByText(`Step ${n} of 5`);

export async function fillBasicInfo(
  page: Page,
  v: { name?: string; industry?: string; slogan?: string } = {},
) {
  await page.getByPlaceholder(OB.businessName).fill(v.name ?? 'E2E Reef Expeditions');
  await page.locator('select').selectOption(v.industry ?? 'Adventure & Nature');
  if (v.slogan !== undefined) await page.getByPlaceholder(OB.slogan).fill(v.slogan);
}

export async function fillBrandIdentity(
  page: Page,
  v: { vibes?: string[]; services?: string[] } = {},
) {
  for (const vibe of v.vibes ?? ['Adventurous', 'Eco-Conscious']) {
    await page.getByRole('button', { name: vibe, exact: true }).click();
  }
  const input = page.getByPlaceholder(OB.service);
  for (const service of v.services ?? ['Guided reef dives']) {
    await input.fill(service);
    await input.press('Enter');
  }
}

export async function fillStructuredInputs(page: Page, v: { description?: string; uvp?: string } = {}) {
  await page.getByPlaceholder(OB.description).fill(v.description ?? PROFILE_DESCRIPTION);
  await page.getByPlaceholder(OB.uvp).fill(v.uvp ?? PROFILE_UVP);
}

/** Clicks Continue through steps 1–4 with valid answers, stopping on step 5 (Analysis). */
export async function reachAnalysis(
  page: Page,
  v: { name?: string; industry?: string; vibes?: string[]; services?: string[]; description?: string; uvp?: string } = {},
) {
  await fillBasicInfo(page, v);
  await next(page).click();
  await fillBrandIdentity(page, v);
  await next(page).click();
  await fillStructuredInputs(page, v);
  await next(page).click();
  await next(page).click(); // Assets & Links — every field optional
  await expect(page.getByRole('heading', { name: 'Categories and uniqueness' })).toBeVisible();
}

/** Step 5's inferred-category chips (buttons inside the "Inferred categories" card). */
export function categoryChips(page: Page) {
  return page.locator('.card', { hasText: 'Inferred categories' }).getByRole('button');
}

/**
 * Answers the two Hugging Face calls on step 5 locally so a walk through the wizard spends no
 * ZeroGPU run. Only the AI replies are stubbed; saving and routing are the real app.
 */
export async function stubAnalysisAi(page: Page) {
  await page.route('**/api/classification/analyze', (route) =>
    route.fulfill({ json: { categories: [{ name: 'Coastal & Island', percentage: 70 }, { name: 'Adventure & Nature', percentage: 30 }] } }),
  );
  await page.route('**/api/classification/uniqueness', (route) =>
    route.fulfill({
      json: {
        overallScore: 64.4, semanticsScore: 41, categoryScore: 77, semanticPercentile: 64.4, cohortSize: 18,
        cohortMedianScore: 50, cohortCategories: ['Coastal & Island'], categoryDensity: 'dense',
        sufficientCohort: true, descriptionFeedback: '', categoryFeedback: '',
      },
    }),
  );
}

/** From step 1 to the dashboard, with the AI replies stubbed (see stubAnalysisAi). */
export async function completeOnboardingStubbed(page: Page) {
  await stubAnalysisAi(page);
  await reachAnalysis(page);
  await page.getByRole('button', { name: 'Compute uniqueness score' }).click();
  await expect(page.getByTestId('score-primary')).toBeVisible();
  await finish(page).click();
  await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
}
