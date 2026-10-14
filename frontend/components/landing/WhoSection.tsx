/**
 * Who it's for (#who): eight kinds of tourism business, each a card with a
 * real, credited stock photo and the tourism themes it usually maps to, plus
 * a band for LGU tourism offices and associations. A strip above the cards
 * explains that CeView forecasts by tourism theme, not by business type.
 *
 * The photos are illustrative, never customers; the footnote says so.
 * Below 768px the cards become a swipeable carousel with dot buttons.
 *
 * Styles: styles/landing-who.css (.cv-who-*).
 */
import { useEffect, useRef, useState } from 'react';
import {
  BedDouble,
  Bus,
  FerrisWheel,
  Fish,
  Gift,
  Landmark,
  Mountain,
  Shapes,
  Utensils,
  type LucideIcon,
} from 'lucide-react';
import { WHO } from '../../content/landing';
import type { ImageSlot } from '../../content/image-credits';
import { Accent, Button, Eyebrow, IconTile, LandingImage } from './ui';

type CardKey = (typeof WHO.cards)[number]['key'];

const ICONS: Record<CardKey, LucideIcon> = {
  resort: BedDouble,
  dive: Fish,
  adventure: Mountain,
  heritage: Landmark,
  attraction: FerrisWheel,
  food: Utensils,
  transport: Bus,
  souvenir: Gift,
};

/** Card photo width: a quarter of the page on desktop, half on tablet, 85% on phones. */
const CARD_SIZES = '(min-width: 1024px) 24vw, (min-width: 768px) 46vw, 85vw';

/** Two business types meeting one theme; decorative, the sentence beside it carries the meaning. */
function ThemeDiagram() {
  const [a, b] = WHO.explainer.from;
  return (
    <svg className="cv-who-diagram" viewBox="0 0 340 96" aria-hidden="true" focusable="false">
      <g className="cv-who-diagram-from">
        <rect x="1" y="6" width="126" height="30" rx="15" />
        <text x="64" y="25.5" textAnchor="middle">
          {a}
        </text>
        <rect x="1" y="60" width="126" height="30" rx="15" />
        <text x="64" y="79.5" textAnchor="middle">
          {b}
        </text>
      </g>
      <path className="cv-who-diagram-link" d="M127 21 C 168 21, 168 48, 202 48" />
      <path className="cv-who-diagram-link" d="M127 75 C 168 75, 168 48, 202 48" />
      <g className="cv-who-diagram-to">
        <rect x="202" y="31" width="136" height="34" rx="17" />
        <text x="270" y="52.5" textAnchor="middle">
          {WHO.explainer.to}
        </text>
      </g>
    </svg>
  );
}

export default function WhoSection() {
  const listRef = useRef<HTMLUListElement>(null);
  const [current, setCurrent] = useState(0);
  // Below 768px the list scrolls sideways; it then takes focus so keyboard users can scroll it too.
  const [isCarousel, setIsCarousel] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia?.('(max-width: 767px)');
    if (!mq) return;
    const update = () => setIsCarousel(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Carousel position for the dots (only scrolls below 768px).
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const items = [...list.children] as HTMLElement[];
        const left = list.scrollLeft;
        let best = 0;
        items.forEach((el, i) => {
          if (
            Math.abs(el.offsetLeft - list.offsetLeft - left) < Math.abs(items[best].offsetLeft - list.offsetLeft - left)
          )
            best = i;
        });
        setCurrent(best);
      });
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      list.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (i: number) => {
    const list = listRef.current;
    const item = list?.children[i] as HTMLElement | undefined;
    if (list && item) list.scrollTo({ left: item.offsetLeft - list.offsetLeft, behavior: 'smooth' });
  };

  return (
    <section className="cv-section cv-who" id="who" aria-labelledby="cv-who-title">
      <div className="cv-container">
        <div className="cv-grid cv-who-head">
          <div className="cv-who-heading">
            <Eyebrow>{WHO.eyebrow}</Eyebrow>
            <h2 id="cv-who-title" className="cv-display-lg">
              {WHO.titleLead}
              <Accent>{WHO.titleAccent}</Accent>
              {WHO.titleTail}
            </h2>
          </div>
          <p className="cv-body-lg cv-who-intro">{WHO.intro}</p>
        </div>

        <div className="cv-who-explainer">
          <IconTile icon={Shapes} />
          <p className="cv-who-explainer-text">{WHO.explainer.text}</p>
          <ThemeDiagram />
        </div>

        <ul
          ref={listRef}
          className="cv-who-grid"
          aria-label="Kinds of tourism business"
          tabIndex={isCarousel ? 0 : undefined}
        >
          {WHO.cards.map((c) => {
            const Icon = ICONS[c.key];
            return (
              <li key={c.key} className="cv-who-card">
                <div className="cv-who-photo">
                  <LandingImage slot={`who-${c.key}` as ImageSlot} fill sizes={CARD_SIZES} />
                </div>
                <div className="cv-who-body">
                  <IconTile icon={Icon} className="cv-who-icon" />
                  <h3 className="cv-who-title">{c.title}</h3>
                  <p className="cv-who-text">{c.body}</p>
                  <ul className="cv-who-themes" aria-label="Usual tourism themes">
                    {c.themes.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
        <div className="cv-who-dots">
          {WHO.cards.map((c, i) => (
            <button
              key={c.key}
              type="button"
              aria-label={`Show card ${i + 1} of ${WHO.cards.length}: ${c.title}`}
              aria-current={i === current || undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="cv-who-partner">
          <div className="cv-who-partner-copy">
            <Eyebrow>{WHO.partner.eyebrow}</Eyebrow>
            <h3 className="cv-who-partner-title">{WHO.partner.title}</h3>
            <p className="cv-who-partner-body">{WHO.partner.body}</p>
            <Button href={WHO.partner.ctaHref} variant="ghost-on-dark" arrow>
              {WHO.partner.cta}
            </Button>
          </div>
          <div className="cv-who-partner-photo">
            <LandingImage slot="who-partner-community" fill sizes="(min-width: 1024px) 40vw, 100vw" />
          </div>
        </div>

        <p className="cv-caption cv-who-footnote">{WHO.footnote}</p>
      </div>
    </section>
  );
}
