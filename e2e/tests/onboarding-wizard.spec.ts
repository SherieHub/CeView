import { test } from '@playwright/test';

// Screen: /onboarding — docs/module-1/screens/onboarding-wizard.md
// Cards: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/02-module-1.md
//
// One test.describe per card. Each starts skipped; the card that owns it
// un-skips (and writes) its block as part of that card's own Definition of
// Done — this file is not expected to be fully green until every card for
// this screen has landed. Pattern to copy for assertions once un-skipped:
// e2e/tests/login.spec.ts.

test.describe.skip('Wizard Shell & Step 1 Basic Info', () => {
  test('Continue is disabled until business name and industry are filled', async ({ page }) => {
    test.fixme();
  });

  test('side rail shows step 1 as current, steps 2-5 as pending', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Step 2 Brand Identity', () => {
  test('Continue is blocked until at least one vibe and one core service are set', async ({ page }) => {
    test.fixme();
  });

  test('typing a service and pressing Enter adds it as a removable tag', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Step 3 Structured Inputs', () => {
  test('description and UVP word counts gate Continue independently at 50 and 30 words', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Step 4 Assets & Links', () => {
  test('Continue is enabled with every field empty (all optional)', async ({ page }) => {
    test.fixme();
  });

  test('picking a logo file shows an inline preview', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('Step 5 Analysis', () => {
  test('completing analysis and compute reveals three score cards', async ({ page }) => {
    test.fixme();
  });

  test('deselecting the last remaining category is blocked with a toast, not silently prevented', async ({ page }) => {
    test.fixme();
  });

  test('full journey: register -> complete all 5 steps -> lands on /dashboard with the new profile visible', async ({ page }) => {
    test.fixme();
  });
});
