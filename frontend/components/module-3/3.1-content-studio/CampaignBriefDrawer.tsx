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
 */
import { Camera, Lightbulb, Sparkles } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import type { CreativeDirection } from '../../../types';

export interface CampaignBriefDrawerProps {
  open: boolean;
  onClose: () => void;
  /** FTUE only — the one-time explanation of what this panel is for. */
  showWelcome: boolean;
  direction: CreativeDirection | null;
}

export default function CampaignBriefDrawer({
  open,
  onClose,
  showWelcome,
  direction,
}: CampaignBriefDrawerProps) {
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

      {direction && direction.visualGuide.length > 0 && (
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

      {direction && direction.shots.length > 0 && (
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
