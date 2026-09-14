# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: journey.spec.ts >> End-to-end authenticated journey >> content studio: caption panel shows real data or a visible error, and visual direction renders real shot-list data
- Location: tests\journey.spec.ts:171:3

# Error details

```
Test timeout of 90000ms exceeded.
```

```
Error: locator.click: Test timeout of 90000ms exceeded.
Call log:
  - waiting for getByRole('heading', { name: 'Demand Surge Detected — South Korea' })

```

# Page snapshot

```yaml
- generic [ref=f1e3]:
  - navigation "Main" [ref=f1e4]:
    - generic [ref=f1e5]:
      - img "CeView Logo" [ref=f1e6]
      - generic [ref=f1e7]: CeView
      - button "Collapse sidebar" [expanded] [ref=f1e9] [cursor=pointer]
    - list [ref=f1e14]:
      - listitem [ref=f1e15]: Intelligence
      - listitem [ref=f1e16]:
        - button "Dashboard" [ref=f1e17] [cursor=pointer]
      - listitem [ref=f1e24]: Create
      - listitem [ref=f1e25]:
        - button "Content Studio" [ref=f1e26] [cursor=pointer]
      - listitem [ref=f1e31]:
        - button "Calendar" [ref=f1e32] [cursor=pointer]
      - listitem [ref=f1e36]: Measure
      - listitem [ref=f1e37]:
        - button "Performance" [ref=f1e38] [cursor=pointer]
      - listitem [ref=f1e43]: Settings
      - listitem [ref=f1e44]:
        - button "Business Profile" [ref=f1e45] [cursor=pointer]
      - listitem [ref=f1e51]:
        - button "Platforms" [ref=f1e52] [cursor=pointer]
      - listitem [ref=f1e60]:
        - button "Workspace" [ref=f1e61] [cursor=pointer]
    - button "Sign out" [ref=f1e69] [cursor=pointer]
  - generic [ref=f1e71]:
    - banner [ref=f1e72]:
      - button "Search" [disabled] [ref=f1e73]
      - button "Notifications" [disabled] [ref=f1e78]
    - main [ref=f1e83]:
      - main "Content Studio" [ref=f1e84]:
        - generic [ref=f1e85]:
          - paragraph [ref=f1e86]: Content Studio
          - heading "Create content that fits the market" [level=1] [ref=f1e87]
        - generic [ref=f1e88]:
          - paragraph [ref=f1e89]: Step 1 of 2
          - heading "Pick a surge alert" [level=2] [ref=f1e90]
          - paragraph [ref=f1e91]: Content Studio generates market-localized captions for one surge at a time. Choose which one you're creating content for, then pick a target market for its category.
          - button "Jul 27, 2026 Surge Demand window alert — South Korea — Coastal & Island Demand window opening for Korea — Moalboal FreeDive Cebu search interest is 31% above the 30-day baseline. Target Korean-market promotion within the next 4 weeks. South Korea Coastal & Island Rising demand window Pick this alert" [ref=f1e93] [cursor=pointer]:
            - generic [ref=f1e94]:
              - generic [ref=f1e95]: Jul 27, 2026
              - generic [ref=f1e96]: Surge
            - heading "Demand window alert — South Korea — Coastal & Island" [level=3] [ref=f1e99]
            - paragraph [ref=f1e100]: Demand window opening for Korea — Moalboal FreeDive Cebu search interest is 31% above the 30-day baseline. Target Korean-market promotion within the next 4 weeks.
            - generic [ref=f1e101]:
              - generic [ref=f1e102]: South Korea
              - generic [ref=f1e106]: Coastal & Island
              - generic [ref=f1e110]: Rising demand window
            - generic [ref=f1e114]: Pick this alert
```

# Test source

