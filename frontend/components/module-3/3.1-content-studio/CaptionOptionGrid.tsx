/**
 * The AI caption options, three abreast, for comparison at a glance.
 *
 * These cards are no longer editable. The old design gave every option its own
 * textarea, which meant three drafts could diverge silently and only one of
 * them ever reached the composer. Selection is now the card's whole job; the
 * staged caption below is the single editable copy.
 *
 * Select carries .btn-cta — the deep teal the dashboard's "Target this market"
 * uses — because choosing an option is the same kind of commitment: it is the
 * one forward action in this row, and the operator arrives here to make it.
 *
 * Reading the full text opens a modal rather than expanding the card in place.
 * In-place expansion grew one column of a three-column row, which pushed the
 * grid to the tallest card's height and shifted the two options the reader was
 * comparing it against — exactly the comparison the row exists for. A modal
 * leaves the row untouched and gives the long ones room.
 */
import { useState } from 'react';
import { Check, Maximize2 } from 'lucide-react';
import Modal from '../../shared/Modal';
import type { PlatformCaptions } from '../../../types';

export interface CaptionOptionGridProps {
  captions: PlatformCaptions;
  /** Index of the option currently staged, or null. Owned by the parent. */
  selectedIndex: number | null;
  onSelect: (index: number, text: string) => void;
}

export default function CaptionOptionGrid({ captions, selectedIndex, onSelect }: CaptionOptionGridProps) {
  const [maximized, setMaximized] = useState<number | null>(null);

  const optionName = (index: number) => captions.optionNames[index] ?? `Option ${index + 1}`;

  return (
    <>
      <div className="cap-grid">
        {captions.options.map((text, index) => {
          const isSelected = selectedIndex === index;
          return (
            <article key={index} className="cap-card" data-selected={isSelected}>
              <div className="cap-head">
                <span className="badge badge--teal">Option {index + 1}</span>
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
                    onClick={() => setMaximized(index)}
                  >
                    <Maximize2 size={15} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <h3 className="cap-title">{optionName(index)}</h3>

              <p className="cap-body" data-testid={`cap-body-${index}`}>
                {text}
              </p>

              <div className="cap-actions">
                <button
                  type="button"
                  className="btn-cta btn-cta--sm"
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

      {/* Selecting from inside the modal is the point: having read the whole
          thing, the reader should not have to close it and hunt for the card
          they just read. */}
      <Modal
        open={maximized !== null}
        onClose={() => setMaximized(null)}
        title={maximized !== null ? optionName(maximized) : undefined}
      >
        {maximized !== null && (
          <>
            <p className="cap-full">{captions.options[maximized]}</p>
            <div className="cap-actions">
              <button
                type="button"
                className="btn-cta btn-cta--sm"
                onClick={() => {
                  onSelect(maximized, captions.options[maximized]);
                  setMaximized(null);
                }}
              >
                <Check size={15} aria-hidden="true" />
                {selectedIndex === maximized ? 'Selected' : 'Select'}
              </button>
            </div>
          </>
        )}
      </Modal>
    </>
  );
}
