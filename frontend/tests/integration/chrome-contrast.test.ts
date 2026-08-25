/**
 * Contrast contract for the chrome surface — the dark teal rail shared by the
 * onboarding wizard (.ob-rail) and the app sidebar (.sb-rail).
 *
 * Why this exists as its own test rather than more rows in brand-tokens.test.ts:
 * that file pins tokens to literal hex values, which catches an accidental edit
 * but says nothing about whether the resulting combination is *readable*. The
 * chrome ramp's ceiling is set by a composite (an active row paints
 * --chrome-raised over the light stop), so the constraint is arithmetic, not a
 * value. Pinning the arithmetic means someone can retune the ramp freely and
 * still be told the moment it stops clearing AA.
 *
 * This caught a real failure: at the original #157F94, white on an active row
 * was 3.61:1.
 *
 * Parses styles/index.css as text — no DOM, no Tailwind build — matching
 * brand-tokens.test.ts.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../styles/index.css'), 'utf8');

function declaredValue(name: string): string {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  if (!match) throw new Error(`${name} is not declared in styles/index.css`);
  return match[1].trim();
}

/** sRGB relative luminance, per WCAG 2.1 §relative-luminance. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** Flatten `fg` at `alpha` over opaque `bg` — what a translucent overlay yields. */
function composite(fg: string, bg: string, alpha: number): string {
  const channel = (hex: string, i: number) => parseInt(hex.slice(i, i + 2), 16);
  return (
    '#' +
    [1, 3, 5]
      .map((i) =>
        Math.round(channel(fg, i) * alpha + channel(bg, i) * (1 - alpha))
          .toString(16)
          .padStart(2, '0'),
      )
      .join('')
  );
}

/** `rgba(255, 255, 255, 0.15)` -> 0.15 */
function alphaOf(rgba: string): number {
  const match = rgba.match(/rgba\([^)]*,\s*([\d.]+)\s*\)/);
  if (!match) throw new Error(`could not read an alpha out of "${rgba}"`);
  return Number(match[1]);
}

const chromeLight = declaredValue('--color-chrome-light');
const chromeDeep = declaredValue('--color-chrome-deep');
const inverse = declaredValue('--color-text-inverse');
const inverseMuted = declaredValue('--color-text-inverse-muted');
const mint = declaredValue('--color-mint-primary');
const raisedAlpha = alphaOf(declaredValue('--chrome-raised'));

/** The lightest surface a rail label can land on: the gradient's light stop
 *  with an active row's --chrome-raised painted over it. */
const activeRow = composite(inverse, chromeLight, raisedAlpha);

describe('chrome surface contrast', () => {
  describe('on the bare gradient', () => {
    it('puts white text at AA or better on the light stop', () => {
      expect(contrast(inverse, chromeLight)).toBeGreaterThanOrEqual(4.5);
    });

    it('puts white text at AA or better on the deep stop', () => {
      expect(contrast(inverse, chromeDeep)).toBeGreaterThanOrEqual(4.5);
    });

    // --color-text-inverse-muted carries the 15px rail subtitles (.ob-step span,
    // .sb-head .text-meta), which are normal-size text and get no large-text
    // exemption.
    it('puts muted inverse text at AA or better on the light stop', () => {
      expect(contrast(inverseMuted, chromeLight)).toBeGreaterThanOrEqual(4.5);
    });
  });

  describe('on an active row (--chrome-raised over the light stop)', () => {
    // The case that failed before the ramp was darkened. The active nav item and
    // the current wizard step are the highest-traffic labels in the app.
    it('puts white text at AA or better', () => {
      expect(contrast(inverse, activeRow)).toBeGreaterThanOrEqual(4.5);
    });

    // Guards the usage rule documented on --color-text-inverse-muted: muted
    // inverse must NOT be used here. If this ever starts passing, the rule can
    // be relaxed — until then, active rows use --color-text-inverse.
    it('is still too light for muted inverse text, so the usage rule stands', () => {
      expect(contrast(inverseMuted, activeRow)).toBeLessThan(4.5);
    });
  });

  describe('non-text indicators', () => {
    // The 3px left border marking the active row / current step. Non-text UI
    // components need 3:1, not 4.5:1 (WCAG 1.4.11).
    it('puts the mint accent border above the 3:1 floor on the light stop', () => {
      expect(contrast(mint, chromeLight)).toBeGreaterThanOrEqual(3);
    });
  });
});
