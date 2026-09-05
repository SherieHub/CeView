/**
 * Every button class a screen names must actually exist in styles/index.css.
 *
 * Content Studio shipped `className="btn btn--primary"` and
 * `className="btn btn--secondary"` on Copy, Approve, Publish and Re-run audit.
 * None of those three classes is defined anywhere — the system's variants are
 * .btn-primary, .btn-cta and .btn-outline (§4 of the brand doc) — so the
 * screen's buttons rendered as bare inline text with a stacked glyph. Nothing
 * failed: not the type-checker (they are strings), not a unit test (the roles
 * and labels were all correct), not the build. It was only visible by looking.
 *
 * This reads the components as text and the stylesheet as text, so a class
 * named but never defined fails here instead of silently rendering unstyled.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { globSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '../..');
const css = readFileSync(resolve(root, 'styles/index.css'), 'utf8');

/** Screen source only — tests and fixtures name no classes. */
const sources = globSync(['components/**/*.tsx', 'layout/**/*.tsx'], { cwd: root })
  .filter((file) => !file.endsWith('.test.tsx'))
  .map((file) => ({ file, text: readFileSync(resolve(root, file), 'utf8') }));

/**
 * Class tokens inside quoted strings only. A JSX comment mentioning a class
 * (this fix left a couple explaining what went wrong) is prose, not markup.
 */
function buttonClassesIn(text: string): string[] {
  const strings = text.match(/(["'`])(?:\\.|(?!\1)[^\\])*\1/g) ?? [];
  return strings
    .flatMap((literal) => literal.slice(1, -1).split(/\s+/))
    .filter((token) => /^[a-z]*-?btn(--?[a-z0-9]+)*$/.test(token) || /^btn(-[a-z0-9]+)*(--[a-z0-9]+)?$/.test(token));
}

describe('button classes', () => {
  it('finds at least one button class to check', () => {
    expect(sources.flatMap(({ text }) => buttonClassesIn(text)).length).toBeGreaterThan(0);
  });

  it('defines every button class the screens name', () => {
    const undefinedUses = sources.flatMap(({ file, text }) =>
      [...new Set(buttonClassesIn(text))]
        .filter((token) => !new RegExp(`\\.${token}(?![\\w-])`).test(css))
        .map((token) => `${file}: .${token}`),
    );

    expect(undefinedUses).toEqual([]);
  });
});
