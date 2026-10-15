/**
 * Pricing (#pricing). Proposed launch plans, labelled as proposed throughout.
 *
 * A warm band with limestone cliffs fading in at both top corners; four plan
 * cards (Growth raised, dark, with a "Recommended" tab); an add-ons bar; and
 * the Partner Plan band, whose offer panel fades into an aerial island photo.
 *
 * The billing toggle is a pair of native radio buttons styled as a segmented
 * control, so arrow keys and screen readers work as for any radio group.
 * Every CTA goes to the demo form as `#demo?plan=<id>`; LeadForm reads it.
 * Below 768px the cards are a swipeable carousel that opens on Growth.
 *
 * Styles: styles/landing-pricing.css (.cv-price-*).
 */
import { useEffect, useRef, useState } from 'react';
import { Check, Layers } from 'lucide-react';
import { PRICING } from '../../content/landing';
import { Accent, Button, Eyebrow, LandingImage } from './ui';

type Billing = 'monthly' | 'annual';

/** "Additional branch: ₱699/month" → the peso amount in bold. */
function AddOn({ text }: { text: string }) {
  const m = text.match(/^(.*?)(₱[\d,]+)(.*)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      {m[1]}
      <strong>{m[2]}</strong>
      {m[3]}
    </>
  );
}

export default function PricingSection() {
  const p = PRICING;
  const [billing, setBilling] = useState<Billing>('monthly');
  const [current, setCurrent] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const growthIndex = p.plans.findIndex((plan) => 'recommended' in plan);

  // On phones, open the carousel on the recommended plan, and keep the dots
  // in step with swiping.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const offsetOf = (i: number) => (list.children[i] as HTMLElement).offsetLeft - list.offsetLeft;
    // Measuring at load would force a layout of the whole page, so wait
    // until the carousel is about to come into view.
    let opener: IntersectionObserver | undefined;
    if (window.matchMedia?.('(max-width: 767px)').matches && typeof IntersectionObserver !== 'undefined') {
      opener = new IntersectionObserver(
        (entries) => {
          if (!entries.some((e) => e.isIntersecting)) return;
          opener?.disconnect();
          list.scrollLeft = offsetOf(growthIndex);
          setCurrent(growthIndex);
        },
        { rootMargin: '400px 0px' },
      );
      opener.observe(list);
    }
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let best = 0;
        for (let i = 1; i < list.children.length; i++)
          if (Math.abs(offsetOf(i) - list.scrollLeft) < Math.abs(offsetOf(best) - list.scrollLeft)) best = i;
        setCurrent(best);
      });
    };
    list.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      opener?.disconnect();
      list.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, [growthIndex]);

  const goTo = (i: number) => {
    const list = listRef.current;
    const item = list?.children[i] as HTMLElement | undefined;
    if (list && item) list.scrollTo({ left: item.offsetLeft - list.offsetLeft, behavior: 'smooth' });
  };

  return (
    <section className="cv-section cv-price" id="pricing" aria-labelledby="cv-price-title">
      <div className="cv-price-cliff" data-side="left" aria-hidden="true">
        <LandingImage slot="how-lagoon" fill decorative sizes="30vw" />
      </div>
      <div className="cv-price-cliff" data-side="right" aria-hidden="true">
        <LandingImage slot="how-lagoon" fill decorative sizes="30vw" />
      </div>

      <div className="cv-container cv-price-inner">
        <header className="cv-price-head">
          <Eyebrow className="cv-price-eyebrow">{p.eyebrow}</Eyebrow>
          <h2 id="cv-price-title" className="cv-display-lg cv-price-title">
            {p.titleLead}
            <Accent>{p.titleAccent}</Accent>
            {p.titleTail}
          </h2>
          <p className="cv-price-intro">{p.intro}</p>
        </header>

        <fieldset className="cv-price-toggle">
          <legend className="sr-only">{p.billingLabel}</legend>
          {(['monthly', 'annual'] as const).map((b) => (
            <label key={b} className="cv-price-toggle-option">
              <input type="radio" name="cv-billing" value={b} checked={billing === b} onChange={() => setBilling(b)} />
              <span>{p.billing[b]}</span>
            </label>
          ))}
        </fieldset>

        <ul ref={listRef} className="cv-price-grid" aria-label="Plans">
          {p.plans.map((plan) => {
            const price = plan[billing];
            const featured = 'recommended' in plan;
            return (
              <li key={plan.id} className="cv-price-card" data-featured={featured || undefined}>
                {featured && <span className="cv-price-ribbon">{p.recommended}</span>}
                <h3 className="cv-price-name">{plan.name}</h3>
                <p className="cv-price-amount">
                  {price.price.startsWith('From ') && <span className="cv-price-from">From </span>}
                  <span className="cv-price-value">{price.price.replace(/^From /, '')}</span>
                  <span className="cv-price-period">{price.period}</span>
                </p>
                <p className="cv-price-note">{'note' in price ? price.note : ' '}</p>
                <p className="cv-price-best">
                  <span>{p.bestForLabel}</span> {plan.bestFor}
                </p>
                <ul className="cv-price-list">
                  {plan.includes.map((item) => (
                    <li key={item}>
                      <span className="cv-price-check" aria-hidden="true">
                        <Check size={12} strokeWidth={3} />
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <Button
                  href={`#demo?plan=${plan.id}`}
                  variant={featured ? 'primary' : 'secondary'}
                  arrow
                  block
                  className="cv-price-cta"
                  aria-label={`${plan.cta}: ${plan.name} plan`}
                >
                  {plan.cta}
                </Button>
              </li>
            );
          })}
        </ul>
        <div className="cv-price-dots">
          {p.plans.map((plan, i) => (
            <button
              key={plan.id}
              type="button"
              aria-label={`Show the ${plan.name} plan`}
              aria-current={i === current || undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>

        <div className="cv-price-addons">
          <span className="cv-price-addons-label">
            <Layers size={22} strokeWidth={1.5} aria-hidden="true" />
            {p.addOnsLabel}
          </span>
          <ul>
            {p.addOns.map((a) => (
              <li key={a}>
                <AddOn text={a} />
              </li>
            ))}
          </ul>
        </div>

        <div className="cv-price-partner">
          <div className="cv-price-partner-copy">
            <Eyebrow className="cv-price-partner-eyebrow">{p.partner.eyebrow}</Eyebrow>
            <h3 className="cv-price-partner-title">{p.partner.title}</h3>
            <p className="cv-price-partner-body">{p.partner.body}</p>
          </div>
          <div className="cv-price-partner-offer">
            <div className="cv-price-partner-photo" aria-hidden="true">
              <LandingImage slot="cta-aerial-ocean" fill decorative sizes="(min-width: 1024px) 45vw, 100vw" />
            </div>
            <p className="cv-price-amount">
              <span className="cv-price-value">{p.partner.price}</span>
              <span className="cv-price-period">{p.partner.period}</span>
            </p>
            <p className="cv-price-partner-terms">{p.partner.terms}</p>
            <Button href="#demo?plan=partner" arrow>
              {p.partner.cta}
            </Button>
          </div>
        </div>

        <p className="cv-price-fine">{p.finePrint}</p>
      </div>
    </section>
  );
}
