import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, TrendingUp, Target, Megaphone, ShieldCheck, ChevronDown, CheckCircle2, Globe, MapPin, ArrowRight, Menu, X, Bell } from 'lucide-react';

const LandingPage: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  return (
    <div className="min-h-screen bg-off-white font-body text-text-body antialiased selection:bg-mint-primary selection:text-navy-dark">
      {/* 1. Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b border-gray-light bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-chrome text-cyan-accent shadow-sm">
              <TrendingUp className="h-5 w-5" />
            </div>
            <span className="font-heading text-xl font-bold text-navy-primary tracking-tight">CeView</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-8">
            <a href="#why-ceview" className="text-sm font-medium text-text-body hover:text-navy-primary transition-colors">Why CeView</a>
            <a href="#how-it-works" className="text-sm font-medium text-text-body hover:text-navy-primary transition-colors">How It Works</a>
            <a href="#features" className="text-sm font-medium text-text-body hover:text-navy-primary transition-colors">Features</a>
            <a href="#who-its-for" className="text-sm font-medium text-text-body hover:text-navy-primary transition-colors">Who It's For</a>
            <a href="#faq" className="text-sm font-medium text-text-body hover:text-navy-primary transition-colors">FAQ</a>
          </div>

          <div className="hidden lg:flex items-center gap-6">
            <Link to="/login" className="text-sm font-semibold text-navy-primary hover:text-mint-primary transition-colors">
              Sign In
            </Link>
            <a href="#request-demo" className="btn-cta btn-cta--sm">
              Request a Demo
            </a>
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className="lg:hidden p-2 -mr-2 text-navy-primary"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            aria-label="Toggle menu"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Nav Dropdown */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-16 left-0 w-full bg-white border-b border-gray-light shadow-lg px-6 py-6 flex flex-col gap-6">
            <a href="#why-ceview" className="text-base font-medium text-navy-primary" onClick={() => setIsMobileMenuOpen(false)}>Why CeView</a>
            <a href="#how-it-works" className="text-base font-medium text-navy-primary" onClick={() => setIsMobileMenuOpen(false)}>How It Works</a>
            <a href="#features" className="text-base font-medium text-navy-primary" onClick={() => setIsMobileMenuOpen(false)}>Features</a>
            <a href="#who-its-for" className="text-base font-medium text-navy-primary" onClick={() => setIsMobileMenuOpen(false)}>Who It's For</a>
            <a href="#faq" className="text-base font-medium text-navy-primary" onClick={() => setIsMobileMenuOpen(false)}>FAQ</a>
            <div className="h-px w-full bg-gray-light"></div>
            <Link to="/login" className="text-base font-semibold text-navy-primary" onClick={() => setIsMobileMenuOpen(false)}>Sign In</Link>
            <a href="#request-demo" className="btn-cta w-full justify-center" onClick={() => setIsMobileMenuOpen(false)}>Request a Demo</a>
          </div>
        )}
      </nav>

      {/* 2. Hero + Primary CTA */}
      <section className="relative overflow-hidden bg-white px-6 pt-20 pb-24 text-center lg:px-8 lg:pt-28 lg:pb-32">
        {/* Subtle Background Effects */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-full pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] bg-cyan-accent/5 rounded-full blur-3xl"></div>
          {/* Faint Grid matching CeView's structured UI background */}
          <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, var(--color-navy-primary) 1px, transparent 0)', backgroundSize: '32px 32px' }}></div>
        </div>

        <div className="relative mx-auto max-w-4xl z-10">
          <div className="mb-8 inline-flex items-center rounded-pill bg-mint-pale px-4 py-1.5">
            <span className="text-sm font-semibold text-teal-accent tracking-wide uppercase">Tourism Demand Intelligence for Cebu Businesses</span>
          </div>
          
          <h1 className="heading-hero mb-8 text-navy-primary max-w-4xl mx-auto leading-tight">
            See where traveler demand is heading—<br className="hidden md:block" />
            <span className="text-teal-accent">before the opportunity passes.</span>
          </h1>
          
          <p className="mx-auto mb-10 max-w-3xl text-lg text-text-body md:text-xl leading-relaxed">
            CeView helps Cebu tourism businesses spot rising interest from South Korea, Japan, and the United States, identify the markets worth focusing on, and prepare marketing around those opportunities.
          </p>
          
          <div className="flex flex-col items-center justify-center gap-4 sm:flex-row mb-6">
            <a href="#request-demo" className="btn-cta w-full sm:w-auto text-lg px-8 py-4">
              Request a Demo
              <ArrowRight className="h-5 w-5 ml-1" />
            </a>
            <a href="[DEMO VIDEO URL]" className="btn-outline w-full sm:w-auto text-lg px-8 py-4">
              Watch Product Walkthrough
            </a>
          </div>
          
          <p className="text-sm text-text-muted font-medium">
            Built for Cebu tourism MSMEs &bull; No data-science expertise required
          </p>
        </div>

        {/* Hero Product Visual with Microcards */}
        <div className="relative mx-auto max-w-[1040px] mt-20 z-10">
          <div className="relative rounded-xl border border-gray-light bg-off-white p-2 shadow-overlay lg:p-4">
            
            {/* Mock Dashboard Screenshot Frame */}
            <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-white relative border border-gray-light">
              <img 
                src="/assets/dashboard-preview.png" 
                alt="CeView Dashboard showing top target markets, surge alerts, and demand forecasting" 
                className="w-full h-full object-cover opacity-90"
                style={{ backgroundColor: '#F7F9FA' }}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-text-muted font-heading font-medium tracking-widest uppercase opacity-50 bg-white/80 px-4 py-2 rounded-md backdrop-blur-sm">[ACTUAL DASHBOARD SCREENSHOT PLACEMENT]</span>
              </div>
            </div>

            {/* Microcard 1: Demand is rising */}
            <div className="absolute -left-6 top-1/4 hidden lg:flex flex-col gap-1 card border border-gray-light shadow-card p-4 !rounded-xl z-20 hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-mint-pale text-teal-accent">
                  <TrendingUp className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Demand is rising</span>
              </div>
              <span className="font-heading text-lg font-bold text-navy-primary">+24% forecasted interest</span>
            </div>

            {/* Microcard 2: Market opportunity */}
            <div className="absolute -right-8 top-1/3 hidden lg:flex flex-col gap-1 card border border-gray-light shadow-card p-4 !rounded-xl z-20 hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-sand/30 text-coral-cta">
                  <Globe className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Market opportunity</span>
              </div>
              <span className="font-heading text-lg font-bold text-navy-primary">South Korea</span>
            </div>

            {/* Microcard 3: Recommended timing */}
            <div className="absolute -bottom-6 left-1/3 hidden lg:flex flex-col gap-1 card border border-gray-light shadow-card p-4 !rounded-xl z-20 hover:-translate-y-1 transition-transform duration-300">
              <div className="flex items-center gap-2 mb-1">
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-cyan-deep/10 text-cyan-deep">
                  <Bell className="h-3 w-3" />
                </div>
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Recommended timing</span>
              </div>
              <span className="font-heading text-lg font-bold text-navy-primary">Prepare campaign now</span>
            </div>

          </div>
        </div>
      </section>

      {/* 3. Short Credibility / Value Strip */}
      <section className="border-b border-gray-light bg-white py-8">
        <div className="mx-auto max-w-[1180px] px-6 text-center lg:px-8">
          <p className="mb-6 text-sm font-semibold uppercase tracking-wider text-text-muted">
            Currently monitoring travel demand from
          </p>
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16">
            <div className="flex items-center gap-2 text-navy-primary">
              <Globe className="h-6 w-6 text-mint-primary" />
              <span className="font-heading text-lg font-semibold">South Korea</span>
            </div>
            <div className="flex items-center gap-2 text-navy-primary">
              <Globe className="h-6 w-6 text-mint-primary" />
              <span className="font-heading text-lg font-semibold">Japan</span>
            </div>
            <div className="flex items-center gap-2 text-navy-primary">
              <Globe className="h-6 w-6 text-mint-primary" />
              <span className="font-heading text-lg font-semibold">United States</span>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Customer Problem */}
      <section className="bg-mint-pale py-20 lg:py-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="eyebrow text-teal-accent mb-4 block">The Challenge</span>
            <h2 className="heading-lg mb-6 text-navy-primary">By the time demand picks up, your best marketing window may already be closing.</h2>
            <p className="text-lg text-text-body">
              Traveler interest changes long before it shows up as a booking, inquiry, or walk-in. But for many small tourism businesses, spotting those changes early—and knowing what to do next—is difficult.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 mb-20">
            {/* Problem 1 */}
            <div className="card border border-gray-light bg-white p-8">
              <h3 className="font-heading text-xl font-semibold text-navy-primary mb-3">
                You don't always know where the next opportunity is coming from.
              </h3>
              <p className="text-text-body">
                A business may know international travelers are important without knowing whether interest from Korea, Japan, or the United States is beginning to rise.
              </p>
            </div>

            {/* Problem 2 */}
            <div className="card border border-gray-light bg-white p-8">
              <h3 className="font-heading text-xl font-semibold text-navy-primary mb-3">
                Marketing becomes reactive.
              </h3>
              <p className="text-text-body">
                When the signal becomes obvious, businesses may already be competing for attention during the same busy period.
              </p>
            </div>

            {/* Problem 3 */}
            <div className="card border border-gray-light bg-white p-8">
              <h3 className="font-heading text-xl font-semibold text-navy-primary mb-3">
                Too many disconnected tools, too little time.
              </h3>
              <p className="text-text-body">
                Market research, content creation, campaign planning, and performance review often happen separately—if they happen at all.
              </p>
            </div>
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <h3 className="heading-md text-navy-primary mb-12">
              CeView brings the signal, the market, and the marketing decision into one workflow.
            </h3>
            
            <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
              {/* Teal connecting line on desktop */}
              <div className="hidden md:block absolute top-1/2 left-0 w-full h-0.5 bg-mint-light -translate-y-1/2 z-0"></div>

              {/* Step 1 */}
              <div className="relative z-10 flex flex-col items-center bg-mint-pale px-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-sand/20 border-2 border-coral-cta text-coral-cta mb-3">
                  <span className="h-3 w-3 rounded-full bg-coral-cta"></span>
                </div>
                <span className="font-heading font-semibold text-navy-primary text-sm md:text-base">Spot the opportunity</span>
              </div>

              {/* Step 2 */}
              <div className="relative z-10 flex flex-col items-center bg-mint-pale px-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-mint-light text-mint-primary mb-3">
                  <div className="h-2 w-2 rounded-full bg-mint-primary"></div>
                </div>
                <span className="font-heading font-semibold text-navy-primary text-sm md:text-base">Understand the market</span>
              </div>

              {/* Step 3 */}
              <div className="relative z-10 flex flex-col items-center bg-mint-pale px-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-mint-light text-mint-primary mb-3">
                  <div className="h-2 w-2 rounded-full bg-mint-primary"></div>
                </div>
                <span className="font-heading font-semibold text-navy-primary text-sm md:text-base">Prepare your content</span>
              </div>

              {/* Step 4 */}
              <div className="relative z-10 flex flex-col items-center bg-mint-pale px-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white border-2 border-mint-light text-mint-primary mb-3">
                  <div className="h-2 w-2 rounded-full bg-mint-primary"></div>
                </div>
                <span className="font-heading font-semibold text-navy-primary text-sm md:text-base">Review what works</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Product Preview */}
      <section id="preview" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="eyebrow text-teal-accent mb-4 block">See CeView in Action</span>
            <h2 className="heading-lg mb-6 text-navy-primary">From traveler interest to a marketing decision—without jumping between tools.</h2>
            <p className="text-lg text-text-body">
              CeView turns tourism-demand signals into clear market opportunities, marketing direction, content guidance, and performance insights inside one connected workspace.
            </p>
          </div>

          <div className="flex flex-col lg:flex-row gap-8 lg:gap-12 items-start">
            {/* Tabs List */}
            <div className="w-full lg:w-1/3 flex overflow-x-auto lg:flex-col gap-4 pb-6 lg:pb-0 snap-x snap-mandatory hide-scrollbar -mx-6 px-6 lg:mx-0 lg:px-0">
              {[
                { title: "Demand Intelligence", caption: "See when traveler interest may be rising and which international markets deserve attention.", points: ["Upcoming demand windows", "Ranked target markets", "Market opportunity signals"] },
                { title: "Content Studio", caption: "Turn the market opportunity into content ideas that fit your business and target audience.", points: ["Marketing direction", "Suggested captions", "Hashtag/content guidance"] },
                { title: "Content Review", caption: "Check whether your promotional material still matches the campaign direction before moving forward.", points: ["Content alignment", "Clear improvement suggestions", "Human review stays in control"] },
                { title: "Performance", caption: "Bring campaign results back into the same workflow so your next marketing decision starts with more context.", points: [] }
              ].map((tab, idx) => (
                <button 
                  key={idx}
                  onClick={() => setActiveTab(idx)}
                  className={`text-left p-6 rounded-xl border transition-all duration-200 shrink-0 w-[85vw] sm:w-[320px] lg:w-full snap-center ${activeTab === idx ? 'bg-mint-pale border-mint-light shadow-sm' : 'bg-white border-transparent hover:bg-off-white hover:border-gray-light'}`}
                >
                  <h3 className={`font-heading text-xl font-semibold mb-2 ${activeTab === idx ? 'text-navy-primary' : 'text-text-muted'}`}>{tab.title}</h3>
                  <div className={`overflow-hidden transition-all duration-300 ${activeTab === idx ? 'max-h-[500px] opacity-100 mt-2' : 'max-h-0 opacity-0'}`}>
                    <p className="text-text-body mb-4 whitespace-normal">{tab.caption}</p>
                    {tab.points.length > 0 && (
                      <ul className="space-y-2 whitespace-normal">
                        {tab.points.map((point, pIdx) => (
                          <li key={pIdx} className="flex items-start gap-2 text-sm text-navy-primary font-medium">
                            <CheckCircle2 className="h-4 w-4 mt-0.5 text-mint-primary shrink-0" />
                            {point}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </button>
              ))}
            </div>

            {/* Tab Panels (Screenshots) */}
            <div className="w-full lg:w-2/3">
              <div className="rounded-xl border border-gray-light bg-off-white p-2 shadow-overlay lg:p-4">
                <div className="aspect-[16/10] w-full overflow-hidden rounded-lg bg-navy-dark relative flex items-center justify-center border border-gray-light">
                  <div className="absolute inset-0 bg-gradient-chrome opacity-50"></div>
                  <div className="relative z-10 flex flex-col items-center p-6 text-center">
                    <span className="font-heading font-medium text-white tracking-widest uppercase bg-white/20 px-6 py-3 rounded-lg backdrop-blur-md border border-white/30 shadow-lg">
                      {activeTab === 0 && "[DEMAND INTELLIGENCE SCREENSHOT]"}
                      {activeTab === 1 && "[CONTENT STUDIO SCREENSHOT]"}
                      {activeTab === 2 && "[CONTENT REVIEW SCREENSHOT]"}
                      {activeTab === 3 && "[PERFORMANCE SCREENSHOT]"}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-20 text-center">
            <h3 className="heading-sm text-navy-primary mb-6">Want to see the complete workflow?</h3>
            <a href="[DEMO VIDEO URL]" className="btn-cta text-lg px-8 py-4">
              Watch the Full Walkthrough <ArrowRight className="h-5 w-5 ml-2" />
            </a>
          </div>
        </div>
      </section>

      {/* 6. Main Outcomes / Benefits (Why CeView) */}
      <section id="why-ceview" className="bg-white pb-20 lg:pb-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mb-16 max-w-3xl">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">Why CeView</span>
            <h2 className="heading-lg mb-6 text-navy-primary">Spend less time guessing what to market—and more time acting on the opportunity.</h2>
            <p className="text-lg text-text-body">
              CeView brings market signals and marketing guidance together so small tourism businesses can make more informed decisions without needing their own analytics team.
            </p>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {/* Benefit 1 */}
            <div className="card p-8 border border-gray-light bg-off-white hover:border-mint-light transition-colors">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-mint-pale text-teal-accent">
                <TrendingUp className="h-7 w-7" />
              </div>
              <h3 className="heading-sm mb-3 text-navy-primary">See opportunities earlier</h3>
              <p className="text-text-body text-base">
                Monitor changes in traveler interest before relying only on bookings or inquiries to tell you demand has changed.
              </p>
            </div>

            {/* Benefit 2 */}
            <div className="card p-8 border border-gray-light bg-off-white hover:border-mint-light transition-colors">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-mint-pale text-teal-accent">
                <Target className="h-7 w-7" />
              </div>
              <h3 className="heading-sm mb-3 text-navy-primary">Know where to focus</h3>
              <p className="text-text-body text-base">
                Compare opportunities across South Korea, Japan, and the United States instead of spreading your marketing attention everywhere.
              </p>
            </div>

            {/* Benefit 3 */}
            <div className="card p-8 border border-gray-light bg-off-white hover:border-mint-light transition-colors">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-mint-pale text-teal-accent">
                <Megaphone className="h-7 w-7" />
              </div>
              <h3 className="heading-sm mb-3 text-navy-primary">Move from insight to content faster</h3>
              <p className="text-text-body text-base">
                Turn market information into relevant promotional direction instead of starting every campaign from a blank page.
              </p>
            </div>

            {/* Benefit 4 */}
            <div className="card p-8 border border-gray-light bg-off-white hover:border-mint-light transition-colors">
              <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl bg-mint-pale text-teal-accent">
                <Sparkles className="h-7 w-7" />
              </div>
              <h3 className="heading-sm mb-3 text-navy-primary">Make the next decision with more context</h3>
              <p className="text-text-body text-base">
                Bring forecasting, content guidance, and performance information into one workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 7. How CeView Works */}
      <section id="how-it-works" className="bg-navy-dark py-20 lg:py-28 text-white">
        <div className="mx-auto max-w-[1280px] px-6 lg:px-8">
          <div className="mb-20 text-center max-w-3xl mx-auto">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">How CeView Works</span>
            <h2 className="heading-lg mb-6 text-white">One workflow from understanding your business to improving your next campaign.</h2>
          </div>
          
          <div className="relative">
            {/* The Line - Vertical on Mobile */}
            <div className="absolute left-[27px] top-4 bottom-4 w-0.5 bg-chrome-line lg:hidden"></div>
            {/* The Line - Horizontal on Desktop */}
            <div className="hidden lg:block absolute top-[27px] left-4 right-4 h-0.5 bg-chrome-line"></div>
            
            <div className="flex flex-col lg:flex-row gap-12 lg:gap-6">
              
              {/* Step 01 */}
              <div className="relative pl-16 lg:pl-0 lg:pt-16 flex-1 flex flex-col items-start lg:items-center text-left lg:text-center">
                <div className="absolute left-0 lg:left-1/2 lg:-ml-7 top-0 h-14 w-14 rounded-full bg-navy-dark text-mint-primary flex items-center justify-center font-heading font-bold text-lg border-2 border-mint-primary z-10 shadow-[0_0_0_8px_#16304D]">01</div>
                
                {/* Visual */}
                <div className="w-full max-w-[200px] h-24 mb-6 bg-[#1a384f] rounded-lg border border-chrome-line p-3 shadow-overlay hidden lg:flex flex-col gap-2">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="h-6 w-6 rounded-full bg-chrome-raised"></div>
                    <div className="h-2 w-16 bg-white/20 rounded"></div>
                  </div>
                  <div className="h-1.5 w-full bg-white/10 rounded"></div>
                  <div className="h-1.5 w-3/4 bg-white/10 rounded"></div>
                  <div className="h-1.5 w-1/2 bg-white/10 rounded"></div>
                </div>

                <h3 className="heading-sm mb-3 text-white">Tell CeView about your business</h3>
                <p className="text-text-inverse-muted text-sm leading-relaxed">
                  Add information about what your tourism business offers so CeView can keep its market and content guidance relevant to you.
                </p>
              </div>

              {/* Step 02 */}
              <div className="relative pl-16 lg:pl-0 lg:pt-16 flex-1 flex flex-col items-start lg:items-center text-left lg:text-center">
                <div className="absolute left-0 lg:left-1/2 lg:-ml-7 top-0 h-14 w-14 rounded-full bg-navy-dark text-mint-primary flex items-center justify-center font-heading font-bold text-lg border-2 border-chrome-line z-10 shadow-[0_0_0_8px_#16304D]">02</div>
                
                <h3 className="heading-sm mb-3 text-white lg:mt-[120px]">See where demand may be heading</h3>
                <p className="text-text-inverse-muted text-sm leading-relaxed">
                  CeView looks at tourism-interest trends alongside factors such as seasonality, market conditions, exchange rates, and travel accessibility to surface upcoming demand patterns.
                </p>
              </div>

              {/* Step 03 */}
              <div className="relative pl-16 lg:pl-0 lg:pt-16 flex-1 flex flex-col items-start lg:items-center text-left lg:text-center">
                <div className="absolute left-0 lg:left-1/2 lg:-ml-7 top-0 h-14 w-14 rounded-full bg-navy-dark text-mint-primary flex items-center justify-center font-heading font-bold text-lg border-2 border-chrome-line z-10 shadow-[0_0_0_8px_#16304D]">03</div>
                
                {/* Visual */}
                <div className="w-full max-w-[200px] mb-6 hidden lg:flex flex-col gap-2">
                  <div className="bg-[#1a384f] rounded border border-coral-cta/50 p-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-coral-cta">1</span>
                    <div className="h-1.5 w-16 bg-coral-cta rounded"></div>
                  </div>
                  <div className="bg-[#1a384f] rounded border border-chrome-line p-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/50">2</span>
                    <div className="h-1.5 w-12 bg-white/20 rounded"></div>
                  </div>
                  <div className="bg-[#1a384f] rounded border border-chrome-line p-2 flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white/50">3</span>
                    <div className="h-1.5 w-8 bg-white/20 rounded"></div>
                  </div>
                </div>

                <h3 className="heading-sm mb-3 text-white">Find the markets worth watching</h3>
                <p className="text-text-inverse-muted text-sm leading-relaxed">
                  See which of CeView's current international markets—South Korea, Japan, or the United States—shows stronger potential for your tourism category.
                </p>
              </div>

              {/* Step 04 */}
              <div className="relative pl-16 lg:pl-0 lg:pt-16 flex-1 flex flex-col items-start lg:items-center text-left lg:text-center">
                <div className="absolute left-0 lg:left-1/2 lg:-ml-7 top-0 h-14 w-14 rounded-full bg-navy-dark text-mint-primary flex items-center justify-center font-heading font-bold text-lg border-2 border-chrome-line z-10 shadow-[0_0_0_8px_#16304D]">04</div>
                
                <h3 className="heading-sm mb-3 text-white lg:mt-[120px]">Turn the opportunity into marketing</h3>
                <p className="text-text-inverse-muted text-sm leading-relaxed mb-3">
                  Get promotional direction, caption ideas, and content guidance aligned with the target market and your business.
                </p>
                <div className="inline-flex rounded bg-chrome-raised px-2 py-1 text-xs font-semibold text-teal-accent">
                  AI assists, you decide
                </div>
              </div>

              {/* Step 05 */}
              <div className="relative pl-16 lg:pl-0 lg:pt-16 flex-1 flex flex-col items-start lg:items-center text-left lg:text-center">
                <div className="absolute left-0 lg:left-1/2 lg:-ml-7 top-0 h-14 w-14 rounded-full bg-navy-dark text-mint-primary flex items-center justify-center font-heading font-bold text-lg border-2 border-chrome-line z-10 shadow-[0_0_0_8px_#16304D]">05</div>
                
                <h3 className="heading-sm mb-3 text-white lg:mt-[120px]">Review and improve</h3>
                <p className="text-text-inverse-muted text-sm leading-relaxed">
                  Check how closely your promotional material follows the intended strategy and use performance information to guide the next decision.
                </p>
              </div>

            </div>
          </div>

          <div className="mt-24 text-center max-w-3xl mx-auto border-t border-chrome-line pt-10">
            <p className="text-lg text-white font-medium">
              The result: fewer disconnected decisions and a clearer path from <span className="text-teal-accent">“there may be an opportunity”</span> to <span className="text-teal-accent">“here's what we can do about it.”</span>
            </p>
          </div>
        </div>
      </section>

      {/* 8. Core Capabilities */}
      <section id="features" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mb-16">
            <h2 className="heading-lg mb-4 text-navy-primary max-w-2xl">The tools behind a better-timed tourism campaign.</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 lg:gap-6 auto-rows-fr">
            
            {/* 1. Demand Forecasts */}
            <div className="card p-6 bg-white border border-gray-light flex flex-col justify-between lg:col-span-2 group hover:border-mint-light transition-colors">
              <div className="mb-6 h-32 w-full bg-off-white rounded-lg border border-gray-light flex items-end px-3 gap-1.5 overflow-hidden relative pt-8 pb-3">
                <div className="absolute top-3 left-3 text-[10px] font-bold text-text-muted uppercase tracking-wider">12-Week Forecast</div>
                {[15, 12, 18, 25, 22, 35, 45, 60, 85, 75, 90, 95].map((h, i) => (
                  <div key={i} className="flex-1 bg-mint-primary/20 rounded-t-sm relative group-hover:bg-mint-primary/30 transition-colors" style={{ height: `${h}%` }}>
                    <div className="absolute top-0 left-0 right-0 h-1 bg-mint-primary rounded-t-sm"></div>
                  </div>
                ))}
              </div>
              <div>
                <h3 className="font-heading font-semibold text-navy-primary text-xl mb-2">Demand Forecasts</h3>
                <p className="text-text-body">See upcoming changes in tourism interest instead of relying only on what already happened.</p>
              </div>
            </div>

            {/* 2. Market Ranking */}
            <div className="card p-6 bg-white border border-gray-light flex flex-col justify-between hover:border-mint-light transition-colors">
              <div className="mb-6 flex flex-col gap-2 pt-2">
                <div className="flex items-center justify-between text-xs font-semibold px-3 py-2.5 bg-coral-cta/5 rounded border border-coral-cta/30">
                  <span className="flex items-center gap-2"><span className="text-coral-cta font-bold">1</span> <span className="text-navy-primary">South Korea</span></span>
                  <span className="text-coral-cta">Surging</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium px-3 py-2.5 bg-off-white rounded border border-gray-light">
                  <span className="flex items-center gap-2 text-text-muted"><span>2</span> Japan</span>
                </div>
                <div className="flex items-center justify-between text-xs font-medium px-3 py-2.5 bg-off-white rounded border border-gray-light">
                  <span className="flex items-center gap-2 text-text-muted"><span>3</span> United States</span>
                </div>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-navy-primary text-xl mb-2">Market Ranking</h3>
                <p className="text-text-body">Understand which international market currently shows stronger potential for your type of tourism business.</p>
              </div>
            </div>

            {/* 3. Surge Alerts */}
            <div className="card p-6 bg-gradient-to-br from-white to-coral-cta/5 border border-gray-light flex flex-col justify-between hover:border-coral-cta/30 transition-colors">
              <div className="mb-8 pt-4">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-coral-cta/10 text-coral-cta text-xs font-bold uppercase tracking-wider border border-coral-cta/20">
                  <div className="h-2 w-2 rounded-full bg-coral-cta animate-pulse"></div>
                  Surge Status
                </div>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-navy-primary text-xl mb-2">Surge Alerts</h3>
                <p className="text-text-body">Get a clear signal when an important demand window may be opening.</p>
              </div>
            </div>

            {/* 4. Business-Aware Marketing Guidance */}
            <div className="card p-6 bg-navy-dark border border-navy-primary flex flex-col justify-between lg:col-span-2 text-white shadow-overlay">
              <div className="mb-8 pt-4 flex gap-3 flex-wrap">
                <span className="px-3 py-1.5 bg-white/10 rounded-md text-xs font-medium text-mint-pale border border-white/5">Resort & Spa</span>
                <span className="px-3 py-1.5 bg-white/10 rounded-md text-xs font-medium text-mint-pale border border-white/5">Family Friendly</span>
                <span className="px-3 py-1.5 bg-white/10 rounded-md text-xs font-medium text-mint-pale border border-white/5">Scuba Diving</span>
              </div>
              <div>
                <h3 className="font-heading font-semibold text-white text-xl mb-2">Business-Aware Marketing Guidance</h3>
                <p className="text-text-inverse-muted">Recommendations take your business category and offering into account instead of giving every business the same generic advice.</p>
              </div>
            </div>

            {/* 5. Content Direction */}
            <div className="card p-6 bg-white border border-gray-light flex flex-col justify-between hover:border-mint-light transition-colors">
              <div className="mb-6 pt-4 text-mint-primary">
                <Megaphone className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-navy-primary text-xl mb-2">Content Direction</h3>
                <p className="text-text-body">Turn the opportunity into promotional ideas, captions, hashtags, and creative direction.</p>
              </div>
            </div>

            {/* 6. Content Review */}
            <div className="card p-6 bg-mint-pale border border-mint-light flex flex-col justify-between lg:col-span-2 hover:border-mint-primary transition-colors">
              <div className="mb-6 pt-4 text-teal-accent">
                <ShieldCheck className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-navy-primary text-xl mb-2">Content Review</h3>
                <p className="text-text-body text-navy-primary/80">See where your promotional material follows—or drifts from—the intended campaign direction and get understandable suggestions for improvement.</p>
              </div>
            </div>

            {/* 7. Performance Guidance */}
            <div className="card p-6 bg-white border border-gray-light flex flex-col justify-between hover:border-mint-light transition-colors">
              <div className="mb-6 pt-4 text-mint-primary">
                <TrendingUp className="h-8 w-8" />
              </div>
              <div>
                <h3 className="font-heading font-semibold text-navy-primary text-xl mb-2">Performance Guidance</h3>
                <p className="text-text-body">Review marketing results in context and use them when planning what to do next.</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 9. Who it is for */}
      <section id="who-its-for" className="bg-mint-pale-alt py-20 lg:py-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mb-16 max-w-3xl text-center mx-auto">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">Built for Cebu Tourism Businesses</span>
            <h2 className="heading-lg mb-6 text-navy-primary">Useful market intelligence shouldn't require a full analytics team.</h2>
            <p className="text-lg text-text-body">
              CeView is built for tourism businesses that depend on traveler demand but may not have dedicated analysts, revenue-management teams, or large marketing departments.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            
            {/* Card 1 */}
            <div className="card p-8 bg-white border border-gray-light hover:border-mint-light transition-colors">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Resorts & Accommodations</h3>
              <p className="text-text-body text-base">
                See when interest from a target market begins to rise and prepare destination-focused promotions around the upcoming demand window.
              </p>
            </div>

            {/* Card 2 */}
            <div className="card p-8 bg-white border border-gray-light hover:border-mint-light transition-colors">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Dive Shops & Marine Experiences</h3>
              <p className="text-text-body text-base">
                Spot growing interest in coastal and activity-based travel and prepare content before travelers finalize their plans.
              </p>
            </div>

            {/* Card 3 */}
            <div className="card p-8 bg-white border border-gray-light hover:border-mint-light transition-colors">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Adventure & Nature Operators</h3>
              <p className="text-text-body text-base">
                Align your outdoor and eco-tourism campaigns with the exact weeks international travelers are researching Cebu nature getaways.
              </p>
            </div>

            {/* Card 4 */}
            <div className="card p-8 bg-white border border-gray-light hover:border-mint-light transition-colors">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Tours & Cultural Experiences</h3>
              <p className="text-text-body text-base">
                Identify which international markets are currently exploring Cebu heritage and tailor your tour packages to their specific interests.
              </p>
            </div>

            {/* Card 5 */}
            <div className="card p-8 bg-white border border-gray-light hover:border-mint-light transition-colors">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Attractions & Entertainment</h3>
              <p className="text-text-body text-base">
                Adjust your promotional focus when market signals show a rising trend in family and entertainment-based travel.
              </p>
            </div>

            {/* Card 6 */}
            <div className="card p-8 bg-white border border-gray-light hover:border-mint-light transition-colors">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Restaurants & Food Businesses</h3>
              <p className="text-text-body text-base">
                Time your seasonal menu highlights when travel signals point toward a coming wave of gastronomy-focused visitors.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* 10. Differentiation */}
      <section className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">From Fragmented to Connected</span>
            <h2 className="heading-lg text-navy-primary">Your market research shouldn't end where your marketing starts.</h2>
          </div>

          <div className="grid md:grid-cols-2 gap-0 rounded-2xl overflow-hidden border border-gray-light shadow-overlay mx-auto max-w-4xl mb-20">
            {/* Left: Without a connected workflow */}
            <div className="bg-off-white p-8 lg:p-12 flex flex-col justify-center">
              <h3 className="font-heading font-semibold text-text-muted text-xl mb-8">Without a connected workflow</h3>
              <ul className="space-y-6">
                {[
                  "Search trends somewhere else",
                  "Research markets manually",
                  "Guess what content to create",
                  "Use another tool to prepare it",
                  "Review performance separately"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-text-muted">
                    <div className="h-1.5 w-1.5 rounded-full bg-gray-light/80 shrink-0"></div>
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Right: With CeView */}
            <div className="bg-mint-pale p-8 lg:p-12 relative overflow-hidden flex flex-col justify-center">
              <div className="absolute top-0 right-0 w-48 h-48 bg-mint-light/30 rounded-bl-full -mr-8 -mt-8"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-mint-primary/10 rounded-tr-full -ml-8 -mb-8"></div>
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-8 relative z-10">With CeView</h3>
              <ul className="space-y-6 relative z-10">
                {[
                  "Spot demand signals",
                  "Identify a target market",
                  "Get marketing direction",
                  "Review your content",
                  "Learn from performance"
                ].map((item, idx) => (
                  <li key={idx} className="flex items-center gap-3 text-navy-primary font-medium">
                    <CheckCircle2 className="h-5 w-5 text-teal-accent shrink-0" />
                    <span className="text-base">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Positioning Statement */}
          <div className="mx-auto max-w-4xl text-center px-4 py-8 rounded-xl bg-gradient-chrome relative overflow-hidden shadow-sm">
            <div className="absolute inset-0 bg-navy-dark opacity-95"></div>
            <p className="relative z-10 text-xl md:text-2xl font-heading font-medium text-white leading-relaxed">
              CeView's advantage isn't simply another forecast or another AI writer.<br className="hidden md:block mb-2" />
              <span className="text-teal-accent font-bold">It's connecting market intelligence with the marketing decisions that follow.</span>
            </p>
          </div>
        </div>
      </section>

      {/* 11. Credibility & Validation */}
      <section className="border-y border-gray-light bg-off-white py-20 lg:py-28">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center mb-16">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">Built around a real tourism-marketing problem</span>
            <h2 className="heading-lg mb-6 text-navy-primary">Designed for businesses that need useful answers—not more complicated data.</h2>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {/* Trust Principle 1 */}
            <div className="text-center md:text-left p-6 rounded-xl bg-white border border-gray-light/50">
              <div className="mb-4 h-12 w-12 rounded-full bg-mint-pale flex items-center justify-center text-mint-primary mx-auto md:mx-0">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-lg mb-3">Built for smaller tourism operators</h3>
              <p className="text-text-body text-sm leading-relaxed">
                CeView is intended to make tourism-market intelligence easier to access for businesses without large analytics or marketing teams.
              </p>
            </div>
            
            {/* Trust Principle 2 */}
            <div className="text-center md:text-left p-6 rounded-xl bg-white border border-gray-light/50">
              <div className="mb-4 h-12 w-12 rounded-full bg-mint-pale flex items-center justify-center text-mint-primary mx-auto md:mx-0">
                <Activity className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-lg mb-3">Recommendations stay understandable</h3>
              <p className="text-text-body text-sm leading-relaxed">
                The product is designed to show useful guidance rather than leaving operators with an unexplained score or prediction.
              </p>
            </div>
            
            {/* Trust Principle 3 */}
            <div className="text-center md:text-left p-6 rounded-xl bg-white border border-gray-light/50">
              <div className="mb-4 h-12 w-12 rounded-full bg-mint-pale flex items-center justify-center text-mint-primary mx-auto md:mx-0">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-lg mb-3">You stay in control</h3>
              <p className="text-text-body text-sm leading-relaxed">
                AI-generated guidance supports the marketing decision. The business still reviews and confirms what it chooses to use.
              </p>
            </div>
          </div>

          {/* Testimonial / Validation Area (Hidden until data exists) */}
          {false && (
            <div className="mx-auto max-w-4xl card p-8 md:p-12 border border-gray-light bg-white shadow-overlay text-center mt-16">
              <blockquote className="font-heading text-xl md:text-2xl font-medium text-navy-primary mb-8 leading-relaxed">
                "[TOURISM BUSINESS TESTIMONIAL]"
              </blockquote>
              <div className="flex flex-col items-center justify-center gap-4">
                <div className="h-16 w-16 rounded-full bg-off-white border border-gray-light overflow-hidden flex items-center justify-center text-[10px] text-text-muted font-bold text-center p-2">
                  [BUSINESS LOGO]
                </div>
                <div>
                  <div className="font-heading font-semibold text-navy-primary">[RESPONDENT NAME]</div>
                  <div className="text-sm text-text-muted">[ROLE / BUSINESS]</div>
                </div>
              </div>
            </div>
          )}

        </div>
      </section>

      {/* 12. Lead Generation Section */}
      <section id="request-demo" className="bg-mint-pale py-20 lg:py-28 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent to-white/50 pointer-events-none"></div>
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8 relative z-10">
          
          <div className="mx-auto max-w-3xl text-center mb-12">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">See CeView for your business</span>
            <h2 className="heading-lg mb-6 text-navy-primary">Want to see how CeView could fit your tourism business?</h2>
            <p className="text-lg text-text-body">
              Request a walkthrough and see how CeView moves from traveler-demand signals to target-market guidance and campaign direction.
            </p>
          </div>

          <div className="bg-white rounded-2xl shadow-overlay border border-gray-light overflow-hidden flex flex-col lg:flex-row">
            
            {/* Left: Expectations */}
            <div className="bg-off-white p-8 lg:p-12 lg:w-5/12 flex flex-col justify-center border-b lg:border-b-0 lg:border-r border-gray-light">
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-6">In the walkthrough, you'll see:</h3>
              <ul className="space-y-6">
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-mint-primary shrink-0" />
                  <span className="text-navy-primary font-medium">How CeView spots tourism-demand opportunities</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-mint-primary shrink-0" />
                  <span className="text-navy-primary font-medium">How target markets are ranked</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle2 className="h-6 w-6 text-mint-primary shrink-0" />
                  <span className="text-navy-primary font-medium">How insights become marketing direction</span>
                </li>
              </ul>
            </div>

            {/* Right: Lead Form */}
            <div className="p-8 lg:p-12 lg:w-7/12">
              <form 
                className="space-y-5" 
                action="[LEAD FORM DESTINATION]" 
                method="POST"
                onSubmit={(e) => { e.preventDefault(); console.log('[CONNECT LEAD FORM HANDLER HERE]'); }}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <div>
                    <label htmlFor="fullName" className="block text-sm font-semibold text-navy-primary mb-2">Full Name</label>
                    <input type="text" id="fullName" name="fullName" className="w-full rounded-md border border-gray-light bg-white px-4 py-2.5 text-navy-primary focus:border-mint-primary focus:outline-none focus:ring-1 focus:ring-mint-primary transition-colors" required />
                  </div>
                  <div>
                    <label htmlFor="workEmail" className="block text-sm font-semibold text-navy-primary mb-2">Work Email</label>
                    <input type="email" id="workEmail" name="workEmail" className="w-full rounded-md border border-gray-light bg-white px-4 py-2.5 text-navy-primary focus:border-mint-primary focus:outline-none focus:ring-1 focus:ring-mint-primary transition-colors" required />
                  </div>
                </div>

                <div>
                  <label htmlFor="businessName" className="block text-sm font-semibold text-navy-primary mb-2">Business Name</label>
                  <input type="text" id="businessName" name="businessName" className="w-full rounded-md border border-gray-light bg-white px-4 py-2.5 text-navy-primary focus:border-mint-primary focus:outline-none focus:ring-1 focus:ring-mint-primary transition-colors" required />
                </div>

                <div>
                  <label htmlFor="businessType" className="block text-sm font-semibold text-navy-primary mb-2">Type of Tourism Business</label>
                  <select id="businessType" name="businessType" className="w-full rounded-md border border-gray-light bg-white px-4 py-2.5 text-navy-primary focus:border-mint-primary focus:outline-none focus:ring-1 focus:ring-mint-primary transition-colors" required>
                    <option value="" disabled selected>Select an option</option>
                    <option value="Accommodation / Resort">Accommodation / Resort</option>
                    <option value="Tour Operator">Tour Operator</option>
                    <option value="Dive / Marine Activity">Dive / Marine Activity</option>
                    <option value="Attraction / Recreation">Attraction / Recreation</option>
                    <option value="Food & Beverage">Food & Beverage</option>
                    <option value="Wellness">Wellness</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="helpTopic" className="block text-sm font-semibold text-navy-primary mb-2">What would you most like help with? <span className="text-text-muted font-normal">(Optional)</span></label>
                  <select id="helpTopic" name="helpTopic" className="w-full rounded-md border border-gray-light bg-white px-4 py-2.5 text-navy-primary focus:border-mint-primary focus:outline-none focus:ring-1 focus:ring-mint-primary transition-colors">
                    <option value="" disabled selected>Select an option</option>
                    <option value="Understanding traveler demand">Understanding traveler demand</option>
                    <option value="Knowing which market to target">Knowing which market to target</option>
                    <option value="Planning marketing content">Planning marketing content</option>
                    <option value="Improving campaign performance">Improving campaign performance</option>
                    <option value="Exploring CeView generally">Exploring CeView generally</option>
                  </select>
                </div>

                <div className="pt-4">
                  <button type="submit" className="w-full rounded-md bg-coral-cta px-6 py-4 text-center font-heading font-semibold text-white transition-colors hover:bg-coral-hover text-lg shadow-sm">
                    Request My Demo
                  </button>
                  <p className="text-center text-xs text-text-muted mt-3">
                    No commitment. We'll use your details only to respond to your CeView request.
                  </p>
                </div>
              </form>
            </div>
            
          </div>
        </div>
      </section>

      {/* 13. Trust & Transparency */}
      <section className="bg-mint-pale-alt py-20 lg:py-28 border-y border-gray-light">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="mb-16 text-center max-w-3xl mx-auto">
            <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">Built for informed decisions</span>
            <h2 className="heading-lg text-navy-primary">Useful guidance, with your business still in control.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            
            {/* Trust Card 1 */}
            <div className="card p-8 bg-white border border-gray-light flex flex-col items-start text-left">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint-pale text-mint-primary">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Human Review</h3>
              <p className="text-text-body text-base">
                CeView supports decisions rather than making marketing decisions automatically. Users review AI-assisted outputs before acting on them.
              </p>
            </div>

            {/* Trust Card 2 */}
            <div className="card p-8 bg-white border border-gray-light flex flex-col items-start text-left">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint-pale text-mint-primary">
                <Target className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Business-Focused Data</h3>
              <p className="text-text-body text-base">
                CeView primarily works with business-level information and publicly available tourism-market data rather than intentionally collecting personal information from travelers.
              </p>
            </div>

            {/* Trust Card 3 */}
            <div className="card p-8 bg-white border border-gray-light flex flex-col items-start text-left">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint-pale text-mint-primary">
                <ShieldCheck className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Data Responsibility</h3>
              <p className="text-text-body text-base">
                The system is designed around responsible data handling and the Philippine Data Privacy Act.
                <br /><br />
                <span className="text-sm italic opacity-70">[CONFIRMED PRODUCTION SECURITY INFORMATION]</span>
              </p>
            </div>

            {/* Trust Card 4 */}
            <div className="card p-8 bg-white border border-gray-light flex flex-col items-start text-left">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-mint-pale text-mint-primary">
                <TrendingUp className="h-6 w-6" />
              </div>
              <h3 className="font-heading font-semibold text-navy-primary text-xl mb-3">Forecast Transparency</h3>
              <p className="text-text-body text-base">
                Tourism forecasts indicate possible demand patterns. They do not guarantee future bookings, traveler arrivals, revenue, or campaign results.
              </p>
            </div>

          </div>
        </div>
      </section>

      {/* Access / Pricing (Pre-FAQ) */}
      <section className="bg-navy-dark py-16 text-center border-b border-chrome-line">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="font-heading font-bold text-3xl md:text-4xl text-white mb-4">Interested in CeView?</h2>
          <p className="text-teal-accent font-medium text-lg mb-8 uppercase tracking-wider">
            [CURRENT ACCESS STATUS — e.g. Request a demo / Pilot access / Early access]
          </p>
          <a href="#request-demo" className="btn-cta text-lg px-8 py-4 inline-flex shadow-overlay">
            Request a Demo
          </a>
        </div>
      </section>

      {/* 14. FAQ */}
      <section id="faq" className="bg-white py-20 lg:py-28">
        <div className="mx-auto max-w-[880px] px-6 lg:px-8">
          <div className="mb-16 text-center">
            <h2 className="heading-lg text-navy-primary">Questions before you explore CeView?</h2>
          </div>
          
          <div className="space-y-4">
            {[
              {
                q: "What exactly does CeView do?",
                a: "CeView helps Cebu tourism businesses spot upcoming traveler demand and turn those insights into well-timed marketing content."
              },
              {
                q: "Who is CeView for?",
                a: "CeView is designed for local Cebu tourism MSMEs—such as resorts, dive shops, tour operators, and restaurants—who want to make smarter marketing decisions without needing a dedicated analytics team."
              },
              {
                q: "Which international markets does CeView currently cover?",
                a: "South Korea, Japan, and the United States."
              },
              {
                q: "Does CeView predict actual bookings?",
                a: "It identifies tourism-demand patterns and market opportunities; forecasts should be treated as decision-support information, not guaranteed bookings."
              },
              {
                q: "Where does the demand information come from?",
                a: "CeView combines online travel-interest signals with tourism seasonality, economic conditions, exchange-rate information, and travel-accessibility factors to build a broader view of demand."
              },
              {
                q: "Does CeView create marketing content for me?",
                a: "It can provide promotional direction and AI-assisted content based on your business and market context, while keeping you in complete control."
              },
              {
                q: "Can CeView review content I've created?",
                a: "Yes, it provides a content-alignment review and understandable improvement guidance to ensure your message matches the intended strategy."
              },
              {
                q: "Does CeView automatically publish my content?",
                a: "[INSERT CONFIRMED CURRENT PUBLISHING CAPABILITY]"
              },
              {
                q: "How do I try CeView?",
                a: "[INSERT CURRENT ACCESS PROCESS]"
              },
              {
                q: "How much does CeView cost?",
                a: "[INSERT CONFIRMED PRICING OR PILOT INFORMATION]"
              }
            ].map((faq, i) => (
              <details key={i} className="group border border-gray-light bg-off-white hover:bg-white transition-colors rounded-xl p-6 [&_summary::-webkit-details-marker]:hidden shadow-sm">
                <summary className="flex cursor-pointer items-center justify-between font-heading font-semibold text-navy-primary text-lg focus:outline-none focus:ring-2 focus:ring-mint-primary focus:ring-offset-2 rounded-sm">
                  {faq.q}
                  <ChevronDown className="h-5 w-5 text-mint-primary transition-transform duration-300 group-open:-rotate-180 shrink-0 ml-4" />
                </summary>
                <div className="mt-4 text-text-body text-base leading-relaxed border-t border-gray-light pt-4">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* 15. Final CTA */}
      <section className="relative overflow-hidden bg-navy-dark py-24 text-center">
        {/* Soft Cyan Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-cyan-accent opacity-[0.03] blur-[120px] rounded-full pointer-events-none"></div>
        
        {/* Dotted Motif */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative mx-auto max-w-3xl px-6 z-10">
          <span className="eyebrow text-teal-accent mb-4 block uppercase tracking-wider font-semibold">From Signal to Action</span>
          <h2 className="heading-hero mb-6 text-white text-3xl md:text-5xl leading-tight">Your next tourism opportunity may start before the bookings do.</h2>
          <p className="mb-10 text-lg md:text-xl text-text-inverse-muted leading-relaxed">
            See how CeView helps you identify rising traveler interest, focus on the right market, and prepare your marketing earlier.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="#request-demo" className="btn-cta w-full sm:w-auto text-lg px-8 py-4 min-h-[44px] flex items-center justify-center">
              Request a Demo
            </a>
            <a href="[DEMO VIDEO URL]" className="btn-outline w-full sm:w-auto text-lg px-8 py-4 min-h-[44px] flex items-center justify-center text-white border-white/20 hover:bg-white/10">
              Watch Product Walkthrough
            </a>
          </div>
        </div>
      </section>

      {/* 16. Footer */}
      <footer className="bg-navy-dark py-16 text-text-inverse-muted border-t border-chrome-line">
        <div className="mx-auto max-w-[1180px] px-6 lg:px-8">
          <div className="grid gap-12 border-b border-chrome-line pb-12 md:grid-cols-2 lg:grid-cols-5">
            
            <div className="lg:col-span-2">
              <div className="mb-4 flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-chrome-raised text-cyan-accent">
                  <TrendingUp className="h-5 w-5" />
                </div>
                <span className="font-heading text-xl font-bold text-white">CeView</span>
              </div>
              <p className="max-w-sm text-sm leading-relaxed">
                Tourism demand intelligence and AI-assisted marketing guidance for Cebu tourism businesses.
              </p>
            </div>
            
            <div>
              <h4 className="mb-4 font-heading font-semibold text-white">Product</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="#why-ceview" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">Why CeView</a></li>
                <li><a href="#features" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">How It Works</a></li>
                <li><a href="#request-demo" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">Demo</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-heading font-semibold text-white">Company</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="[ABOUT URL]" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">About [PLACEHOLDER IF NEEDED]</a></li>
                <li><a href="mailto:[CONTACT EMAIL]" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">Contact</a></li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 font-heading font-semibold text-white">Legal</h4>
              <ul className="space-y-3 text-sm">
                <li><a href="[PRIVACY POLICY URL]" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">Privacy Policy</a></li>
                <li><a href="[TERMS URL]" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">Terms</a></li>
              </ul>
            </div>

          </div>
          
          <div className="mt-8 flex flex-col items-center justify-between gap-4 text-xs md:flex-row">
            <p>&copy; 2026 CeView. All rights reserved.</p>
            <div className="flex items-center gap-2">
              <a href="mailto:[CONTACT EMAIL]" className="hover:text-white transition-colors min-h-[44px] inline-flex items-center">
                [CONTACT EMAIL]
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
