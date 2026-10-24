/**
 * Public landing page ("/"), for Cebu tourism businesses evaluating CeView.
 *
 * Narrative: signal → opportunity → market → marketing action → review →
 * better next decision, ending on the demo request. Sections live in
 * components/landing/; all copy and configurable links are in
 * content/landing.ts, photo credits in content/image-credits.ts. Tokens and
 * shared primitives (.cv-*) are in styles/landing-foundation.css; each
 * section has its own styles/landing-*.css.
 *
 * Sections below the hero use `content-visibility: auto` (styles/index.css),
 * so the first paint only lays out the hero. Off-screen sections then have
 * estimated heights, which would make in-page links land short; so the first
 * time someone follows one (or arrives with a #hash), every section is
 * rendered for real before the browser scrolls.
 */
// Self-hosted landing fonts: Fraunces (display, with italic for the accent
// word) and Caveat (the handwritten annotation). Inter comes from index.html.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource/caveat/600.css';
import { useEffect } from 'react';
import LandingNav from './landing/LandingNav';
import LandingHero from './landing/LandingHero';
import MarketStrip from './landing/MarketStrip';
import ChallengeSection from './landing/ChallengeSection';
import ValuePillars from './landing/ValuePillars';
import ProductSection from './landing/ProductSection';
import WorkflowSection from './landing/WorkflowSection';
import FeaturesSection from './landing/FeaturesSection';
import WhoSection from './landing/WhoSection';
import CompareSection from './landing/CompareSection';
import TrustSection from './landing/TrustSection';
import PricingSection from './landing/PricingSection';
import DemoSection from './landing/DemoSection';
import FaqSection from './landing/FaqSection';
import LandingFooter, { FinalCta } from './landing/LandingFooter';

/** Turns off the content-visibility skipping for good (see the note above). */
function renderAllSections() {
  document.documentElement.setAttribute('data-lp-full', '');
}

export default function LandingPage() {
  useEffect(() => {
    if (window.location.hash) {
      renderAllSections();
      // Arriving from another screen (the demo's "Request a demo", a legal
      // page) is an in-app navigation, and browsers only scroll to the hash
      // on a full page load — so go there once the sections have rendered.
      // Sections and images above it lay out as they load, moving the target;
      // keep re-aiming until it has held still for a few frames, for at most
      // two seconds, and never once the visitor starts scrolling themselves.
      const id = decodeURIComponent(window.location.hash.slice(1));
      const startedAt = performance.now();
      let lastTop = Number.NaN;
      let still = 0;
      let stopped = false;
      const stop = () => { stopped = true; };
      const settle = () => {
        const el = document.getElementById(id);
        if (stopped || !el) return;
        // Instant: the site's smooth scrolling would restart on every re-aim.
        el.scrollIntoView({ behavior: 'instant' });
        const top = Math.round(el.getBoundingClientRect().top);
        still = Math.abs(top - lastTop) < 2 ? still + 1 : 0;
        lastTop = top;
        if (still < 8 && performance.now() - startedAt < 2000) requestAnimationFrame(settle);
      };
      for (const type of ['wheel', 'touchstart', 'keydown'] as const) {
        window.addEventListener(type, stop, { once: true, passive: true });
      }
      requestAnimationFrame(settle);
    }
    // Capture phase: runs before the browser's own scroll to the anchor.
    const onClick = (e: MouseEvent) => {
      const link = (e.target as Element | null)?.closest?.('a[href^="#"]');
      if (link) renderAllSections();
    };
    document.addEventListener('click', onClick, true);
    window.addEventListener('hashchange', renderAllSections);
    return () => {
      document.removeEventListener('click', onClick, true);
      window.removeEventListener('hashchange', renderAllSections);
    };
  }, []);

  return (
    <div className="lp">
      <a href="#lp-main" className="lp-skip">
        Skip to content
      </a>
      <LandingNav />
      <main id="lp-main">
        <LandingHero />
        <MarketStrip />
        <ChallengeSection />
        <ValuePillars />
        <ProductSection />
        <WorkflowSection />
        <FeaturesSection />
        <WhoSection />
        <CompareSection />
        <TrustSection />
        <PricingSection />
        <DemoSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
