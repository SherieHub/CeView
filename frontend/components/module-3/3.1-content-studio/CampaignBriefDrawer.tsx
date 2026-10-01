/**
 * Slide-out visual guide — the shooting reference for this campaign: the
 * direction principles, and the shot list with its lighting notes.
 *
 * Scoped deliberately to MEDIA guidance. It briefly also carried the moodboard
 * and the per-option copywriting rationale, which made it a catch-all "campaign
 * brief" — but the button that opens it sits beside the media step, so that is
 * what an operator expects to find, and mixing copy analysis in meant scrolling
 * past it to reach the shot list.
 *
 * This is the ONLY copy of the shot list. An inline collapsed accordion above
 * the upload used to render it as well; the composer now offers a
 * "Review Visual Guide" link beside the upload control instead.
 *
 * Built on the shared Drawer so it joins the same overlay stack as the Market
 * Radar drawer: Escape and the scrim close it, and a modal opened above it
 * (the publish modal) closes first.
 *
 * The guide is generated ON REQUEST, not on mount: the backend only produces a
 * direction once the operator has approved captions for the market (400
 * missing_dependency otherwise). The drawer therefore owns the explicit
 * "Approve & get visual guide" action and a visible state for every step of
 * it — it used to render nothing at all when the request had failed.
 */
import { CheckCircle2, Camera, Lightbulb, Loader2, RefreshCw, Sparkles } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { CreativeDirection } from '../../../types';

export type VisualGuideStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface CampaignBriefDrawerProps {
  open: boolean;
  onClose: () => void;
  /** FTUE only — the one-time explanation of what this panel is for. */
  showWelcome: boolean;
  direction: CreativeDirection | null;
  /** Defaults to 'ready' when a direction is passed, 'idle' otherwise. */
  status?: VisualGuideStatus;
  error?: unknown;
  /** The market the guide is (or will be) generated for, as the operator knows it. */
  marketName?: string;
  /** Approval covers the market's generated captions — gated on one being picked. */
  captionChosen?: boolean;
  /** Approves the market's captions, then generates the guide. Also the retry. */
  onApprove?: () => void;
}

export default function CampaignBriefDrawer({
  open,
  onClose,
  showWelcome,
  direction,
  status = direction ? 'ready' : 'idle',
  error,
  marketName,
  captionChosen = false,
  onApprove,
}: CampaignBriefDrawerProps) {
  const forMarket = marketName ? ` for ${marketName}` : '';
  const empty = status === 'ready' && direction != null
    && direction.visualGuide.length === 0 && direction.shots.length === 0;

  return (
    <Drawer open={open} onClose={onClose} label="Visual Guide">
      <div className="brief-head">
        <span className="conn-ico" aria-hidden="true"><Camera /></span>
        <div className="studio-head-text">
          <h2 className="heading-md">Visual Guide</h2>
          <p className="body-sm">Shooting reference for this market and platform.</p>
        </div>
      </div>

      {showWelcome && (
        <p className="studio-note" data-testid="brief-welcome">
          <Sparkles size={16} aria-hidden="true" />
          This panel holds the visual direction and shot list for your media. It stays out of your
          way — reopen it any time with "Visual Guide".
        </p>
      )}

      {status === 'idle' && onApprove && (
        <div className="brief-state">
          <h3 className="heading-sm">Get a shot list{forMarket}</h3>
          <p className="body-sm">
            {captionChosen
              ? 'Approving marks this market\'s captions as final, then generates the visual direction and shot list to match them.'
              : 'Select a caption option first. Approving it marks this market\'s captions as final and generates a visual direction and shot list to match.'}
          </p>
          <button
            type="button"
            className="btn-primary brief-state-action"
            onClick={onApprove}
            disabled={!captionChosen}
          >
            <CheckCircle2 size={16} aria-hidden="true" />
            Approve &amp; get visual guide
          </button>
        </div>
      )}

      {status === 'loading' && (
        <div className="brief-state" role="status">
          <p className="body-sm brief-state-row">
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            Generating your visual guide{forMarket}…
          </p>
          <p className="body-xs">This usually takes a few seconds.</p>
        </div>
      )}

      {status === 'error' && (
        <div className="brief-state">
          <ApiErrorPanel error={error} label="Visual Guide" />
          {onApprove && (
            <button type="button" className="btn-outline brief-state-action" onClick={onApprove}>
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      )}

      {empty && (
        <div className="brief-state">
          <p className="body-sm">
            The visual guide{forMarket} came back empty — the AI service returned no direction or shots.
          </p>
          {onApprove && (
            <button type="button" className="btn-outline brief-state-action" onClick={onApprove}>
              <RefreshCw size={14} aria-hidden="true" />
              Try again
            </button>
          )}
        </div>
      )}

      {status === 'ready' && marketName && !empty && (
        <p className="body-xs brief-for">Generated for {marketName} from your approved captions.</p>
      )}

      {status === 'ready' && direction && direction.visualGuide.length > 0 && (
        <div className="studio-block">
          <h3>Visual direction</h3>
          <ol className="studio-list">
            {direction.visualGuide.map((item, index) => (
              <li key={item}>
                <span className="badge badge--teal">{index + 1}</span>
                <span className="body-sm">{item}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {status === 'ready' && direction && direction.shots.length > 0 && (
        <div className="studio-block">
          <h3>Shot list</h3>
          <ol className="shot-list">
            {direction.shots.map((shot) => (
              <li key={shot.label} className="shot">
                <p className="shot-title">
                  {shot.shotType && <span className="shot-type">{shot.shotType}</span>}
                  <span className="shot-subject">{shot.subject ?? shot.label}</span>
                </p>

                {/* Structured directives when the service supplies them; the
                    narrative otherwise. A photographer on set scans for the one
                    line they need, which a paragraph does not allow. */}
                {shot.placement || shot.action || shot.context ? (
                  <dl className="shot-specs">
                    {shot.placement && (
                      <div><dt>Placement</dt><dd>{shot.placement}</dd></div>
                    )}
                    {shot.action && (
                      <div><dt>Action</dt><dd>{shot.action}</dd></div>
                    )}
                    {shot.context && (
                      <div><dt>Context</dt><dd>{shot.context}</dd></div>
                    )}
                  </dl>
                ) : (
                  <p className="shot-narrative">{shot.description}</p>
                )}

                <p className="shot-lighting">
                  <Lightbulb size={15} aria-hidden="true" />
                  <span><b>Lighting constraint:</b> {shot.lighting}</span>
                </p>
              </li>
            ))}
          </ol>
        </div>
      )}

    </Drawer>
  );
}
