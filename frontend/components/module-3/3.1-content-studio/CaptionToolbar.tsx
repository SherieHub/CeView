/**
 * The caption editor's toolbar. Each control edits the caption in a way that
 * survives publishing (see captionFormatting.ts): social captions are plain
 * text, so "bold" is Unicode bold letters, lists are line prefixes, and the
 * old alignment button tidies spacing instead — platforms can't align text.
 *
 * Undo/redo keep their own history rather than relying on the browser's: the
 * caption is also changed programmatically (picking an option, formatting),
 * and the native textarea undo stack loses those edits.
 *
 * Shortcuts on the caption field: Ctrl/⌘+B, I, U, Z, and Y or Shift+Z.
 */
import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { AlignJustify, Bold, Italic, Link2, List, ListOrdered, Redo2, Smile, Underline, Undo2 } from 'lucide-react';
import { useDismiss } from '../../shared/useDismiss';
import { applyStyle, insertText, normalizeUrl, tidySpacing, toggleList } from './captionFormatting';
import type { Edit, TextStyle } from './captionFormatting';
import type { StudioPlatformId } from './contentStudioTypes';

const EMOJIS: [string, string][] = [
  ['🌴', 'palm tree'], ['🌊', 'wave'], ['🏝️', 'island'], ['☀️', 'sun'], ['🌅', 'sunrise'], ['🐠', 'tropical fish'],
  ['🐢', 'turtle'], ['🤿', 'diving mask'], ['🚤', 'speedboat'], ['✈️', 'airplane'], ['🧳', 'luggage'], ['📍', 'pin'],
  ['🗺️', 'map'], ['📸', 'camera'], ['🍹', 'tropical drink'], ['🥥', 'coconut'], ['🍽️', 'plate'], ['🏨', 'hotel'],
  ['✨', 'sparkles'], ['❤️', 'red heart'], ['😍', 'heart eyes'], ['🙌', 'raised hands'], ['👉', 'pointing right'], ['✅', 'check mark'],
];

const HISTORY_LIMIT = 100;
/** Keystrokes closer together than this undo as one step. */
const TYPING_MERGE_MS = 800;

interface CaptionToolbarProps {
  value: string;
  onChange: (value: string) => void;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  platform: StudioPlatformId;
  /** Changes when the textarea remounts, so shortcuts re-bind to the new one. */
  fieldKey?: string | number;
}

function useHistory(value: string, onChange: (v: string) => void) {
  const past = useRef<string[]>([]);
  const future = useRef<string[]>([]);
  const last = useRef(value);
  const lastAt = useRef(0);
  const own = useRef(false);
  const step = useRef(false);
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (value === last.current) return;
    if (own.current) {
      own.current = false;
    } else {
      const now = Date.now();
      if (step.current || !past.current.length || now - lastAt.current > TYPING_MERGE_MS) {
        past.current = [...past.current, last.current].slice(-HISTORY_LIMIT);
      }
      // A formatting step stands alone: typing right after it starts a new one.
      lastAt.current = step.current ? 0 : now;
      step.current = false;
      future.current = [];
    }
    last.current = value;
    rerender();
  }, [value]);

  /** Makes the next change its own undo step (formatting, inserts). */
  const checkpoint = useCallback(() => {
    step.current = true;
  }, []);

  const undo = useCallback(() => {
    const prev = past.current.at(-1);
    if (prev === undefined) return;
    past.current = past.current.slice(0, -1);
    future.current = [...future.current, last.current];
    own.current = true;
    lastAt.current = 0;
    onChange(prev);
  }, [onChange]);

  const redo = useCallback(() => {
    const next = future.current.at(-1);
    if (next === undefined) return;
    future.current = future.current.slice(0, -1);
    past.current = [...past.current, last.current];
    own.current = true;
    lastAt.current = 0;
    onChange(next);
  }, [onChange]);

  return { undo, redo, checkpoint, canUndo: past.current.length > 0, canRedo: future.current.length > 0 };
}

