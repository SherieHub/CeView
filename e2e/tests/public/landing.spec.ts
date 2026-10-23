import type { Page } from '@playwright/test';
import { test, expect } from '../support/fixtures';
import { expectNoHorizontalOverflow } from '../support/ui';

// "/" — the public marketing page. No backend needed.
const SECTIONS = [
  { link: 'Why CeView', id: 'why' },
  { link: 'How It Works', id: 'how-it-works' },
  { link: 'Features', id: 'features' },
  { link: 'Who It’s For', id: 'who' },
  { link: 'Pricing', id: 'pricing' },
  { link: 'FAQ', id: 'faq' },
] as const;

const headerNav = (page: Page) => page.getByRole('navigation', { name: 'Page sections' }).first();

test.describe('Landing page', () => {
  test('shows the headline, the eyebrow and the two calls to action', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'See traveler demand before the opportunity passes.' }),
    ).toBeVisible();
    await expect(page.getByText('Tourism demand intelligence for Cebu businesses')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Request a Demo' }).first()).toHaveAttribute('href', '#demo');
    // No walkthrough video is configured, so the secondary CTA is the in-page product tour.
    await expect(page.getByRole('link', { name: 'Take the Product Tour' }).first()).toHaveAttribute('href', '#product');
  });

  test('the Sign In link opens the login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Sign In', exact: true }).first().click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('the header lists the six sections and each one exists on the page', async ({ page }) => {
    await page.goto('/');
    const links = headerNav(page).getByRole('link');
    await expect(links).toHaveText(SECTIONS.map((s) => s.link));
    for (const s of SECTIONS) {
      await expect(page.locator(`#${s.id}`), `#${s.id}`).toBeAttached();
    }
  });

  for (const s of SECTIONS) {
    test(`"${s.link}" scrolls to its section`, async ({ page }) => {
      await page.goto('/');
      await headerNav(page).getByRole('link', { name: s.link, exact: true }).click();
      await expect(page).toHaveURL(new RegExp(`#${s.id}$`));
      await expect(page.locator(`#${s.id}`)).toBeInViewport();
    });
  }

  test('the header gains its scrolled style after scrolling', async ({ page }) => {
    await page.goto('/');
    const header = page.locator('header.cv-header');
    await expect(header).not.toHaveAttribute('data-scrolled', /.*/);
    await page.evaluate(() => window.scrollTo(0, 600));
    await expect(header).toHaveAttribute('data-scrolled', 'true');
  });

  test('the market strip names every tracked market', async ({ page }) => {
    await page.goto('/');
    for (const name of ['Cebu & nearby provinces', 'Other Philippine regions', 'South Korea', 'Japan', 'United States']) {
      await expect(page.getByText(name, { exact: true }).first()).toBeAttached();
    }
  });

  test('every dashboard sample on the page is labelled as sample data', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('Sample data').first()).toBeAttached();
    await expect(page.getByText('Real CeView screen · sample data').first()).toBeAttached();
  });

  test('a signed-in visitor is sent to the dashboard instead', async ({ page, freshOperator }) => {
    await page.goto('/terms');
    await page.evaluate(
      (s) => localStorage.setItem('ceview.auth', JSON.stringify(s)),
      { accessToken: freshOperator.token, profileCompleted: true, emailVerified: true, email: freshOperator.email },
    );
    await page.goto('/');
    await expect(page).not.toHaveURL(/^[^#]*\/$/);
    await expect(page).toHaveURL(/\/(dashboard|onboarding)$/);
  });
});

test.describe('Landing page — FAQ', () => {
  test('the first question starts open and the others closed', async ({ page }) => {
    await page.goto('/');
    const questions = page.locator('#faq button[aria-expanded]');
    expect(await questions.count()).toBeGreaterThan(3);
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.nth(1)).toHaveAttribute('aria-expanded', 'false');
  });

  test('opening a question closes the previous one; clicking it again closes it', async ({ page }) => {
    await page.goto('/');
    const questions = page.locator('#faq button[aria-expanded]');
    await questions.nth(2).scrollIntoViewIfNeeded();
    await questions.nth(2).click();
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'true');
    await expect(questions.first()).toHaveAttribute('aria-expanded', 'false');
    const answerId = await questions.nth(2).getAttribute('aria-controls');
    await expect(page.locator(`#${answerId}`)).toBeVisible();
    await questions.nth(2).click();
    await expect(questions.nth(2)).toHaveAttribute('aria-expanded', 'false');
  });

  test('a closed answer is not reachable (inert)', async ({ page }) => {
    await page.goto('/');
    const closed = page.locator('#faq button[aria-expanded="false"]').first();
    const answerId = await closed.getAttribute('aria-controls');
    await expect(page.locator(`#${answerId}`)).toHaveAttribute('inert', '');
  });
});

