/**
 * The publishing modal.
 *
 * Publishing is the one irreversible action on this screen, so it takes over
 * the viewport: a large centred stage on a dimmed, blurred backdrop, with
 * everything behind it out of scope while it is open.
 *
 * 40/60. The left column is every decision that changes what gets published —
 * destinations, distribution, the final copy, the authorisation. The right is
 * the consequence of those decisions, and nothing else.
 *
 * Destination selection drives the preview: the platform pills used to sit
 * above the phone, which put the control that changes the preview in the same
 * place as the preview it changed. They are in the driver's seat on the left
 * now, and the space above the canvas belongs to the form factor instead.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { Lock, Megaphone, Send } from 'lucide-react';
import Modal from '../../shared/Modal';
import DevicePreview, { PREVIEW_DEVICES } from './DevicePreview';
import type { PreviewDevice } from './DevicePreview';
import { STUDIO_PLATFORMS } from './contentStudioTypes';
import type { PublishDraftState, StudioPlatformId } from './contentStudioTypes';
import { useConnections } from '../../../services/connectionsStore';

/**
 * Fitted frames stop just short of the canvas edge. A preview touching the
 * bounds on both axes reads as cropped even when every pixel is present.
 */
export const PREVIEW_FIT_MARGIN = 0.92;

export interface PublishModalProps {
  open: boolean;
  draft: PublishDraftState;
  onDraftChange: (patch: Partial<PublishDraftState>) => void;
  onClose: () => void;
  onConfirm: () => void;
}

export default function PublishModal({ open, draft, onDraftChange, onClose, onConfirm }: PublishModalProps) {
  const [device, setDevice] = useState<PreviewDevice>('mobile');
  // A disconnected platform cannot be added to "Publish to" without first
  // connecting it (Settings -> Platforms, docs/superpowers/plans/
  // 2026-08-10-ui-ux-overhaul-frontend/04-module-3.md, "Publish Composer
  // (connection-gated)"). Read here rather than in PublishComposer: that panel
  // no longer owns destination choice, this modal does.
  const { isConnected } = useConnections();

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
    // No frame to measure means nothing to fit against.
    if (!fw || !fh) return;
    // Each axis constrains independently, and an axis that reports 0 simply
    // does not constrain. Bailing out entirely on a zero — as this did — left
    // the frame at 1:1 and overflowing whenever the canvas had not been laid
    // out yet, which is exactly what the desktop preview hit.
    const byWidth = cw ? cw / fw : Infinity;
    const byHeight = ch ? ch / fh : Infinity;
    setScale(Math.min(1, byWidth, byHeight) * PREVIEW_FIT_MARGIN);
  }, []);

  // Measure now, then again after the browser has actually laid out. The first
  // pass can read a frame whose caption has not wrapped and whose media has not
  // resolved its aspect box yet — an under-measured height produces a scale
  // that is too large, which is what left the frame clipped at the bottom.
  useLayoutEffect(() => {
    fit();
    const id = requestAnimationFrame(fit);
    return () => cancelAnimationFrame(id);
  }, [fit, device, draft.caption, draft.mediaDataUrl, open]);

  // Observes BOTH boxes. Watching only the canvas left the fit stale whenever
  // the frame itself changed size — switching device, or a caption growing —
  // because the canvas never moved. ResizeObserver reports layout size, which
  // the scale transform does not affect, so this cannot feed back on itself.
  useEffect(() => {
    const canvas = canvasRef.current;
    const frame = frameRef.current;
    if (!canvas || !frame || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(fit);
    observer.observe(canvas);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [fit, open]);

  // The preview follows the destinations rather than carrying its own state:
  // one selection, one thing being previewed. Falls back to Instagram so the
  // canvas is never blank before a destination is picked.
  const previewPlatform: StudioPlatformId = (draft.platforms[0] as StudioPlatformId) ?? 'instagram';

  const togglePlatform = (platform: StudioPlatformId) => onDraftChange({
    platforms: draft.platforms.includes(platform)
      ? draft.platforms.filter((p) => p !== platform)
      : [...draft.platforms, platform],
  });

  return (
    <Modal open={open} onClose={onClose} variant="full" label="Publish">
      <div className="pub-shell">
        <div className="pub-controls">
          <fieldset className="pub-group">
            <legend>Publish to</legend>
            <div className="pub-plats">
              {STUDIO_PLATFORMS.map(({ id, label }) => {
                const connected = isConnected(id);
                return (
                  <label
                    key={id}
                    className="plat-opt"
                    data-on={draft.platforms.includes(id)}
                    data-disabled={!connected}
                  >
                    <input
                      type="checkbox"
                      checked={draft.platforms.includes(id)}
                      disabled={!connected}
                      onChange={() => togglePlatform(id)}
                    />
                    {label}
                    {!connected && <span className="text-meta">{' '}Not connected</span>}
                  </label>
                );
              })}
            </div>
          </fieldset>

          <fieldset className="pub-group">
            <legend>Distribution</legend>
            {/* .seg is the app's segmented control — the same object the caption
                platform tabs and the board filters use. */}
            <div className="seg" role="radiogroup" aria-label="Visibility">
              {(['public', 'private'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={draft.visibility === value}
                  aria-selected={draft.visibility === value}
                  onClick={() => onDraftChange({ visibility: value })}
                  className="capitalize"
                >
                  {value}
                </button>
              ))}
            </div>
            <label className="pub-switch">
              <input
                type="checkbox"
                checked={draft.paidPartnership}
                onChange={(event) => onDraftChange({ paidPartnership: event.target.checked })}
              />
              <Megaphone size={15} aria-hidden="true" />
              Run as Paid Ad
            </label>
          </fieldset>

          <div className="pub-group pub-group--grow">
            <label className="field-label" htmlFor="pub-caption">Final caption</label>
            <textarea
              id="pub-caption"
              className="textarea pub-caption"
              value={draft.caption}
              onChange={(event) => onDraftChange({ caption: event.target.value })}
            />
          </div>

          <label className="composer-agree">
            <input
              type="checkbox"
              checked={draft.agreementChecked}
              onChange={(event) => onDraftChange({ agreementChecked: event.target.checked })}
            />
            <span>
              <Lock size={15} className="mr-1 inline" aria-hidden="true" />
              I confirm I am authorised to publish this media and caption.
            </span>
          </label>
        </div>

        <div className="pub-preview">
          <div className="seg" role="tablist" aria-label="Preview size">
            {PREVIEW_DEVICES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={device === id}
                onClick={() => setDevice(id)}
              >
                {label}
              </button>
            ))}
          </div>

          <div
            className="pub-canvas"
            ref={canvasRef}
            style={{ '--preview-scale': scale } as CSSProperties}
          >
            <DevicePreview
              ref={frameRef}
              platform={previewPlatform}
              caption={draft.caption}
              mediaDataUrl={draft.mediaDataUrl}
              device={device}
            />
          </div>
        </div>

        <div className="pub-foot">
          <button type="button" className="btn-outline btn-outline--inverse" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-cta"
            disabled={!draft.agreementChecked || draft.platforms.length === 0}
            onClick={onConfirm}
          >
            <Send size={16} aria-hidden="true" /> Confirm &amp; Publish
          </button>
        </div>
      </div>
    </Modal>
  );
}
