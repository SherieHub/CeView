# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: social-publishing.spec.ts >> shows reconnect requirements and disabled unconfigured providers
- Location: tests/social-publishing.spec.ts:102:1

# Error details

```
Error: expect(locator).toBeDisabled() failed

Locator: getByRole('button', { name: 'Connect TikTok', exact: true })
Expected: disabled
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 10000ms
  - waiting for getByRole('button', { name: 'Connect TikTok', exact: true })

```

```yaml
- navigation "Main":
  - img "CeView"
  - button "Collapse sidebar" [expanded]
  - list:
    - listitem: Intelligence
    - listitem:
      - button "Dashboard"
    - listitem: Create
    - listitem:
      - button "Content Studio"
    - listitem:
      - button "Calendar"
    - listitem: Measure
    - listitem:
      - button "Performance"
    - listitem: Settings
    - listitem:
      - button "Business Profile"
    - listitem:
      - button "Platforms"
    - listitem:
      - button "Workspace"
  - button "Sign out"
- banner:
  - button "Notifications" [disabled]
  - button "Account menu for Sunset Cove Beach Resort": SC
- main:
  - paragraph: Settings
  - heading "Platforms" [level=1]
  - paragraph: Connect where you publish and where you advertise.
  - complementary:
    - region "Connection status":
      - heading "Connection status" [level=2]
      - paragraph: 0 of 2 platforms connected
      - link "0 of 0 Ad accounts connected":
        - /url: "#pf-ads"
        - strong: 0 of 0
        - text: Ad accounts connected
      - link "0 of 2 Platforms connected":
        - /url: "#pf-publishing"
        - strong: 0 of 2
        - text: Platforms connected
    - region "Why connect?":
      - heading "Why connect?" [level=2]
      - paragraph: Unlock the full power of CeView with your platforms and ad accounts.
      - list:
        - listitem:
          - strong: Automatically pull performance data
          - text: Ad accounts bring impressions, clicks and spend into Performance.
        - listitem:
          - strong: Publish straight from Content Studio
          - text: Connected platforms are the ones Quick Post can publish to.
        - listitem:
          - strong: Decide with real numbers
          - text: See what each post and ad actually did, in one place.
  - region "Connected platforms":
    - heading "Connected platforms" [level=2]
    - paragraph: Connection state here gates which platforms Content Studio can publish to.
    - list:
      - listitem:
        - paragraph: Instagram
        - paragraph: Permissions changed — reconnect to keep publishing
        - button "Reconnect Instagram": Reconnect
      - listitem:
        - paragraph: TikTok
        - paragraph: Coming soon. Facebook and Instagram are available now.
        - text: In development
      - listitem:
        - paragraph: Facebook
        - paragraph: Permissions changed — reconnect to keep publishing
        - button "Reconnect Facebook": Reconnect
  - region "Ad accounts":
    - heading "Ad accounts" [level=2]
    - paragraph: Connect an ad account to pull impressions, clicks, and spend into Performance automatically. Revenue and bookings stay yours to enter.
    - list
  - region "Ad spending limits":
    - heading "Ad spending limits" [level=2]
    - paragraph: The most CeView may let a paid Meta ad spend, whatever is typed in the Publish window. Ads are always created paused, and nothing spends until you launch it in Ads Manager.
    - paragraph: Connect a Meta ad account above to set spending limits for paid ads.
```

# Test source

