/**
 * Public landing page ("/"), for Cebu tourism businesses evaluating CeView.
 *
 * Narrative: signal → opportunity → market → marketing action → review →
 * better next decision, ending on the demo request. Sections live in
 * components/landing/; all copy and configurable links are in
 * content/landing.ts, photo credits in content/image-credits.ts. Tokens and
 * shared primitives (.cv-*) are in styles/landing-foundation.css; older
 * section styles are the "Landing page" block (.lp-*) in styles/index.css.
 */
// Self-hosted landing fonts: Fraunces (display, with italic for the accent
// word) and Caveat (the handwritten annotation). Inter comes from index.html.
import '@fontsource-variable/fraunces/opsz.css';
import '@fontsource-variable/fraunces/opsz-italic.css';
import '@fontsource/caveat/600.css';
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

export default function LandingPage() {
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
