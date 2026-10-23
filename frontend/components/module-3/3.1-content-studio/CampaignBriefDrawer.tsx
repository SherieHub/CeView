/**
 * Slide-out visual guide — the full shooting reference for the chosen
 * caption: tips for the target market, the caption's four shots laid out at
 * once (captionShots.ts — each with its inspiration photo, the caption line it
 * illustrates and how to take it), and the platform's AI guide lines.
 *
 * The four shots are where generated AI inspiration shots will appear; until
 * that service exists they, and the market tips, are MOCK. The platform guide
 * lines are real (from caption generation).
 *
 * Scoped deliberately to MEDIA guidance — the button that opens it sits beside
 * the media step, so that is what an operator expects to find.
 *
 * Built on the shared Drawer so it joins the same overlay stack as the Market
 * Radar drawer: Escape and the scrim close it, and a modal opened above it
 * closes first.
 */
import { CheckCircle2, ImageIcon, Lightbulb, Sparkles } from 'lucide-react';
import Drawer from '../../shared/Drawer';
import { ShotList } from './ShotSlides';
import { tipsFor } from './captionShots';
import type { ShotSlide } from './captionShots';

export interface CampaignBriefDrawerProps {
  open: boolean;
  onClose: () => void;
  /** FTUE only — the one-time explanation of what this panel is for. */
  showWelcome: boolean;
  /** The target market, as the operator knows it. */
  marketName?: string;
  /** The chosen caption's shots (captionShots.ts). Empty until they're generated. */
  slides?: ShotSlide[];
  /** A caption is chosen but its shots haven't been generated yet. */
  shotsPending?: boolean;
  /** The platform's AI visual-guide lines, from caption generation. */
  platformGuide?: string[];
}

export default function CampaignBriefDrawer({
  open,
  onClose,
  showWelcome,
  marketName,
  slides = [],
  shotsPending = false,
  platformGuide = [],
}: CampaignBriefDrawerProps) {
  const tips = tipsFor(marketName);

  return (
    <Drawer open={open} onClose={onClose} label="Visual Guide">
      <div className="vg-drawer">
        <div className="vg-drawer-head">
          <span className="vg-panel-icon" aria-hidden="true"><ImageIcon size={22} /></span>
          <div>
            <h2 className="vg-drawer-title">Visual Guide{marketName ? ` for ${marketName}` : ''}</h2>
            <p className="vg-panel-sub">
              Shots for your caption, and how to take them{marketName ? ` for travelers from ${marketName}` : ''}.
            </p>
          </div>
        </div>

        <section className="vg-tips" aria-labelledby="vg-tips-title">
          <div className="vg-tips-intro">
            <span className="vg-tips-icon" aria-hidden="true"><Lightbulb size={18} /></span>
            <div>
              <h3 id="vg-tips-title" className="vg-tips-title">Key tips{marketName ? ` for the ${marketName} market` : ''}</h3>
              <p className="vg-panel-sub">Visual styles that tend to work well{marketName ? ` with travelers from ${marketName}` : ''}.</p>
            </div>
          </div>
          <ul className="vg-tips-list">
            {tips.map((t) => (
              <li key={t}><CheckCircle2 size={15} aria-hidden="true" /> {t}</li>
            ))}
          </ul>
        </section>

        {showWelcome && (
          <p className="studio-note" data-testid="brief-welcome">
            <Sparkles size={16} aria-hidden="true" />
            This panel holds the shots for your caption and how to take them. It stays out of your way — reopen it
            any time with "Review Visual Guide".
          </p>
        )}

        <h3 className="vg-section-title">Shots for your caption</h3>
        {slides.length > 0 ? (
          <>
            <ShotList slides={slides} />
            <p className="vg-mock-note">Photos are examples for inspiration, not your business — shoot your own.</p>
          </>
        ) : shotsPending ? (
          <p className="vg-panel-sub">Generate the AI shots from the Visual guide beside the upload, and they&rsquo;ll appear here.</p>
        ) : (
          <p className="vg-panel-sub">Choose a caption in Draft — the guide suggests shots for it.</p>
        )}

        {platformGuide.length > 0 && (
          <>
            <h3 className="vg-section-title">Platform direction</h3>
            <ul className="vg-platform">
              {platformGuide.map((line) => (
                <li key={line}><CheckCircle2 size={15} aria-hidden="true" /> {line}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Drawer>
  );
}
