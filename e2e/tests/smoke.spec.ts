import { test, expect } from '@playwright/test';

// Full-stack smoke test — exercises frontend -> Spring Boot -> FastAPI wiring
// end to end against the real docker-compose stack (see RUNNING.md / the CI
// e2e workflow). Pattern to copy: navigate, wait for a real UI element that
// only appears once data has loaded, and assert no server error banner shows.
test('homepage loads, sidebar renders, and Campaign Analytics tab navigates without a server error', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /CeView/i })).toBeVisible();

  const campaignAnalyticsTab = page.getByRole('button', { name: 'Campaign Analytics' });
  await expect(campaignAnalyticsTab).toBeVisible();
  await campaignAnalyticsTab.click();

  // Dismiss button only renders inside ServerErrorBanner — its absence means
  // no backend call surfaced a fatal error on this tab.
  await expect(page.getByRole('button', { name: 'Dismiss' })).toHaveCount(0);
});
