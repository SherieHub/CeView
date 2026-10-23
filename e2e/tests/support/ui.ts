import { expect, type Locator, type Page } from '@playwright/test';

/** The shell's shared drawer/modal scrim (layout: `#scrim`, visible when it has class `on`). */
export function scrim(page: Page) {
  return page.locator('#scrim');
}

export async function expectScrimOff(page: Page) {
  await expect(scrim(page)).not.toHaveClass(/\bon\b/);
}

/** A toast with the given text. Toasts (components/shared/Toast.tsx) have no ARIA role and last 2.6 s. */
export function toast(page: Page, text: string | RegExp) {
  return page.locator('div.fixed.bottom-6.right-6').getByText(text);
}

/** Presses Escape and asserts `locator` goes away. */
export async function escapeCloses(page: Page, locator: Locator) {
  await expect(locator).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(locator).toBeHidden();
}

/** Asserts no horizontal page scroll at the current viewport. */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow, 'page scrolls horizontally').toBeLessThanOrEqual(1);
}

/** Counts full document loads, to prove client-side navigation didn't reload the page. */
export async function markDocument(page: Page) {
  await page.evaluate(() => ((window as any).__e2eMark = Math.random()));
  return page.evaluate(() => (window as any).__e2eMark as number);
}

export async function expectSameDocument(page: Page, mark: number) {
  expect(await page.evaluate(() => (window as any).__e2eMark)).toBe(mark);
}
