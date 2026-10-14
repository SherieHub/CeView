/**
 * The Market Explorer card in the product split: five markets ranked for a
 * sample beach resort, drawn in HTML (not an image) and badged "Sample data".
 * Rows slide in one after another and the score bars fill when the card
 * scrolls into view; with reduced motion everything is simply shown.
 *
 * Styles: styles/landing-product.css (.cv-mx-*).
 */
import type { CSSProperties } from 'react';
import { Plane } from 'lucide-react';
import { PRODUCT } from '../../content/landing';
import { Chip, MarketFlag, SampleBadge } from './ui';
import useInView from './ui/useInView';

export default function MarketExplorer({ className }: { className?: string }) {
  const m = PRODUCT.explorer;
  const [ref, shown] = useInView<HTMLDivElement>(0.35);

  return (
    <div ref={ref} className={`cv-mx${className ? ` ${className}` : ''}`} data-shown={shown || undefined}>
      <div className="cv-mx-head">
        <p className="cv-mx-title">{m.title}</p>
        <SampleBadge />
      </div>
      <p className="cv-mx-sub">{m.subtitle}</p>

      <ol className="cv-mx-rows">
        {m.rows.map((r, i) => (
          <li key={r.key} className="cv-mx-row" style={{ '--i': i, '--score': `${r.score}%` } as CSSProperties}>
            <span className="cv-mx-market">
              <MarketFlag market={r.key} name={r.name} detail={'note' in r ? r.note : undefined} />
              <span className="cv-mx-bar">
                <span />
              </span>
            </span>
            <Chip variant={r.tone} pill className="cv-mx-chip">
              {r.status}
            </Chip>
            <span className="cv-mx-score">{r.score}</span>
          </li>
        ))}
      </ol>

      <p className="cv-mx-flight">
        <Plane size={14} strokeWidth={1.75} aria-hidden="true" />
        {m.flight}
      </p>
      <ul className="cv-mx-factors" aria-label="Factors in the ranking">
        {m.factors.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
