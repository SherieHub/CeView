import type { Page, Route } from '@playwright/test';
import { test, expect } from '../support/fixtures';

// The "Request your demo" form on the landing page. The :3012 build has a lead-form endpoint
// (https://leads.e2e.ceview.invalid/submit — a host that cannot resolve, so only the provider is
// stubbed); the :3013 build has none (tests tagged @alt-env).
const ENDPOINT = '**/leads.e2e.ceview.invalid/**';

async function openForm(page: Page) {
  await page.goto('/#demo');
  await expect(page.getByRole('form', { name: 'Request your demo' })).toBeVisible();
}

async function fillValid(page: Page) {
  await page.getByLabel('Full name').fill('Ana Reyes');
  await page.getByLabel('Work email').fill('ana@reefco.example');
  await page.getByLabel('Business name').fill('Reef Co');
  await page.getByLabel('Type of tourism business').selectOption('Dive shop or marine tour');
}

const submit = (page: Page) => page.getByRole('button', { name: 'Request My Demo' });

test.describe('Request your demo', () => {
  test('shows the heading, the fields and the consent line', async ({ page }) => {
    await openForm(page);
    await expect(page.getByRole('heading', { name: 'Request your demo' })).toBeVisible();
    for (const label of ['Full name', 'Work email', 'Business name', 'Type of tourism business']) {
      await expect(page.getByLabel(label)).toBeVisible();
    }
    await expect(page.getByLabel(/What would you most like help with/)).toBeVisible();
    const options = await page.getByLabel('Type of tourism business').locator('option').allInnerTexts();
    expect(options[0]).toBe('Choose the closest match…');
    expect(options).toContain('Resort, hotel or homestay');
    expect(options).toContain('Other');
  });

  test('submitting empty shows all four errors, focuses the first and announces the count', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
    await expect(page.getByText('Please enter your work email.')).toBeVisible();
    await expect(page.getByText('Please enter your business name.')).toBeVisible();
    await expect(page.getByText('Please choose the closest type of business.')).toBeVisible();
    await expect(page.getByLabel('Full name')).toBeFocused();
    await expect(page.locator('.cv-sr-live')).toHaveText('4 fields need attention.');
    await expect(page.getByLabel('Full name')).toHaveAttribute('aria-invalid', 'true');
  });

  test('a malformed email gets the format error', async ({ page }) => {
    await openForm(page);
    await fillValid(page);
    await page.getByLabel('Work email').fill('not-an-email');
    await submit(page).click();
    await expect(page.getByText('Please enter a valid email address, like name@business.com.')).toBeVisible();
    await expect(page.getByLabel('Work email')).toBeFocused();
    await expect(page.locator('.cv-sr-live')).toHaveText('1 field needs attention.');
  });

  test('whitespace-only answers count as empty', async ({ page }) => {
    await openForm(page);
    await page.getByLabel('Full name').fill('   ');
    await submit(page).click();
    await expect(page.getByText('Please enter your full name.')).toBeVisible();
  });

  test('editing a field clears just its own error', async ({ page }) => {
    await openForm(page);
    await submit(page).click();
    await page.getByLabel('Full name').fill('Ana');
    await expect(page.getByText('Please enter your full name.')).toHaveCount(0);
    await expect(page.getByText('Please enter your work email.')).toBeVisible();
  });

  test('a valid submission posts the answers as JSON and shows the thank-you state', async ({ page }) => {
    let body: Record<string, string> | null = null;
    await page.route(ENDPOINT, async (route: Route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: { ok: true } });
    });
    await openForm(page);
    await fillValid(page);
    await page.getByLabel(/What would you most like help with/).selectOption({ index: 1 });
    await submit(page).click();
    await expect(page.getByRole('heading', { name: 'Thanks — we’ll be in touch soon.' })).toBeVisible();
    await expect(page.getByText('We’ll reach out to arrange a walkthrough that fits your business.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore the FAQ' })).toHaveAttribute('href', '#faq');
    expect(body).toMatchObject({
      name: 'Ana Reyes',
      email: 'ana@reefco.example',
      business: 'Reef Co',
      businessType: 'Dive shop or marine tour',
      source: 'landing-page',
    });
    expect(body!.help).toBeTruthy();
  });

  test('the chosen plan travels with the request', async ({ page }) => {
    let body: Record<string, string> | null = null;
    await page.route(ENDPOINT, async (route) => {
      body = route.request().postDataJSON();
      await route.fulfill({ status: 200, json: {} });
    });
    await page.goto('/#demo?plan=growth');
    await fillValid(page);
    await submit(page).click();
    await expect(page.getByRole('heading', { name: 'Thanks — we’ll be in touch soon.' })).toBeVisible();
    expect(body).toMatchObject({ plan: 'growth' });
  });

  test('a provider error shows the retry notice with the contact email and keeps the answers', async ({ page }) => {
    await page.route(ENDPOINT, (route) => route.fulfill({ status: 500, json: { error: 'down' } }));
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    const notice = page.getByRole('alert');
    await expect(notice).toContainText('We couldn’t send your request just now. Please try again');
    await expect(notice.getByRole('link', { name: 'hello@ceview.local' })).toHaveAttribute('href', 'mailto:hello@ceview.local');
    await expect(page.getByLabel('Full name')).toHaveValue('Ana Reyes');
    // Editing a field clears the notice so the visitor can retry.
    await page.getByLabel('Full name').fill('Ana R');
    await expect(page.getByRole('alert')).toHaveCount(0);
  });

  test('a network failure is reported the same way', async ({ page }) => {
    await page.route(ENDPOINT, (route) => route.abort('failed'));
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    await expect(page.getByRole('alert')).toContainText('We couldn’t send your request just now.');
  });

  test('the button is busy while sending and only one request goes out', async ({ page }) => {
    let calls = 0;
    await page.route(ENDPOINT, async (route) => {
      calls += 1;
      await new Promise((r) => setTimeout(r, 1200));
      await route.fulfill({ status: 200, json: {} });
    });
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    const busy = page.getByRole('button', { name: /Sending…/ });
    await expect(busy).toBeDisabled();
    await expect(busy).toHaveAttribute('aria-busy', 'true');
    await expect(page.getByRole('heading', { name: 'Thanks — we’ll be in touch soon.' })).toBeVisible();
    expect(calls).toBe(1);
  });

  test('after success the form is replaced and the answers are cleared', async ({ page }) => {
    await page.route(ENDPOINT, (route) => route.fulfill({ status: 200, json: {} }));
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    await expect(page.getByLabel('Full name')).toHaveCount(0);
    await expect(page.getByRole('status')).toContainText('Thanks');
  });
});

test.describe('Request your demo — not configured', () => {
  test('@alt-env with no endpoint and no contact email, nothing is sent and the visitor is told', async ({ page }) => {
    let sent = false;
    page.on('request', (r) => {
      if (r.method() === 'POST') sent = true;
    });
    await openForm(page);
    await fillValid(page);
    await submit(page).click();
    await expect(page.getByRole('status')).toContainText('Online demo requests aren’t open just yet, so nothing was sent.');
    expect(sent).toBe(false);
    // The answers are kept so nothing the visitor typed is lost.
    await expect(page.getByLabel('Full name')).toHaveValue('Ana Reyes');
  });
});
