import type { Page } from '@playwright/test';
import { api } from '../support/api';
import { codesOf, recordClick, redemptionsOf } from '../support/builders';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect } from '../support/fixtures';
import { provisionOperator } from '../support/operator';
import { daysFromNow, seedDemandWindow } from '../support/demandWindow';
import { openDashboard } from '../support/dashboard';

// "Took a booking?" — the dashboard's quick log for a customer who quoted an attribution code.
test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const section = (page: Page) => page.getByRole('region', { name: 'Log a booking' });
const form = (page: Page) => page.getByRole('form', { name: 'Log a booking' });
const open = (page: Page) => section(page).getByRole('button', { name: 'Log a booking' });
const save = (page: Page) => form(page).getByRole('button', { name: /Save booking|Saving…/ });

/** `YYYY-MM-DDTHH:mm` in the browser's local zone, as <input type=datetime-local> wants. */
function localInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

async function startLogging(page: Page, op: Awaited<ReturnType<typeof provisionOperator>>) {
  await openDashboard(page, op);
  await expect(section(page)).toBeVisible();
  await open(page).click();
  await expect(form(page)).toBeVisible();
}

test.describe('The quick-log card', () => {
  test('names the live code the customer should quote', async ({ page }) => {
    const op = await provisionOperator('ql-card', { demandWindow: true });
    await openDashboard(page, op);
    await expect(section(page).getByRole('heading', { name: 'Took a booking?' })).toBeVisible();
    await expect(section(page)).toContainText('Log it as soon as a customer quotes');
    await expect(section(page).locator('span.font-mono')).toHaveText(op.window!.code);
  });

  test('lists several codes with commas and "or"', async ({ page }) => {
    const op = await provisionOperator('ql-many', { categories: ['Coastal & Island', 'Adventure & Nature', 'Urban & City'] });
    const a = await seedDemandWindow(op, { category: 'Coastal & Island', market: 'korea' });
    const b = await seedDemandWindow(op, { category: 'Adventure & Nature', market: 'japan' });
    const c = await seedDemandWindow(op, { category: 'Urban & City', market: 'usa' });
    await openDashboard(page, op);
    const text = (await section(page).locator('p.body-sm').innerText()).replace(/\s+/g, ' ');
    expect(text).toMatch(/quotes .+, .+ or .+\./);
    for (const w of [a, b, c]) expect(text).toContain(w.code);
  });

  test('an upcoming code is offered too', async ({ page }) => {
    const op = await provisionOperator('ql-upcoming');
    const w = await seedDemandWindow(op, { windowStart: daysFromNow(5) });
    await openDashboard(page, op);
    await expect(section(page)).toContainText(w.code);
  });

  test('when every code has ended the card is not shown at all', async ({ page }) => {
    const op = await provisionOperator('ql-ended');
    await seedDemandWindow(op, { windowStart: daysFromNow(-30) });
    await openDashboard(page, op);
    await expect(section(page)).toHaveCount(0);
  });

  test('without any code the card is not shown', async ({ page }) => {
    const op = await provisionOperator('ql-none');
    await openDashboard(page, op);
    await expect(section(page)).toHaveCount(0);
  });
});

