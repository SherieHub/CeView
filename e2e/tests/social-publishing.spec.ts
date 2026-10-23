import { test, expect, type Page } from '@playwright/test';
import { MOCK_CONTENT } from '../../frontend/services/fixtures/content';
import { MOCK_OMCS } from '../../frontend/services/fixtures/omcs';
import { MOCK_MARKETS } from '../../frontend/services/fixtures/markets';

async function openComposer(page: Page) {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/forecasting/markets?**', route => route.fulfill({ json: { markets: MOCK_MARKETS } }));
  await page.route('**/api/social-connections', route => route.fulfill({ json: ['instagram', 'facebook', 'tiktok'].map(platform => ({ platform, status: 'ACTIVE', configured: true, displayName: 'Tester' })) }));
  await page.route('**/api/content/generate', route => route.fulfill({ json: MOCK_CONTENT }));
  await page.route('**/api/content/translate', route => route.fulfill({ json: { captionEn: 'A quiet morning.', sourceLanguage: 'en' } }));
  await page.route('**/api/ad-connections', route => route.fulfill({ json: [{ provider: 'meta', status: 'ACTIVE', configured: true, currency: 'PHP' }] }));
  await page.route('**/api/attribution/links', route => route.fulfill({ json: [{ linkId: '00000000-0000-0000-0000-000000000002', targetMarket: 'japan', category: 'Travel', windowStart: '2026-10-20T00:00:00Z' }] }));
  await page.route('**/api/compliance/omcs-analyze', route => route.fulfill({ json: MOCK_OMCS }));
  await page.route('**/api/media/uploads', route => route.fulfill({ json: { mediaId: '00000000-0000-0000-0000-000000000001', uploadUrl: '/api/local-upload', publicUrl: 'https://example.test/media.jpg', kind: 'image' } }));
  await page.route('**/api/local-upload', route => route.fulfill({ status: 204 }));
  await page.route('**/api/media/*/complete', route => route.fulfill({ status: 204 }));
  await page.goto('/preview/content');
  await page.getByRole('textbox', { name: 'Your caption', exact: true }).fill('A quiet morning in Cebu.');
  await page.getByRole('button', { name: 'Attach', exact: true }).click();
  const guide = page.getByRole('dialog', { name: 'Visual Guide', exact: true });
  if (await guide.isVisible()) await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Remove media', exact: true }).click();
  const jpeg = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; return canvas.toDataURL('image/jpeg').split(',')[1]; });
  await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  await page.getByRole('button', { name: 'Validate', exact: true }).click();
  await page.getByRole('button', { name: /Run Compliance Audit/ }).click();
  await page.getByRole('button', { name: /^Publish/ }).click();
  const modal = page.getByRole('dialog', { name: 'Publish', exact: true });
  await modal.getByRole('checkbox', { name: /authorised to publish/ }).check();
  return modal;
}

for (const status of ['scheduled', 'failed', 'inbox'] as const) {
  test(`persists and displays ${status} result`, async ({ page }) => {
    let payload: Record<string, any> | undefined;
    const modal = await openComposer(page);
    // More-specific handler is registered after the catch-all used by this fixture.
    await page.route('**/api/posts/publish', async route => {
      payload = route.request().postDataJSON();
      await route.fulfill({ json: [{ id: `result-${status}`, date: '2026-10-20', platform: status === 'inbox' ? 'tiktok' : 'instagram',
        caption: payload!.captionsByPlatform[status === 'inbox' ? 'tiktok' : 'instagram'], status,
        deliveryStatus: status === 'inbox' ? 'SENT_TO_INBOX' : status === 'failed' ? 'FAILED' : 'PENDING',
        scheduledFor: payload!.scheduledFor, errorMessage: status === 'failed' ? 'Reconnect your account.' : null,
        metricsAvailable: false, mediaType: 'image', reach: null, likes: null, comments: null, shares: null, engagementRate: null, series: [] }] });
    });
    if (status === 'scheduled') await modal.getByRole('radio', { name: 'Schedule', exact: true }).click();
    if (status === 'inbox') await modal.getByRole('checkbox', { name: /TikTok/ }).check();
    await modal.getByRole('button', { name: /Confirm &/ }).click();
    await expect(modal).not.toBeVisible();
    expect(payload?.approved).toBe(true);
    expect(payload?.mediaId).toBe('00000000-0000-0000-0000-000000000001');
    if (status === 'scheduled') { expect(payload?.scheduledFor).toMatch(/Z$/); await expect(page.getByRole('dialog', { name: 'Scheduled for Instagram' })).toBeVisible(); }
    if (status === 'failed') await expect(page.getByRole('alert').filter({ hasText: 'Reconnect your account.' })).toBeVisible();
    if (status === 'inbox') await expect(page.getByText(/Draft sent to your TikTok inbox/)).toBeVisible();
  });
}
test('requires valid Meta ad budget and attribution link', async ({ page }) => {
  const modal = await openComposer(page);
  await modal.getByRole('checkbox', { name: /Run as Paid Ad/ }).check();
  await expect(modal.getByRole('button', { name: 'Confirm & Publish' })).toBeDisabled();
  await modal.getByLabel('Daily budget (PHP)').fill('100');
  await modal.getByLabel('Campaign tracking link').selectOption('00000000-0000-0000-0000-000000000002');
  await expect(modal.getByRole('button', { name: 'Confirm & Publish' })).toBeEnabled();
  await expect(modal.getByText(/ad remains paused/)).toBeVisible();
});

