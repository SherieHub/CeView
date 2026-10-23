import { expect, type Locator } from '@playwright/test';

/** Same script tests as frontend/components/module-3/3.1-content-studio/captionLanguage.ts. */
const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/;
const KANA = /[぀-ゟ゠-ヿ]/;
const HAN = /[一-鿿]/;

export type Script = 'ko' | 'ja' | 'en';

/** Market id → the script its captions must be written in. */
export const MARKET_SCRIPT: Record<string, Script> = { korea: 'ko', japan: 'ja', usa: 'en' };

export function expectScript(text: string, script: Script) {
  expect(text.trim().length, 'AI text is empty').toBeGreaterThan(0);
  if (script === 'ko') expect(text, 'expected Hangul').toMatch(HANGUL);
  if (script === 'ja') expect(KANA.test(text) || HAN.test(text), `expected kana/Han in: ${text.slice(0, 80)}`).toBe(true);
  if (script === 'en') {
    expect(text, 'expected no Hangul').not.toMatch(HANGUL);
    expect(text, 'expected no kana').not.toMatch(KANA);
  }
}

/** Fails on the tell-tale strings of a broken render. */
export async function expectNoJunk(locator: Locator) {
  const text = await locator.innerText();
  expect(text).not.toMatch(/\bNaN\b/);
  expect(text).not.toMatch(/\bundefined\b/);
  expect(text).not.toMatch(/\[object Object\]/);
}

export function expectInRange(value: number, min: number, max: number, what = 'value') {
  expect(Number.isFinite(value), `${what} is not a finite number`).toBe(true);
  expect(value, `${what} below ${min}`).toBeGreaterThanOrEqual(min);
  expect(value, `${what} above ${max}`).toBeLessThanOrEqual(max);
}

/** First number in a locator's text, e.g. "Score 74 / 100" → 74. */
export async function numberIn(locator: Locator): Promise<number> {
  const text = await locator.innerText();
  const m = text.replace(/,/g, '').match(/-?\d+(\.\d+)?/);
  if (!m) throw new Error(`no number in "${text}"`);
  return Number(m[0]);
}
