import { describe, expect, it } from 'vitest';
import { applyStyle, insertText, normalizeUrl, tidySpacing, toggleList, toggleStyle } from './captionFormatting';

describe('toggleStyle', () => {
  it('bolds letters and digits with Unicode sans-serif bold, leaving the rest', () => {
    expect(toggleStyle('Dive 2026!', 'bold')).toBe('𝗗𝗶𝘃𝗲 𝟮𝟬𝟮𝟲!');
  });

  it('toggles back off when everything is already bold', () => {
    expect(toggleStyle('𝗗𝗶𝘃𝗲', 'bold')).toBe('Dive');
  });

  it('combines bold and italic, and removes one without the other', () => {
    const both = toggleStyle(toggleStyle('Cebu', 'bold'), 'italic');
    expect(both).toBe('𝘾𝙚𝙗𝙪');
    expect(toggleStyle(both, 'bold')).toBe('𝘊𝘦𝘣𝘶');
  });

  it('underlines every visible character with a combining low line', () => {
    expect(toggleStyle('go now', 'underline')).toBe('g̲o̲ n̲o̲w̲');
    expect(toggleStyle('g̲o̲ n̲o̲w̲', 'underline')).toBe('go now');
  });

  it('leaves non-Latin text untouched', () => {
    expect(toggleStyle('세부 여행', 'bold')).toBe('세부 여행');
  });
});

describe('applyStyle', () => {
  it('styles the selection only', () => {
    expect(applyStyle('Visit Cebu now', 6, 10, 'bold')).toEqual({ value: 'Visit 𝗖𝗲𝗯𝘂 now', start: 6, end: 14 });
  });

  it('with no selection, styles the word around the cursor', () => {
    expect(applyStyle('Visit Cebu now', 8, 8, 'italic').value).toBe('Visit 𝘊𝘦𝘣𝘶 now');
  });
});

describe('toggleList', () => {
  const text = 'Intro\nSnorkel\nDive\nStay';

  it('bullets every line the selection touches, skipping blanks', () => {
    expect(toggleList(text, 7, 15, 'bullet').value).toBe('Intro\n• Snorkel\n• Dive\nStay');
    expect(toggleList('a\n\nb', 0, 4, 'bullet').value).toBe('• a\n\n• b');
  });

  it('numbers lines, and swaps bullets for numbers', () => {
    expect(toggleList('• a\n• b', 0, 7, 'number').value).toBe('1. a\n2. b');
  });

  it('removes the list when every line already has it', () => {
    expect(toggleList('1. a\n2. b', 0, 9, 'number').value).toBe('a\nb');
  });

  it('works on the cursor line with nothing selected', () => {
    expect(toggleList(text, 0, 0, 'bullet').value).toBe('• Intro\nSnorkel\nDive\nStay');
  });
});

describe('tidySpacing', () => {
  it('drops trailing spaces, extra blank lines and blank edges', () => {
    expect(tidySpacing('\n Hello   \n\n\n\nWorld  \n')).toBe('Hello\n\nWorld');
  });
});

describe('insertText', () => {
  it('replaces the selection and puts the cursor after the insert', () => {
    expect(insertText('Hi there', 3, 8, '🌴')).toEqual({ value: 'Hi 🌴', start: 5, end: 5 });
  });
});

describe('normalizeUrl', () => {
  it('accepts bare domains and full addresses', () => {
    expect(normalizeUrl('sunsetcove.ph')).toBe('https://sunsetcove.ph');
    expect(normalizeUrl('https://sunsetcove.ph/kr')).toBe('https://sunsetcove.ph/kr');
  });

  it('rejects things that are not web addresses', () => {
    expect(normalizeUrl('')).toBeNull();
    expect(normalizeUrl('not a link')).toBeNull();
    expect(normalizeUrl('localhost')).toBeNull();
  });
});
