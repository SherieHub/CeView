/**
 * Caption formatting that survives publishing.
 *
 * Instagram, TikTok and Facebook captions are plain text — no markdown, no
 * HTML. So bold and italic use the Unicode "Mathematical Sans-Serif" letters
 * (the approach social scheduling tools use), underline uses the combining low
 * line (U+0332), and lists are line prefixes. What the owner sees in the
 * editor is exactly what the platform will show.
 *
 * Every function is pure: (text, selection) in, (text, selection) out.
 */

export interface Edit {
  value: string;
  start: number;
  end: number;
}

export type TextStyle = 'bold' | 'italic' | 'underline';

const UNDERLINE = 0x332;

// Sans-serif alphabets: [upper A, lower a, digit 0 (or null)].
const ALPHABETS = {
  bold: [0x1d5d4, 0x1d5ee, 0x1d7ec],
  italic: [0x1d608, 0x1d622, null],
  boldItalic: [0x1d63c, 0x1d656, 0x1d7ec],
} as const;

interface Unit {
  base: string;
  bold: boolean;
  italic: boolean;
  underline: boolean;
}

function decode(cp: number): { base: string; bold: boolean; italic: boolean } | null {
  for (const [key, [upper, lower, digit]] of Object.entries(ALPHABETS)) {
    const bold = key !== 'italic';
    const italic = key !== 'bold';
    if (cp >= upper && cp < upper + 26) return { base: String.fromCharCode(65 + cp - upper), bold, italic };
    if (cp >= lower && cp < lower + 26) return { base: String.fromCharCode(97 + cp - lower), bold, italic };
    // Bold and bold-italic share the bold digits; read them as bold only.
    if (digit != null && key === 'bold' && cp >= digit && cp < digit + 10) {
      return { base: String.fromCharCode(48 + cp - digit), bold: true, italic: false };
    }
  }
  return null;
}

function parse(text: string): Unit[] {
  const units: Unit[] = [];
  for (const ch of Array.from(text)) {
    const cp = ch.codePointAt(0) as number;
    if (cp === UNDERLINE && units.length) {
      units[units.length - 1].underline = true;
      continue;
    }
    const styled = decode(cp);
    units.push(styled ? { ...styled, underline: false } : { base: ch, bold: false, italic: false, underline: false });
  }
  return units;
}

function encode(u: Unit): string {
  let out = u.base;
  const code = u.base.charCodeAt(0);
  const isUpper = code >= 65 && code <= 90;
  const isLower = code >= 97 && code <= 122;
  const isDigit = code >= 48 && code <= 57;
  if (u.bold || u.italic) {
    const [upper, lower, digit] = ALPHABETS[u.bold && u.italic ? 'boldItalic' : u.bold ? 'bold' : 'italic'];
    if (isUpper) out = String.fromCodePoint(upper + code - 65);
    else if (isLower) out = String.fromCodePoint(lower + code - 97);
    else if (isDigit && digit != null) out = String.fromCodePoint(digit + code - 48);
  }
  return u.underline ? out + String.fromCharCode(UNDERLINE) : out;
}

const isAlnum = (s: string) => /^[A-Za-z0-9]$/.test(s);
const canTake = (u: Unit, style: TextStyle) =>
  style === 'underline' ? /\S/.test(u.base) : style === 'italic' ? /^[A-Za-z]$/.test(u.base) : isAlnum(u.base);

/** Toggles a style on a run of text: on unless every eligible character already has it. */
export function toggleStyle(text: string, style: TextStyle): string {
  const units = parse(text);
  const eligible = units.filter((u) => canTake(u, style));
  if (!eligible.length) return text;
  const on = !eligible.every((u) => u[style]);
  return units.map((u) => encode(canTake(u, style) ? { ...u, [style]: on } : u)).join('');
}

/** The selection, or — with nothing selected — the word around the cursor. */
function target(value: string, start: number, end: number): [number, number] {
  if (start !== end) return [start, end];
  let s = start;
  let e = end;
  while (s > 0 && /\S/.test(value[s - 1])) s -= 1;
  while (e < value.length && /\S/.test(value[e])) e += 1;
  return [s, e];
}

export function applyStyle(value: string, start: number, end: number, style: TextStyle): Edit {
  const [s, e] = target(value, start, end);
  if (s === e) return { value, start, end };
  const styled = toggleStyle(value.slice(s, e), style);
  return { value: value.slice(0, s) + styled + value.slice(e), start: s, end: s + styled.length };
}

const BULLET = '• ';
const NUMBERED = /^\d+\.\s/;

/** Turns the lines the selection touches into a bulleted or numbered list — or back. */
export function toggleList(value: string, start: number, end: number, kind: 'bullet' | 'number'): Edit {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const stop = end > start && value[end - 1] === '\n' ? end - 1 : end;
  const nl = value.indexOf('\n', stop);
  const to = nl === -1 ? value.length : nl;
  const lines = value.slice(from, to).split('\n');
  const filled = lines.filter((l) => l.trim());
  const has = (l: string) => (kind === 'bullet' ? l.startsWith(BULLET) : NUMBERED.test(l));
  const strip = (l: string) => l.replace(NUMBERED, '').replace(/^• /, '');
  const remove = filled.length > 0 && filled.every(has);
  let n = 0;
  const next = lines
    .map((l) => {
      if (!l.trim()) return l;
      if (remove) return strip(l);
      n += 1;
      return (kind === 'bullet' ? BULLET : `${n}. `) + strip(l);
    })
    .join('\n');
  return { value: value.slice(0, from) + next + value.slice(to), start: from, end: from + next.length };
}

/** Trailing spaces off every line, at most one blank line in a row, no blank edges. */
export function tidySpacing(value: string): string {
  return value
    .split('\n')
    .map((l) => l.replace(/[ \t]+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Inserts text at the selection, replacing it, with the cursor after the insert. */
export function insertText(value: string, start: number, end: number, text: string): Edit {
  const at = start + text.length;
  return { value: value.slice(0, start) + text + value.slice(end), start: at, end: at };
}

/** Accepts "example.com" or a full address; null for anything that isn't a web address. */
export function normalizeUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw || /\s/.test(raw)) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
    return url.hostname.includes('.') ? url.toString().replace(/\/$/, raw.endsWith('/') ? '/' : '') : null;
  } catch {
    return null;
  }
}
