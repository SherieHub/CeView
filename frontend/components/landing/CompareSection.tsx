/**
 * Why CeView (#compare): the usual options a tourism MSME has, what each
 * usually gives, and what CeView adds — a comparison laid out as cards, with
 * the CeView column highlighted like a featured pricing column. Then the
 * positioning statement and the connected-workflow ribbon.
 *
 * Each row is a list item that reads as "Option / Usually / CeView adds" to
 * assistive tech; on desktop the per-cell labels are visually hidden and the
 * column headers (decorative) show instead. Below 768px rows stack as cards.
 *
 * Styles: styles/landing-compare.css (.cv-cmp-*).
 */
import { Fragment } from 'react';
import { ArrowRight, BarChart3, Check, FileText, MapPin, Settings, Sparkles, Target, Briefcase, CalendarDays, Globe, Search, UserRound, type LucideIcon } from 'lucide-react';
import { COMPARE } from '../../content/landing';
import { Accent, Eyebrow } from './ui';

const ICONS: Record<(typeof COMPARE.rows)[number]['icon'], LucideIcon> = {
  calendar: CalendarDays,
  briefcase: Briefcase,
  globe: Globe,
  search: Search,
  user: UserRound,
};

const ADD_ICONS = [BarChart3, Settings, Target, BarChart3, Sparkles];
const FLOW_ICONS = [BarChart3, MapPin, FileText, Check, BarChart3];

export default function CompareSection() {
  const c = COMPARE;
  return (
    <section className="cv-section cv-cmp" id="compare" aria-labelledby="cv-cmp-title">
      <div className="cv-cmp-ring" aria-hidden="true" />
      <div className="cv-container">
        <header className="cv-cmp-head">
          <Eyebrow>{c.eyebrow}</Eyebrow>
          <h2 id="cv-cmp-title" className="cv-display-lg cv-cmp-title">
            {c.titleLead}
            <Accent>{c.titleAccent}</Accent>
            {c.titleTail}
          </h2>
        </header>

        <div className="cv-cmp-table">
          <div className="cv-cmp-cols" aria-hidden="true">
            <span>{c.headers.option}</span>
            <span>{c.headers.usually}</span>
            <span data-highlight>{c.headers.adds}</span>
          </div>
          <ul className="cv-cmp-rows">
            {c.rows.map((r, i) => {
              const Icon = ICONS[r.icon];
              const AddIcon = ADD_ICONS[i];
              return (
                <li key={r.option} className="cv-cmp-row">
                  <h3 className="cv-cmp-option">
                    <span className="cv-cmp-icon" aria-hidden="true">
                      <Icon size={18} strokeWidth={1.75} />
                    </span>
                    {r.option}
                  </h3>
                  <p className="cv-cmp-usually">
                    <span className="cv-cmp-label">{c.usuallyLabel} </span>
                    {r.usually}
                  </p>
                  <p className="cv-cmp-adds">
                    <span className="cv-cmp-add-icon" aria-hidden="true"><AddIcon size={18} strokeWidth={1.75} /></span>
                    <span><span className="cv-cmp-label">{c.addsLabel} </span>{r.adds}</span>
                  </p>
                </li>
              );
            })}
          </ul>
        </div>

        <p className="cv-cmp-statement">
          {c.statementLead} <mark>{c.statementHighlight}</mark>
        </p>

        <ol className="cv-cmp-flow" aria-label={c.workflowLabel}>
          {c.workflow.map((step, i) => {
            const FlowIcon = FLOW_ICONS[i];
            return (
            <Fragment key={step}>
              {i > 0 && (
                <li className="cv-cmp-flow-arrow" aria-hidden="true">
                  <ArrowRight size={16} strokeWidth={1.75} />
                </li>
              )}
              <li className="cv-cmp-flow-step"><span className="cv-cmp-flow-icon" aria-hidden="true"><FlowIcon size={16} strokeWidth={1.75} /></span>{step}</li>
            </Fragment>
          );
          })}
        </ol>
      </div>
    </section>
  );
}