test('selects a Page and refreshes linked Instagram connection states', async ({ page }, testInfo) => {
  let linked = false;
  let selected = false;
  const views = () => [
    { platform: 'facebook', status: selected ? 'ACTIVE' : 'NEEDS_PAGE', configured: true, handle: selected ? 'Cebu Page' : null },
    { platform: 'instagram', status: !selected ? 'NEEDS_PAGE' : linked ? 'ACTIVE' : 'NO_LINKED_INSTAGRAM', configured: true, handle: linked ? '@cebu' : null },
    { platform: 'tiktok', status: 'DISCONNECTED', configured: false, handle: null },
  ];
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/social-connections', route => route.fulfill({ json: views() }));
  await page.route('**/api/social-connections/meta/pages', route => route.fulfill({ json: [
    { id: 'without-ig', name: 'Cebu Page', instagramUsername: null },
    { id: 'with-ig', name: 'Cebu Instagram Page', instagramUsername: 'cebu' },
  ] }));
  await page.route('**/api/social-connections/meta/page', async route => {
    selected = true; linked = route.request().postDataJSON().pageId === 'with-ig';
    await route.fulfill({ json: views() });
  });
  await page.goto('/preview/settings/platforms');
  await page.getByRole('button', { name: 'Choose Page', exact: true }).first().click();
  const picker = page.getByRole('dialog', { name: 'Choose a Facebook Page' });
  await picker.getByRole('radio', { name: /Cebu Page No Instagram/ }).click();
  await picker.getByRole('button', { name: 'Use this Page' }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.getByText(/Link an Instagram business account to your Page/)).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('no-linked-instagram.png'), fullPage: true });
  await page.getByRole('button', { name: 'Check again', exact: true }).click();
  await picker.getByRole('radio', { name: /Cebu Instagram Page/ }).click();
  await picker.getByRole('button', { name: 'Use this Page' }).click();
  await expect(picker).not.toBeVisible();
  await expect(page.getByText('@cebu', { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('active-connections.png'), fullPage: true });
});

test('shows reconnect requirements and disabled unconfigured providers', async ({ page }, testInfo) => {
  await page.route('**/api/**', route => route.fulfill({ json: [] }));
  await page.route('**/api/social-connections', route => route.fulfill({ json: [
    { platform: 'facebook', status: 'NEEDS_RECONNECT', configured: true },
    { platform: 'instagram', status: 'NEEDS_RECONNECT', configured: true },
    { platform: 'tiktok', status: 'DISCONNECTED', configured: false },
  ] }));
  await page.goto('/preview/settings/platforms');
  await expect(page.getByRole('button', { name: 'Reconnect Facebook', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Reconnect Instagram', exact: true })).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Connect TikTok', exact: true })).toBeDisabled();
  await page.screenshot({ path: testInfo.outputPath('reconnect-required.png'), fullPage: true });
});
