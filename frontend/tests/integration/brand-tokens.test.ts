/**
 * Contract test for the tourism-app-branding skill's palette (SKILL.md §1, §2, §5).
 * Parses styles/index.css as text — no DOM, no Tailwind build — so it stays fast
 * and fails loudly if an off-palette token is reintroduced.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(resolve(here, '../../styles/index.css'), 'utf8');

const REQUIRED_COLORS: Record<string, string> = {
  '--color-navy-primary': '#1B3A5C',
  '--color-navy-dark': '#16304D',
  '--color-mint-primary': '#5FD6A6',
  '--color-mint-light': '#7FE0B8',
  '--color-mint-pale': '#E4F6EF',
  '--color-mint-pale-alt': '#EFFAF5',
  '--color-cyan-accent': '#2ED9DA',
  '--color-teal-accent': '#3CBDB1',
  '--color-coral-cta': '#FF8C69',
  '--color-coral-cta-hover': '#FF7550',
  '--color-sand': '#FFB88C',
  '--color-white': '#FFFFFF',
  '--color-off-white': '#F7F9FA',
  '--color-gray-text': '#6B7B8C',
  '--color-gray-light': '#C9D6DE',
  '--color-text-heading': '#1B3A5C',
  '--color-text-body': '#5A6B7A',
  '--color-text-inverse': '#FFFFFF',
  '--color-text-accent': '#5FD6A6',
  '--color-text-muted': '#8A97A3',
};

const REQUIRED_GEOMETRY: Record<string, string> = {
  '--radius-sm': '8px',
  '--radius-md': '16px',
  '--radius-pill': '24px',
  // The skill's named spacing lives in --space-*, NOT Tailwind's --spacing-*
  // namespace — names like sm/md/xl in there redefine the built-in max-w-*,
  // h-*, w-* utilities. See the comment on @theme in styles/index.css.
  '--space-xs': '8px',
  '--space-sm': '16px',
  '--space-md': '24px',
  '--space-lg': '48px',
  '--space-xl': '80px',
};

function declaredValue(name: string): string | undefined {
  const match = css.match(new RegExp(`${name}\\s*:\\s*([^;]+);`));
  return match?.[1].trim();
}

describe('brand tokens', () => {
  it.each(Object.entries(REQUIRED_COLORS))('declares %s as %s', (name, hex) => {
    expect(declaredValue(name)?.toUpperCase()).toBe(hex.toUpperCase());
  });

  it.each(Object.entries(REQUIRED_GEOMETRY))('declares %s as %s', (name, value) => {
    expect(declaredValue(name)).toBe(value);
  });

  it('declares the two brand font families and no third', () => {
    expect(declaredValue('--font-heading')).toMatch(/Poppins/);
    expect(declaredValue('--font-body')).toMatch(/Inter/);
    expect(css).not.toMatch(/JetBrains Mono/);
    expect(css).not.toMatch(/Plus Jakarta Sans/);
  });

  // Regression guard: a --spacing-<word> token (as opposed to --spacing-<number>)
  // redefines Tailwind's built-in utility of that name. --spacing-sm: 16px made
  // max-w-sm mean 16px instead of 24rem and collapsed the login form to a
  // ~90px column; --spacing-xl gave h-xl a height that overrode .heading-xl.
  it('keeps the Tailwind --spacing-* namespace numeric-only', () => {
    const named = [...css.matchAll(/--spacing-([a-z]+)\s*:/g)].map((m) => m[1]);
    expect(named).toEqual([]);
  });

  it('declares the two card shadows', () => {
    expect(declaredValue('--shadow-card')).toBe('0 4px 20px rgba(27, 58, 92, 0.08)');
    expect(declaredValue('--shadow-card-hover')).toBe('0 8px 28px rgba(27, 58, 92, 0.14)');
  });
});