test.describe('Landing page — pricing', () => {
  const plan = (page: Page, name: string) => page.locator('.cv-price-card', { has: page.getByRole('heading', { name, exact: true }) });

  test('monthly billing is the default and shows the four plans', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('radio', { name: 'Monthly' })).toBeChecked();
    await expect(page.locator('.cv-price-name')).toHaveText(['Starter', 'Insights', 'Growth', 'Scale']);
    await expect(plan(page, 'Starter')).toContainText('₱0');
    await expect(plan(page, 'Insights')).toContainText('₱499');
    await expect(plan(page, 'Growth')).toContainText('₱999');
    await expect(plan(page, 'Scale')).toContainText('From');
    await expect(plan(page, 'Growth')).toContainText('Recommended');
  });

  test('switching to annual billing changes the prices and the periods', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: /Annually/ }).check();
    await expect(plan(page, 'Insights')).toContainText('₱4,990');
    await expect(plan(page, 'Insights')).toContainText('/year');
    await expect(plan(page, 'Growth')).toContainText('₱9,990');
    await page.getByRole('radio', { name: 'Monthly' }).check();
    await expect(plan(page, 'Insights')).toContainText('₱499');
    await expect(plan(page, 'Insights')).toContainText('/month');
  });

  test('a plan button pre-selects that plan in the demo form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Choose Insights: Insights plan' }).click();
    await expect(page).toHaveURL(/#demo\?plan=insights$/);
    await expect(page.locator('.cv-form-plan')).toContainText('Insights');
  });

  test('the partner plan button pre-fills the help field', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Ask about the Partner Plan/ }).click();
    await expect(page).toHaveURL(/#demo\?plan=partner$/);
    await expect(page.getByLabel(/What would you most like help with/)).toHaveValue('The Partner Plan');
  });
});

test.describe('Landing page — product tour', () => {
  const tabs = ['Demand Intelligence', 'Content Studio', 'Content Review', 'Performance'];

  test('shows four tabs with the first selected, and switching changes the panel', async ({ page }) => {
    await page.goto('/');
    for (const name of tabs) await expect(page.getByRole('tab', { name })).toBeVisible();
    await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'true');
    await page.getByRole('tab', { name: 'Content Review' }).click();
    await expect(page.getByRole('tab', { name: 'Content Review' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'false');
    await expect(page.getByText('Review score 84 · passes the mark of 70')).toBeVisible();
  });

  test('arrow keys, Home and End move between tabs, wrapping around', async ({ page }) => {
    await page.goto('/');
    const first = page.getByRole('tab', { name: tabs[0] });
    await first.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: tabs[1] })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('End');
    await expect(page.getByRole('tab', { name: tabs[3] })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('tab', { name: tabs[3] })).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Home');
    await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'true');
  });
});

test.describe('Landing page — footer', () => {
  test('links to the legal pages and back to sign in', async ({ page }) => {
    await page.goto('/');
    const footer = page.locator('footer');
    await footer.getByRole('link', { name: 'Terms of Use' }).click();
    await expect(page).toHaveURL(/\/terms$/);
    await page.goBack();
    await footer.getByRole('link', { name: 'Privacy Notice' }).click();
    await expect(page).toHaveURL(/\/privacy$/);
  });

  test('the photo credits dialog opens and closes', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Photo credits' }).click();
    const dialog = page.getByRole('dialog', { name: 'Photo credits' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('Every photo on this page is a real photograph');
    await page.getByRole('button', { name: 'Close photo credits' }).click();
    await expect(dialog).toBeHidden();
  });

  test('the copyright line is shown', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('© 2026 CeView. All rights reserved.')).toBeVisible();
  });
});

test.describe('Landing page — phone', () => {
  const open = (page: Page) => page.getByRole('button', { name: 'Open menu' });
  const sheet = (page: Page) => page.getByRole('dialog', { name: 'Menu' });

  test('@mobile the header shows a menu button instead of the links', async ({ page }) => {
    await page.goto('/');
    await expect(open(page)).toBeVisible();
    await expect(open(page)).toHaveAttribute('aria-expanded', 'false');
    await expect(headerNav(page)).toBeHidden();
  });

  test('@mobile the menu sheet opens, locks scrolling and lists the sections', async ({ page }) => {
    await page.goto('/');
    await open(page).click();
    await expect(sheet(page)).toBeVisible();
    for (const s of SECTIONS) await expect(sheet(page).getByRole('link', { name: s.link })).toBeVisible();
    await expect(sheet(page).getByRole('link', { name: 'Request a Demo' })).toBeVisible();
    expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  });

  test('@mobile Escape closes the sheet, returns focus to the button and restores scrolling', async ({ page }) => {
    await page.goto('/');
    await open(page).click();
    await page.keyboard.press('Escape');
    await expect(sheet(page)).toBeHidden();
    await expect(open(page)).toBeFocused();
    expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  });

  test('@mobile the close button closes the sheet', async ({ page }) => {
    await page.goto('/');
    await open(page).click();
    await sheet(page).getByRole('button', { name: 'Close menu' }).click();
    await expect(sheet(page)).toBeHidden();
  });

  test('@mobile choosing a section closes the sheet and scrolls there', async ({ page }) => {
    await page.goto('/');
    await open(page).click();
    await sheet(page).getByRole('link', { name: 'Pricing' }).click();
    await expect(sheet(page)).toBeHidden();
    await expect(page).toHaveURL(/#pricing$/);
    await expect(page.locator('#pricing')).toBeInViewport();
  });

  test('@mobile Tab stays inside the open sheet', async ({ page }) => {
    await page.goto('/');
    await open(page).click();
    for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
    expect(await page.evaluate(() => !!document.activeElement?.closest('#cv-menu'))).toBe(true);
  });

  test('@mobile the page does not scroll sideways', async ({ page }) => {
    await page.goto('/');
    await expectNoHorizontalOverflow(page);
  });
});