```ts
  12  |   await page.route('**/api/ad-connections', route => route.fulfill({ json: [{ provider: 'meta', status: 'ACTIVE', configured: true, currency: 'PHP' }] }));
  13  |   await page.route('**/api/attribution/links', route => route.fulfill({ json: [{ linkId: '00000000-0000-0000-0000-000000000002', targetMarket: 'japan', category: 'Travel', windowStart: '2026-10-20T00:00:00Z' }] }));
  14  |   await page.route('**/api/compliance/omcs-analyze', route => route.fulfill({ json: MOCK_OMCS }));
  15  |   await page.route('**/api/media/uploads', route => route.fulfill({ json: { mediaId: '00000000-0000-0000-0000-000000000001', uploadUrl: '/api/local-upload', publicUrl: 'https://example.test/media.jpg', kind: 'image' } }));
  16  |   await page.route('**/api/local-upload', route => route.fulfill({ status: 204 }));
  17  |   await page.route('**/api/media/*/complete', route => route.fulfill({ status: 204 }));
  18  |   await page.goto('/preview/content');
  19  |   await page.getByRole('textbox', { name: 'Your caption', exact: true }).fill('A quiet morning in Cebu.');
  20  |   await page.getByRole('button', { name: 'Attach', exact: true }).click();
  21  |   const guide = page.getByRole('dialog', { name: 'Visual Guide', exact: true });
  22  |   if (await guide.isVisible()) await page.keyboard.press('Escape');
  23  |   await page.getByRole('button', { name: 'Remove media', exact: true }).click();
  24  |   const jpeg = await page.evaluate(() => { const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 16; return canvas.toDataURL('image/jpeg').split(',')[1]; });
  25  |   await page.locator('input[type=file]').first().setInputFiles({ name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') });
  26  |   await page.getByRole('button', { name: 'Validate', exact: true }).click();
  27  |   await page.getByRole('button', { name: /Run Compliance Audit/ }).click();
  28  |   await page.getByRole('button', { name: /^Publish/ }).click();
  29  |   const modal = page.getByRole('dialog', { name: 'Publish', exact: true });
  30  |   await modal.getByRole('checkbox', { name: /authorised to publish/ }).check();
  31  |   return modal;
  32  | }
  33  | 
  34  | for (const status of ['scheduled', 'failed', 'inbox'] as const) {
  35  |   test(`persists and displays ${status} result`, async ({ page }) => {
  36  |     let payload: Record<string, any> | undefined;
  37  |     const modal = await openComposer(page);
  38  |     // More-specific handler is registered after the catch-all used by this fixture.
  39  |     await page.route('**/api/posts/publish', async route => {
  40  |       payload = route.request().postDataJSON();
  41  |       await route.fulfill({ json: [{ id: `result-${status}`, date: '2026-10-20', platform: status === 'inbox' ? 'tiktok' : 'instagram',
  42  |         caption: payload!.captionsByPlatform[status === 'inbox' ? 'tiktok' : 'instagram'], status,
  43  |         deliveryStatus: status === 'inbox' ? 'SENT_TO_INBOX' : status === 'failed' ? 'FAILED' : 'PENDING',
  44  |         scheduledFor: payload!.scheduledFor, errorMessage: status === 'failed' ? 'Reconnect your account.' : null,
  45  |         metricsAvailable: false, mediaType: 'image', reach: null, likes: null, comments: null, shares: null, engagementRate: null, series: [] }] });
  46  |     });
  47  |     if (status === 'scheduled') await modal.getByRole('radio', { name: 'Schedule', exact: true }).click();
  48  |     if (status === 'inbox') await modal.getByRole('checkbox', { name: /TikTok/ }).check();
  49  |     await modal.getByRole('button', { name: /Confirm &/ }).click();
  50  |     await expect(modal).not.toBeVisible();
  51  |     expect(payload?.approved).toBe(true);
  52  |     expect(payload?.mediaId).toBe('00000000-0000-0000-0000-000000000001');
  53  |     if (status === 'scheduled') { expect(payload?.scheduledFor).toMatch(/Z$/); await expect(page.getByRole('dialog', { name: 'Scheduled for Instagram' })).toBeVisible(); }
  54  |     if (status === 'failed') await expect(page.getByRole('alert').filter({ hasText: 'Reconnect your account.' })).toBeVisible();
  55  |     if (status === 'inbox') await expect(page.getByText(/Draft sent to your TikTok inbox/)).toBeVisible();
  56  |   });
  57  | }
  58  | test('requires valid Meta ad budget and attribution link', async ({ page }) => {
  59  |   const modal = await openComposer(page);
  60  |   await modal.getByRole('checkbox', { name: /Run as Paid Ad/ }).check();
  61  |   await expect(modal.getByRole('button', { name: 'Confirm & Publish' })).toBeDisabled();
  62  |   await modal.getByLabel('Daily budget (PHP)').fill('100');
  63  |   await modal.getByLabel('Campaign tracking link').selectOption('00000000-0000-0000-0000-000000000002');
  64  |   await expect(modal.getByRole('button', { name: 'Confirm & Publish' })).toBeEnabled();
  65  |   await expect(modal.getByText(/ad remains paused/)).toBeVisible();
  66  | });
  67  | 
  68  | test('selects a Page and refreshes linked Instagram connection states', async ({ page }, testInfo) => {
  69  |   let linked = false;
  70  |   let selected = false;
  71  |   const views = () => [
  72  |     { platform: 'facebook', status: selected ? 'ACTIVE' : 'NEEDS_PAGE', configured: true, handle: selected ? 'Cebu Page' : null },
  73  |     { platform: 'instagram', status: !selected ? 'NEEDS_PAGE' : linked ? 'ACTIVE' : 'NO_LINKED_INSTAGRAM', configured: true, handle: linked ? '@cebu' : null },
  74  |     { platform: 'tiktok', status: 'DISCONNECTED', configured: false, handle: null },
  75  |   ];
  76  |   await page.route('**/api/**', route => route.fulfill({ json: [] }));
  77  |   await page.route('**/api/social-connections', route => route.fulfill({ json: views() }));
  78  |   await page.route('**/api/social-connections/meta/pages', route => route.fulfill({ json: [
  79  |     { id: 'without-ig', name: 'Cebu Page', instagramUsername: null },
  80  |     { id: 'with-ig', name: 'Cebu Instagram Page', instagramUsername: 'cebu' },
  81  |   ] }));
  82  |   await page.route('**/api/social-connections/meta/page', async route => {
  83  |     selected = true; linked = route.request().postDataJSON().pageId === 'with-ig';
  84  |     await route.fulfill({ json: views() });
  85  |   });
  86  |   await page.goto('/preview/settings/platforms');
  87  |   await page.getByRole('button', { name: 'Choose Page', exact: true }).first().click();
  88  |   const picker = page.getByRole('dialog', { name: 'Choose a Facebook Page' });
  89  |   await picker.getByRole('radio', { name: /Cebu Page No Instagram/ }).click();
  90  |   await picker.getByRole('button', { name: 'Use this Page' }).click();
  91  |   await expect(picker).not.toBeVisible();
  92  |   await expect(page.getByText(/Link an Instagram business account to your Page/)).toBeVisible();
  93  |   await page.screenshot({ path: testInfo.outputPath('no-linked-instagram.png'), fullPage: true });
  94  |   await page.getByRole('button', { name: 'Check again', exact: true }).click();
  95  |   await picker.getByRole('radio', { name: /Cebu Instagram Page/ }).click();
  96  |   await picker.getByRole('button', { name: 'Use this Page' }).click();
  97  |   await expect(picker).not.toBeVisible();
  98  |   await expect(page.getByText('@cebu', { exact: true })).toBeVisible();
  99  |   await page.screenshot({ path: testInfo.outputPath('active-connections.png'), fullPage: true });
  100 | });
  101 | 
  102 | test('shows reconnect requirements and disabled unconfigured providers', async ({ page }, testInfo) => {
  103 |   await page.route('**/api/**', route => route.fulfill({ json: [] }));
  104 |   await page.route('**/api/social-connections', route => route.fulfill({ json: [
  105 |     { platform: 'facebook', status: 'NEEDS_RECONNECT', configured: true },
  106 |     { platform: 'instagram', status: 'NEEDS_RECONNECT', configured: true },
  107 |     { platform: 'tiktok', status: 'DISCONNECTED', configured: false },
  108 |   ] }));
  109 |   await page.goto('/preview/settings/platforms');
  110 |   await expect(page.getByRole('button', { name: 'Reconnect Facebook', exact: true })).toBeEnabled();
  111 |   await expect(page.getByRole('button', { name: 'Reconnect Instagram', exact: true })).toBeEnabled();
> 112 |   await expect(page.getByRole('button', { name: 'Connect TikTok', exact: true })).toBeDisabled();
      |                                                                                   ^ Error: expect(locator).toBeDisabled() failed
  113 |   await page.screenshot({ path: testInfo.outputPath('reconnect-required.png'), fullPage: true });
  114 | });
  115 | 
```