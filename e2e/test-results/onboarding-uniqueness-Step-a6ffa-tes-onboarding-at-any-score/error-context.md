# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: onboarding-uniqueness.spec.ts >> Step 5 Analysis >> discloses a real cohort and completes onboarding at any score
- Location: tests\onboarding-uniqueness.spec.ts:58:3

# Error details

```
Test timeout of 180000ms exceeded.
```

```
Error: locator.click: Test timeout of 180000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: 'Compute uniqueness score' })

```

# Page snapshot

```yaml
- generic [ref=e3]:
  - complementary [ref=e4]:
    - generic [ref=e5]:
      - img "CeView Logo" [ref=e6]
      - generic [ref=e7]:
        - generic [ref=e8]: CeView
        - text: Set up your profile
    - paragraph [ref=e9]: Required steps
    - list "Onboarding progress" [ref=e10]:
      - listitem [ref=e11]:
        - generic [ref=e15]:
          - generic [ref=e16]: Basic Info
          - generic [ref=e17]: Name, industry, slogan
      - listitem [ref=e18]:
        - generic [ref=e22]:
          - generic [ref=e23]: Brand Identity
          - generic [ref=e24]: Vibe and core services
      - listitem [ref=e25]:
        - generic [ref=e29]:
          - generic [ref=e30]: Structured Inputs
          - generic [ref=e31]: Description and UVP
      - listitem [ref=e32]:
        - generic [ref=e36]:
          - generic [ref=e37]: Assets & Links
          - generic [ref=e38]: Socials, logo, website
      - listitem [ref=e39]:
        - generic [ref=e40]: "5"
        - generic [ref=e41]:
          - generic [ref=e42]: Analysis
          - generic [ref=e43]: Categories and uniqueness
    - generic [ref=e44]: Every field feeds the AI. Complete answers produce sharper forecasts and better captions.
  - main [ref=e48]:
    - generic [ref=e52]:
      - paragraph [ref=e53]: Step 5 — Required
      - heading "Categories and uniqueness" [level=2] [ref=e54]
      - alert [ref=e55]:
        - heading "huggingface_space is unavailable" [level=3] [ref=e60]
        - paragraph [ref=e61]: Business analysis
        - paragraph [ref=e62]: This screen needs a dependency that is not answering. Nothing below is simulated — the data is simply not available.
        - generic [ref=e63]:
          - generic [ref=e64]:
            - term [ref=e65]: Request
            - definition [ref=e66]: POST /api/classification/analyze
          - generic [ref=e67]:
            - term [ref=e68]: Status
            - definition [ref=e69]: 503 · MOD1_HF_SPACE_UNAVAILABLE
          - generic [ref=e70]:
            - term [ref=e71]: Message
            - definition [ref=e72]: Business classification is unavailable.
          - generic [ref=e73]:
            - term [ref=e74]: Cause
            - definition [ref=e75]: "AppError: You have exceeded your ZeroGPU runs limit. Subscribe to Hugging Face PRO to get 40 min of ZeroGPU quota a day - https://huggingface.co/subscribe/pro?from=ZeroGPU"
          - generic [ref=e76]:
            - term [ref=e77]: Stage
            - definition [ref=e78]: fastapi-sbert/classification -> spring/classification/analyze
    - generic [ref=e79]:
      - button "Back" [ref=e80] [cursor=pointer]
      - generic [ref=e83]:
        - generic [ref=e84]: Step 5 of 5
        - button "Finish" [disabled] [ref=e85]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { requireBackend } from './support/stack';
  3   | 
  4   | test.describe('Step 5 Analysis', () => {
  5   |   test.beforeEach(async () => {
  6   |     await requireBackend();
  7   |   });
  8   | 
  9   |   function freshEmail() {
  10  |     return `e2e-uniqueness-${Date.now()}-${Math.floor(Math.random() * 1e6)}@ceview.local`;
  11  |   }
  12  | 
  13  |   async function registerAndReachStepFive(page: any) {
  14  |     await page.goto('/');
  15  |     await page.getByRole('tab', { name: 'Create account' }).click();
  16  |     await page.getByLabel('First name').fill('E2E');
  17  |     await page.getByLabel('Last name').fill('Tester');
  18  |     await page.getByLabel('Contact number').fill('+63 917 000 0000');
  19  |     await page.getByPlaceholder('you@example.com').fill(freshEmail());
  20  |     await page.getByPlaceholder('••••••••').fill('MoalboalDive2024!');
  21  |     await page.getByRole('button', { name: 'Create account' }).click();
  22  | 
  23  |     await expect(page).toHaveURL(/\/onboarding$/, { timeout: 30_000 });
  24  | 
  25  |     await page.getByPlaceholder('e.g. Sunset Cove Beach Resort').fill('E2E Reef Expeditions');
  26  |     await page.locator('select').selectOption('Adventure & Nature');
  27  |     await page.getByPlaceholder('One line that captures what you offer').fill('Dive the wall at dawn.');
  28  |     await page.getByRole('button', { name: 'Continue' }).click();
  29  | 
  30  |     await page.getByRole('button', { name: 'Adventurous' }).click();
  31  |     await page.getByRole('button', { name: 'Eco-Conscious' }).click();
  32  |     const service = page.getByPlaceholder('Type a service and press Enter…');
  33  |     await service.fill('Guided reef dives');
  34  |     await service.press('Enter');
  35  |     await page.getByRole('button', { name: 'Continue' }).click();
  36  | 
  37  |     await page
  38  |       .getByPlaceholder('What is the property, where exactly is it, what does a guest actually experience?')
  39  |       .fill(
  40  |         'A small freediving and snorkelling outfit on the Moalboal shoreline in Cebu, running two '
  41  |         + 'daily boat trips out to the resident sardine ball and the turtle sanctuary just south of '
  42  |         + 'Panagsama Beach. Groups are capped at six guests so every diver gets individual attention '
  43  |         + 'from an instructor, and every booking includes full gear rental, a shore briefing, and an '
  44  |         + 'underwater photo review back at the shop afterwards over coffee.',
  45  |       );
  46  |     await page
  47  |       .getByPlaceholder('What can a guest get here that they genuinely cannot get from the business next door?')
  48  |       .fill(
  49  |         'We are the only operator on this stretch of coast that logs the sardine ball position every '
  50  |         + 'morning before any group leaves the shore, so guests are taken to where the shoal actually '
  51  |         + 'is that day rather than to where it usually sits.',
  52  |       );
  53  |     await page.getByRole('button', { name: 'Continue' }).click();
  54  |     await page.getByRole('button', { name: 'Continue' }).click();
  55  |     await expect(page.getByRole('heading', { name: 'Categories and uniqueness' })).toBeVisible();
  56  |   }
  57  | 
  58  |   test('discloses a real cohort and completes onboarding at any score', async ({ page }) => {
  59  |     test.setTimeout(180_000);
  60  |     await registerAndReachStepFive(page);
> 61  |     await page.getByRole('button', { name: 'Compute uniqueness score' }).click();
      |                                                                          ^ Error: locator.click: Test timeout of 180000ms exceeded.
  62  | 
  63  |     const primary = page.getByTestId('score-primary');
  64  |     const cohort = page.getByTestId('cohort-context');
  65  |     await expect(primary.or(cohort).first()).toBeVisible({ timeout: 90_000 });
  66  | 
  67  |     await expect(cohort).toContainText(/\d+\s+\S+.*business/i);
  68  |     await expect(cohort).not.toContainText('undefined');
  69  |     await expect(cohort).not.toContainText('NaN');
  70  | 
  71  |     await expect(page.getByRole('button', { name: 'Finish' })).toBeEnabled();
  72  |   });
  73  | 
  74  |   test('a materially more specific UVP moves the score', async ({ page }) => {
  75  |     test.setTimeout(240_000);
  76  |     await registerAndReachStepFive(page);
  77  |     await page.getByRole('button', { name: 'Compute uniqueness score' }).click();
  78  | 
  79  |     const primary = page.getByTestId('score-primary');
  80  |     await expect(primary).toBeVisible({ timeout: 90_000 });
  81  |     const before = await primary.innerText();
  82  | 
  83  |     await page.getByRole('button', { name: 'Back' }).click();
  84  |     await page.getByRole('button', { name: 'Back' }).click();
  85  | 
  86  |     await page
  87  |       .getByPlaceholder('What can a guest get here that they genuinely cannot get from the business next door?')
  88  |       .fill(
  89  |         'We are the only PADI five-star centre in Moalboal with a resident marine biologist on staff, '
  90  |         + 'running dawn sardine-run dives from a private shore entry thirty metres from the reef wall, '
  91  |         + 'with every dive logged against a twelve-year record of shoal movement along this coast.',
  92  |       );
  93  | 
  94  |     await page.getByRole('button', { name: 'Continue' }).click();
  95  |     await page.getByRole('button', { name: 'Continue' }).click();
  96  | 
  97  |     await page.getByRole('button', { name: /Recompute score|Compute uniqueness score/ }).click();
  98  |     await expect(primary).toBeVisible({ timeout: 90_000 });
  99  |     await expect(primary).not.toHaveText(before);
  100 |   });
  101 | });
  102 | 
```