export default function CaptionToolbar({ value, onChange, textareaRef, platform, fieldKey }: CaptionToolbarProps) {
  const history = useHistory(value, onChange);
  const [panel, setPanel] = useState<'link' | 'emoji' | null>(null);
  const [url, setUrl] = useState('');
  const [urlError, setUrlError] = useState(false);
  const linkRef = useRef<HTMLDivElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  const linkBtn = useRef<HTMLButtonElement>(null);
  const emojiBtn = useRef<HTMLButtonElement>(null);
  // The selection when a popover opened — focus moves into it, and the
  // insert should still land where the owner's cursor was.
  const saved = useRef<[number, number]>([0, 0]);
  const closePanel = useCallback(() => setPanel(null), []);
  useDismiss(linkRef, panel === 'link', closePanel, linkBtn);
  useDismiss(emojiRef, panel === 'emoji', closePanel, emojiBtn);

  const selection = (): [number, number] => {
    const el = textareaRef.current;
    return el ? [el.selectionStart, el.selectionEnd] : [value.length, value.length];
  };

  /** Applies an edit as one undo step, then puts the cursor/selection back. */
  const commit = (edit: Edit) => {
    if (edit.value === value) return;
    history.checkpoint();
    onChange(edit.value);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(edit.start, edit.end);
    });
  };

  const style = (s: TextStyle) => commit(applyStyle(value, ...selection(), s));
  const list = (kind: 'bullet' | 'number') => commit(toggleList(value, ...selection(), kind));
  const tidy = () => {
    const next = tidySpacing(value);
    commit({ value: next, start: next.length, end: next.length });
  };

  const openPanel = (p: 'link' | 'emoji') => {
    saved.current = selection();
    setUrlError(false);
    setPanel((cur) => (cur === p ? null : p));
  };

  const insert = (text: string) => {
    const [s, e] = saved.current;
    // Keep inserts from fusing with the word before them.
    const pad = s > 0 && /\S/.test(value[s - 1]) ? ' ' : '';
    commit(insertText(value, s, e, pad + text));
    setPanel(null);
  };

  const insertLink = () => {
    const normalized = normalizeUrl(url);
    if (!normalized) {
      setUrlError(true);
      return;
    }
    insert(normalized);
    setUrl('');
  };

  // Shortcuts on the caption field itself.
  const handlers = useRef({ style, undo: history.undo, redo: history.redo });
  handlers.current = { style, undo: history.undo, redo: history.redo };
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    function onKey(e: KeyboardEvent) {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      const k = e.key.toLowerCase();
      const h = handlers.current;
      if (k === 'b' || k === 'i' || k === 'u') {
        e.preventDefault();
        h.style(k === 'b' ? 'bold' : k === 'i' ? 'italic' : 'underline');
      } else if (k === 'z' && !e.shiftKey) {
        e.preventDefault();
        h.undo();
      } else if (k === 'y' || (k === 'z' && e.shiftKey)) {
        e.preventDefault();
        h.redo();
      }
    }
    el.addEventListener('keydown', onKey);
    return () => el.removeEventListener('keydown', onKey);
  }, [textareaRef, fieldKey]);

  // Buttons keep the caption's selection: no focus steal on press.
  const keep = (e: React.MouseEvent) => e.preventDefault();
  const linkNote =
    platform === 'facebook'
      ? 'Facebook turns this into a clickable link.'
      : `${platform === 'instagram' ? 'Instagram' : 'TikTok'} shows caption links as plain text — they aren’t clickable there.`;

  return (
    <div className="caption-toolbar-tools" role="toolbar" aria-label="Caption formatting">
      <button type="button" className="caption-tbtn" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!history.canUndo} onMouseDown={keep} onClick={history.undo}>
        <Undo2 size={14} aria-hidden="true" />
      </button>
      <button type="button" className="caption-tbtn" aria-label="Redo" title="Redo (Ctrl+Y)" disabled={!history.canRedo} onMouseDown={keep} onClick={history.redo}>
        <Redo2 size={14} aria-hidden="true" />
      </button>
      <span className="caption-tsep" aria-hidden="true" />
      <button type="button" className="caption-tbtn" aria-label="Bold" title="Bold (Ctrl+B)" onMouseDown={keep} onClick={() => style('bold')}>
        <Bold size={14} aria-hidden="true" />
      </button>
      <button type="button" className="caption-tbtn" aria-label="Italic" title="Italic (Ctrl+I)" onMouseDown={keep} onClick={() => style('italic')}>
        <Italic size={14} aria-hidden="true" />
      </button>
      <button type="button" className="caption-tbtn" aria-label="Underline" title="Underline (Ctrl+U)" onMouseDown={keep} onClick={() => style('underline')}>
        <Underline size={14} aria-hidden="true" />
      </button>
      <span className="caption-tsep" aria-hidden="true" />
      <button type="button" className="caption-tbtn" aria-label="Bullet list" title="Bullet list" onMouseDown={keep} onClick={() => list('bullet')}>
        <List size={14} aria-hidden="true" />
      </button>
      <button type="button" className="caption-tbtn" aria-label="Numbered list" title="Numbered list" onMouseDown={keep} onClick={() => list('number')}>
        <ListOrdered size={14} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="caption-tbtn"
        aria-label="Tidy spacing"
        title="Tidy spacing — removes extra blank lines and trailing spaces"
        onMouseDown={keep}
        onClick={tidy}
      >
        <AlignJustify size={14} aria-hidden="true" />
      </button>
      <span className="caption-tsep" aria-hidden="true" />

      <div className="caption-pop-wrap" ref={linkRef}>
        <button
          ref={linkBtn}
          type="button"
          className="caption-tbtn"
          aria-label="Insert link"
          title="Insert link"
          aria-expanded={panel === 'link'}
          aria-haspopup="dialog"
          onMouseDown={keep}
          onClick={() => openPanel('link')}
        >
          <Link2 size={14} aria-hidden="true" />
        </button>
        {panel === 'link' && (
          <div className="caption-pop caption-pop--link" role="dialog" aria-label="Insert link">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                insertLink();
              }}
            >
              <label className="caption-pop-label" htmlFor="caption-link-url">Link address</label>
              <div className="caption-pop-row">
                <input
                  id="caption-link-url"
                  className="caption-pop-input"
                  type="text"
                  inputMode="url"
                  autoFocus
                  value={url}
                  placeholder="yourwebsite.com/booking"
                  aria-invalid={urlError || undefined}
                  aria-describedby="caption-link-note"
                  onChange={(e) => {
                    setUrl(e.target.value);
                    setUrlError(false);
                  }}
                />
                <button type="submit" className="caption-pop-btn">Insert</button>
              </div>
              <p id="caption-link-note" className="caption-pop-note" data-error={urlError || undefined}>
                {urlError ? 'Enter a web address, like yourwebsite.com.' : linkNote}
              </p>
            </form>
          </div>
        )}
      </div>

      <div className="caption-pop-wrap" ref={emojiRef}>
        <button
          ref={emojiBtn}
          type="button"
          className="caption-tbtn"
          aria-label="Insert emoji"
          title="Insert emoji"
          aria-expanded={panel === 'emoji'}
          aria-haspopup="dialog"
          onMouseDown={keep}
          onClick={() => openPanel('emoji')}
        >
          <Smile size={14} aria-hidden="true" />
        </button>
        {panel === 'emoji' && (
          <div className="caption-pop caption-pop--emoji" role="dialog" aria-label="Insert emoji">
            <div className="caption-emoji-grid">
              {EMOJIS.map(([emoji, name], i) => (
                <button
                  key={emoji}
                  type="button"
                  className="caption-emoji"
                  aria-label={name}
                  title={name}
                  autoFocus={i === 0}
                  onClick={() => insert(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
