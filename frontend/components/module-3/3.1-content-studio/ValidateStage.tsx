/**
 * Quick Post — Validate. The post as it will go out on the left (its media and
 * caption, each with a way back to change it) and the compliance audit on the
 * right. Publishing itself sits in the stage footer (QuickPostWorkspace), and
 * the ad URL block, when the alert window has one, runs across the foot.
 *
 * The post carries one image — the composer takes one — so the media panel
 * shows that image rather than a carousel of several.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { ImageIcon, Maximize2, PenLine } from 'lucide-react';
import Modal from '../../shared/Modal';
import CompliancePanel from './CompliancePanel';
import type { AuditState, PublishDraftState } from './contentStudioTypes';

interface ValidateStageProps {
  draft: PublishDraftState;
  audit: AuditState;
  onAuditChange: (audit: AuditState) => void;
  recommendations: Record<string, unknown> | null;
  onEditCaption: () => void;
  onManageMedia: () => void;
  /** Below both columns — the ad URL block, when there is one. */
  footer?: ReactNode;
}

export default function ValidateStage({
  draft,
  audit,
  onAuditChange,
  recommendations,
  onEditCaption,
  onManageMedia,
  footer,
}: ValidateStageProps) {
  const [mediaOpen, setMediaOpen] = useState(false);
  const caption = draft.caption.trim();

  return (
    <div className="val">
      <div className="val-main">
        <section className="val-box" aria-labelledby="val-media-title">
          <div className="val-box-head">
            <h4 id="val-media-title" className="val-label">Selected media ({draft.mediaDataUrl ? 1 : 0})</h4>
            <button type="button" className="val-link" onClick={onManageMedia}>
              <ImageIcon size={15} aria-hidden="true" /> Manage media
            </button>
          </div>
          {draft.mediaDataUrl ? (
            <div className="val-media">
              <img src={draft.mediaDataUrl} alt="Attached media" />
              <button type="button" className="val-media-expand" aria-label="View media full size" onClick={() => setMediaOpen(true)}>
                <Maximize2 size={15} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button type="button" className="val-media val-media--empty" onClick={onManageMedia}>
              <ImageIcon size={22} aria-hidden="true" />
              <span>No media yet — add it in Attach.</span>
            </button>
          )}

          <div className="val-box-head val-box-head--caption">
            <h4 className="val-label">Caption</h4>
            <button type="button" className="val-link" onClick={onEditCaption}>
              <PenLine size={14} aria-hidden="true" /> Edit
            </button>
          </div>
          <p className="val-caption" data-empty={!caption || undefined}>
            {caption || 'No caption yet — choose one in Draft.'}
          </p>
        </section>
      </div>

      <div className="val-audit">
        <CompliancePanel draft={draft} audit={audit} onAuditChange={onAuditChange} recommendations={recommendations} />
      </div>

      {footer && <div className="val-foot">{footer}</div>}

      <Modal open={mediaOpen} onClose={() => setMediaOpen(false)} title="Publication media">
        {draft.mediaDataUrl && <img className="media-full" src={draft.mediaDataUrl} alt="Publication media at full size" />}
      </Modal>
    </div>
  );
}
