/**
 * The head band every Content Studio panel shares: icon chip, title, one line
 * of support copy, and an optional control on the same baseline.
 *
 * Extracted because the four panels had hand-copied the same block at
 * .heading-lg (32px) — larger than the screen's own <h1> renders in this shell
 * (28px), so each panel announced itself louder than the page it sat on, and
 * four of them stacked read as four page titles rather than one screen with
 * four parts. The scale lives in .studio-head (styles/index.css) now, at the
 * same 20px the dashboard's section headings use, so the studio and the
 * dashboard agree on what a panel title is.
 *
 * The 16px support line was competing too: it matched the body copy inside the
 * panel, so nothing marked where the header ended. It drops to the meta size
 * and the muted colour.
 *
 * Presentational and stateless.
 */
import type { ReactNode } from 'react';

interface PanelHeadProps {
  /** Lucide glyph for the chip. Sized by CSS, not by the caller. */
  icon: ReactNode;
  title: string;
  /** Matches the panel's own aria-labelledby. */
  titleId: string;
  subtitle: ReactNode;
  /** Panel-level control, right-aligned against the title. */
  actions?: ReactNode;
}

export default function PanelHead({ icon, title, titleId, subtitle, actions }: PanelHeadProps) {
  return (
    <div className="studio-head">
      <span className="studio-head-ico" aria-hidden="true">
        {icon}
      </span>
      <div className="min-w-0">
        <h2 id={titleId} className="studio-head-title">
          {title}
        </h2>
        <p className="studio-head-sub">{subtitle}</p>
      </div>
      {actions && <div className="studio-head-actions">{actions}</div>}
    </div>
  );
}
