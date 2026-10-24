# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: login.spec.ts >> Shell & Routing ? router and overlay stack (mocked API) >> market radar drawer pushes the scrim and Escape closes it
- Location: tests\login.spec.ts:100:3

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /Demand window ? South Korea/ })

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
      - button "Account menu for E2E Resort" [ref=e81] [cursor=pointer]: ER
    - main [ref=e85]:
      - generic [ref=e86]:
        - generic [ref=e87]:
          - button "Edit cover photo" [ref=e91] [cursor=pointer]
          - generic [ref=e96]:
            - generic [ref=e97]:
              - heading "Good morning, E2E Resort" [level=1] [ref=e98]: Good morning,E2E Resort
              - paragraph [ref=e99]: Select an alert to see the markets ranked for its category.
            - generic [ref=e100]:
              - generic [ref=e101]:
                - generic [ref=e102]: "82"
                - generic [ref=e103]: Uniqueness
              - button "Refresh forecast" [ref=e107] [cursor=pointer]
        - generic [ref=e113]:
          - generic [ref=e114]:
            - generic [ref=e119]:
              - generic [ref=e120]: Unread alerts
              - generic [ref=e121]: "1"
            - generic [ref=e122]: Across your categories
          - generic [ref=e123]:
            - generic [ref=e128]:
              - generic [ref=e129]: Active surges
              - generic [ref=e130]: "1"
            - generic [ref=e131]: South Korea
          - button "Top market for International South Korea 89/100 · Accommodation & Staycation" [ref=e132] [cursor=pointer]:
            - generic [ref=e137]:
              - generic [ref=e138]: Top market for International
              - generic [ref=e139]: South Korea
            - generic [ref=e140]: 89/100 · Accommodation & Staycation
          - button "Top market for Philippines CALABARZON 78/100 · Accommodation & Staycation" [ref=e144] [cursor=pointer]:
            - generic [ref=e149]:
              - generic [ref=e150]: Top market for Philippines
              - generic [ref=e151]: CALABARZON
            - generic [ref=e152]: 78/100 · Accommodation & Staycation
        - generic [ref=e156]:
          - region "Surge Alerts" [ref=e157]:
            - heading "Surge Alerts" [level=2] [ref=e159]
            - region "Surge alert list" [ref=e160]:
              - button "Week of Aug 24, 2026 Unread Surge Demand window — South Korea Demand window detected for South Korea — the 4-week forecast is 30.5% above the rolling baseline. South Korea Accommodation & Staycation Rising demand window View target markets" [ref=e162] [cursor=pointer]:
                - generic [ref=e163]:
                  - generic [ref=e165]: Week of Aug 24, 2026
                  - generic [ref=e166]: Unread
                  - generic [ref=e167]: Surge
                - heading "Demand window — South Korea" [level=3] [ref=e170]
                - paragraph [ref=e171]: Demand window detected for South Korea — the 4-week forecast is 30.5% above the rolling baseline.
                - generic [ref=e172]:
                  - generic [ref=e173]: South Korea
                  - generic [ref=e177]: Accommodation & Staycation
                  - generic [ref=e181]: Rising demand window
                - generic [ref=e185]: View target markets
          - generic [ref=e188]:
            - region "Top International Market" [ref=e189]:
              - generic [ref=e190]:
                - heading "Top International Market" [level=2] [ref=e191]
                - generic [ref=e194]: Based on your selected alert
              - generic [ref=e196]:
                - heading "Select a surge alert" [level=3] [ref=e204]
                - paragraph [ref=e205]: Markets are ranked for the category of whichever alert you open, so this list changes with your selection.
            - region [ref=e206]:
              - heading "Top Philippines Region Market Preview rankings — live regional forecasts are not available yet." [level=2] [ref=e208]:
                - text: Top Philippines Region Market
                - generic "Preview rankings — live regional forecasts are not available yet." [ref=e209]
              - generic [ref=e214]:
                - heading "Select a surge alert" [level=3] [ref=e222]
                - paragraph [ref=e223]: Select an alert to view the Philippine-region preview for your dashboard.
        - region "Traveller enquiries" [ref=e224]:
          - heading "Traveller enquiries" [level=2] [ref=e225]
          - paragraph [ref=e226]: Requests from your ads. Contact each traveller to confirm availability and booking details.
          - generic [ref=e227]:
            - text: Search enquiries
            - searchbox "Search enquiries" [ref=e228]
          - paragraph [ref=e229]: No traveller enquiries yet.
          - list
        - region [ref=e230]:
          - heading "Trending Search Interests" [level=2] [ref=e231]
          - paragraph [ref=e232]: Preview data · Illustrative search interests across tourism themes.
          - region "Trending search interests preview" [ref=e233]:
            - list [ref=e234]:
              - listitem [ref=e235]:
                - generic [ref=e236]: "1"
                - generic [ref=e237]:
                  - heading "Beach" [level=3] [ref=e238]
                  - generic [ref=e239]: Coastal & Island
                - generic [ref=e245]: "100"
              - listitem [ref=e246]:
                - generic [ref=e247]: "2"
                - generic [ref=e248]:
                  - heading "Bay" [level=3] [ref=e249]
                  - generic [ref=e250]: Coastal & Island
                - generic [ref=e256]: "92"
              - listitem [ref=e257]:
                - generic [ref=e258]: "3"
                - generic [ref=e259]:
                  - heading "Sand" [level=3] [ref=e260]
                  - generic [ref=e261]: Coastal & Island
                - generic [ref=e267]: "88"
              - listitem [ref=e268]:
                - generic [ref=e269]: "4"
                - generic [ref=e270]:
                  - heading "Diving" [level=3] [ref=e271]
                  - generic [ref=e272]: Adventure & Nature
                - generic [ref=e277]: "84"
              - listitem [ref=e278]:
                - generic [ref=e279]: "5"
                - generic [ref=e280]:
                  - heading "Fiesta" [level=3] [ref=e281]
                  - generic [ref=e282]: Cultural & Heritage
                - generic [ref=e287]: "81"
              - listitem [ref=e288]:
                - generic [ref=e289]: "6"
                - generic [ref=e290]:
                  - heading "Spa" [level=3] [ref=e291]
                  - generic [ref=e292]: Accommodation & Staycation
                - generic [ref=e298]: "76"
              - listitem [ref=e299]:
                - generic [ref=e300]: "7"
                - generic [ref=e301]:
                  - heading "Dining" [level=3] [ref=e302]
                  - generic [ref=e303]: Culinary & Gastronomy
                - generic [ref=e309]: "72"
              - listitem [ref=e310]:
                - generic [ref=e311]: "8"
                - generic [ref=e312]:
                  - heading "Cliff" [level=3] [ref=e313]
                  - generic [ref=e314]: Adventure & Nature
                - generic [ref=e319]: "68"
