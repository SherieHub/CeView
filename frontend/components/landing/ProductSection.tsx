/**
 * Product section (#product).
 *
 * Part A, the split: copy on the left; the Market Explorer card (sample data)
 * overlapping the left edge of a photo collage — a traveler over turquoise
 * water, an inset sea turtle, and a handwritten note with a coral swash.
 * Part B (ScreenTabs): the real CeView screens, one tab each.
 *
 * Styles: styles/landing-product.css (.cv-product-*, .cv-mx-*, .cv-screens-*).
 */
import { PRODUCT } from '../../content/landing';
import { Accent, Button, Eyebrow, LandingImage } from './ui';
import useInView from './ui/useInView';
import MarketExplorer from './MarketExplorer';
import ScreenTabs from './ScreenTabs';

/**
 * The handwritten note. Rendered twice: beside the photo on desktop, and after
 * the Market Explorer card below 1024px (where the card overlaps the photo's
 * foot). CSS shows one; the hidden copy is display:none, so AT reads it once.
 */
function HandNote({ placement }: { placement: 'desktop' | 'mobile' }) {
  const [ref, shown] = useInView<HTMLParagraphElement>(0.6);
  return (
    <p ref={ref} className="cv-product-note" data-placement={placement} data-shown={shown || undefined}>
      {PRODUCT.note.map((line) => (
        <span key={line}>{line}</span>
      ))}
      <svg className="cv-product-swash" viewBox="0 0 220 20" aria-hidden="true" focusable="false">
        <path d="M4 13 C 38 5, 74 17, 112 10 S 182 4, 216 9" pathLength={1} />
      </svg>
    </p>
  );
}

export default function ProductSection() {
  return (
    <section className="cv-section cv-product" id="product" aria-labelledby="cv-product-title">
      <div className="cv-container">
        <div className="cv-product-split">
          <div className="cv-product-copy">
            <Eyebrow>{PRODUCT.eyebrow}</Eyebrow>
            <h2 id="cv-product-title" className="cv-display-lg cv-product-title">
              {PRODUCT.titleLead}
              <Accent>{PRODUCT.titleAccent}</Accent>
              {PRODUCT.titleTail}
            </h2>
            <p className="cv-body-lg cv-product-body">{PRODUCT.body}</p>
            <Button href={PRODUCT.ctaHref} variant="secondary" arrow className="cv-product-cta">
              {PRODUCT.cta}
            </Button>
          </div>

          <div className="cv-product-collage">
            <div className="cv-product-photo">
              <LandingImage slot="product-traveler-lagoon" fill sizes="(min-width: 1024px) 50vw, 100vw" />
            </div>
            <div className="cv-product-inset">
              <LandingImage slot="product-sea-turtle" fill sizes="(min-width: 1024px) 20vw, 40vw" />
            </div>
            <HandNote placement="desktop" />
          </div>

          <MarketExplorer className="cv-product-card" />
          <HandNote placement="mobile" />
        </div>

        <ScreenTabs />
      </div>
    </section>
  );
}
