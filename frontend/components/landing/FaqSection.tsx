/**
 * FAQ — an accessible accordion (one question open at a time).
 * Each question is a real <button> inside a heading, wired to its answer
 * region with aria-expanded / aria-controls. Closed answers are `inert`, so
 * nothing inside them is focusable while collapsed.
 */
import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { FAQ } from './landingContent';
import { SectionHead } from './landingParts';

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="lp-section lp-section--white" id="faq" aria-labelledby="lp-faq-title">
      <div className="lp-wrap lp-faq-grid">
        <div className="lp-faq-side">
          <SectionHead id="lp-faq-title" eyebrow={FAQ.eyebrow} title={FAQ.title} />
          <p className="lp-body">
            Something else on your mind? <a href="#request-demo">Request a demo</a> and ask us directly.
          </p>
        </div>

        <div className="lp-faq-list">
          {FAQ.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="lp-faq-item" data-open={isOpen || undefined}>
                <h3 className="lp-faq-q">
                  <button
                    type="button"
                    id={`lp-faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`lp-faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span>{item.q}</span>
                    <ChevronDown size={20} aria-hidden="true" className="lp-faq-chevron" />
                  </button>
                </h3>
                <div
                  className="lp-faq-a"
                  id={`lp-faq-a-${i}`}
                  role="region"
                  aria-labelledby={`lp-faq-q-${i}`}
                  inert={!isOpen}
                >
                  <div>
                    <p className="lp-body">{item.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