```

# Test source

```ts
  4   | 
  5   | // Public routes and shell behavior can be checked without a live backend.
  6   | // Keep a separate full-stack smoke test for real password authentication.
  7   | const PROFILE = {
  8   |   businessProfileId: '00000000-0000-0000-0000-000000000001',
  9   |   businessName: 'E2E Resort', categories: ['Accommodation & Staycation'],
  10  |   coreServices: [], description: '', uvp: '', imagePreview: null, uniquenessScore: 0.82,
  11  | };
  12  | 
  13  | async function mockAuthenticatedShell(page: Page) {
  14  |   await page.addInitScript(() => {
  15  |     localStorage.setItem('ceview.auth', JSON.stringify({
  16  |       accessToken: 'e2e-shell-token', profileCompleted: true, emailVerified: true,
  17  |     }));
  18  |   });
  19  |   await page.route('**/api/**', route => route.fulfill({ json: [] }));
  20  |   await page.route('**/api/business-profile', route => route.fulfill({ json: PROFILE }));
  21  |   await mockModule2Api(page);
  22  | }
  23  | 
  24  | const mainNav = (page: Page) => page.getByRole('navigation', { name: 'Main', exact: true });
  25  | 
  26  | test.describe('Shell & Routing - public routes', () => {
  27  |   test('unauthenticated visit to /login shows the login page, not the app', async ({ page }) => {
  28  |     await page.goto('/login');
  29  |     await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  30  |     await expect(page.getByRole('textbox', { name: 'Email', exact: true })).toBeVisible();
  31  |     await expect(mainNav(page)).toHaveCount(0);
  32  |   });
  33  | 
  34  |   test('unauthenticated visit to / shows the public landing page, not the login form', async ({ page }) => {
  35  |     await page.goto('/');
  36  |     await expect(page.getByRole('heading', { level: 1, name: 'See traveler demand before the opportunity passes.' })).toBeVisible();
  37  |     await expect(page.getByRole('heading', { name: 'Welcome back' })).toHaveCount(0);
  38  |     await page.getByRole('link', { name: 'Sign In', exact: true }).first().click();
  39  |     await expect(page).toHaveURL(/\/login$/);
  40  |     await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  41  |   });
  42  | });
  43  | 
  44  | test.describe('Shell & Routing - live backend', () => {
  45  |   test.beforeEach(async () => { await requireBackend(); });
  46  | 
  47  |   test('login with seeded credentials loads the dashboard and navigates to Performance', async ({ page }) => {
  48  |     await page.goto('/login');
  49  |     await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  50  |     await page.getByRole('textbox', { name: 'Email', exact: true }).fill(SEED_OPERATOR.email);
  51  |     await page.getByLabel('Password', { exact: true }).fill(SEED_OPERATOR.password);
  52  |     const loginResponse = page.waitForResponse(response => response.url().endsWith('/api/auth/login') && response.request().method() === 'POST');
  53  |     await page.getByRole('button', { name: 'Sign In', exact: true }).click();
  54  |     expect((await loginResponse).status()).toBe(200);
  55  |     await expect(mainNav(page).getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
  56  |     await mainNav(page).getByRole('button', { name: 'Performance', exact: true }).click();
  57  |     await expect(page).toHaveURL(/\/performance$/);
  58  |     await expect(page.getByRole('heading', { name: 'Log campaign performance' })).toBeVisible();
  59  |     await expect(page.getByRole('button', { name: 'Dismiss', exact: true })).toHaveCount(0);
  60  |   });
  61  | });
  62  | 
  63  | test.describe('Shell & Routing - router and overlay stack (mocked API)', () => {
  64  |   test.beforeEach(async ({ page }) => { await mockAuthenticatedShell(page); });
  65  | 
  66  |   test('deep links render each route and sidebar navigation avoids a full reload', async ({ page }) => {
  67  |     const routes = [
  68  |       { path: '/dashboard', label: 'Dashboard' },
  69  |       { path: '/content', label: 'Content Studio' },
  70  |       { path: '/calendar', label: 'Calendar' },
  71  |       { path: '/performance', label: 'Performance' },
  72  |       { path: '/settings/profile', label: 'Business Profile' },
  73  |       { path: '/settings/platforms', label: 'Platforms' },
  74  |       { path: '/settings/workspace', label: 'Workspace' },
  75  |     ];
  76  |     for (const route of routes) {
  77  |       await page.goto(route.path);
  78  |       await expect(mainNav(page).getByRole('button', { name: route.label, exact: true })).toHaveAttribute('aria-current', 'page');
  79  |     }
  80  |     await page.evaluate(() => { (window as any).__noReload = true; });
  81  |     for (const route of routes) {
  82  |       await mainNav(page).getByRole('button', { name: route.label, exact: true }).click();
  83  |       await expect(page).toHaveURL(new RegExp(`${route.path}$`));
  84  |       await expect(mainNav(page).getByRole('button', { name: route.label, exact: true })).toHaveAttribute('aria-current', 'page');
  85  |       expect(await page.evaluate(() => (window as any).__noReload)).toBe(true);
  86  |     }
  87  |   });
  88  | 
  89  |   test('profile guard redirects completed profiles to Dashboard and incomplete profiles to onboarding', async ({ page }) => {
  90  |     await page.goto('/onboarding');
  91  |     await expect(page).toHaveURL(/\/dashboard$/);
  92  |     await expect(mainNav(page).getByRole('button', { name: 'Dashboard', exact: true })).toHaveAttribute('aria-current', 'page');
  93  | 
  94  |     await page.route('**/api/business-profile', route => route.fulfill({ json: { ...PROFILE, uniquenessScore: null } }));
  95  |     await page.goto('/dashboard');
  96  |     await expect(page).toHaveURL(/\/onboarding$/);
  97  |     await expect(mainNav(page)).toHaveCount(0);
  98  |   });
  99  | 
  100 |   test('market radar drawer pushes the scrim and Escape closes it', async ({ page }) => {
  101 |     await page.goto('/dashboard');
  102 |     const scrim = page.locator('#scrim');
  103 |     await expect(scrim).not.toHaveClass(/on/);
> 104 |     await page.getByRole('button', { name: /Demand window \u2014 South Korea/ }).click();
      |                                                                             ^ Error: locator.click: Test timeout of 30000ms exceeded.
  105 |     await page.getByLabel('Top International Market').getByRole('button', { name: /South Korea/ }).click();
  106 |     const drawer = page.getByRole('dialog', { name: /South Korea market radar/ });
  107 |     await expect(drawer).toBeVisible();
  108 |     await expect(scrim).toHaveClass(/on/);
  109 |     await page.keyboard.press('Escape');
  110 |     await expect(drawer).not.toBeVisible();
  111 |     await expect(scrim).not.toHaveClass(/on/);
  112 |   });
  113 | 
  114 |   test('Facebook Page picker pushes the scrim and Escape closes it', async ({ page }) => {
  115 |     // Connect now redirects to OAuth. Page selection is the actual in-app modal.
  116 |     await page.route('**/api/social-connections', route => route.fulfill({ json: [
  117 |       { platform: 'facebook', status: 'NEEDS_PAGE', configured: true },
  118 |       { platform: 'instagram', status: 'NEEDS_PAGE', configured: true },
  119 |       { platform: 'tiktok', status: 'DISCONNECTED', configured: false },
  120 |     ] }));
  121 |     await page.route('**/api/social-connections/meta/pages', route => route.fulfill({ json: [
  122 |       { id: 'cebu-page', name: 'Cebu Page', instagramUsername: 'cebu' },
  123 |     ] }));
  124 |     await page.goto('/settings/platforms');
  125 |     const scrim = page.locator('#scrim');
  126 |     await expect(scrim).not.toHaveClass(/on/);
  127 |     await page.getByRole('button', { name: 'Choose Page', exact: true }).first().click();
  128 |     const picker = page.getByRole('dialog', { name: 'Choose a Facebook Page' });
  129 |     await expect(picker).toBeVisible();
  130 |     await expect(picker.getByRole('radio', { name: /Cebu Page/ })).toBeVisible();
  131 |     await expect(scrim).toHaveClass(/on/);
  132 |     await page.keyboard.press('Escape');
  133 |     await expect(picker).not.toBeVisible();
  134 |     await expect(scrim).not.toHaveClass(/on/);
  135 |   });
  136 | });
  137 | 
```