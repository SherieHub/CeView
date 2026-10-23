import type { Page } from '@playwright/test';
import { api } from '../support/api';
import { enquiryPath, listEnquiries, submitEnquiry } from '../support/builders';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator, type Operator } from '../support/operator';
import { openDashboard } from '../support/dashboard';

// "Traveller enquiries" — requests that arrive from the operator's tracked ad links. The public
// enquiry endpoints are rate limited per address, so every submission here goes through
// support/builders.submitEnquiry, which reserves from a budget shared by all workers.
test.describe.configure({ mode: 'serial' });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const inbox = (page: Page) => page.getByRole('region', { name: 'Traveller enquiries' });

/** One new click → one enquiry (each click can carry only one). */
async function receiveEnquiry(op: Operator, fields: Parameters<typeof submitEnquiry>[1] = {}) {
  const { clickId } = await enquiryPath(op.window!);
  const res = await submitEnquiry(clickId, fields);
  expect(res.status).toBe(200);
}

test.describe('An empty inbox', () => {
  test('says there are no enquiries yet', async ({ page }) => {
    const op = await provisionOperator('inbox-empty', { demandWindow: true });
    await openDashboard(page, op);
    await expect(inbox(page).getByRole('heading', { name: 'Traveller enquiries' })).toBeVisible();
    await expect(inbox(page).getByText('Requests from your ads.')).toBeVisible();
    await expect(inbox(page).getByText('No traveller enquiries yet.')).toBeVisible();
    await expect(inbox(page).getByRole('navigation', { name: 'Enquiry pages' })).toHaveCount(0);
  });
});

test.describe('Received enquiries', () => {
  test('show the traveller\'s name, contact, guests, dates and message', async ({ page }) => {
    const op = await provisionOperator('inbox-fields', { demandWindow: true });
    await receiveEnquiry(op, {
      contactName: 'Mina Park', contactValue: 'mina@example.com', partySize: 4,
      requestedStart: '2026-12-10', requestedEnd: '2026-12-14', message: 'Two rooms, sea view.',
    });
    await openDashboard(page, op);
    const card = inbox(page).locator('li').first();
    await expect(card.getByRole('heading', { name: 'Mina Park' })).toBeVisible();
    await expect(card).toContainText('Contact: mina@example.com');
    await expect(card).toContainText('Guests: 4');
    await expect(card).toContainText('Start date: 2026-12-10');
    await expect(card).toContainText('End date: 2026-12-14');
    await expect(card).toContainText('Message: Two rooms, sea view.');
    await expect(card.locator('time')).toHaveAttribute('datetime', /^\d{4}-\d{2}-\d{2}T/);
    await expect(inbox(page).getByText('Showing 1-1 of 1 enquiries')).toBeVisible();
  });

  test('leave out the optional lines the traveller did not fill in', async ({ page }) => {
    const op = await provisionOperator('inbox-minimal', { demandWindow: true });
    await receiveEnquiry(op, { contactName: 'Only Name', contactValue: '@only_name' });
    await openDashboard(page, op);
    const card = inbox(page).locator('li').first();
    await expect(card).toContainText('Contact: @only_name');
    for (const label of ['Guests:', 'Start date:', 'End date:', 'Message:']) {
      await expect(card).not.toContainText(label);
    }
  });

  test('are listed newest first', async ({ page }) => {
    const op = await provisionOperator('inbox-order', { demandWindow: true });
    await receiveEnquiry(op, { contactName: 'First In', contactValue: 'first@example.com' });
    await new Promise((r) => setTimeout(r, 1100));
    await receiveEnquiry(op, { contactName: 'Second In', contactValue: 'second@example.com' });
    await openDashboard(page, op);
    await expect(inbox(page).locator('li h3')).toHaveText(['Second In', 'First In']);
  });

  test('can be searched by name or contact, case-insensitively', async ({ page }) => {
    const op = await provisionOperator('inbox-search', { demandWindow: true });
    await receiveEnquiry(op, { contactName: 'Anna Schmidt', contactValue: 'anna@example.de' });
    await receiveEnquiry(op, { contactName: 'Kenji Mori', contactValue: '@kenji_travels' });
    await openDashboard(page, op);
    const search = inbox(page).getByLabel('Search enquiries');
    await expect(inbox(page).locator('li')).toHaveCount(2);

    await search.fill('ANNA');
    await expect(inbox(page).locator('li h3')).toHaveText(['Anna Schmidt']);
    await expect(inbox(page).getByText('Showing 1-1 of 1 enquiries')).toBeVisible();

    await search.fill('kenji_travels');
    await expect(inbox(page).locator('li h3')).toHaveText(['Kenji Mori']);

    await search.fill('nobody at all');
    await expect(inbox(page).getByText('No enquiries match your search.')).toBeVisible();
    await expect(inbox(page).locator('li')).toHaveCount(0);

    await search.fill('');
    await expect(inbox(page).locator('li')).toHaveCount(2);
  });

  test('are paged six at a time, and searching returns to page one', async ({ page }) => {
    const op = await provisionOperator('inbox-paging', { demandWindow: true });
    for (let i = 1; i <= 7; i++) {
      await receiveEnquiry(op, { contactName: `Traveller ${i}`, contactValue: `t${i}@example.com` });
    }
    expect(await listEnquiries(op)).toHaveLength(7);
    await openDashboard(page, op);

    const nav = inbox(page).getByRole('navigation', { name: 'Enquiry pages' });
    await expect(inbox(page).locator('li')).toHaveCount(6);
    await expect(nav.getByText('Showing 1-6 of 7 enquiries')).toBeVisible();
    await expect(nav.getByText('Page 1 of 2')).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Previous' })).toBeDisabled();
    await expect(nav.getByRole('button', { name: 'Next' })).toBeEnabled();

    await nav.getByRole('button', { name: 'Next' }).click();
    await expect(inbox(page).locator('li')).toHaveCount(1);
    await expect(nav.getByText('Showing 7-7 of 7 enquiries')).toBeVisible();
    await expect(nav.getByText('Page 2 of 2')).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(nav.getByRole('button', { name: 'Previous' })).toBeEnabled();

    await inbox(page).getByLabel('Search enquiries').fill('Traveller');
    await expect(nav.getByText('Page 1 of 2')).toBeVisible();

    await inbox(page).getByLabel('Search enquiries').fill('Traveller 3');
    await expect(nav.getByText('Page 1 of 1')).toBeVisible();
    await expect(nav.getByRole('button', { name: 'Next' })).toBeDisabled();
    await expect(nav.getByRole('button', { name: 'Previous' })).toBeDisabled();
  });

  test('arrive through the real enquiry page and appear on the operator\'s dashboard', async ({ page, browser }) => {
    const op = await provisionOperator('inbox-e2e', { demandWindow: true });
    const { path } = await enquiryPath(op.window!);
    const { reserveEnquiryCalls } = await import('../support/builders');
    await reserveEnquiryCalls(2);
    const traveller = await browser.newPage();
    await traveller.goto(path);
    await traveller.getByLabel('Your name (required)').fill('Walk Through');
    await traveller.getByLabel('Email, phone number or social handle (required)').fill('walk@example.com');
    await traveller.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(traveller.getByRole('heading', { name: 'Your enquiry has been sent' })).toBeVisible();
    await traveller.close();

    await openDashboard(page, op);
    await expect(inbox(page).locator('li h3')).toHaveText(['Walk Through']);
  });
});

