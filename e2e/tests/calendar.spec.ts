import { test } from '@playwright/test';

// Screen: /calendar — docs/module-3/screens/calendar.md
// Cards: docs/superpowers/plans/2026-08-10-ui-ux-overhaul-frontend/04-module-3.md
//
// Does not exercise ceview/old-components/CalendarView.tsx — that component
// is legacy and is not reused by this screen.

test.describe.skip('Month Grid & Navigation', () => {
  test('today is ringed and a post published from Content Studio appears on today\'s cell without a reload', async ({ page }) => {
    test.fixme();
  });

  test('month navigation wraps December -> January correctly', async ({ page }) => {
    test.fixme();
  });
});

test.describe.skip('List View & Day-Click Modal', () => {
  test('clicking a day with zero posts does nothing', async ({ page }) => {
    test.fixme();
  });

  test('clicking a day with posts opens a modal showing reach/likes/engagement for published posts', async ({ page }) => {
    test.fixme();
  });

  test('List view toggle shows a flat reverse-chronological list', async ({ page }) => {
    test.fixme();
  });
});
