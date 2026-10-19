/**
 * The publishing modal.
 *
 * Publishing is the one irreversible action on this screen, so it takes over
 * the viewport: one large card on a dimmed, blurred backdrop, read left to
 * right in three steps —
 *   1. Publishing options — where it goes, its visibility, paid or organic.
 *   2. Preview — the post as each chosen platform would show it.
 *   3. Review & confirm — the final caption and a plain summary of what will
 *      be published where.
 * The authorisation that unlocks Confirm closes the options column, and the
 * footer says what is still missing while Confirm is disabled.
 *
 * Destination choice drives the preview: with several platforms chosen, the
 * arrows and dots step through each one's preview.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Facebook,
  FileText,
  Globe,
  Instagram,
  Lock,
  Megaphone,
  Minus,
  Monitor,
  Send,
  Smartphone,
  Tablet,
  X,
  Zap,
} from 'lucide-react';
import Modal from '../../shared/Modal';
import { TikTokGlyph } from '../../shared/PlatformGlyphs';
import { BrandMark } from '../../landing/LandingNav';
import DevicePreview, { PREVIEW_DEVICES } from './DevicePreview';
import { CaptionTranslationToggle, EnglishEditBar } from './CaptionTranslationToggle';
import { useEditableCaptionTranslation } from './useCaptionTranslation';
import type { PreviewDevice } from './DevicePreview';
import { PLATFORM_CHAR_LIMITS } from './AIContentMatrixPanel';
import { STUDIO_PLATFORMS } from './contentStudioTypes';
import type { PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import { useConnections } from '../../../services/connectionsStore';
import { defaultSchedule, formatSchedule, isFuture, timeZoneName } from './schedule';

/**
 * Fitted frames stop just short of the canvas edge. A preview touching the
 * bounds on both axes reads as cropped even when every pixel is present.
 */
export const PREVIEW_FIT_MARGIN = 0.92;

const DEVICE_ICONS: Record<PreviewDevice, typeof Smartphone> = { mobile: Smartphone, tablet: Tablet, desktop: Monitor };

export interface PublishModalProps {
  open: boolean;
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  onClose: () => void;
  onConfirm: () => void;
  /** The account name the preview shows the post under. */
  accountName?: string;
}

function PlatformMark({ platform }: { platform: StudioPlatformId }) {
  return (
    <span className="pubx-mark" data-platform={platform} aria-hidden="true">
      {platform === 'instagram' ? <Instagram size={17} /> : platform === 'facebook' ? <Facebook size={17} /> : <TikTokGlyph size={15} />}
    </span>
  );
}

function StepHead({ n, title, sub }: { n: number; title: string; sub: string }) {
  return (
    <header className="pubx-step">
      <span className="pubx-step-no" aria-hidden="true">{n}</span>
      <div>
        <h3 className="pubx-step-title">{title}</h3>
        <p className="pubx-step-sub">{sub}</p>
      </div>
    </header>
  );
}

