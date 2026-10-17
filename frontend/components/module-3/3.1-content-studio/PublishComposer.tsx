/**
 * Step 2 of the linear journey — "Attach".
 *
 * Renders a FRAGMENT, not a card: it shares one card with AIContentMatrixPanel
 * under a single "Post composer" header. See ContentStudioView.
 *
 * Narrowed to the two things this step is actually about: the single editable
 * copy of the caption, and the media it will publish with. Destination choice,
 * visibility, comment settings and the publishing authorisation all moved to
 * the publish modal (PublishModal), where they sit beside the live preview and
 * the irreversible action they govern.
 */
import { useEffect, useRef, useState } from 'react';
import { Facebook, FileText, ImagePlus, Instagram, Maximize2, PenLine, Target, Trash2, Upload, UserRound } from 'lucide-react';
import { TikTokGlyph } from '../../shared/PlatformGlyphs';
import Modal from '../../shared/Modal';
import CaptionToolbar from './CaptionToolbar';
import { PLATFORM_CHAR_LIMITS } from './AIContentMatrixPanel';
import type { ComposerSlotProps, PublishDraftState } from './contentStudioTypes';

/**
 * What is still missing before the audit can run. Scoped to this panel's own
 * inputs — it used to also report on platforms, authorisation and the audit
 * itself, none of which the composer owns any more, so it would have told the
 * operator to use controls that are no longer on screen.
 */
function blockReason(draft: PublishDraftState) {
  if (!draft.caption.trim()) return 'Select an option above, or write your own caption.';
  if (!draft.mediaDataUrl) return 'Add a PNG, JPG, or WEBP image to run the audit.';
  return null;
}

