import { api } from '../support/api';
import { DESKTOP_UA, enquiryPath, listEnquiries, recordClick, reserveEnquiryCalls, submitEnquiry, uniqueIp, unknownClickId } from '../support/builders';
import { requireBackend, requireTestSupport } from '../support/stack';
import { test, expect, useOperator } from '../support/fixtures';
import { daysFromNow, seedDemandWindow } from '../support/demandWindow';
import { expectNoHorizontalOverflow } from '../support/ui';

// /enquiry?cv=<click id> — the public page a traveller lands on from a tracked ad link. The
// enquiry endpoints share a hard-coded 30-requests-per-minute limit, so every call here is
// reserved against a cross-worker budget (support/builders.ts: reserveEnquiryCalls).
test.describe.configure({ mode: 'serial' });

const op = useOperator('enquiry', { demandWindow: true });

test.beforeEach(async () => {
  await requireBackend();
  await requireTestSupport();
});

const EXPIRED = 'This link has expired';
const form = (page: import('@playwright/test').Page) => page.getByRole('form', { name: 'Booking enquiry' });

test.describe('Expired or invalid links', () => {
  test('no cv parameter shows the expired page without calling the server', async ({ page }) => {
    let called = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/public/attribution/enquiries')) called = true;
    });
    await page.goto('/enquiry');
    await expect(page.getByRole('heading', { name: EXPIRED })).toBeVisible();
    await expect(page.getByText('Please contact the business directly to make an enquiry.')).toBeVisible();
    expect(called).toBe(false);
  });

  test('a malformed cv shows the expired page without calling the server', async ({ page }) => {
    let called = false;
    page.on('request', (r) => {
      if (r.url().includes('/api/public/attribution/enquiries')) called = true;
    });
    await page.goto('/enquiry?cv=not-a-uuid');
    await expect(page.getByRole('heading', { name: EXPIRED })).toBeVisible();
    expect(called).toBe(false);
  });

  test('a well-formed cv that no click carries shows the expired page', async ({ page }) => {
    await reserveEnquiryCalls(1);
    await page.goto(`/enquiry?cv=${unknownClickId()}`);
    await expect(page.getByRole('heading', { name: EXPIRED })).toBeVisible();
  });

  test('a click on a link whose window has closed shows the expired page', async ({ page }) => {
    // Window ended 20 days ago (windows last 14 days), but the click is recorded now, so it falls
    // outside the window and the traveller is refused.
    const past = await seedDemandWindow(op.current, { market: 'japan', windowStart: daysFromNow(-20) });
    const click = await recordClick(past.slug);
    test.skip(!click.clickId, 'the tracker did not record a click outside the window');
    await reserveEnquiryCalls(1);
    await page.goto(`/enquiry?cv=${click.clickId}`);
    await expect(page.getByRole('heading', { name: EXPIRED })).toBeVisible();
  });
});

