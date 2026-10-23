import type { Page } from '@playwright/test';
import { api } from '../support/api';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, AI_WAIT } from '../support/fixtures';
import { PROFILE_DESCRIPTION, PROFILE_UVP, provisionOperator, signIn, type Operator } from '../support/operator';
import { expectInRange, expectNoJunk } from '../support/ai';
import { toast } from '../support/ui';
import { OB, back, categoryChips, finish, next, reachAnalysis, stepCounter } from '../support/onboarding';

// Onboarding step 5 — Analysis. Classification and uniqueness scoring run on the real Hugging Face
// Space (ZeroGPU, a limited daily quota), so the real-AI scenarios are kept few and share a page:
//   • one serial group → 1 classification + 2 scorings
//   • one UVP-sensitivity test → 1 classification + 2 scorings
// Everything asserted is structure and range, never wording or an exact score.
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const SPECIFIC_UVP =
  'We are the only PADI five-star centre in Moalboal with a resident marine biologist on staff, ' +
  'running dawn sardine-run dives from a private shore entry thirty metres from the reef wall, ' +
  'with every dive logged against a twelve-year record of shoal movement along this coast.';

const compute = (page: Page) => page.getByRole('button', { name: /^(Compute uniqueness score|Recompute score)$/ });
const primary = (page: Page) => page.getByTestId('score-primary');
const cohort = (page: Page) => page.getByTestId('cohort-context');

async function waitForCategories(page: Page) {
  await expect(categoryChips(page).first()).toBeVisible({ timeout: AI_WAIT });
}

async function runScore(page: Page) {
  await compute(page).click();
  await expect(primary(page).or(cohort(page)).first()).toBeVisible({ timeout: AI_WAIT });
}

