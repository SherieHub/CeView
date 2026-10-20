/**
 * Which captions get the "Show English" toggle, and which language an edited
 * English caption should be rewritten into.
 *
 * Decided from the text itself, not the target market, so it also covers edited
 * captions and already-published posts. English (or any Latin-script) text gets
 * no toggle.
 */
import type { CaptionLanguage } from '../../../types';

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힯]/u;
const KANA = /[぀-ヿㇰ-ㇿｦ-ﾟ]/u;
const HAN = /[㐀-䶿一-鿿]/u;

export function hasNonEnglishScript(text: string): boolean {
  return HANGUL.test(text) || KANA.test(text) || HAN.test(text);
}

/**
 * The language to localise back into. Hangul → Korean; kana or Han → Japanese
 * (CeView's markets are Korea, Japan and the USA, so Han-only text is Japanese).
 * Null for text with no such script.
 */
export function nativeLanguageOf(text: string): CaptionLanguage | null {
  if (HANGUL.test(text)) return 'ko';
  if (KANA.test(text) || HAN.test(text)) return 'ja';
  return null;
}

export const LANGUAGE_LABEL: Record<CaptionLanguage, string> = { ko: 'Korean', ja: 'Japanese' };
