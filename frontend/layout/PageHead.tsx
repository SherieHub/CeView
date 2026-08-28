/**
 * PageHead — the single <h1> a screen owns, with optional eyebrow, subtitle
 * and a right-aligned actions slot.
 *
 * Exists because the Topbar used to render the route title and every screen
 * stacked a second title block beneath it. One heading per screen, rendered by
 * the screen that knows what it is called (the dashboard's is a greeting, not
 * a route name), with the screen-level actions sitting on the same baseline
 * instead of in a separate row.
 *
 * Presentational and stateless. Modules 3 and 4 reuse it as their screens land.
 */
import type { ReactNode } from 'react';

interface PageHeadProps {
  /** Small uppercase label above the title — context, not a heading. */
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Screen-level controls, right-aligned on wide viewports. */
  actions?: ReactNode;
}

export default function PageHead({ eyebrow, title, subtitle, actions }: PageHeadProps) {
  return (
    <div className="page-head">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-1">{eyebrow}</p>}
        {/* .heading-lg (2rem), not .heading-xl (2.5rem): 40px is the login
            hero's size, and a screen title repeated on every page does not need
            hero weight — at 40px the greeting dominated the data below it.
            Still a step above .heading-md, which the section headings use. */}
        <h1 className="heading-lg">{title}</h1>
        {subtitle && <p className="body-sm mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="page-head-actions">{actions}</div>}
    </div>
  );
}
