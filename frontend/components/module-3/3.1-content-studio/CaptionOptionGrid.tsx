/**
 * The AI caption options, for comparison at a glance.
 *
 * These cards are no longer editable. The old design gave every option its own
 * textarea, which meant three drafts could diverge silently and only one of
 * them ever reached the composer. Selection is now the card's whole job; the
 * staged caption is the single editable copy.
 *
 * Select carries .btn-cta — the deep teal the dashboard's "Target this market"
 * uses — because choosing an option is the same kind of commitment: it is the
 * one forward action in this row, and the operator arrives here to make it.
 *
 * Reading the full text expands that option over the cards' own area — not a
 * modal, so the rest of the page stays visible and undimmed. The expanded
 * view scrolls on its own; a click anywhere (or Escape) puts the original
 * cards back exactly where they were, so the comparison is never disturbed.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, Maximize2, Minimize2 } from 'lucide-react';
import type { PlatformCaptions } from '../../../types';
import { CaptionTranslationToggle } from './CaptionTranslationToggle';
import { useCaptionTranslationSet } from './useCaptionTranslation';

export interface CaptionOptionGridProps {
  captions: PlatformCaptions;
  /** Which platform these options are for; sent with on-demand translations. */
  platform?: string;
  /** Index of the option currently staged, or null. Owned by the parent. */
  selectedIndex: number | null;
  onSelect: (index: number, text: string) => void;
}

export default function CaptionOptionGrid({ captions, platform, selectedIndex, onSelect }: CaptionOptionGridProps) {
  const [maximized, setMaximized] = useState<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  // The English toggle swaps what is READ; selecting always stages the native text.
  const translation = useCaptionTranslationSet(captions.options, captions.optionsEn, platform);

  const optionName = (index: number) => captions.optionNames[index] ?? `Option ${index + 1}`;

  const close = useCallback(() => {
    setMaximized(null);
    triggerRef.current?.focus();
  }, []);

  // A click anywhere — inside the expanded view or out — and Escape both put
  // the cards back. Listening from the next tick so the click that opened it
  // does not immediately close it again.
  useEffect(() => {
    if (maximized === null) return;
    panelRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    const timer = window.setTimeout(() => document.addEventListener('click', close), 0);
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('click', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [maximized, close]);

  // A different platform swaps the option set; never leave a stale one open.
  useEffect(() => {
    setMaximized(null);
  }, [captions]);

  return (
    <div className="cap-stack" data-expanded={maximized !== null}>
      <div className="cap-grid" aria-hidden={maximized !== null || undefined}>
        {captions.options.map((text, index) => {
          const isSelected = selectedIndex === index;
          return (
            <article
              key={index}
              className="cap-card"
              data-selected={isSelected}
              // The whole card picks the option — a pointer convenience; the
              // Select button stays the keyboard and screen-reader control.
              // Its own buttons (Select, expand) handle themselves, and a
              // click that ends a text selection is left alone.
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('button')) return;
                if (window.getSelection()?.toString()) return;
                onSelect(index, text);
              }}
            >
              <div className="cap-head">
                <span className="badge badge--teal">Option {index + 1}</span>
                <span className="cap-length">{text.length} characters</span>
                <div className="cap-head-act">
                  {isSelected && (
                    <span className="chip chip--success">
                      <Check aria-hidden="true" /> Staged
                    </span>
                  )}
                  {/* Named for the option rather than a bare "Expand", so three
                      identical buttons in a row are distinguishable by voice
                      and in a screen reader's element list. */}
                  <button
                    type="button"
                    className="icon-btn cap-zoom"
                    aria-label={`Read ${optionName(index)} in full`}
                    aria-expanded={maximized === index}
                    tabIndex={maximized !== null ? -1 : undefined}
                    onClick={(e) => {
                      triggerRef.current = e.currentTarget;
                      setMaximized(index);
                    }}
                  >
                    <Maximize2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <h3 className="cap-title">{optionName(index)}</h3>

              <p
                className="cap-body"
                data-testid={`cap-body-${index}`}
                lang={translation.stateAt(index).showing === 'english' ? 'en' : undefined}
              >
                {translation.displayAt(index)}
              </p>

              <div className="cap-card-foot">
                <CaptionTranslationToggle state={translation.stateAt(index)} label={optionName(index)} />
              </div>

              <div className="cap-actions">
                <button
                  type="button"
                  className="btn-cta btn-cta--sm"
                  aria-label={isSelected ? 'Selected' : 'Select'}
                  aria-pressed={isSelected}
                  tabIndex={maximized !== null ? -1 : undefined}
                  onClick={() => onSelect(index, text)}
                >
                  <Check size={15} aria-hidden="true" />
                  {isSelected ? 'Selected' : 'Select'}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {maximized !== null && (
        <div
          ref={panelRef}
          className="cap-expanded"
          role="region"
          aria-labelledby="cap-expanded-title"
          tabIndex={-1}
        >
          <div className="cap-expanded-head">
            <span className="badge badge--teal">Option {maximized + 1}</span>
            <span className="cap-length">{captions.options[maximized].length} characters</span>
            <CaptionTranslationToggle state={translation.stateAt(maximized)} label={optionName(maximized)} stopPropagation />
            <button type="button" className="icon-btn cap-zoom" aria-label="Back to all options" onClick={close}>
              <Minimize2 size={15} aria-hidden="true" />
            </button>
          </div>
          <h3 id="cap-expanded-title" className="cap-expanded-title">{optionName(maximized)}</h3>
          <p className="cap-full" lang={translation.stateAt(maximized).showing === 'english' ? 'en' : undefined}>
            {translation.displayAt(maximized)}
          </p>
          {/* Selecting from the expanded view is the point: having read the
              whole thing, the reader should not have to go back and hunt for
              the card they just read. */}
          <div className="cap-actions">
            <button
              type="button"
              className="btn-cta btn-cta--sm"
              onClick={() => onSelect(maximized, captions.options[maximized])}
            >
              <Check size={15} aria-hidden="true" />
              {selectedIndex === maximized ? 'Selected' : 'Select'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