test.describe('Step 5 — Analysis', () => {
  test.describe.configure({ mode: 'serial' });
  let page: Page;
  let op: Operator;
  let selected: string[] = [];

  test.beforeAll(async ({ browser }) => {
    test.setTimeout(AI_WAIT * 2);
    op = await provisionOperator('onb-analysis', { stage: 'verified' });
    page = await browser.newPage();
    await signIn(page, op, '/onboarding');
    await reachAnalysis(page);
  });

  test.afterAll(async () => {
    await page.close();
  });

  test('@ai classifies on arrival and preselects the top two categories', async () => {
    test.setTimeout(AI_WAIT * 2);
    await expect(stepCounter(page, 5)).toBeVisible();
    await expect(page.getByText('Step 5 — Required')).toBeVisible();
    // While the Space works, a progress banner and skeletons show.
    await waitForCategories(page);
    await expect(page.getByText('Inferred categories')).toBeVisible();

    const chips = categoryChips(page);
    const count = await chips.count();
    expect(count).toBeGreaterThanOrEqual(1);
    const names: string[] = [];
    const percents: number[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await chips.nth(i).innerText()).replace(/\s+/g, ' ').trim();
      const m = text.match(/^(.*?)\s*(\d+)%$/);
      expect(m, `chip "${text}" should end with a percentage`).not.toBeNull();
      names.push(m![1].trim());
      percents.push(Number(m![2]));
      expectInRange(percents[i], 0, 100, `chip ${i} percentage`);
    }
    // Shown highest-first, only categories the model found evidence for.
    expect([...percents].sort((a, b) => b - a)).toEqual(percents);
    expect(percents.every((p) => p > 0)).toBe(true);
    expect(new Set(names).size).toBe(names.length);

    // The top two (or fewer, if fewer were found) start selected.
    for (let i = 0; i < count; i++) {
      await expect(chips.nth(i)).toHaveAttribute('aria-pressed', i < 2 ? 'true' : 'false');
    }
    selected = names.slice(0, 2);
    await expect(compute(page)).toBeEnabled();
    await expect(compute(page)).toHaveText(/Compute uniqueness score/);
    // No score yet, so Finish is locked.
    await expect(finish(page)).toBeDisabled();
  });

  test('the last selected category cannot be removed', async () => {
    const chips = categoryChips(page);
    // Narrow the selection to exactly one chip (the first), then try to drop it.
    if (selected.length === 2) {
      await chips.nth(1).click();
      await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'false');
      selected = selected.slice(0, 1);
    }
    await chips.nth(0).click();
    await expect(toast(page, 'At least one category must stay selected.')).toBeVisible();
    await expect(chips.nth(0)).toHaveAttribute('aria-pressed', 'true');
    // Put the second back so the scored profile spans two categories where available.
    if ((await chips.count()) > 1) {
      await chips.nth(1).click();
      await expect(chips.nth(1)).toHaveAttribute('aria-pressed', 'true');
      selected = [await chipName(chips.nth(0)), await chipName(chips.nth(1))];
    }
  });

  test('@ai computing shows either a 0–100 score with its cohort, or the too-small-cohort notice', async () => {
    test.setTimeout(AI_WAIT * 2);
    await compute(page).click();
    await expect(page.getByRole('button', { name: /Computing/ })).toBeDisabled();
    await expect(primary(page).or(cohort(page)).first()).toBeVisible({ timeout: AI_WAIT });
    await expectNoJunk(cohort(page));
    await expect(compute(page)).toHaveText(/Recompute score/);

    if (await primary(page).isVisible()) {
      const overall = page.getByRole('img', { name: /^Overall uniqueness \d+$/ });
      const score = Number((await overall.getAttribute('aria-label'))!.match(/\d+/)![0]);
      expectInRange(score, 0, 100, 'overall uniqueness');
      await expect(overall).toHaveText(String(score));
      await expectNoJunk(primary(page));
      // The two diagnostics are exposed to assistive tech and stay in range.
      for (const name of ['Description strength', 'Category fit']) {
        const label = await page.getByRole('img', { name: new RegExp(`^${name} \\d+$`) }).getAttribute('aria-label');
        expectInRange(Number(label!.match(/\d+/)![0]), 0, 100, name);
      }
      const text = await cohort(page).innerText();
      const m = text.match(/Compared against (\d+) .+ in Cebu\. The median score in this group is (\d+)\./);
      expect(m, `cohort sentence in: ${text}`).not.toBeNull();
      expect(Number(m![1])).toBeGreaterThan(0);
      expectInRange(Number(m![2]), 0, 100, 'cohort median');
    } else {
      await expect(cohort(page)).toContainText(/Only \d+ comparable businesses? (is|are) on record, too few to rank against/);
      await expect(page.getByRole('img', { name: /^Overall uniqueness/ })).toHaveCount(0);
    }
    await expect(cohort(page)).toContainText('This score does not gate anything');
    await expect(finish(page)).toBeEnabled();
  });

  test('changing the selection after scoring discards the score and locks Finish', async () => {
    const chips = categoryChips(page);
    test.skip((await chips.count()) < 2, 'the classifier found only one category, so the selection cannot change');
    await chips.nth(1).click();
    await expect(primary(page)).toHaveCount(0);
    await expect(cohort(page)).toHaveCount(0);
    await expect(compute(page)).toHaveText(/Compute uniqueness score/);
    await expect(finish(page)).toBeDisabled();
    selected = [await chipName(chips.nth(0))];
  });

  test('@ai recomputing after a change scores again and unlocks Finish', async () => {
    test.setTimeout(AI_WAIT * 2);
    await runScore(page);
    await expect(compute(page)).toHaveText(/Recompute score/);
    await expect(finish(page)).toBeEnabled();
  });

  test('@ai Finish saves the profile with the answers, categories and score, then opens the dashboard', async () => {
    test.setTimeout(AI_WAIT * 2);
    const sufficient = await primary(page).isVisible();
    const shown = sufficient
      ? Number((await page.getByRole('img', { name: /^Overall uniqueness \d+$/ }).getAttribute('aria-label'))!.match(/\d+/)![0])
      : null;
    await finish(page).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });

    const saved = await api(op.token).getOrThrow('/api/business-profile');
    expect(saved.businessName).toBe('E2E Reef Expeditions');
    expect(saved.categories).toEqual(selected);
    expect(saved.coreServices).toEqual(['Guided reef dives']);
    expect(saved.description).toBe(PROFILE_DESCRIPTION);
    expect(saved.uvp).toBe(PROFILE_UVP);
    if (shown !== null) expect(Math.abs(saved.uniquenessScore * 100 - shown)).toBeLessThanOrEqual(0.51);
    else expect(saved.uniquenessScore).toBe(0); // no number for a too-small cohort; 0 only unlocks the app
  });
});

