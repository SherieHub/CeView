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
import { Facebook, FileText, ImagePlus, Instagram, Maximize2, Target, Trash2, Upload, UserRound } from 'lucide-react';
import { TikTokGlyph } from '../../shared/PlatformGlyphs';
import Modal from '../../shared/Modal';
import CaptionToolbar from './CaptionToolbar';
import { CaptionTranslationToggle, EnglishEditBar } from './CaptionTranslationToggle';
import { useEditableCaptionTranslation } from './useCaptionTranslation';
import { PLATFORM_CHAR_LIMITS } from './AIContentMatrixPanel';
import type { ComposerSlotProps, PublishDraftState } from './contentStudioTypes';
import MediaPreview from './MediaPreview';
import { captureVideoPoster } from './videoPoster';
import { MEDIA_LIMITS, mediaKindOf, uploadMedia } from '../../../services/mediaUpload';
import type { MediaDimensions } from '../../../services/mediaUpload';
import { apiClient } from '../../../services/apiClient';
import type { AttributionVoucher } from '../../../types';
import { composeVoucherOverlay } from './voucherImageOverlay';

/**
 * What is still missing before the audit can run. Scoped to this panel's own
 * inputs — it used to also report on platforms, authorisation and the audit
 * itself, none of which the composer owns any more, so it would have told the
 * operator to use controls that are no longer on screen.
 */
