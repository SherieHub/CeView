/**
 * Value pillars (#why): four outcomes for the business, one card each, with
 * the outcome label pinned to the bottom of every card.
 *
 * Styles: styles/landing-how.css (.cv-why-*).
 */
import { BarChart3, PenLine, RefreshCw, Users } from 'lucide-react';
import { WHY } from '../../content/landing';
import { Accent, Card, Eyebrow, IconTile } from './ui';

const ICONS = [BarChart3, Users, PenLine, RefreshCw];

export default function ValuePillars() {
  return (
    <section className="cv-section cv-why" id="why" aria-labelledby="cv-why-title">
      <div className="cv-why-photo" aria-hidden="true" />
      <svg className="cv-why-contours" viewBox="0 0 1600 900" preserveAspectRatio="none" fill="none" aria-hidden="true">
        <path d="M760 -30C1100 -30 930 240 1210 180S1280 390 1480 340 1680 500 1700 520" />
        <path d="M900 -40C1150 70 1030 150 1300 220S1290 370 1530 430 1630 550 1700 570" />
        <path d="M-50 330C160 340 -10 600 210 630S230 870 530 900" />
        <path d="M-60 410C70 470 -30 610 150 660S270 920 550 940" />
      </svg>
      <div className="cv-container">
        <div className="cv-grid cv-why-head">
          <div className="cv-why-heading">
            <Eyebrow>{WHY.eyebrow}</Eyebrow>
            <h2 id="cv-why-title" className="cv-display-lg">
              {WHY.titleLead}
              <Accent>{WHY.titleAccent}</Accent>
              {WHY.titleTail}
            </h2>
          </div>
          <p className="cv-body-lg cv-why-intro">{WHY.intro}</p>
        </div>

        <ul className="cv-why-grid">
          {WHY.pillars.map((p, i) => (
            <li key={p.title}>
              <Card className="cv-why-card">
                <IconTile icon={ICONS[i]} tone={p.tone} />
                <h3 className="cv-title">{p.title}</h3>
                <p className="cv-why-body">{p.body}</p>
                <p className="cv-why-outcome">{p.outcome}</p>
              </Card>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
