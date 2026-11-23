import { expect, type Page } from '@playwright/test';
import { PROFILE_ANSWERS } from './operator';

/** Placeholders / labels of the onboarding wizard (components/module-1/onboarding). */
export const OB = {
  businessName: 'e.g. Sunset Cove Beach Resort',
  slogan: 'One line that captures what you offer',
  service: 'Type a service and press Enter…',
};

/** Step 3's structured questions, by the label each field carries. */
export const SI = {
  storyBusinessType: 'Business type',
  storyLocation: 'Location',
  storyExperience: 'What can guests actually experience during a visit?',
  storyFacilities: 'What facilities, resources, or notable features do you have?',
  uvpDistinguisher: '1. What distinguishes your business from similar businesses?',
  uvpSupportingFact: '2. What specific feature or fact supports that difference?',
  uvpGuestBenefit: '3. How does this benefit your guests?',
} as const;

export type StructuredAnswers = typeof PROFILE_ANSWERS;

/** The Business Story template filled with PROFILE_ANSWERS for the default business name. */
export const expectedStory = (servicesPhrase: string) =>
  `E2E Reef Expeditions is a family-run dive shop located in Panagsama Beach, Moalboal. We offer ${servicesPhrase}, ` +
  'where guests can dive the house reef with local instructors who plan every trip around the tides and currents. ' +
  'Our facilities and services include small-group boats, open water courses, and a shore entry onto the house reef.';

/** The UVP template filled with PROFILE_ANSWERS. */
export const EXPECTED_UVP =
  'We cap every boat at four divers. Each group is paired with a marine biologist guide. ' +
  'Guests learn to read the reef and leave with their own logged species list.';

export const storyParagraph = (page: Page) => page.getByRole('textbox', { name: 'Generated Business Story' });
export const uvpParagraph = (page: Page) => page.getByRole('textbox', { name: 'Combined UVP' });

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

export async function fillStructuredInputs(page: Page, answers: Partial<StructuredAnswers> = {}) {
  const all = { ...PROFILE_ANSWERS, ...answers };
  for (const key of Object.keys(SI) as (keyof typeof SI)[]) {
    await page.getByLabel(SI[key], { exact: true }).fill(all[key]);
  }
}

/** Clicks Continue through steps 1–4 with valid answers, stopping on step 5 (Analysis). */
export async function reachAnalysis(
  page: Page,
  v: { name?: string; industry?: string; vibes?: string[]; services?: string[]; answers?: Partial<StructuredAnswers> } = {},
) {
  await fillBasicInfo(page, v);
  await next(page).click();
  await fillBrandIdentity(page, v);
  await next(page).click();
  await fillStructuredInputs(page, v.answers);
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