test.describe('Step 5 — uniqueness responds to the UVP', () => {
  test('@ai a materially more specific UVP changes the score', async ({ page }) => {
    test.setTimeout(AI_WAIT * 4);
    const op = await provisionOperator('onb-uvp', { stage: 'verified' });
    await signIn(page, op, '/onboarding');
    await reachAnalysis(page);
    await waitForCategories(page);
    await runScore(page);
    test.skip(!(await primary(page).isVisible()), 'the cohort is too small to rank, so there is no score to compare');
    const before = await page.getByRole('img', { name: /^Overall uniqueness \d+$/ }).getAttribute('aria-label');

    await back(page).click(); // Assets & Links
    await back(page).click(); // Structured Inputs
    await page.getByPlaceholder(OB.uvp).fill(SPECIFIC_UVP);
    await next(page).click();
    await next(page).click();
    await waitForCategories(page);
    await runScore(page);
    test.skip(!(await primary(page).isVisible()), 'the cohort became too small to rank');
    const after = await page.getByRole('img', { name: /^Overall uniqueness \d+$/ }).getAttribute('aria-label');
    expect(after).not.toBe(before);
  });
});

test.describe('Step 5 — too-small cohort (classification and scoring replies stubbed)', () => {
  // A cohort below the comparison floor is a valid backend answer that the real corpus cannot be
  // made to produce on demand, so only the two AI replies are stubbed; everything else is real.
  async function stubAi(page: Page) {
    await page.route('**/api/classification/analyze', (route) =>
      route.fulfill({
        json: {
          categories: [
            { name: 'Adventure & Nature', percentage: 62 },
            { name: 'Coastal & Island', percentage: 38 },
            { name: 'Urban & City', percentage: 0 },
          ],
        },
      }),
    );
    await page.route('**/api/classification/uniqueness', (route) =>
      route.fulfill({
        json: {
          overallScore: 0, semanticsScore: 0, categoryScore: 55, semanticPercentile: 0,
          cohortSize: 2, cohortMedianScore: 0, cohortCategories: ['Adventure & Nature'], categoryDensity: 'sparse',
          sufficientCohort: false, descriptionFeedback: '', categoryFeedback: '',
        },
      }),
    );
  }

  test('shows the notice instead of a number, and Finish is still allowed', async ({ page }) => {
    const op = await provisionOperator('onb-small-cohort', { stage: 'verified' });
    await stubAi(page);
    await signIn(page, op, '/onboarding');
    await reachAnalysis(page);

    // Zero-percent categories are not offered.
    await expect(categoryChips(page)).toHaveCount(2);
    await expect(finish(page)).toBeDisabled();
    await compute(page).click();
    await expect(cohort(page)).toContainText('Only 2 comparable businesses are on record, too few to rank against.');
    await expect(page.getByTestId('score-primary')).toHaveCount(0);
    await expect(page.getByRole('img', { name: /^Overall uniqueness/ })).toHaveCount(0);
    await expect(finish(page)).toBeEnabled();

    await finish(page).click();
    await expect(page).toHaveURL(/\/dashboard$/, { timeout: 60_000 });
    const saved = await api(op.token).getOrThrow('/api/business-profile');
    expect(saved.categories).toEqual(['Adventure & Nature', 'Coastal & Island']);
    // Persisted as 0 (not null) — a null score would send the operator straight back to onboarding.
    expect(saved.uniquenessScore).toBe(0);
  });

  test('an AI outage shows the dependency error panel with no fake categories', async ({ page }) => {
    const op = await provisionOperator('onb-ai-down', { stage: 'verified' });
    await page.route('**/api/classification/analyze', (route) =>
      route.fulfill({ status: 503, json: { error: 'huggingface_space is unavailable' } }),
    );
    await signIn(page, op, '/onboarding');
    await reachAnalysis(page);
    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByText('Business analysis')).toBeVisible();
    await expect(categoryChips(page)).toHaveCount(0);
    await expect(finish(page)).toBeDisabled();
  });
});

async function chipName(chip: import('@playwright/test').Locator) {
  const text = (await chip.innerText()).replace(/\s+/g, ' ').trim();
  return text.replace(/\s*\d+%$/, '').trim();
}