test.describe('Sending an enquiry', () => {
  test('shows the business name and the form fields for a valid link', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await expect(page.getByText('PLAN YOUR VISIT')).toBeVisible();
    await expect(page.getByRole('heading', { name: `Enquire with ${op.current.businessName}` })).toBeVisible();
    await expect(page.getByText('No payment is required.')).toBeVisible();
    for (const label of [
      'Your name (required)',
      'Email, phone number or social handle (required)',
      'Number of guests (optional)',
      'Start date (optional)',
      'End date (optional)',
      'Message (optional)',
    ]) {
      await expect(form(page).getByLabel(label)).toBeVisible();
    }
    await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeEnabled();
  });

  test('name and contact are required by the browser', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    let posted = false;
    page.on('request', (r) => {
      if (r.method() === 'POST') posted = true;
    });
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByRole('heading', { name: 'Your enquiry has been sent' })).toHaveCount(0);
    expect(posted).toBe(false);
    expect(await form(page).getByLabel('Your name (required)').evaluate((el: HTMLInputElement) => el.validity.valueMissing)).toBe(true);
  });

  test('whitespace-only name and contact are refused with a message', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await form(page).getByLabel('Your name (required)').fill('   ');
    await form(page).getByLabel('Email, phone number or social handle (required)').fill('   ');
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByRole('alert')).toHaveText('Please enter your name and contact details.');
  });

  test('an end date before the start date is refused', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await form(page).getByLabel('Your name (required)').fill('Mina Park');
    await form(page).getByLabel('Email, phone number or social handle (required)').fill('mina@example.com');
    await form(page).getByLabel('Start date (optional)').fill('2026-12-20');
    await form(page).getByLabel('End date (optional)').fill('2026-12-10');
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByRole('alert')).toHaveText('The end date must be on or after the start date.');
  });

  test('the number of guests must be between 1 and 500', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    const guests = form(page).getByLabel('Number of guests (optional)');
    await expect(guests).toHaveAttribute('min', '1');
    await expect(guests).toHaveAttribute('max', '500');
    await form(page).getByLabel('Your name (required)').fill('Mina Park');
    await form(page).getByLabel('Email, phone number or social handle (required)').fill('mina@example.com');
    for (const bad of ['0', '501']) {
      await guests.fill(bad);
      await page.getByRole('button', { name: 'Send enquiry' }).click();
      expect(await guests.evaluate((el: HTMLInputElement) => el.validity.valid)).toBe(false);
      await expect(page.getByRole('heading', { name: 'Your enquiry has been sent' })).toHaveCount(0);
    }
  });

  test('a complete enquiry is sent, confirmed as "not a booking", and reaches the operator', async ({ page }) => {
    const { path, clickId } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(2);
    await page.goto(path);
    await form(page).getByLabel('Your name (required)').fill('  Mina Park  ');
    await form(page).getByLabel('Email, phone number or social handle (required)').fill('mina@example.com');
    await form(page).getByLabel('Number of guests (optional)').fill('4');
    await form(page).getByLabel('Start date (optional)').fill('2026-12-10');
    await form(page).getByLabel('End date (optional)').fill('2026-12-14');
    await form(page).getByLabel('Message (optional)').fill('Two rooms with a sea view please.');
    const sending = page.getByRole('button', { name: 'Send enquiry' });
    await sending.click();
    await expect(page.getByRole('heading', { name: 'Your enquiry has been sent' })).toBeVisible();
    await expect(page.getByText('This is an enquiry, not a confirmed booking.')).toBeVisible();
    await expect(form(page)).toHaveCount(0);

    const inbox = await listEnquiries(op.current);
    const mine = inbox.find((e) => e.contactValue === 'mina@example.com');
    expect(mine).toMatchObject({ contactName: 'Mina Park', partySize: 4, message: 'Two rooms with a sea view please.' });
    void clickId;
  });

  test('the same link cannot send a second enquiry', async ({ page }) => {
    const { path, clickId } = await enquiryPath(op.current.window!);
    const first = await submitEnquiry(clickId);
    expect(first.status).toBe(200);
    expect(first.body).toEqual({ received: true });
    const second = await submitEnquiry(clickId);
    expect(second.status).toBe(400);
    expect(second.body).toEqual({ error: 'Unable to process this enquiry.' });
    // …and the page for a used link says it has expired.
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await expect(page.getByRole('heading', { name: EXPIRED })).toBeVisible();
  });

  test('a server refusal shows the generic failure message and keeps the form', async ({ page }) => {
    const { path, clickId } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await form(page).getByLabel('Your name (required)').fill('Late Traveller');
    await form(page).getByLabel('Email, phone number or social handle (required)').fill('late@example.com');
    // Someone else uses the link first, so this submit is refused by the server.
    expect((await submitEnquiry(clickId)).status).toBe(200);
    await reserveEnquiryCalls(1);
    await page.getByRole('button', { name: 'Send enquiry' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'We could not send your enquiry. Please try again later or contact the business directly.',
    );
    await expect(form(page)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeEnabled();
  });

  test('field limits are enforced: 200 characters for name and contact, 2000 for the message', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await expect(form(page).getByLabel('Your name (required)')).toHaveAttribute('maxlength', '200');
    await expect(form(page).getByLabel('Email, phone number or social handle (required)')).toHaveAttribute('maxlength', '200');
    await expect(form(page).getByLabel('Message (optional)')).toHaveAttribute('maxlength', '2000');
  });

  test('@mobile the form fits a phone screen', async ({ page }) => {
    const { path } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(1);
    await page.goto(path);
    await expect(page.getByRole('button', { name: 'Send enquiry' })).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
});

test.describe('The public endpoints', () => {
  test('POST validation: a blank name, a missing click id and a 501-guest party are all 400', async () => {
    const { clickId } = await enquiryPath(op.current.window!);
    await reserveEnquiryCalls(3);
    const post = (body: object) => api().post('/api/public/attribution/enquiries', body);
    expect((await post({ clickId, contactName: ' ', contactValue: 'a@b.co' })).status).toBe(400);
    expect((await post({ contactName: 'A', contactValue: 'a@b.co' })).status).toBe(400);
    expect((await post({ clickId, contactName: 'A', contactValue: 'a@b.co', partySize: 501 })).status).toBe(400);
  });

  test('GET …/context for an unknown click is 400 and is never cached', async () => {
    await reserveEnquiryCalls(1);
    const res = await fetch(`${process.env.E2E_API_BASE_URL || 'http://localhost:8080'}/api/public/attribution/enquiries/context?cv=${unknownClickId()}`);
    expect(res.status).toBe(400);
    expect(res.headers.get('cache-control')).toContain('no-store');
  });

  test('a bot user agent and a repeat click from the same address are not recorded as clicks', async () => {
    const win = op.current.window!;
    const ip = uniqueIp();
    const bot = await recordClick(win.slug, { ua: 'Mozilla/5.0 (compatible; Googlebot/2.1)', ip });
    expect(bot.clickId).toBeNull();
    const first = await recordClick(win.slug, { ua: DESKTOP_UA, ip });
    expect(first.clickId).not.toBeNull();
    const repeat = await recordClick(win.slug, { ua: DESKTOP_UA, ip });
    expect(repeat.clickId).toBeNull();
    expect(repeat.status).toBe(302);
  });

  test('an unknown tracked-link slug is 404', async () => {
    const res = await recordClick('nosuchslug');
    expect(res.status).toBe(404);
  });

  // KNOWN BUG: hosted links redirect to <attribution base>/attribution/enquiry, but the app's page
  // lives at /enquiry (the deployment spec admits the former "serves nothing").
  test.fail('a hosted tracked link redirects the traveller to the /enquiry page', async () => {
    const { location } = await recordClick(op.current.window!.slug);
    expect(new URL(location!).pathname).toBe('/enquiry');
  });
});