test.describe('Logging a booking', () => {
  test('opens a form with the code, bookings, revenue and time, and Cancel closes it', async ({ page }) => {
    const op = await provisionOperator('ql-form', { demandWindow: true });
    await startLogging(page, op);
    await expect(form(page).getByLabel('Code the customer quoted')).toContainText(op.window!.code);
    await expect(form(page).getByLabel('Bookings')).toHaveValue('1');
    await expect(form(page).getByLabel('Revenue (₱)')).toHaveValue('');
    await expect(form(page).getByLabel('Revenue (₱)')).toHaveAttribute('placeholder', 'Optional');
    await expect(form(page).getByLabel('When')).not.toHaveValue('');
    await expect(open(page)).toHaveCount(0);
    await form(page).getByRole('button', { name: 'Cancel' }).click();
    await expect(form(page)).toHaveCount(0);
    await expect(open(page)).toBeVisible();
  });

  test('saves the booking, confirms it, links to the evidence and records it for the code', async ({ page }) => {
    const op = await provisionOperator('ql-save', { demandWindow: true });
    await startLogging(page, op);
    await form(page).getByLabel('Bookings').fill('3');
    await form(page).getByLabel('Revenue (₱)').fill('4500.50');
    await save(page).click();
    await expect(section(page).getByRole('status')).toContainText(`Logged 3 bookings for ${op.window!.code}.`);
    await expect(form(page)).toHaveCount(0);
    await section(page).getByRole('link', { name: 'See campaign evidence' }).click();
    await expect(page).toHaveURL(/\/performance$/);

    const [summary] = await codesOf(op);
    expect(summary.totalBookings).toBe(3);
    expect(summary.totalRevenue).toBeCloseTo(4500.5);
    expect(summary.byKind.find((k) => k.kind === 'CODE_LOGGED')?.bookings).toBe(3);
    const rows = await redemptionsOf(op);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ bookings: 3, kind: 'CODE_LOGGED' });
  });

  test('one booking reads "1 booking" and revenue is optional', async ({ page }) => {
    const op = await provisionOperator('ql-one', { demandWindow: true });
    await startLogging(page, op);
    await save(page).click();
    await expect(section(page).getByRole('status')).toContainText(`Logged 1 booking for ${op.window!.code}.`);
    expect((await redemptionsOf(op))[0].revenue).toBe(0);
  });

  test('opening the form again clears the previous confirmation', async ({ page }) => {
    const op = await provisionOperator('ql-again', { demandWindow: true });
    await startLogging(page, op);
    await save(page).click();
    await expect(section(page).getByRole('status')).toBeVisible();
    await open(page).click();
    await expect(section(page).getByRole('status')).toHaveCount(0);
  });

  for (const [label, bookings, message] of [
    ['zero bookings', '0', 'Bookings must be a whole number from 1 to 500.'],
    ['501 bookings', '501', 'Bookings must be a whole number from 1 to 500.'],
    ['a fractional number of bookings', '2.5', 'Bookings must be a whole number from 1 to 500.'],
  ] as const) {
    test(`${label} is refused`, async ({ page }) => {
      const op = await provisionOperator('ql-val', { demandWindow: true });
      await startLogging(page, op);
      await form(page).getByLabel('Bookings').fill(bookings);
      await save(page).click();
      await expect(form(page).getByRole('alert')).toHaveText(message);
      expect(await redemptionsOf(op)).toHaveLength(0);
    });
  }

  test('negative revenue is refused', async ({ page }) => {
    const op = await provisionOperator('ql-neg', { demandWindow: true });
    await startLogging(page, op);
    await form(page).getByLabel('Revenue (₱)').fill('-5');
    await save(page).click();
    await expect(form(page).getByRole('alert')).toHaveText('Revenue must be zero or more.');
  });

  test('a time in the future is refused', async ({ page }) => {
    const op = await provisionOperator('ql-future', { demandWindow: true });
    await startLogging(page, op);
    await form(page).getByLabel('When').fill(localInput(new Date(Date.now() + 60 * 60 * 1000)));
    await save(page).click();
    await expect(form(page).getByRole('alert')).toHaveText('The booking time cannot be in the future.');
  });

  test('a cleared time is refused', async ({ page }) => {
    const op = await provisionOperator('ql-notime', { demandWindow: true });
    await startLogging(page, op);
    await form(page).getByLabel('When').fill('');
    await save(page).click();
    await expect(form(page).getByRole('alert')).toHaveText('Enter when the booking was made.');
  });

  test('the server also refuses a future time and an unknown code', async () => {
    const op = await provisionOperator('ql-api', { demandWindow: true });
    const client = api(op.token);
    const future = new Date(Date.now() + 3600_000).toISOString();
    expect((await client.post('/api/attribution/redemptions', { attributionCodeId: op.window!.attributionCodeId, eventAt: future })).status).toBe(400);
    expect((await client.post('/api/attribution/redemptions', { attributionCodeId: '00000000-0000-0000-0000-000000000001' })).status).toBe(404);
    expect((await client.post('/api/attribution/redemptions', {})).status).toBe(400);
  });
});

test.describe('Attaching the booking to an ad click', () => {
  test('lists unconverted clicks on the code\'s link and attaches the chosen one', async ({ page }) => {
    const op = await provisionOperator('ql-click', { demandWindow: true });
    const click = await recordClick(op.window!.slug);
    expect(click.clickId).not.toBeNull();
    await startLogging(page, op);
    // The click happened a moment after the form's default time, so say the booking was a bit later.
    await form(page).getByLabel('When').fill(localInput(new Date(Date.now() + 2 * 60 * 1000)));
    const group = form(page).getByRole('group', { name: 'Was this from an ad click? (optional)' });
    await expect(group.getByRole('radio', { name: 'None of these' })).toBeChecked();
    const candidate = group.getByRole('radio').nth(1);
    await expect(candidate).toBeVisible();
    await expect(group).toContainText(/Ad 120210000000003/);
    await expect(group).toContainText(/meta/i);
    await candidate.check();
    await save(page).click();
    await expect(section(page).getByRole('status')).toContainText('Logged 1 booking');

    const [summary] = await codesOf(op);
    expect(summary.byKind.find((k) => k.kind === 'CLICK_MATCHED')?.bookings).toBe(1);
    expect((await redemptionsOf(op))[0].kind).toBe('CLICK_MATCHED');
  });

  test('says so when there are no unconverted clicks in the period', async ({ page }) => {
    const op = await provisionOperator('ql-noclick', { demandWindow: true });
    await startLogging(page, op);
    await expect(form(page)).toContainText('No unconverted clicks found for this time period.');
  });

  test('the same click cannot be attached twice', async () => {
    const op = await provisionOperator('ql-twice', { demandWindow: true });
    const { clickId } = await recordClick(op.window!.slug);
    const client = api(op.token);
    expect((await client.post('/api/attribution/redemptions', { clickId })).status).toBe(201);
    const again = await client.post('/api/attribution/redemptions', { clickId });
    expect(again.status).toBe(409);
  });

  test('another operator cannot attach a click that is not theirs', async () => {
    const mine = await provisionOperator('ql-mine', { demandWindow: true });
    const theirs = await provisionOperator('ql-theirs', { demandWindow: true });
    const { clickId } = await recordClick(mine.window!.slug);
    expect((await api(theirs.token).post('/api/attribution/redemptions', { clickId })).status).toBe(404);
  });
});