test.describe('Whose enquiries', () => {
  test('one operator\'s inbox never shows another\'s', async ({ page }) => {
    const mine = await provisionOperator('inbox-iso-a', { demandWindow: true });
    const theirs = await provisionOperator('inbox-iso-b', { demandWindow: true });
    await receiveEnquiry(theirs, { contactName: 'Private Person', contactValue: 'private@example.com' });
    await openDashboard(page, mine);
    await expect(inbox(page).getByText('No traveller enquiries yet.')).toBeVisible();
    expect(await listEnquiries(mine)).toEqual([]);
    expect(await listEnquiries(theirs)).toHaveLength(1);
  });

  test('the list endpoint needs a signed-in operator and is never cached', async () => {
    expect((await api().get('/api/attribution/enquiries')).status).toBe(401);
    const op = await provisionOperator('inbox-api', { demandWindow: true });
    const res = await fetch(`${process.env.E2E_API_BASE_URL || 'http://localhost:8080'}/api/attribution/enquiries`, {
      headers: { Authorization: `Bearer ${op.token}` },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });
});

test.describe('When the inbox cannot load', () => {
  // The failure is injected in the browser: the real backend answers this endpoint reliably.
  test('shows a retry button, and retrying loads the enquiries', async ({ page }) => {
    const op = await provisionOperator('inbox-fail', { demandWindow: true });
    await receiveEnquiry(op, { contactName: 'Recovered', contactValue: 'recovered@example.com' });
    await page.route('**/api/attribution/enquiries', (route) => route.abort('failed'));
    await openDashboard(page, op);
    await expect(inbox(page).getByRole('alert')).toContainText('Enquiries could not be refreshed. Any details below may be out of date.');
    await page.unroute('**/api/attribution/enquiries');
    await inbox(page).getByRole('button', { name: 'Retry enquiries' }).click();
    await expect(inbox(page).locator('li h3')).toHaveText(['Recovered']);
    await expect(inbox(page).getByRole('alert')).toHaveCount(0);
  });
});
