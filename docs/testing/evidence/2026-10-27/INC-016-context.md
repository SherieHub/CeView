# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: social-publishing.spec.ts >> requires valid Meta ad budget and attribution link
- Location: tests/social-publishing.spec.ts:58:1

# Error details

```
TimeoutError: locator.check: Timeout 15000ms exceeded.
Call log:
  - waiting for getByRole('dialog', { name: 'Publish', exact: true }).getByRole('checkbox', { name: /Run as Paid Ad/ })
    - locator resolved to <input disabled type="checkbox"/>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
    - waiting 20ms
    2 × waiting for element to be visible, enabled and stable
      - element is not enabled
    - retrying click action
      - waiting 100ms
    29 × waiting for element to be visible, enabled and stable
       - element is not enabled
     - retrying click action
       - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - navigation "Main" [ref=e4]:
    - generic [ref=e5]:
      - img "CeView" [ref=e8]
      - button "Collapse sidebar" [expanded] [ref=e9] [cursor=pointer]
    - list [ref=e14]:
      - listitem [ref=e15]: Intelligence
      - listitem [ref=e16]:
        - button "Dashboard" [ref=e17] [cursor=pointer]
      - listitem [ref=e24]: Create
      - listitem [ref=e25]:
        - button "Content Studio" [ref=e26] [cursor=pointer]
      - listitem [ref=e31]:
        - button "Calendar" [ref=e32] [cursor=pointer]
      - listitem [ref=e36]: Measure
      - listitem [ref=e37]:
        - button "Performance" [ref=e38] [cursor=pointer]
      - listitem [ref=e43]: Settings
      - listitem [ref=e44]:
        - button "Business Profile" [ref=e45] [cursor=pointer]
      - listitem [ref=e51]:
        - button "Platforms" [ref=e52] [cursor=pointer]
      - listitem [ref=e60]:
        - button "Workspace" [ref=e61] [cursor=pointer]
    - button "Sign out" [ref=e69] [cursor=pointer]
  - generic [ref=e74]:
    - banner:
      - button "Notifications" [disabled] [ref=e75]
      - button "Account menu for Sunset Cove Beach Resort" [ref=e81] [cursor=pointer]: SC
    - main [ref=e85]:
      - region "Content Studio" [ref=e86]:
        - generic [ref=e87]:
          - generic [ref=e88]:
            - heading "Content Studio" [level=1] [ref=e89]
            - paragraph [ref=e90]: Create, plan, and review content for your target markets.
          - generic [ref=e92]:
            - generic [ref=e93]: Target market
            - combobox "Target market" [ref=e95] [cursor=pointer]:
              - option "South Korea" [selected]
              - option "Japan"
              - option "United States"
        - tablist "Content Studio sections" [ref=e96]:
          - tab "Quick Post" [selected] [ref=e97] [cursor=pointer]
          - tab "Campaigns" [ref=e100] [cursor=pointer]
          - tab "Content Library 16" [ref=e103] [cursor=pointer]:
            - text: Content Library
            - generic [ref=e107]: "16"
        - tabpanel "Quick Post" [ref=e108]:
          - generic [ref=e109]:
            - generic [ref=e110]:
              - generic [ref=e111]:
                - heading "Quick Post" [level=2] [ref=e112]
                - paragraph [ref=e113]: Create a single market-ready post, from your own idea or a demand opportunity.
              - navigation "Studio progress" [ref=e114]:
                - list [ref=e115]:
                  - listitem [ref=e116]:
                    - button "Draft" [ref=e117] [cursor=pointer]:
                      - generic [ref=e118]: "1"
                  - listitem [ref=e121]:
                    - button "Attach" [ref=e122] [cursor=pointer]:
                      - generic [ref=e123]: "2"
                  - listitem [ref=e126]:
                    - button "Validate" [ref=e127] [cursor=pointer]:
                      - generic [ref=e128]: "3"
            - region [ref=e131]:
              - generic [ref=e132]:
                - generic [ref=e133]: "3"
                - generic [ref=e134]:
                  - heading "Review and publish" [level=3] [ref=e135]
                  - paragraph [ref=e136]: Check your post against the review criteria before it goes live.
              - generic [ref=e137]:
                - region [ref=e139]:
                  - generic [ref=e140]:
                    - heading "Selected media (1)" [level=4] [ref=e141]
                    - button "Manage media" [ref=e142] [cursor=pointer]
                  - generic [ref=e147]:
                    - img "Attached media" [ref=e148]
                    - button "View media full size" [ref=e149]
                  - generic [ref=e155]:
                    - heading "Caption" [level=4] [ref=e156]
                    - button "Edit" [ref=e157] [cursor=pointer]
                  - paragraph [ref=e160]: A quiet morning in Cebu.
                - region [ref=e162]:
                  - generic [ref=e163]:
                    - generic [ref=e168]:
                      - heading "Compliance audit" [level=2] [ref=e169]
                      - paragraph [ref=e170]: Checks the caption and selected media before publishing.
                    - button "Re-run audit (45s)" [disabled] [ref=e171]
                  - generic [ref=e177]:
                    - generic [ref=e178]:
                      - generic [ref=e179]:
                        - generic [ref=e181]:
                          - generic [ref=e182]: "84"
                          - generic [ref=e183]: OMCS score
                        - paragraph [ref=e184]:
                          - generic [ref=e185]: Pass
                        - paragraph [ref=e189]: "Pass threshold: 70"
                      - generic [ref=e195]:
                        - paragraph [ref=e196]: Your post meets the guidelines.
                        - paragraph [ref=e197]: The caption promises stillness and unstructured rest; the image delivers warm golden-hour light and an uncluttered frame, which supports that promise. The sardine run — the caption's strongest concrete claim — is not visible in the asset, which is the main source of drift.
                    - generic [ref=e198]:
                      - generic [ref=e200]:
                        - generic [ref=e201]: Visual ↔ business context match
                        - generic [ref=e202]: 88%
                      - generic [ref=e206]:
                        - generic [ref=e207]: Visual intent consistency
                        - generic [ref=e208]: 82%
                      - generic [ref=e212]:
                        - generic [ref=e213]: Tone ↔ visual mood alignment
                        - generic [ref=e214]: 90%
                      - generic [ref=e218]:
                        - generic [ref=e219]: Psychological strategy support
                        - generic [ref=e220]: 79%
                      - generic [ref=e224]:
                        - generic [ref=e225]: Target audience fit
                        - generic [ref=e226]: 86%
                      - generic [ref=e230]:
                        - generic [ref=e231]: Platform suitability
                        - generic [ref=e232]: 84%
                      - generic [ref=e236]:
                        - generic [ref=e237]: Attribute coverage consistency
                        - generic [ref=e238]: 75%
            - generic [ref=e241]:
              - button "Back to Attach" [ref=e242] [cursor=pointer]
              - generic [ref=e245]:
                - button "Promote as an ad" [ref=e246] [cursor=pointer]
                - button "Publish to 1 platform" [ref=e250] [cursor=pointer]
        - dialog "Publish" [ref=e254]:
          - generic [ref=e256]:
            - generic [ref=e257]:
              - img "CeView" [ref=e259]
              - heading "Publish Post" [level=2] [ref=e261]
              - button "Close" [ref=e262] [cursor=pointer]
            - generic [ref=e266]:
              - region "Publishing options" [ref=e267]:
                - generic [ref=e268]:
                  - generic [ref=e269]: "1"
                  - generic [ref=e270]:
                    - heading "Publishing Options" [level=3] [ref=e271]
                    - paragraph [ref=e272]: Choose where and how to publish this content.
                - group "Publish to" [ref=e273]:
                  - generic [ref=e275]:
                    - generic [ref=e276] [cursor=pointer]:
                      - checkbox "Instagram" [checked] [ref=e277]
                      - generic [ref=e282]: Instagram
                    - generic [ref=e283] [cursor=pointer]:
                      - checkbox "TikTok" [ref=e284]
                      - generic [ref=e288]: TikTok
                    - generic [ref=e289] [cursor=pointer]:
                      - checkbox "Facebook" [ref=e290]
                      - generic [ref=e294]: Facebook
                - group "Distribution" [ref=e295]:
                  - radiogroup "Visibility" [ref=e297]:
                    - radio "public" [checked] [ref=e298] [cursor=pointer]
                    - radio "private" [disabled] [ref=e299] [cursor=pointer]
                  - paragraph [ref=e300]: Public posts can be seen by everyone.
                - group "When to publish" [ref=e304]:
                  - radiogroup "When to publish" [ref=e306]:
                    - radio "Publish now" [checked] [ref=e307] [cursor=pointer]
                    - radio "Schedule" [ref=e310] [cursor=pointer]
                - generic [ref=e315] [cursor=pointer]:
                  - checkbox "Run as Paid Ad Set your ad spending limits in Settings before running a paid ad. Open Settings" [disabled] [ref=e316]
                  - generic [ref=e317]:
                    - generic [ref=e318]: Run as Paid Ad
                    - generic [ref=e322]:
                      - text: Set your ad spending limits in Settings before running a paid ad.
                      - link "Open Settings" [ref=e323]:
                        - /url: /settings/platforms
                - generic [ref=e324] [cursor=pointer]:
                  - checkbox "I confirm I am authorised to publish this media and caption." [checked] [active] [ref=e325]
                  - generic [ref=e326]: I confirm I am authorised to publish this media and caption.
              - region "Preview" [ref=e330]:
                - generic [ref=e331]:
                  - generic [ref=e332]:
                    - generic [ref=e333]: "2"
                    - generic [ref=e334]:
                      - heading "Preview" [level=3] [ref=e335]
                      - paragraph [ref=e336]: See how your post will look on each platform.
                  - tablist "Preview size" [ref=e337]:
                    - tab "Mobile" [selected] [ref=e338] [cursor=pointer]
                    - tab "Tablet" [ref=e341] [cursor=pointer]
                    - tab "Desktop" [ref=e344] [cursor=pointer]
                - generic [ref=e351]:
                  - generic [ref=e352]: 9:41
                  - generic [ref=e362]: Instagram
                  - generic [ref=e363]:
                    - generic [ref=e364]: SC
                    - generic [ref=e365]: Sunset Cove Beach Resort
                  - paragraph [ref=e381]: A quiet morning in Cebu.
                - generic [ref=e382]: Instagram preview
              - region "Review and confirm" [ref=e384]:
                - generic [ref=e385]:
                  - generic [ref=e386]: "3"
                  - generic [ref=e387]:
                    - heading "Review & Confirm" [level=3] [ref=e388]
                    - paragraph [ref=e389]: Check your content and settings before publishing.
                - generic [ref=e390]:
                  - generic [ref=e391]: Final caption
                  - textbox "Final caption" [ref=e395]: A quiet morning in Cebu.
                  - paragraph [ref=e396]: 24 / 2,200
                - generic [ref=e397]:
                  - paragraph [ref=e398]: What will be published
                  - paragraph [ref=e402]: Here’s a summary of your publishing plan.
                  - list [ref=e403]:
                    - listitem [ref=e404]:
                      - generic [ref=e409]: Instagram
                      - generic [ref=e410]: Public
                    - listitem [ref=e414]:
                      - generic [ref=e418]: TikTok
                      - generic [ref=e419]: Not selected
                    - listitem [ref=e420]:
                      - generic [ref=e424]: Facebook
                      - generic [ref=e425]: Not selected
                  - generic [ref=e426]:
                    - generic [ref=e427]:
                      - term [ref=e428]: Timing
                      - definition [ref=e433]: Publishes now
                    - generic [ref=e434]:
                      - term [ref=e435]: Post type
                      - definition [ref=e439]: Organic post
                    - generic [ref=e440]:
                      - term [ref=e441]: Run as Paid Ad
                      - definition [ref=e445]: "No"
            - generic [ref=e446]:
              - button "Cancel" [ref=e447] [cursor=pointer]
              - button "Confirm & Publish" [ref=e449] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect, type Page } from '@playwright/test';
  2   | import { MOCK_CONTENT } from '../../frontend/services/fixtures/content';
  3   | import { MOCK_OMCS } from '../../frontend/services/fixtures/omcs';
  4   | import { MOCK_MARKETS } from '../../frontend/services/fixtures/markets';
  5   | 
  6   | async function openComposer(page: Page) {
  7   |   await page.route('**/api/**', route => route.fulfill({ json: [] }));
  8   |   await page.route('**/api/forecasting/markets?**', route => route.fulfill({ json: { markets: MOCK_MARKETS } }));
  9   |   await page.route('**/api/social-connections', route => route.fulfill({ json: ['instagram', 'facebook', 'tiktok'].map(platform => ({ platform, status: 'ACTIVE', configured: true, displayName: 'Tester' })) }));
  10  |   await page.route('**/api/content/generate', route => route.fulfill({ json: MOCK_CONTENT }));
  11  |   await page.route('**/api/content/translate', route => route.fulfill({ json: { captionEn: 'A quiet morning.', sourceLanguage: 'en' } }));
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
> 60  |   await modal.getByRole('checkbox', { name: /Run as Paid Ad/ }).check();
      |                                                                 ^ TimeoutError: locator.check: Timeout 15000ms exceeded.
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
  112 |   await expect(page.getByRole('button', { name: 'Connect TikTok', exact: true })).toBeDisabled();
  113 |   await page.screenshot({ path: testInfo.outputPath('reconnect-required.png'), fullPage: true });
  114 | });
  115 | 
```