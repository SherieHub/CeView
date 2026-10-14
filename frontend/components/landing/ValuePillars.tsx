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
    <section className="cv-section cv-why" data-bg="white" id="why" aria-labelledby="cv-why-title">
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