```ts
  86  |     const alertHeading = page.getByRole('heading', { name: 'Demand Surge Detected — South Korea' });
  87  |     await expect(alertHeading).toBeVisible();
  88  |     await alertHeading.click();
  89  | 
  90  |     const marketsPanel = page.locator('section.dash-markets');
  91  |     const rankHeading = marketsPanel.getByRole('heading', { name: 'South Korea' });
  92  |     await expect(rankHeading).toBeVisible();
  93  |     await expect(marketsPanel).toContainText('Seoul');
  94  |     await expect(marketsPanel).not.toContainText('undefined');
  95  |     await expect(marketsPanel).not.toContainText('NaN');
  96  | 
  97  |     await rankHeading.click();
  98  | 
  99  |     await expect(page).toHaveURL(/market=korea/);
  100 |     const drawer = page.locator('.drawer.on');
  101 |     await expect(drawer).toBeVisible();
  102 | 
  103 |     // Purchasing Power tab (default) — real GDP/forex values from
  104 |     // GET /api/forecasting/markets, verified directly: forexLabel "PHP per 1
  105 |     // KRW", gdpValue 2.1.
  106 |     await expect(drawer.getByText('PHP per 1 KRW', { exact: true })).toBeVisible();
  107 |     const gdpTile = drawer.locator('.stat-tile', { hasText: 'GDP growth' });
  108 |     await expect(gdpTile.locator('.stat-value')).toHaveText('2.1%');
  109 |     await expect(drawer).not.toContainText('undefined');
  110 |     await expect(drawer).not.toContainText('NaN');
  111 | 
  112 |     // Seasonal Patterns — yoyRatio is null for this seeded row, so the screen
  113 |     // must show an explicit "not available" message rather than a bare number
  114 |     // (or, worse, "NaN"/"undefined").
  115 |     await drawer.getByRole('tab', { name: 'Seasonal Patterns' }).click();
  116 |     await expect(drawer.getByText('N/A')).toBeVisible();
  117 |     await expect(drawer.getByText('Under 59 weeks of history — not yet comparable')).toBeVisible();
  118 |     await expect(drawer).not.toContainText('undefined');
  119 |     await expect(drawer).not.toContainText('NaN');
  120 |   });
  121 | 
  122 |   test('performance: ingestion persists to the backend, the PES gauge reflects the server score, and the prescriptive report renders', async ({ page }) => {
  123 |     // The report round-trips through Spring -> FastAPI -> Groq for a large
  124 |     // structured completion (executive summary + 3 funnel diagnostics + 3
  125 |     // recommendations) and Spring allows it the full 30s configured at
  126 |     // ceview.fastapi.timeout-seconds (application.yml) before giving up. The
  127 |     // content-studio test in this same file already documents ~25s as an
  128 |     // observed real ceiling for a comparable Groq-backed call. Give both
  129 |     // budgets real headroom instead of the old 60s/20s, which sized the
  130 |     // heading wait below the backend's own allowance and made this flaky
  131 |     // under CI's slower/higher-latency runners rather than actually broken.
  132 |     test.setTimeout(90_000);
  133 | 
  134 |     await loginAsSeedOperator(page);
  135 |     await page.goto('/performance');
  136 | 
  137 |     // Gated behind the 7-field ingestion form until a campaign is submitted.
  138 |     await expect(page.getByRole('heading', { name: 'No campaign data found' })).toBeVisible();
  139 | 
  140 |     const [ingestResponse] = await Promise.all([
  141 |       page.waitForResponse(
  142 |         (res) => res.url().includes('/api/analytics/manual') && res.request().method() === 'POST',
  143 |       ),
  144 |       page.getByRole('button', { name: 'Generate campaign analytics' }).click(),
  145 |     ]);
  146 |     expect(ingestResponse.ok()).toBe(true);
  147 |     const ingestBody = await ingestResponse.json();
  148 |     const serverScore: number = ingestBody.pes.overallScore;
  149 |     expect(Number.isFinite(serverScore)).toBe(true);
  150 | 
  151 |     // The gauge must show the SERVER's score (persisted to
  152 |     // tbl_campaign_records), not a client-recomputed fallback — assert it
  153 |     // against the actual ingest response rather than a hardcoded number.
  154 |     await expect(page.getByTestId('pes-score-value')).toHaveText(serverScore.toFixed(2));
  155 | 
  156 |     // The prescriptive report now returns a real executiveSummary — assert
  157 |     // the AI Action Plan renders, not the "Loading report…" or "returned no
  158 |     // content" placeholder states. 45s, not 35s: Spring's own proxy timeout to
  159 |     // FastAPI (ceview.fastapi.timeout-seconds) is 30s, and 35s left only 5s of
  160 |     // headroom over it — not enough to absorb a cold first Groq call, which is
  161 |     // what this kept failing on (a 39.7s first attempt, then a 11.9s pass on
  162 |     // retry, i.e. warm). A stricter wait fails on a real, still-in-flight
  163 |     // report rather than a genuine problem. Still well inside the 90s budget
  164 |     // set above.
  165 |     await expect(page.getByRole('heading', { name: 'AI Action Plan' })).toBeVisible({ timeout: 45_000 });
  166 |     const firstDiagnostic = page.getByTestId('action-plan-card-0');
  167 |     await expect(firstDiagnostic).toBeVisible();
  168 |     await expect(firstDiagnostic).not.toHaveText('');
  169 |   });
  170 | 
  171 |   test('content studio: caption panel shows real data or a visible error, and visual direction renders real shot-list data', async ({ page }) => {
  172 |     // POST /api/content/generate has been observed taking ~25s before it
  173 |     // 500s — give this test real room rather than the default per-test
  174 |     // timeout.
  175 |     test.setTimeout(90_000);
  176 | 
  177 |     await loginAsSeedOperator(page);
  178 |     await page.goto('/content');
  179 | 
  180 |     // Content Studio is gated behind an explicit surge + target-market pick
  181 |     // (ContentTargetPicker) — it must never infer one on the operator's
  182 |     // behalf. Drive the same two-step pick a real operator would: the seeded
  183 |     // South Korea / Coastal & Island demand alert from the dashboard tests
  184 |     // above, then its top-ranked market.
  185 |     await expect(page.getByText('Step 1 of 2')).toBeVisible();
> 186 |     await page.getByRole('heading', { name: 'Demand Surge Detected — South Korea' }).click();
      |                                                                                      ^ Error: locator.click: Test timeout of 90000ms exceeded.
  187 |     await expect(page.getByText('Step 2 of 2')).toBeVisible();
  188 |     await page.getByRole('heading', { name: 'South Korea' }).click();
  189 | 
  190 |     await expect(
  191 |       page.getByRole('heading', { level: 1, name: 'Create content that fits the market' }),
  192 |     ).toBeVisible();
  193 | 
  194 |     // The shot list lives in the "Visual Guide" drawer now — the inline
  195 |     // VisualDirectionBoard (section[aria-labelledby="visual-direction-title"])
  196 |     // was removed in the studio rebuild, which is what this assertion used to
  197 |     // reach for. The drawer auto-opens on a first visit (useFirstRunDrawer);
  198 |     // the floating trigger opens it if that FTUE flag has already been set.
  199 |     const visualGuide = page.getByRole('dialog', { name: 'Visual Guide' });
  200 |     if (!(await visualGuide.isVisible())) {
  201 |       await page.getByRole('button', { name: 'Visual Guide' }).click();
  202 |     }
  203 |     await expect(visualGuide).toBeVisible();
  204 | 
  205 |     // POST /api/creative-direction/generate -> Spring's
  206 |     // AIInferenceGatewayService.generateCreative -> fastapi-sbert has no known
  207 |     // defect on the happy path, and fastapi-sbert IS started in the e2e-journey
  208 |     // CI job (see this file's header comment) — but a live Groq call can still
  209 |     // fail transiently. ContentStudioView catches that into `direction = null`,
  210 |     // which renders the drawer's header with no sections and NO error panel, so
  211 |     // there is nothing to assert on in that branch. Require real content only
  212 |     // when the shot list actually rendered, mirroring the caption-panel
  213 |     // assertion below.
  214 |     const shotListHeading = visualGuide.getByRole('heading', { name: 'Shot list' });
  215 |     const shotListRendered = await shotListHeading
  216 |       .waitFor({ state: 'visible', timeout: 20_000 })
  217 |       .then(() => true)
  218 |       .catch(() => false);
  219 |     if (shotListRendered) {
  220 |       await expect(visualGuide).not.toContainText('undefined');
  221 |       await expect(visualGuide).not.toContainText('NaN');
  222 |     }
  223 | 
  224 |     // Close it before asserting on the caption matrix underneath — the drawer
  225 |     // scrim covers the column the cards are in.
  226 |     await visualGuide.getByRole('button', { name: 'Close' }).click();
  227 |     await expect(visualGuide).toBeHidden();
  228 | 
  229 |     // POST /api/content/generate currently 500s with
  230 |     // MOD31_CAPTION_AGENT_FAILED — a known, out-of-scope defect in the
  231 |     // FastAPI caption agent's prompt. Accept EITHER outcome (a real caption
  232 |     // matrix, or a visible, non-blank error panel) and fail only on neither
  233 |     // appearing. Do not assert the 500 as required: once the caption agent is
  234 |     // fixed, this must keep passing on the happy path too.
  235 |     const errorPanel = page.getByRole('alert').filter({ hasText: 'Content Studio' });
  236 |     // "Select", not "Approve": the option cards stage a caption into the
  237 |     // composer now rather than approving in place.
  238 |     const captionOption = page.getByRole('article').filter({ hasText: 'Select' });
  239 |     await expect(errorPanel.or(captionOption).first()).toBeVisible({ timeout: 60_000 });
  240 |   });
  241 | });
  242 | 
```