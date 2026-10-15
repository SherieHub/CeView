/**
 * How it works (#how-it-works): the one place the page explains the workflow.
 *
 * A light band with a lagoon photo fading in from the top right (with the
 * handwritten note over it). Five phase cards deepen from
 * white to dark teal; a coral marker above phase 04 shows where you approve,
 * and a dashed loop runs from phase 05 back to 02. Then the result card with
 * the CTAs, and the search-interest fine print.
 *
 * Styles: styles/landing-how.css (.cv-how-*).
 */
import { Building2, ChartLine, Hand, PenLine, RefreshCw, ShieldCheck, type LucideIcon } from 'lucide-react';
import { DEMO_ANCHOR, HOW, TOUR_ANCHOR } from '../../content/landing';
import { Accent, Button, Eyebrow, LandingImage } from './ui';
import useInView from './ui/useInView';

const ICONS: LucideIcon[] = [Building2, ChartLine, PenLine, ShieldCheck, RefreshCw];
const APPROVE_STEP = 3; // phase 04, zero-based

function HandNote() {
  const [ref, shown] = useInView<HTMLParagraphElement>(0.6);
  return (
    <p ref={ref} className="cv-how-note" data-shown={shown || undefined}>
      {HOW.note.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <svg className="cv-how-swash" viewBox="0 0 220 20" aria-hidden="true" focusable="false">
        <path d="M4 15 C 46 6, 98 8, 140 6 S 196 2, 216 3" pathLength={1} />
      </svg>
    </p>
  );
}

export default function WorkflowSection() {
  return (
    <section className="cv-how" id="how-it-works" aria-labelledby="cv-how-title">
      <div className="cv-how-photo" aria-hidden="true">
        <LandingImage slot="how-lagoon" fill decorative sizes="(min-width: 1024px) 62vw, 100vw" />
      </div>

      <div className="cv-container cv-how-inner">
        <header className="cv-how-head">
          <Eyebrow>{HOW.eyebrow}</Eyebrow>
          <h2 id="cv-how-title" className="cv-display-lg cv-how-title">
            {HOW.titleLead}
            <Accent>{HOW.titleAccent}</Accent>
            {HOW.titleTail}
          </h2>
          <p className="cv-body-lg cv-how-intro">{HOW.intro}</p>
        </header>

        <HandNote />

        <ol className="cv-how-cards" aria-label="The five phases">
          {HOW.phases.map((p, i) => {
            const Icon = ICONS[i];
            return (
              <li key={p.title} className="cv-how-card" data-step={i + 1}>
                {i === APPROVE_STEP && (
                  <p className="cv-how-approve">
                    <span className="cv-how-approve-icon" aria-hidden="true">
                      <Hand size={15} strokeWidth={2} />
                    </span>
                    <span aria-hidden="true">{HOW.approve}</span>
                    <span className="sr-only">{HOW.approveLabel}</span>
                  </p>
                )}
                <div className="cv-how-card-top">
                  <span className="cv-how-num" aria-hidden="true">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <span className="cv-how-icon" aria-hidden="true">
                    <Icon size={18} strokeWidth={1.75} />
                  </span>
                </div>
                <h3 className="cv-how-card-title">
                  <span className="sr-only">Phase {i + 1}: </span>
                  {p.title}
                </h3>
                <p className="cv-how-does">{p.does}</p>
                <div className="cv-how-get">
                  <p className="cv-how-get-label">{HOW.youGetLabel}</p>
                  <p className="cv-how-get-value">{p.youGet}</p>
                </div>
              </li>
            );
          })}
        </ol>

        <div className="cv-how-loop">
          <svg viewBox="0 0 1000 70" preserveAspectRatio="none" aria-hidden="true" focusable="false">
            <path d="M1000 0 C 1000 40, 985 52, 940 52 L 60 52 C 15 52, 0 40, 0 8" vectorEffect="non-scaling-stroke" />
          </svg>
          <span className="cv-how-loop-head" aria-hidden="true" />
          <p className="cv-how-loop-label">
            <RefreshCw className="cv-how-loop-icon" size={18} strokeWidth={1.75} aria-hidden="true" />
            {HOW.loop}
          </p>
        </div>

        <div className="cv-how-result">
          <p className="cv-how-result-text">
            <strong>{HOW.resultLead}</strong> {HOW.result}
          </p>
          <div className="cv-how-ctas">
            <Button href={DEMO_ANCHOR}>
              {HOW.primaryCta}
            </Button>
            <Button href={TOUR_ANCHOR} variant="secondary" play>
              {HOW.secondaryCta}
            </Button>
          </div>
        </div>
        <p className="cv-how-fine">{HOW.finePrint}</p>
      </div>
    </section>
  );
}