export default function PublishComposer({
  draft,
  onDraftChange,
  platform,
  stageToken,
  onOpenBrief,
  part = 'both',
  marketName,
  selectedOption,
}: ComposerSlotProps & {
  /**
   * Which half to render. Quick Post shows the caption in its Draft stage and
   * the media in its Attach stage; 'both' is the original side-by-side layout.
   */
  part?: 'caption' | 'media' | 'both';
  marketName?: string;
  selectedOption?: number | null;
}) {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  const reason = blockReason(draft);
  const overLimit = draft.caption.length > limit;

  /**
   * Grow the caption field to its content so the whole caption is visible
   * without scrolling — these run to several paragraphs and the operator is
   * checking them over, which a 120px window with a scrollbar makes hard.
   *
   * `height: auto` first is load-bearing: scrollHeight is measured against the
   * CURRENT height, so without the reset the field can only ever grow. Deleting
   * text would leave it stuck at its tallest.
   *
   * Runs on the caption rather than on input events so it also fires when an
   * option is staged from the grid above, which changes the value without any
   * keystroke.
   */
  // The staged image, full size. The preview is cropped to fill its column, so
  // the only way to check the whole frame — what the crop is cutting — is to
  // open it uncropped.
  const [mediaOpen, setMediaOpen] = useState(false);

  const captionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.caption]);

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const readImage = (file: File | undefined) => {
    if (!file) return;
    // Rejected files used to vanish silently; say why instead.
    if (!file.type.match(/^image\/(png|jpeg|webp)$/)) {
      setFileError('That file type isn’t supported — use a PNG, JPG or WEBP image.');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setFileError('That image is over 20 MB — use a smaller file.');
      return;
    }
    setFileError(null);
    const reader = new FileReader();
    reader.onload = () => onDraftChange({ mediaDataUrl: String(reader.result), agreementChecked: false });
    reader.readAsDataURL(file);
  };

  return (
    <>
      <div className={part === 'both' ? 'composer-grid' : 'composer-single'} data-part={part}>
        {part !== 'media' && (
        <div>
          {part === 'caption' ? <>
            <div className="draft-editor-head">
              <span className="draft-heading-icon" aria-hidden="true"><UserRound size={26} /></span>
              <div><label className="field-label" htmlFor="staged-caption">Edit your caption</label>
                <p>Make it your own. Adjust the tone, add details, or combine ideas.</p></div>
              <label className="draft-write-own" htmlFor="staged-caption"><PenLine size={15} aria-hidden="true" /> Write your own</label>
            </div>
            <dl className="draft-facts">
              <div><span className={`draft-fact-icon draft-fact-icon--${platform}`} aria-hidden="true">{platform === 'instagram' ? <Instagram size={29} /> : platform === 'facebook' ? <Facebook size={29} /> : <TikTokGlyph size={29} />}</span><div><dt>Platform</dt><dd>{platform === 'instagram' ? 'Instagram' : platform === 'facebook' ? 'Facebook' : 'TikTok'}</dd></div></div>
              <div><span className="draft-fact-icon draft-fact-icon--market" aria-hidden="true"><Target size={28} /></span><div><dt>Target market</dt><dd>{marketName ?? '—'}</dd></div></div>
              <div><span className="draft-fact-icon" aria-hidden="true"><FileText size={27} /></span><div><dt>Selected option</dt><dd>{selectedOption == null ? 'Custom caption' : `Option ${selectedOption + 1}`}</dd></div></div>
            </dl>
          </> : <label className="field-label" htmlFor="staged-caption">Your caption</label>}
          {/* The changing `key` remounts the element, which is what restarts a
              one-shot CSS animation — without it the flash plays once and never
              again on subsequent selections. */}
          <textarea
            id="staged-caption"
            aria-label="Your caption"
            ref={captionRef}
            className={`textarea textarea--caption ${overLimit ? 'is-invalid' : ''}`}
            data-flash={stageToken != null && stageToken > 0}
            key={`staged-${stageToken ?? 0}`}
            value={draft.caption}
            onChange={(event) => onDraftChange({ caption: event.target.value, agreementChecked: false })}
            placeholder="Approve a matrix option or write your own caption."
          />
          <div className="cap-count caption-toolbar-bar" data-over={overLimit}>
            <CaptionToolbar
              value={draft.caption}
              onChange={(caption) => onDraftChange({ caption, agreementChecked: false })}
              textareaRef={captionRef}
              platform={platform}
              fieldKey={stageToken}
            />
            <span className="num">
              Characters: {draft.caption.length.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
        </div>
        )}

        {part !== 'caption' && (
        <div>
          <div className="media-head">
            <span className="field-label">Publication media</span>
            {/* The point-of-action pointer into the visual guide. The shot list
                used to be inlined here as a collapsed accordion, which
                duplicated the drawer wholesale; a link costs one line and sends
                the operator to the single copy. */}
            {onOpenBrief && (
              <button type="button" className="link-inline" onClick={onOpenBrief}>
                Review Visual Guide
              </button>
            )}
          </div>
          {draft.mediaDataUrl ? (
            <div className="media-frame">
              <img src={draft.mediaDataUrl} alt="Publication media preview" />
              <div className="media-acts">
                <button
                  type="button"
                  className="icon-btn media-act"
                  onClick={() => setMediaOpen(true)}
                  aria-label="View media full size"
                >
                  <Maximize2 size={16} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="icon-btn media-act"
                  onClick={() => onDraftChange({ mediaDataUrl: null, agreementChecked: false })}
                  aria-label="Remove media"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
          ) : (
            <label
              className="upload-zone"
              data-dragging={dragging || undefined}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                readImage(event.dataTransfer.files?.[0]);
              }}
            >
              <span className="upload-glyph"><ImagePlus size={20} aria-hidden="true" /></span>
              <span className="heading-sm">Upload PNG, JPG, or WEBP</span>
              <span className="text-meta mt-1 block">Up to 20 MB</span>
              {/* The whole zone is the label, so this is its visible affordance
                  rather than a second control. */}
              <span className="upload-choose" aria-hidden="true"><Upload size={15} /> Choose file</span>
              <span className="upload-drop">or drag and drop</span>
              <input
                className="sr"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => {
                  readImage(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          )}
          {fileError && <p className="upload-error" role="alert">{fileError}</p>}
          {reason && !fileError && <p className="text-meta mt-3" role="status">{reason}</p>}
        </div>
        )}
      </div>

      {/* Uncropped, so what the column's crop hides is checkable before the
          audit scores caption-to-media consistency against it. */}
      <Modal open={mediaOpen} onClose={() => setMediaOpen(false)} title="Publication media">
        {draft.mediaDataUrl && (
          <img className="media-full" src={draft.mediaDataUrl} alt="Publication media at full size" />
        )}
      </Modal>
    </>
  );
}
