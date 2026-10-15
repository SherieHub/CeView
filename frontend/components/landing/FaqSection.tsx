/**
 * FAQ (#faq): a pale-mint band. On the left the intro, a "Request a demo"
 * link and a Cebu photo card (with a soft circle and palm frond behind it);
 * on the right a white card holding the accordion — one answer open at a
 * time, the first open by default. Each question is a real <button> inside
 * a heading, wired to its answer region with aria-expanded / aria-controls;
 * closed answers are `inert`, so nothing inside them is focusable while
 * collapsed. The same Q&A text is published as FAQPage JSON-LD.
 *
 * Styles: styles/landing-closing.css (.cv-faq-*).
 */
import { useState } from 'react';
import { ArrowRight, Minus, Plus } from 'lucide-react';
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

/** Leaflets of a single palm frond, drawn along one curved stem (decorative). */
const FROND = 'M18 232Q62 223 101 203Q57 211 18 232ZM18 232Q11 188 -9 149Q-2 192 18 232ZM28 214Q70 208 109 190Q66 196 28 214ZM28 214Q23 171 6 133Q11 175 28 214ZM38 196Q79 193 117 178Q76 181 38 196ZM38 196Q36 156 21 117Q24 158 38 196ZM49 179Q89 178 126 165Q86 167 49 179ZM49 179Q49 140 37 103Q37 142 49 179ZM62 163Q99 164 135 154Q98 153 62 163ZM62 163Q63 126 54 89Q52 127 62 163ZM75 147Q111 150 145 142Q110 139 75 147ZM75 147Q78 112 71 77Q67 112 75 147ZM89 132Q123 136 156 130Q122 126 89 132ZM89 132Q94 98 88 65Q83 98 89 132ZM104 117Q136 123 168 118Q136 113 104 117ZM104 117Q110 85 107 53Q100 85 104 117ZM120 103Q150 110 180 107Q150 100 120 103ZM120 103Q127 73 125 42Q118 72 120 103ZM137 89Q165 97 194 96Q166 88 137 89ZM137 89Q145 61 144 32Q136 60 137 89ZM154 76Q181 84 208 84Q182 76 154 76ZM154 76Q163 50 164 23Q155 48 154 76ZM173 63Q197 72 223 73Q199 64 173 63ZM173 63Q183 39 184 14Q175 37 173 63ZM193 51Q215 60 239 62Q217 53 193 51ZM193 51Q203 29 205 5Q195 27 193 51ZM213 39Q234 49 256 51Q236 42 213 39ZM213 39Q223 19 226 -3Q217 17 213 39Z';

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
    <section className="cv-section cv-faq" id="faq" aria-labelledby="cv-faq-title">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON_LD }} />
      <div className="cv-container cv-faq-grid">
        <div className="cv-faq-side">
          <Eyebrow>{FAQ.eyebrow}</Eyebrow>
          <h2 id="cv-faq-title" className="cv-display-lg cv-faq-title">
            {FAQ.titleLines.map((line, i) => (
              <span key={line} className="cv-faq-title-line">
                {line}
                {i === FAQ.titleLines.length - 1 && (
                  <>
                    <Accent>{FAQ.titleAccent}</Accent>
                    {FAQ.titleTail}
                  </>
                )}{' '}
              </span>
            ))}
          </h2>
          <p className="cv-faq-intro">
            {FAQ.introLead}
            <br />
            {FAQ.introLink}
            {FAQ.introTail}
          </p>
          <a className="cv-faq-cta" href={DEMO_ANCHOR}>
            <span>{FAQ.introLink}</span>
            <span className="cv-faq-cta-arrow" aria-hidden="true">
              <ArrowRight size={18} strokeWidth={2} />
            </span>
          </a>
          <figure className="cv-faq-card">
            <span className="cv-faq-circle" aria-hidden="true" />
            <div className="cv-faq-photo">
              <LandingImage slot="faq-card" fill sizes="(min-width: 1024px) 26vw, 90vw" />
            </div>
            <figcaption>{FAQ.cardCaption}</figcaption>
          </figure>
          <svg className="cv-faq-frond" viewBox="-10 -5 270 260" aria-hidden="true" focusable="false">
            <path d={FROND} />
          </svg>
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
                      {isOpen ? <Minus size={15} strokeWidth={2} /> : <Plus size={15} strokeWidth={2} />}
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
