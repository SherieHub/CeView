# Current executed failures

Only dependency-complete executions are included. Focused repeats are not duplicated.

## frontend/services/forecastStore.test.tsx — forecast store — cached first paint keeps the cached data on screen while the refresh runs, then replaces it

```text
AssertionError: expected [ { id: 'n1', …(11) }, …(7) ] to have a length of 5 but got 8
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1389:20)
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1156:15)
    at Proxy.methodWrapper (file://frontend/node_modules/chai/index.js:1700:25)
    at frontend/services/forecastStore.test.tsx:104:50
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/services/forecastStore.test.tsx — forecast store — cached first paint writes what it reads back to the cache, keyed by profile

```text
AssertionError: expected [ { id: 'n1', …(11) }, …(7) ] to have a length of 5 but got 8
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1389:20)
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1156:15)
    at Proxy.methodWrapper (file://frontend/node_modules/chai/index.js:1700:25)
    at frontend/services/forecastStore.test.tsx:113:55
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/services/forecastStore.test.tsx — forecast store — sync reads alerts, health and markets without waiting on ensure

```text
AssertionError: expected [ { id: 'n1', …(11) }, …(7) ] to have a length of 5 but got 8
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1389:20)
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1156:15)
    at Proxy.methodWrapper (file://frontend/node_modules/chai/index.js:1700:25)
    at frontend/services/forecastStore.test.tsx:123:50
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/services/forecastStore.test.tsx — forecast store — sync does not treat any other ensure failure as an error

```text
AssertionError: expected [ { id: 'n1', …(11) }, …(7) ] to have a length of 5 but got 8
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1389:20)
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1156:15)
    at Proxy.methodWrapper (file://frontend/node_modules/chai/index.js:1700:25)
    at frontend/services/forecastStore.test.tsx:165:50
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/services/forecastStore.test.tsx — forecast store — failures never blank the screen keeps the snapshot and says it is stale when a later refresh fails

```text
AssertionError: expected [ { id: 'n1', …(11) }, …(7) ] to have a length of 5 but got 8
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1389:20)
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1156:15)
    at Proxy.methodWrapper (file://frontend/node_modules/chai/index.js:1700:25)
    at frontend/services/forecastStore.test.tsx:205:50
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/services/forecastStore.test.tsx — forecast store — read state and revalidation reports a failed Refresh without throwing, and keeps the data

```text
AssertionError: expected [ { id: 'n1', …(11) }, …(7) ] to have a length of 5 but got 8
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1389:20)
    at Proxy.<anonymous> (file://frontend/node_modules/@vitest/expect/dist/index.js:1156:15)
    at Proxy.methodWrapper (file://frontend/node_modules/chai/index.js:1700:25)
    at frontend/services/forecastStore.test.tsx:291:50
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx — ContentStudioView — saved drafts saving the same work again updates the saved draft in place once the work has been edited, never adding a copy

```text
Error: Unable to find role="button" and name "Save changes"

Ignored nodes: comments, script, style
<body
  style=""
>
  <div>
    <section
      aria-label="Content Studio"
      class="studio-screen"
    >
      <div
        class="page-head"
      >
        <div
          class="min-w-0"
        >
          <h1
            class="heading-lg"
          >
            Content Studio
          </h1>
          <p
            class="body-sm mt-1"
          >
            Create, plan, and review content for your target markets.
          </p>
        </div>
        <div
          class="page-head-actions"
        >
          <label
            class="studio-market"
          >
            <span
              class="studio-market-label"
            >
              Target market
            </span>
            <span
              class="studio-select-wrap"
            >
              <span
                aria-hidden="true"
                class="mkt-flag"
              >
                <img
                  alt=""
                  height="21"
                  src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20id='flag-icons-kr'%20viewBox='0%200%20640%20480'%3e%3cdefs%3e%3cclipPath%20id='kr-a'%3e%3cpath%20fill-opacity='.7'%20d='M-95.8-.4h682.7v512H-95.8z'/%3e%3c/clipPath%3e%3c/defs%3e%3cg%20fill-rule='evenodd'%20clip-path='url(%23kr-a)'%20transform='translate(89.8%20.4)scale(.9375)'%3e%3cpath%20fill='%23fff'%20d='M-95.8-.4H587v512H-95.8Z'/%3e%3cg%20transform='rotate(-56.3%20361.6%20-101.3)scale(10.66667)'%3e%3cg%20id='kr-c'%3e%3cpath%20id='kr-b'%20fill='%23000001'%20d='M-6-26H6v2H-6Zm0%203H6v2H-6Zm0%203H6v2H-6Z'/%3e%3cuse%20xlink:href='%23kr-b'%20width='100%25'%20height='100%25'%20y='44'/%3e%3c/g%3e%3cpath%20stroke='%23fff'%20d='M0%2017v10'/%3e%3cpath%20fill='%23cd2e3a'%20d='M0-12a12%2012%200%200%201%200%2024Z'/%3e%3cpath%20fill='%230047a0'%20d='M0-12a12%2012%200%200%200%200%2024A6%206%200%200%200%200%200Z'/%3e%3ccircle%20cy='-6'%20r='6'%20fill='%23cd2e3a'/%3e%3c/g%3e%3cg%20transform='rotate(-123.7%20191.2%2062.2)scale(10.66667)'%3e%3cuse%20xlink:href='%23kr-c'%20width='100%25'%20height='100%25'/%3e%3cpath%20stroke='%23fff'%20d='M0-23.5v3M0%2017v3.5m0%203v3'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e"
                  width="28"
                />
              </span>
              <select
                class="studio-select"
              >
                <option
                  value="korea"
                >
                  South Korea
                </option>
                <option
                  value="japan"
                >
                  Japan
                </option>
                <option
                  value="usa"
                >
                  United States
                </option>
              </select>
              <svg
                aria-hidden="true"
                class="lucide lucide-chevron-down studio-select-caret"
                fill="none"
                height="18"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </span>
          </label>
        </div>
      </div>
      <div
        aria-label="Content Studio sections"
        class="studio-tabs"
        role="tablist"
      >
        <button
          aria-controls="studio-panel-quick"
          aria-selected="true"
          id="studio-tab-quick"
          role="tab"
          tabindex="0"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-pen-line"
            fill="none"
            height="16"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
            viewBox="0 0 24 24"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 21h8"
            />
            <path
              d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
            />
          </svg>
          Quick Post
        </button>
        <button
          aria-controls="studio-panel-campaigns"
          aria-selected="false"
          id="studio-tab-campaigns"
          role="tab"
          tabindex="-1"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-folder-kanban"
            fill="none"
            height="16"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
            viewBox="0 0 24 ...
    at waitForWrapper (frontend/node_modules/@testing-library/dom/dist/wait-for.js:163:27)
    at frontend/node_modules/@testing-library/dom/dist/query-helpers.js:86:33
    at frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx:870:33
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx — ContentStudioView — saved drafts saving the same work again saves a fresh draft if the linked one was deleted elsewhere

```text
Error: Unable to find role="button" and name "Save changes"

Ignored nodes: comments, script, style
<body
  style=""
>
  <div>
    <section
      aria-label="Content Studio"
      class="studio-screen"
    >
      <div
        class="page-head"
      >
        <div
          class="min-w-0"
        >
          <h1
            class="heading-lg"
          >
            Content Studio
          </h1>
          <p
            class="body-sm mt-1"
          >
            Create, plan, and review content for your target markets.
          </p>
        </div>
        <div
          class="page-head-actions"
        >
          <label
            class="studio-market"
          >
            <span
              class="studio-market-label"
            >
              Target market
            </span>
            <span
              class="studio-select-wrap"
            >
              <span
                aria-hidden="true"
                class="mkt-flag"
              >
                <img
                  alt=""
                  height="21"
                  src="data:image/svg+xml,%3csvg%20xmlns='http://www.w3.org/2000/svg'%20xmlns:xlink='http://www.w3.org/1999/xlink'%20id='flag-icons-kr'%20viewBox='0%200%20640%20480'%3e%3cdefs%3e%3cclipPath%20id='kr-a'%3e%3cpath%20fill-opacity='.7'%20d='M-95.8-.4h682.7v512H-95.8z'/%3e%3c/clipPath%3e%3c/defs%3e%3cg%20fill-rule='evenodd'%20clip-path='url(%23kr-a)'%20transform='translate(89.8%20.4)scale(.9375)'%3e%3cpath%20fill='%23fff'%20d='M-95.8-.4H587v512H-95.8Z'/%3e%3cg%20transform='rotate(-56.3%20361.6%20-101.3)scale(10.66667)'%3e%3cg%20id='kr-c'%3e%3cpath%20id='kr-b'%20fill='%23000001'%20d='M-6-26H6v2H-6Zm0%203H6v2H-6Zm0%203H6v2H-6Z'/%3e%3cuse%20xlink:href='%23kr-b'%20width='100%25'%20height='100%25'%20y='44'/%3e%3c/g%3e%3cpath%20stroke='%23fff'%20d='M0%2017v10'/%3e%3cpath%20fill='%23cd2e3a'%20d='M0-12a12%2012%200%200%201%200%2024Z'/%3e%3cpath%20fill='%230047a0'%20d='M0-12a12%2012%200%200%200%200%2024A6%206%200%200%200%200%200Z'/%3e%3ccircle%20cy='-6'%20r='6'%20fill='%23cd2e3a'/%3e%3c/g%3e%3cg%20transform='rotate(-123.7%20191.2%2062.2)scale(10.66667)'%3e%3cuse%20xlink:href='%23kr-c'%20width='100%25'%20height='100%25'/%3e%3cpath%20stroke='%23fff'%20d='M0-23.5v3M0%2017v3.5m0%203v3'/%3e%3c/g%3e%3c/g%3e%3c/svg%3e"
                  width="28"
                />
              </span>
              <select
                class="studio-select"
              >
                <option
                  value="korea"
                >
                  South Korea
                </option>
                <option
                  value="japan"
                >
                  Japan
                </option>
                <option
                  value="usa"
                >
                  United States
                </option>
              </select>
              <svg
                aria-hidden="true"
                class="lucide lucide-chevron-down studio-select-caret"
                fill="none"
                height="18"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
                width="18"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="m6 9 6 6 6-6"
                />
              </svg>
            </span>
          </label>
        </div>
      </div>
      <div
        aria-label="Content Studio sections"
        class="studio-tabs"
        role="tablist"
      >
        <button
          aria-controls="studio-panel-quick"
          aria-selected="true"
          id="studio-tab-quick"
          role="tab"
          tabindex="0"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-pen-line"
            fill="none"
            height="16"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
            viewBox="0 0 24 24"
            width="16"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13 21h8"
            />
            <path
              d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"
            />
          </svg>
          Quick Post
        </button>
        <button
          aria-controls="studio-panel-campaigns"
          aria-selected="false"
          id="studio-tab-campaigns"
          role="tab"
          tabindex="-1"
          type="button"
        >
          <svg
            aria-hidden="true"
            class="lucide lucide-folder-kanban"
            fill="none"
            height="16"
            stroke="currentColor"
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="1.75"
            viewBox="0 0 24 ...
    at waitForWrapper (frontend/node_modules/@testing-library/dom/dist/wait-for.js:163:27)
    at frontend/node_modules/@testing-library/dom/dist/query-helpers.js:86:33
    at frontend/components/module-3/3.1-content-studio/ContentStudioView.test.tsx:886:42
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:20
```

## frontend/components/module-3/3.1-content-studio/contentDraftPayload.test.ts — contentDraftPayload round-trips through JSON

```text
AssertionError: expected { schemaVersion: 1, …(8) } to deeply equal { schemaVersion: 1, …(8) }
    at frontend/components/module-3/3.1-content-studio/contentDraftPayload.test.ts:87:65
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:302:11
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:1903:26
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:2326:20
    at new Promise (<anonymous>)
    at runWithCancel (file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:2323:10)
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:2305:20
    at new Promise (<anonymous>)
    at runWithTimeout (file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:2272:10)
    at file://frontend/node_modules/@vitest/runner/dist/chunk-artifact.js:2956:64
```

## com.ceview.module2.ForecastingControllerJwtVariantTest — ensureReportsThatThePipelineRan

```text

expected: {"generatedAt"="2026-10-22T07:00:00Z", "refreshed"=true}
 but was: {"generatedAt"="2026-10-22T07:00Z", "refreshed"=true}
```

## com.ceview.module3.social.publish.SocialPublishingPostgresTest — migrationsValidateAndConcurrentDispatchersClaimDifferentRows

```text

expected: "52"
 but was: "56"
```

## public/landing.spec.ts — @mobile the menu sheet opens, locks scrolling and lists the sections

```text
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Request a Demo' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Request a Demo' })


  228 |     await expect(sheet(page)).toBeVisible();
  229 |     for (const s of SECTIONS) await expect(sheet(page).getByRole('link', { name: s.link })).toBeVisible();