export default function PublishModal({ open, draft, onDraftChange, onClose, onConfirm, accountName }: PublishModalProps) {
  const [device, setDevice] = useState<PreviewDevice>('mobile');
  // A disconnected platform cannot be added to "Publish to" without first
  // connecting it (Settings -> Platforms). Read here rather than in
  // PublishComposer: that panel no longer owns destination choice, this does.
  const { isConnected, available } = useConnections();

  // The preview steps through the chosen platforms, in the platforms' own
  // order; Instagram stands in before any is chosen, so it is never blank.
  const chosen = STUDIO_PLATFORMS.map((p) => p.id).filter((id) => draft.platforms.includes(id));
  const previewList: StudioPlatformId[] = chosen.length ? chosen : ['instagram'];
  const [previewIndex, setPreviewIndex] = useState(0);
  const at = Math.min(previewIndex, previewList.length - 1);
  const previewPlatform = previewList[at];
  const stepPreview = (delta: number) => setPreviewIndex((at + delta + previewList.length) % previewList.length);

  /**
   * Scale the device frame down until it fits the canvas whole.
   *
   * The desktop frame is 1100px wide by design — a browser preview narrower
   * than that stops looking like a browser. Rather than let it overflow into
   * scrollbars, it is measured against the space available and shrunk to suit,
   * so every form factor shows the entire post at once.
   *
   * offsetWidth/offsetHeight rather than getBoundingClientRect: those report
   * LAYOUT size and ignore the transform we are about to set, so reading them
   * cannot feed back into the value it computes.
   */
  const canvasRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  const fit = useCallback(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame) return;
    const { offsetWidth: fw, offsetHeight: fh } = frame;
    const { clientWidth: cw, clientHeight: ch } = canvas;
    if (!fw || !fh) return;
    // Each axis constrains independently, and an axis that reports 0 simply
    // does not constrain — bailing out on a zero left the frame unscaled and
    // overflowing whenever the canvas had not been laid out yet.
    const byWidth = cw ? cw / fw : Infinity;
    const byHeight = ch ? ch / fh : Infinity;
    setScale(Math.min(1, byWidth, byHeight) * PREVIEW_FIT_MARGIN);
  }, []);

  // Measure now, then again after the browser has actually laid out — the first
  // pass can read a frame whose caption has not wrapped yet.
  useLayoutEffect(() => {
    fit();
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fit, device, draft.caption, draft.mediaDataUrl, open, previewPlatform]);

  // Observes BOTH boxes: the frame changes size with the device or a growing
  // caption even when the canvas does not move.
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [fit, open]);

  const togglePlatform = (platform: StudioPlatformId) => onDraftChange({
    platforms: draft.platforms.includes(platform)
      ? draft.platforms.filter((p) => p !== platform)
      : [...draft.platforms, platform],
  });

  // The strictest limit among the chosen platforms is the one that bites.
  const limit = Math.min(...previewList.map((p) => PLATFORM_CHAR_LIMITS[p]));
  const overLimit = draft.caption.length > limit;
  // One translation state drives both the Final caption box and the device
  // preview, so they always show the same language. Publishing uses draft.caption.
  const translation = useEditableCaptionTranslation(draft.caption, {
    knownEnglish: draft.captionEn,
    platform: previewPlatform,
    onTranslated: (captionEn) => onDraftChange({ captionEn }),
    onApply: (caption, captionEn) => onDraftChange({ caption, captionEn }),
  });
  const viewingEnglish = translation.showing === 'english';
  // Scheduling: a local date-time on the draft; null means publish now.
  const scheduled = draft.scheduledFor != null;
  const [schedDate, schedTime] = (draft.scheduledFor ?? defaultSchedule()).split('T');
  const scheduleValid = !scheduled || isFuture(draft.scheduledFor as string);
  const setSchedule = (date: string, time: string) => onDraftChange({ scheduledFor: `${date}T${time}` });
  const today = new Date();
  const minDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const canConfirm = draft.agreementChecked && draft.platforms.length > 0 && scheduleValid;
  const label = (id: StudioPlatformId) => STUDIO_PLATFORMS.find((p) => p.id === id)?.label ?? id;

  return (
    <Modal open={open} onClose={onClose} variant="full" label="Publish">
      <div className="pubx">
        <header className="pubx-head">
          <BrandMark />
          <span className="pubx-head-rule" aria-hidden="true" />
          <h2 className="pubx-title">Publish Post</h2>
          <button type="button" className="pubx-close" aria-label="Close" onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        <div className="pubx-cols">
          {/* 1 — every decision that changes where and how it goes out. */}
          <section className="pubx-col pubx-options" aria-label="Publishing options">
            <StepHead n={1} title="Publishing Options" sub="Choose where and how to publish this content." />

            <fieldset className="pubx-group">
              <legend>Publish to</legend>
              {!available && (
                <p className="pubx-note" role="status">
                  Social platform connections aren&rsquo;t available yet, so publishing is turned off.
                </p>
              )}
              <div className="pubx-plats">
                {STUDIO_PLATFORMS.map(({ id, label: name }) => {
                  const connected = isConnected(id);
                  const on = draft.platforms.includes(id);
                  return (
                    <label key={id} className="pubx-plat" data-on={on} data-disabled={!connected}>
                      <input type="checkbox" checked={on} disabled={!connected} onChange={() => togglePlatform(id)} />
                      <PlatformMark platform={id} />
                      <span className="pubx-plat-name">{name}</span>
                      {!connected && <span className="pubx-plat-off">Not connected</span>}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="pubx-group">
              <legend>Distribution</legend>
              <div className="pubx-seg" role="radiogroup" aria-label="Visibility">
                {(['public', 'private'] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={draft.visibility === value}
                    onClick={() => onDraftChange({ visibility: value })}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="pubx-hint">
                {draft.visibility === 'public' ? <Globe size={14} aria-hidden="true" /> : <Lock size={14} aria-hidden="true" />}
                {draft.visibility === 'public' ? 'Public posts can be seen by everyone.' : 'Private posts aren’t shown publicly.'}
              </p>
            </fieldset>

            <fieldset className="pubx-group">
              <legend>When to publish</legend>
              <div className="pubx-seg pubx-seg--when" role="radiogroup" aria-label="When to publish">
                <button
                  type="button"
                  role="radio"
                  aria-checked={!scheduled}
                  onClick={() => onDraftChange({ scheduledFor: null })}
                >
                  <Zap size={14} aria-hidden="true" /> Publish now
                </button>
                <button
                  type="button"
                  role="radio"
                  aria-checked={scheduled}
                  onClick={() => !scheduled && onDraftChange({ scheduledFor: defaultSchedule() })}
                >
                  <CalendarClock size={14} aria-hidden="true" /> Schedule
                </button>
              </div>
              {scheduled && (
                <div className="pubx-when">
                  <label className="pubx-when-field">
                    <span>Date</span>
                    <input
                      type="date"
                      value={schedDate}
                      min={minDate}
                      onChange={(e) => e.target.value && setSchedule(e.target.value, schedTime)}
                    />
                  </label>
                  <label className="pubx-when-field">
                    <span>Time</span>
                    <input
                      type="time"
                      value={schedTime}
                      onChange={(e) => e.target.value && setSchedule(schedDate, e.target.value)}
                    />
                  </label>
                  <p className="pubx-hint pubx-when-note" data-error={!scheduleValid || undefined} role={!scheduleValid ? 'alert' : undefined}>
                    {scheduleValid
                      ? `${timeZoneName()} time. Automatic posting isn’t connected yet — the post is kept as scheduled in your Content Library.`
                      : 'Pick a date and time in the future.'}
                  </p>
                </div>
              )}
            </fieldset>

            <label className="pubx-paid">
              <input
                type="checkbox"
                checked={draft.paidPartnership}
                onChange={(event) => onDraftChange({ paidPartnership: event.target.checked })}
              />
              <span>
                <span className="pubx-paid-title">
                  <Megaphone size={17} aria-hidden="true" /> Run as Paid Ad
                </span>
                <span className="pubx-paid-sub">Marks this post to run as a paid ad.</span>
              </span>
            </label>

            {/* The sign-off closes the options: last thing decided before Confirm. */}
            <label className="pubx-agree">
              <input
                type="checkbox"
                checked={draft.agreementChecked}
                onChange={(event) => onDraftChange({ agreementChecked: event.target.checked })}
              />
              <span>
                <Lock size={14} aria-hidden="true" /> I confirm I am authorised to publish this media and caption.
              </span>
            </label>
          </section>

          {/* 2 — the consequence of those decisions, and nothing else. */}
          <section className="pubx-col pubx-preview" aria-label="Preview">
            <div className="pubx-preview-head">
              <StepHead n={2} title="Preview" sub="See how your post will look on each platform." />
              <div className="pubx-devices" role="tablist" aria-label="Preview size">
                {PREVIEW_DEVICES.map(({ id, label: name }) => {
                  const Icon = DEVICE_ICONS[id];
                  return (
                    <button key={id} type="button" role="tab" aria-selected={device === id} onClick={() => setDevice(id)}>
                      <Icon size={15} aria-hidden="true" />
                      {name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pubx-stage">
              {previewList.length > 1 && (
                <button type="button" className="pubx-nav" aria-label="Previous platform preview" onClick={() => stepPreview(-1)}>
                  <ChevronLeft size={18} aria-hidden="true" />
                </button>
              )}
              <div className="pub-canvas" ref={canvasRef} style={{ '--preview-scale': scale } as CSSProperties}>
                <DevicePreview
                  ref={frameRef}
                  platform={previewPlatform}
                  caption={viewingEnglish ? translation.englishDraft : draft.caption}
                  mediaDataUrl={draft.mediaDataUrl}
                  videoSrc={draft.localVideoUrl}
                  device={device}
                  accountName={accountName}
                />
              </div>
              {previewList.length > 1 && (
                <button type="button" className="pubx-nav" aria-label="Next platform preview" onClick={() => stepPreview(1)}>
                  <ChevronRight size={18} aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="pubx-preview-foot">
              <span className="pubx-preview-label">{label(previewPlatform)} preview</span>
              {viewingEnglish && (
                <span className="cap-lang-note">English preview — the original caption is what will be published.</span>
              )}
              {previewList.length > 1 && (
                <span className="pubx-dots">
                  {previewList.map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      className="pubx-dot"
                      aria-label={`Show ${label(id)} preview`}
                      aria-current={i === at || undefined}
                      onClick={() => setPreviewIndex(i)}
                    />
                  ))}
                </span>
              )}
            </div>
          </section>

          {/* 3 — what is about to go out, said plainly, then the sign-off. */}
          <section className="pubx-col pubx-review" aria-label="Review and confirm">
            <StepHead n={3} title="Review & Confirm" sub="Check your content and settings before publishing." />

            <div className="pubx-box">
              <label className="pubx-box-title" htmlFor="pub-caption">
                <FileText size={17} aria-hidden="true" /> Final caption
              </label>
              {translation.visible && (
                <div className="cap-lang-bar">
                  <CaptionTranslationToggle state={translation} />
                </div>
              )}
              <textarea
                id="pub-caption"
                className="pubx-caption"
                lang={viewingEnglish ? 'en' : undefined}
                value={viewingEnglish ? translation.englishDraft : draft.caption}
                onChange={(event) =>
                  viewingEnglish
                    ? translation.setEnglishDraft(event.target.value)
                    : onDraftChange({ caption: event.target.value })
                }
              />
              <p className="pubx-count" data-over={overLimit || undefined}>
                {draft.caption.length.toLocaleString()} / {limit.toLocaleString()}
              </p>
              <EnglishEditBar state={translation} />
            </div>

            <div className="pubx-box">
              <p className="pubx-box-title">
                <Eye size={17} aria-hidden="true" /> What will be published
              </p>
              <p className="pubx-box-sub">Here&rsquo;s a summary of your publishing plan.</p>
              <ul className="pubx-plan">
                {STUDIO_PLATFORMS.map(({ id, label: name }) => {
                  const connected = isConnected(id);
                  const on = draft.platforms.includes(id);
                  return (
                    <li key={id}>
                      <PlatformMark platform={id} />
                      <span className="pubx-plan-name">{name}</span>
                      {!connected ? (
                        <span className="pubx-chip" data-tone="off"><Minus size={12} aria-hidden="true" /> Not connected</span>
                      ) : on ? (
                        <span className="pubx-chip" data-tone="on">
                          {draft.visibility === 'public' ? <Globe size={12} aria-hidden="true" /> : <Lock size={12} aria-hidden="true" />}
                          {draft.visibility === 'public' ? 'Public' : 'Private'}
                        </span>
                      ) : (
                        <span className="pubx-chip" data-tone="idle">Not selected</span>
                      )}
                    </li>
                  );
                })}
              </ul>
              <dl className="pubx-facts">
                <div>
                  <dt><CalendarClock size={15} aria-hidden="true" /> Timing</dt>
                  <dd>{scheduled ? `Scheduled · ${formatSchedule(draft.scheduledFor as string)}` : 'Publishes now'}</dd>
                </div>
                <div>
                  <dt><FileText size={15} aria-hidden="true" /> Post type</dt>
                  <dd>{draft.paidPartnership ? 'Paid ad' : 'Organic post'}</dd>
                </div>
                <div>
                  <dt><Megaphone size={15} aria-hidden="true" /> Run as Paid Ad</dt>
                  <dd>{draft.paidPartnership ? 'Yes' : 'No'}</dd>
                </div>
              </dl>
            </div>
          </section>
        </div>

        <footer className="pubx-foot">
          <button type="button" className="pubx-cancel" onClick={onClose}>
            Cancel
          </button>
          <div className="pubx-foot-end">
            {/* Says what is still missing, so a disabled Confirm is never a mystery. */}
            {!canConfirm && (
              <span className="pubx-foot-hint">
                {draft.platforms.length === 0
                  ? 'Choose where to publish.'
                  : !scheduleValid
                    ? 'Pick a future date and time.'
                    : 'Tick the confirmation under Publishing Options.'}
              </span>
            )}
            <button type="button" className="pubx-confirm" disabled={!canConfirm} onClick={onConfirm}>
              {scheduled ? <CalendarClock size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
              {scheduled ? 'Confirm & Schedule' : 'Confirm & Publish'}
            </button>
          </div>
        </footer>
      </div>
    </Modal>
  );
}
