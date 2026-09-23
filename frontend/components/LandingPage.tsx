/**
 * Public landing page ("/"), for Cebu tourism businesses evaluating CeView.
 *
 * Narrative: signal → opportunity → market → marketing action → review →
 * better next decision, ending on the demo request. Sections live in
 * components/landing/; all copy and configurable links are in
 * components/landing/landingContent.ts; styles are the "Landing page" block
 * (.lp-*) in styles/index.css.
 */
import LandingNav from './landing/LandingNav';
import LandingHero from './landing/LandingHero';
import ProblemSection from './landing/ProblemSection';
import BenefitsSection from './landing/BenefitsSection';
import ProductTour from './landing/ProductTour';
import HowItWorks from './landing/HowItWorks';
import FeatureBento from './landing/FeatureBento';
import AudienceSection from './landing/AudienceSection';
import ComparisonSection from './landing/ComparisonSection';
import TrustSection from './landing/TrustSection';
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
        <ProblemSection />
        <BenefitsSection />
        <ProductTour />
        <HowItWorks />
        <FeatureBento />
        <AudienceSection />
        <ComparisonSection />
        <TrustSection />
        <DemoSection />
        <FaqSection />
        <FinalCta />
      </main>
      <LandingFooter />
    </div>
  );
}