> 230 |     await expect(sheet(page).getByRole('link', { name: 'Request a Demo' })).toBeVisible();
      |                                                                             ^
  231 |     expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  232 |   });
  233 |
    at e2e/tests/public/landing.spec.ts:230:77
```

## social-publishing.spec.ts — requires valid Meta ad budget and attribution link

```text
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


  58 | test('requires valid Meta ad budget and attribution link', async ({ page }) => {
  59 |   const modal = await openComposer(page);
> 60 |   await modal.getByRole('checkbox', { name: /Run as Paid Ad/ }).check();
     |                                                                 ^
  61 |   await expect(modal.getByRole('button', { name: 'Confirm & Publish' })).toBeDisabled();
  62 |   await modal.getByLabel('Daily budget (PHP)').fill('100');
  63 |   await modal.getByLabel('Campaign tracking link').selectOption('00000000-0000-0000-0000-000000000002');
    at e2e/tests/social-publishing.spec.ts:60:65
```

## social-publishing.spec.ts — shows reconnect requirements and disabled unconfigured providers

```text
Error: expect(locator).toBeDisabled() failed

Locator: getByRole('button', { name: 'Connect TikTok', exact: true })
Expected: disabled
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeDisabled" with timeout 10000ms
  - waiting for getByRole('button', { name: 'Connect TikTok', exact: true })


  110 |   await expect(page.getByRole('button', { name: 'Reconnect Facebook', exact: true })).toBeEnabled();
  111 |   await expect(page.getByRole('button', { name: 'Reconnect Instagram', exact: true })).toBeEnabled();
> 112 |   await expect(page.getByRole('button', { name: 'Connect TikTok', exact: true })).toBeDisabled();
      |                                                                                   ^
  113 |   await page.screenshot({ path: testInfo.outputPath('reconnect-required.png'), fullPage: true });
  114 | });
  115 |
    at e2e/tests/social-publishing.spec.ts:112:83
```
