/**
 * FAQ (#faq): a sticky intro with a small photo card on the left (desktop),
 * an accordion on the right — one answer open at a time, the first open by
 * default. Each question is a real <button> inside a heading, wired to its
 * answer region with aria-expanded / aria-controls; closed answers are
 * `inert`, so nothing inside them is focusable while collapsed. The same Q&A
 * text is published as FAQPage JSON-LD.
 *
 * Styles: styles/landing-closing.css (.cv-faq-*).
 */
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { DEMO_ANCHOR, FAQ } from '../../content/landing';
import { Accent, Eyebrow, LandingImage } from './ui';

const JSON_LD = JSON.stringify({
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.items.map((item) => ({
    '@type': 'Question',
    name: item.q,
    acceptedAnswer: { '@type': 'Answer', text: item.a },
  })),
});

/** The answer text, with its `link` phrase (if any) turned into an in-page link. */
function Answer({ item }: { item: (typeof FAQ.items)[number] }) {
  if (!('link' in item)) return <>{item.a}</>;
  const i = item.a.lastIndexOf(item.link.text);
  if (i < 0) return <>{item.a}</>;
  return (
    <>
      {item.a.slice(0, i)}
      <a href={item.link.href}>{item.link.text}</a>
      {item.a.slice(i + item.link.text.length)}
    </>
  );
}

export default function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="cv-section cv-faq" data-bg="white" id="faq" aria-labelledby="cv-faq-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      <div className="cv-container cv-faq-grid">
        <div className="cv-faq-side">
          <Eyebrow>{FAQ.eyebrow}</Eyebrow>
          <h2 id="cv-faq-title" className="cv-display-lg cv-faq-title">
            {FAQ.titleLead}
            <Accent>{FAQ.titleAccent}</Accent>
            {FAQ.titleTail}
          </h2>
          <p className="cv-body-lg">
            {FAQ.introLead}
            <a href={DEMO_ANCHOR}>{FAQ.introLink}</a>
            {FAQ.introTail}
          </p>
          <figure className="cv-faq-card">
            <div className="cv-faq-photo">
              <LandingImage slot="faq-card" fill sizes="(min-width: 1024px) 26vw, 90vw" />
            </div>
            <figcaption>{FAQ.cardCaption}</figcaption>
          </figure>
        </div>

        <div className="cv-faq-list">
          {FAQ.items.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className="cv-faq-item" data-open={isOpen || undefined}>
                <h3 className="cv-faq-q">
                  <button
                    type="button"
                    id={`cv-faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`cv-faq-a-${i}`}
                    onClick={() => setOpen(isOpen ? null : i)}
                  >
                    <span>{item.q}</span>
                    <span className="cv-faq-icon" aria-hidden="true">
                      <Plus size={18} strokeWidth={2} />
                    </span>
                  </button>
                </h3>
                <div
                  className="cv-faq-a"
                  id={`cv-faq-a-${i}`}
                  role="region"
                  aria-labelledby={`cv-faq-q-${i}`}
                  inert={!isOpen}
                >
                  <div>
                    <p>
                      <Answer item={item} />
                    </p>
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
