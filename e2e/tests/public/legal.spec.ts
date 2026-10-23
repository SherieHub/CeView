import { test, expect } from '../support/fixtures';

// /terms and /privacy — public, readable signed in or out. No backend needed.
const PAGES = [
  { path: '/terms', title: 'Terms of Use', other: 'Privacy Notice', otherPath: '/privacy' },
  { path: '/privacy', title: 'Privacy Notice', other: 'Terms of Use', otherPath: '/terms' },
] as const;

for (const p of PAGES) {
  test.describe(p.path, () => {
    test('renders its title, effective date, summary and numbered sections', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByRole('heading', { level: 1, name: p.title })).toBeVisible();
      await expect(page.getByText(/^Effective /)).toBeVisible();
      await expect(page.getByRole('heading', { name: 'At a glance' })).toBeVisible();
      await expect(page).toHaveTitle(`${p.title} — CeView`);
      const toc = page.getByRole('complementary', { name: 'On this page' }).getByRole('link');
      const count = await toc.count();
      expect(count).toBeGreaterThan(3);
      // Every table-of-contents entry points at a section that exists.
      for (let i = 0; i < count; i++) {
        const href = (await toc.nth(i).getAttribute('href'))!;
        await expect(page.locator(href)).toBeAttached();
      }
    });

    test('marks itself current in the document switcher and links to the other one', async ({ page }) => {
      await page.goto(p.path);
      const switcher = page.getByRole('navigation', { name: 'Legal documents' });
      await expect(switcher.getByRole('link', { name: p.title })).toHaveAttribute('aria-current', 'page');
      await expect(switcher.getByRole('link', { name: p.other })).not.toHaveAttribute('aria-current', 'page');
      await switcher.getByRole('link', { name: p.other }).click();
      await expect(page).toHaveURL(new RegExp(`${p.otherPath}$`));
    });

    test('a table-of-contents link jumps to its section', async ({ page }) => {
      await page.goto(p.path);
      const toc = page.getByRole('complementary', { name: 'On this page' }).getByRole('link');
      const last = toc.last();
      const href = (await last.getAttribute('href'))!;
      await last.click();
      await expect(page).toHaveURL(new RegExp(`${href}$`));
      await expect(page.locator(href)).toBeInViewport();
    });

    test('shows the contact card and a card linking to the other document', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.getByText('Questions or requests?')).toBeVisible();
      await expect(page.getByRole('link', { name: new RegExp(`Read our ${p.other}`) })).toHaveAttribute('href', p.otherPath);
    });

    test('"Back to CeView" returns to the landing page', async ({ page }) => {
      await page.goto(p.path);
      await page.getByRole('link', { name: /Back to CeView/ }).click();
      await expect(page).toHaveURL(/\/$/);
      await expect(page.getByRole('heading', { level: 1, name: /See traveler demand/ })).toBeVisible();
    });

    test('"Print or save as PDF" calls the browser print', async ({ page }) => {
      await page.addInitScript(() => {
        (window as any).__printed = 0;
        window.print = () => {
          (window as any).__printed += 1;
        };
      });
      await page.goto(p.path);
      await page.getByRole('button', { name: /Print or save as PDF/ }).click();
      expect(await page.evaluate(() => (window as any).__printed)).toBe(1);
    });

    test('is readable while signed in', async ({ page, freshOperator }) => {
      await page.goto('/privacy');
      await page.evaluate(
        (s) => localStorage.setItem('ceview.auth', JSON.stringify(s)),
        { accessToken: freshOperator.token, profileCompleted: true, emailVerified: true, email: freshOperator.email },
      );
      await page.goto(p.path);
      await expect(page).toHaveURL(new RegExp(`${p.path}$`));
      await expect(page.getByRole('heading', { level: 1, name: p.title })).toBeVisible();
    });

    test('the footer is present with the same legal links', async ({ page }) => {
      await page.goto(p.path);
      await expect(page.locator('footer').getByRole('link', { name: 'Terms of Use' })).toBeVisible();
      await expect(page.locator('footer').getByRole('link', { name: 'Privacy Notice' })).toBeVisible();
    });
  });
}