function blockReason(draft: PublishDraftState) {
  if (!draft.caption.trim()) return 'Select an option above, or write your own caption.';
  if (!draft.mediaDataUrl) return 'Add an image or video to run the audit.';
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
  uploadToStorage = true,
}: ComposerSlotProps & {
  /**
   * Which half to render. Quick Post shows the caption in its Draft stage and
   * the media in its Attach stage; 'both' is the original side-by-side layout.
   */
  part?: 'caption' | 'media' | 'both';
  marketName?: string;
  selectedOption?: number | null;
  /**
   * Default: photos and videos are uploaded to storage for publishing. The
   * campaign drawer passes false to keep its image-only, local-only behaviour.
   */
  uploadToStorage?: boolean;
}) {
  const limit = PLATFORM_CHAR_LIMITS[platform];
  const reason = blockReason(draft);
  const overLimit = draft.caption.length > limit;

  // The English view edits a reading aid; "Apply" rewrites the native caption
  // from it. What is published is always draft.caption.
  const translation = useEditableCaptionTranslation(draft.caption, {
    knownEnglish: draft.captionEn,
    platform,
    onTranslated: (captionEn) => onDraftChange({ captionEn }),
    onApply: (caption, captionEn) => onDraftChange({ caption, captionEn, agreementChecked: false }),
  });
  const viewingEnglish = translation.showing === 'english';

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
  const [sourceMedia, setSourceMedia] = useState<string | null>(null);
  const [vouchers, setVouchers] = useState<AttributionVoucher[]>([]);
  const [voucherId, setVoucherId] = useState('');
  const [voucherEnabled, setVoucherEnabled] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  useEffect(() => { apiClient.vouchers.list().then((items) => {
    const active = items.filter((item) => item.voucherStatus === 'ACTIVE' && item.redemptionsRemaining !== 0);
    setVouchers(active); setVoucherId((current) => current || active.find((item) => item.code === 'CVLAUNCH')?.attributionCodeId || active[0]?.attributionCodeId || '');
  }).catch(() => setVouchers([])); }, []);

  const captionRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = captionRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [draft.caption, viewingEnglish, translation.englishDraft]);

  const [dragging, setDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  // True while a video's poster frame is being read.
  const [preparing, setPreparing] = useState(false);
  // A pick that finishes uploading after the operator chose or removed something
  // else must not overwrite the newer state.
  const uploadSeq = useRef(0);
  const pending = useRef<{ file: File; dims: MediaDimensions } | null>(null);

  const readFileAsDataUrl = (file: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const startUpload = async (file: File, token: number, dims: MediaDimensions) => {
    onDraftChange({ mediaUpload: { status: 'uploading' } });
    try {
      const uploaded = await uploadMedia(file, dims);
      if (token !== uploadSeq.current) return;
      onDraftChange({ mediaUpload: { status: 'ready', mediaId: uploaded.mediaId, publicUrl: uploaded.publicUrl } });
    } catch (err) {
      if (token !== uploadSeq.current) return;
      onDraftChange({
        mediaUpload: { status: 'failed', message: err instanceof Error ? err.message : 'Upload failed. Please try again.' },
      });
    }
  };

  const readMedia = async (file: File | undefined) => {
    if (!file) return;
    // Rejected files used to vanish silently; say why instead.
    const kind = mediaKindOf(file.type);
    if (!kind || (!uploadToStorage && kind !== 'image')) {
      setFileError(
        uploadToStorage
          ? 'That file type isn’t supported — use a PNG, JPG or WEBP image, or an MP4 or MOV video.'
          : 'That file type isn’t supported — use a PNG, JPG or WEBP image.',
      );
      return;
    }
    const limit = MEDIA_LIMITS[kind];
    if (file.size > limit) {
      setFileError(`That ${kind} is over ${limit / (1024 * 1024)} MB — use a smaller file.`);
      return;
    }
    setFileError(null);
    pending.current = null;

    const token = ++uploadSeq.current;
    // Revoked only once the new media is committed: if reading it fails, the
    // previous media is still on screen and still needs its URL.
    const prevUrl = draft.localVideoUrl;
    setPreparing(false);

    let dims: MediaDimensions = {};
    try {
      if (kind === 'image') {
        const dataUrl = await readFileAsDataUrl(file);
        if (token !== uploadSeq.current) return;
        if (!uploadToStorage) {
          setSourceMedia(dataUrl);
          setVoucherEnabled(false);
          onDraftChange({ mediaDataUrl: dataUrl, agreementChecked: false });
          return;
        }
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        setSourceMedia(dataUrl);
        setVoucherEnabled(false);
        onDraftChange({ mediaDataUrl: dataUrl, mediaType: 'image', localVideoUrl: null, mediaUpload: null, agreementChecked: false });
      } else {
        // The poster is what the audit reads; playback uses the object URL.
        setPreparing(true);
        const info = await captureVideoPoster(file);
        if (token !== uploadSeq.current) return;
        if (prevUrl) URL.revokeObjectURL(prevUrl);
        setSourceMedia(info.posterDataUrl);
        setVoucherEnabled(false);
        onDraftChange({
          mediaDataUrl: info.posterDataUrl,
          mediaType: 'video',
          localVideoUrl: URL.createObjectURL(file),
          mediaUpload: null,
          agreementChecked: false,
        });
        dims = { width: info.width, height: info.height, durationSeconds: info.durationSeconds };
      }
    } catch {
      if (token === uploadSeq.current) setFileError('We couldn’t read that file — try another one.');
      return;
    } finally {
      if (token === uploadSeq.current) setPreparing(false);
    }

    pending.current = { file, dims };
    void startUpload(file, token, dims);
  };

  const retryUpload = () => {
    const last = pending.current;
    if (last) void startUpload(last.file, ++uploadSeq.current, last.dims);
  };

  const removeMedia = () => {
    uploadSeq.current += 1; // abandon any in-flight upload
    pending.current = null;
    setPreparing(false);
    if (draft.localVideoUrl) URL.revokeObjectURL(draft.localVideoUrl);
    setSourceMedia(null);
    setVoucherEnabled(false);
    onDraftChange({ mediaDataUrl: null, mediaType: undefined, localVideoUrl: null, mediaUpload: null, agreementChecked: false });
  };
  const selectedVoucher = vouchers.find((item) => item.attributionCodeId === voucherId);
  const setVoucherOverlay = async (enabled: boolean) => {
    const original = sourceMedia ?? draft.mediaDataUrl;
    if (!original || !selectedVoucher) return;
    setVoucherError(''); setSourceMedia(original);
    if (!enabled) { setVoucherEnabled(false); onDraftChange({ mediaDataUrl: original, agreementChecked: false }); return; }
    try { const composed = await composeVoucherOverlay(original, selectedVoucher); setVoucherEnabled(true); onDraftChange({ mediaDataUrl: composed, agreementChecked: false }); }
    catch (error) { setVoucherEnabled(false); setVoucherError(error instanceof Error ? error.message : 'Voucher overlay could not be created.'); }
  };
  useEffect(() => { if (voucherEnabled) void setVoucherOverlay(true); }, [voucherId]);

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
          {translation.visible && (
            <div className="cap-lang-bar">
              <CaptionTranslationToggle state={translation} />
            </div>
          )}
          <textarea
            id="staged-caption"
            aria-label={viewingEnglish ? 'Your caption (English translation)' : 'Your caption'}
            lang={viewingEnglish ? 'en' : undefined}
            ref={captionRef}
            className={`textarea textarea--caption ${overLimit ? 'is-invalid' : ''}`}
            data-flash={stageToken != null && stageToken > 0}
            key={`staged-${stageToken ?? 0}`}
            value={viewingEnglish ? translation.englishDraft : draft.caption}
            onChange={(event) =>
              viewingEnglish
                ? translation.setEnglishDraft(event.target.value)
                : onDraftChange({ caption: event.target.value, agreementChecked: false })
            }
            placeholder="Approve a matrix option or write your own caption."
          />
          <div className="cap-count caption-toolbar-bar" data-over={overLimit}>
            {!viewingEnglish && (
              <CaptionToolbar
                value={draft.caption}
                onChange={(caption) => onDraftChange({ caption, agreementChecked: false })}
                textareaRef={captionRef}
                platform={platform}
                fieldKey={stageToken}
              />
            )}
            <span className="num">
              Characters: {draft.caption.length.toLocaleString()} / {limit.toLocaleString()}
            </span>
          </div>
          <EnglishEditBar state={translation} />
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
            <>
              <div className="media-frame">
              <MediaPreview src={draft.mediaDataUrl} videoSrc={draft.localVideoUrl} alt="Publication media preview" />
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
                  onClick={removeMedia}
                  aria-label="Remove media"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </div>
            </div>
              {vouchers.length > 0 && <div className="mt-3 space-y-2">
                <label><input type="checkbox" checked={voucherEnabled} onChange={(event) => setVoucherOverlay(event.target.checked)} /> Add voucher to image</label>
                {voucherEnabled && <label className="field-label">Voucher<select value={voucherId} onChange={(event) => setVoucherId(event.target.value)}><option value="">Choose voucher</option>{vouchers.map((voucher) => <option key={voucher.attributionCodeId} value={voucher.attributionCodeId}>{voucher.code} — PHP {voucher.discountAmount} off</option>)}</select></label>}
                {voucherError && <p role="status" className="text-meta">{voucherError}</p>}
              </div>}
            </>
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
                void readMedia(event.dataTransfer.files?.[0]);
              }}
            >
              <span className="upload-glyph"><ImagePlus size={20} aria-hidden="true" /></span>
              <span className="heading-sm">{uploadToStorage ? 'Upload an image or video' : 'Upload an image'}</span>
              <span className="text-meta mt-1 block">
                {uploadToStorage ? 'Images up to 8 MB, videos up to 250 MB' : 'Images up to 8 MB'}
              </span>
              {/* The whole zone is the label, so this is its visible affordance
                  rather than a second control. */}
              <span className="upload-choose" aria-hidden="true"><Upload size={15} /> Choose file</span>
              <span className="upload-drop">or drag and drop</span>
              <input
                className="sr"
                type="file"
                accept={uploadToStorage ? 'image/png,image/jpeg,image/webp,video/mp4,video/quicktime' : 'image/png,image/jpeg,image/webp'}
                onChange={(event) => {
                  void readMedia(event.target.files?.[0]);
                  event.target.value = '';
                }}
              />
            </label>
          )}
          {fileError && <p className="upload-error" role="alert">{fileError}</p>}
          {preparing && <p className="text-meta mt-3" role="status">Preparing video…</p>}
          {draft.mediaUpload?.status === 'uploading' && (
            <p className="text-meta mt-3" role="status">Uploading media…</p>
          )}
          {draft.mediaUpload?.status === 'failed' && (
            <p className="upload-error" role="alert">
              {draft.mediaUpload.message}{' '}
              <button type="button" className="link-inline" onClick={retryUpload}>Retry upload</button>
            </p>
          )}
          {reason && !fileError && <p className="text-meta mt-3" role="status">{reason}</p>}
        </div>
        )}
      </div>

      {/* Uncropped, so what the column's crop hides is checkable before the
          audit scores caption-to-media consistency against it. */}
      <Modal open={mediaOpen} onClose={() => setMediaOpen(false)} title="Publication media">
        {draft.mediaDataUrl && (
          <MediaPreview className="media-full" src={draft.mediaDataUrl} videoSrc={draft.localVideoUrl} alt="Publication media at full size" />
        )}
      </Modal>
    </>
  );
}
