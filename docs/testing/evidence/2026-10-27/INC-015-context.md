# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: public/landing.spec.ts >> Landing page — phone >> @mobile the menu sheet opens, locks scrolling and lists the sections
- Location: tests/public/landing.spec.ts:225:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Request a Demo' })
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Request a Demo' })

```

```yaml
- link "Skip to content":
  - /url: "#lp-main"
- banner:
  - link "CeView — back to top":
    - /url: "#top"
    - img "CeView"
  - button "Open menu" [expanded]
- dialog "Menu":
  - link "CeView — back to top":
    - /url: "#top"
    - img "CeView"
  - button "Close menu"
  - navigation "Page sections":
    - list:
      - listitem:
        - link "Why CeView":
          - /url: "#why"
      - listitem:
        - link "How It Works":
          - /url: "#how-it-works"
      - listitem:
        - link "Features":
          - /url: "#features"
      - listitem:
        - link "Who It’s For":
          - /url: "#who"
      - listitem:
        - link "Pricing":
          - /url: "#pricing"
      - listitem:
        - link "FAQ":
          - /url: "#faq"
  - link "Try Interactive Demo":
    - /url: /demo
  - link "Sign In":
    - /url: /login
- main:
  - region "See traveler demand before the opportunity passes.":
    - paragraph: Tourism demand intelligence for Cebu businesses
    - heading "See traveler demand before the opportunity passes." [level=1]:
      - text: See traveler demand
      - emphasis: before
      - text: the opportunity passes.
    - paragraph: CeView forecasts traveler search interest up to 12 weeks ahead across the Philippines, South Korea, Japan, and the United States, helping you target the right markets, create relevant content, and improve future campaigns.
    - link "Request a Demo":
      - /url: "#demo"
    - link "Take the Product Tour":
      - /url: "#product"
    - list:
      - listitem: Built for Cebu tourism MSMEs
      - listitem: Local, domestic & 3 international markets
      - listitem: Plain-language guidance, no analysts needed
    - 'img "Illustrative CeView dashboard with sample data: search interest from South Korea is forecast 24% above its recent baseline, and South Korea ranks first for Accommodation & Staycation."':
      - paragraph: Good morning, Sunset Cove Beach Resort
      - paragraph: Here’s what’s happening with traveler search interest.
      - list:
        - listitem: +24% Search interest
        - listitem: 2 Active surge alerts
        - listitem: 3 Markets rising
      - paragraph: Search interest forecast
      - text: Forecast Recent baseline
      - paragraph: South Korea · Accommodation & Staycation
      - img: 80 65 50 35
      - text: +24% Now +3w +6w +9w +12w
      - paragraph: Market potential
      - paragraph: Accommodation & Staycation
      - list:
        - listitem: South Korea 87
        - listitem: Japan 79
        - listitem: Domestic 74
        - listitem: United States 68
        - listitem: Local 61
      - text: Sample data
  - region "Tracking traveler search interest from":
    - paragraph: Tracking traveler search interest from
    - list:
      - listitem: Cebu & nearby provinces Local
      - listitem: Other Philippine regions Domestic
      - listitem: South Korea International
      - listitem: Japan International
      - listitem: United States International
    - paragraph:
      - text: Why these three? They bring about 60% of Central Visayas’ foreign arrivals.
      - superscript:
        - 'link "1 : source, DEPDev Regional Office VII, Central Visayas Regional Development Report 2024"':
          - /url: "#challenge-sources"
    - paragraph: Updated weekly12-week look-ahead7 tourism themes
  - region "Tourism demand keeps shifting. Small businesses are usually last to know.":
    - paragraph: The challenge
    - heading "Tourism demand keeps shifting. Small businesses are usually last to know." [level=2]:
      - text: Tourism demand keeps shifting. Small businesses are usually
      - emphasis: last
      - text: to know.
    - paragraph: Interest from a market can rise or fade long before it shows up as a booking. Most small tourism businesses don’t have the time or analysts to track it.
    - figure "Moalboal, Cebu":
      - img "Aerial view of outrigger bangka boats moored beside a forested island in clear turquoise water off Moalboal, Cebu."
      - text: Moalboal, Cebu
    - paragraph: What’s at stake
    - term: Tourism’s direct contribution to the economy in 2025, 8.1% of GDP
    - definition: ₱2.27T
    - term: Jobs supported by tourism, 15.7% of total employment
    - definition: 7.70M
    - term: Change in inbound tourism spending in 2025
    - definition: −6.4%
    - term: "Central Visayas arrivals in 2024: 5.0M domestic, 2.5M foreign"
    - definition: 7.5M
    - paragraph: "Sources: Philippine Statistics Authority (May 2026); DEPDev Regional Office VII, Central Visayas Regional Development Report 2024."
    - list:
      - listitem:
        - heading "Market information arrives late" [level=3]
        - paragraph: Search interest, exchange rates and flight access shift on their own. Free tools show past searches, but you still have to choose, translate and interpret the terms.
      - listitem:
        - heading "Hard to turn it into action" [level=3]
        - paragraph: Even with the right market in mind, you still need content that fits it, and a way to see whether the campaign worked, on top of daily operations.
    - paragraph: Slow seasons shouldn’t be a waiting game.
  - region "Spend less time guessing and more time growing.":
    - paragraph: Turn traveler interest into smarter decisions
    - heading "Spend less time guessing and more time growing." [level=2]:
      - text: Spend less time guessing and more time
      - emphasis: growing
      - text: .
    - paragraph: CeView brings the signal, the market and the marketing decision into one connected workflow, so a slow season becomes something you plan for instead of wait out.
    - list:
      - listitem:
        - heading "See opportunities earlier" [level=3]
        - paragraph: Get an alert when forecast search interest for your tourism themes rises above its usual level, weeks before it turns into inquiries.
        - paragraph: More time to prepare
      - listitem:
        - heading "Know where to focus" [level=3]
        - paragraph: Markets ranked for your business using the forecast plus seasonality, exchange rates, economic conditions and flight access.
        - paragraph: A clearer target
      - listitem:
        - heading "Move from insight to content" [level=3]
        - paragraph: Caption and visual directions drafted for the market you chose and its cultural context, then checked before you use them.
        - paragraph: Less time drafting
      - listitem:
        - heading "Make the next decision better" [level=3]
        - paragraph: Meta and TikTok results turned into one effectiveness score and a plain-language report with next steps.
        - paragraph: Every campaign informs the next
  - region "From traveler interest to a clearer marketing decision.":
    - paragraph: AI-assisted insights built for Cebu tourism
    - heading "From traveler interest to a clearer marketing decision." [level=2]:
      - text: From traveler interest to a clearer marketing
      - emphasis: decision
      - text: .
    - paragraph: See which market is warming up for your kind of experience, why it ranks where it does, and what to prepare, all in one place.
    - link "Explore all features":
      - /url: "#features"
    - paragraph: Market Explorer
    - text: Sample data
    - paragraph: Accommodation & Staycation · ranked for a sample beach resort
    - list:
      - listitem: South Korea Surge active 87
      - listitem: Japan Rising 79
      - listitem: Other PH regions Steady 72
      - listitem: United States Steady 64
      - listitem: Cebu & nearby Steady 61
    - paragraph: South Korea · direct flights 14×/week · 3h 45m to Cebu
    - list "Factors in the ranking":
      - listitem: Forecast
      - listitem: Seasonality
      - listitem: Exchange rate
      - listitem: Economy
      - listitem: Flight access
    - paragraph: Spot it early. Plan it well. Grow Cebu together.
    - img "Clear turquoise water lapping a white-sand beach lined with palm trees on Malapascua Island."
    - img "A sea turtle swimming over a coral reef in clear blue water off Moalboal, Cebu."
    - paragraph: See CeView in action
    - heading "Four tools, one workflow." [level=3]:
      - text: Four tools, one
      - emphasis: workflow
      - text: .
    - paragraph: Demand signals, market priorities, content guidance and performance context, inside one workflow.
    - tabpanel "Demand Intelligence Showing now See when interest may be rising, and which market deserves attention.":
      - paragraph: Surge alert · South Korea · +24% vs baseline
      - figure:
        - img "CeView dashboard showing a surge alert for South Korea and the markets ranked by potential for that alert’s category."
        - 'button "Point 1: A surge alert"': "1"
        - 'button "Point 2: Markets ranked for that alert"': "2"
        - 'button "Point 3: A top market for every category"': "3"
      - paragraph: Overview
      - paragraph: Demand Intelligence
      - paragraph: Select a numbered point, or press Next for a short walk-through.
      - button "Previous step" [disabled]
      - button "Show the whole screen"
      - button "Show step 1"
      - button "Show step 2"
      - button "Show step 3"
      - button "Next"
    - tablist "Product areas":
      - tab "Demand Intelligence" [selected]: Demand Intelligence Showing now See when interest may be rising, and which market deserves attention.
      - tab "Content Studio": Content Studio Turn the opportunity into posts written for the market you’re targeting.
      - tab "Content Review": Content Review Check a caption and image against your campaign direction first.
      - tab "Performance": Performance Bring results back into the workflow, so the next decision has context.
    - paragraph: Explore CeView with a sample business and sample data — no account needed.
    - link "Try Interactive Demo":
      - /url: /demo
    - link "Request a Demo":
      - /url: "#demo"
  - region "One connected path from your business to your next campaign.":
    - paragraph: How CeView works
    - heading "One connected path from your business to your next campaign." [level=2]:
      - text: One connected path from your business to your next
      - emphasis: campaign
      - text: .
    - paragraph: Five phases in one workspace. Each step builds on the last, so you never re-explain your business to a new tool.
    - list "The five phases":
      - listitem:
        - 'heading "Phase 1: Understand" [level=3]'
        - paragraph: Reads your own description of what you offer, assigns up to three of seven tourism themes, and measures how distinct you are locally.
        - paragraph: You get
        - paragraph: A clear profile
      - listitem:
        - 'heading "Phase 2: Predict & prioritize" [level=3]'
        - paragraph: Forecasts 12 weeks of search interest for your themes in each market, ranks the markets, and alerts you when interest climbs.
        - paragraph: You get
        - paragraph: Where and when to focus
      - listitem:
        - 'heading "Phase 3: Create" [level=3]'
        - paragraph: Drafts social captions and visual direction from your profile, the forecast and the market’s cultural context.
        - paragraph: You get
        - paragraph: Content for that market
      - listitem:
        - paragraph: You approve each draft here. CeView never posts on your behalf.
        - 'heading "Phase 4: Check & improve" [level=3]'
        - paragraph: A second AI scores each draft against a fixed rubric and explains what to improve. You approve the final version.
        - paragraph: You get
        - paragraph: Strategy-aligned content
      - listitem:
        - 'heading "Phase 5: Learn & optimize" [level=3]'
        - paragraph: Turns Meta and TikTok results, or numbers you enter, into one effectiveness score and a plain-language report.
        - paragraph: You get
        - paragraph: A better next plan
    - paragraph: each campaign sharpens the next forecast
    - paragraph:
      - strong: "The result:"
      - text: fewer disconnected decisions, and a clear path from “there may be an opportunity” to “here’s what we’ll do about it.”
    - link "Request a Demo":
      - /url: "#demo"
    - link "Product Tour":
      - /url: "#product"
    - paragraph: Forecasts describe online search interest, an early indicator of traveler attention, not bookings or arrivals.
  - region "The tools behind a better-timed tourism campaign.":
    - paragraph: Features
    - heading "The tools behind a better-timed tourism campaign." [level=2]:
      - text: The tools behind a better-timed tourism
      - emphasis: campaign
      - text: .
    - paragraph: Each tool works on its own, but they’re built to hand off to each other, from your profile to the forecast to the content to the results.
    - article:
      - img "Illustrative forecast of search interest A line shows 52 weeks of past search interest up to now, then a dashed 12-week forecast inside a widening confidence band. A shaded window marks where the forecast rises above its usual level, with its peak highlighted.": Window opens Now
      - paragraph: Illustrative · 52 weeks in, 12 weeks out
      - heading "Demand forecasts" [level=3]
      - paragraph: Forecast search interest for the next 12 weeks, for every market and tourism theme you match.
    - article:
      - paragraph: Sample · Accommodation & Staycation
      - list:
        - listitem: South Korea 87
        - listitem: Japan 79
        - listitem: Other PH regions 72
      - heading "Market ranking" [level=3]
      - paragraph: Find your strongest markets using forecast demand, seasonality, exchange rates, economic conditions and flight access.
    - article:
      - text: Surge
      - paragraph: "Demand window opening: South Korea"
      - paragraph: Forecast 24% above the recent baseline · prepare within 4 weeks
      - paragraph: Sample alert
      - heading "Surge alerts" [level=3]
      - paragraph: Get a clear signal when forecast interest rises above its usual level, early enough to prepare.
    - article:
      - heading "Business-aware guidance" [level=3]
      - paragraph: Describe your business to find relevant tourism themes and get content directions shaped for your target market.
      - list:
        - listitem:
          - text: Accommodation & Staycation
          - strong: "0.94"
        - listitem:
          - text: Coastal & Island
          - strong: "0.81"
        - listitem:
          - text: Culinary & Gastronomy
          - strong: "0.62"
      - paragraph: Sample
      - group: Content direction & all tourism themes
    - article:
      - text: 84 Pass · mark 70
      - list:
        - listitem: Fits your business 88
        - listitem: Fits the target audience 86
        - listitem: Fits the platform 84
      - paragraph: Sample review
      - heading "Content review" [level=3]
      - paragraph: Get clear feedback on each draft, with a review score and practical suggestions. You decide what to use.
    - article:
      - heading "Performance guidance" [level=3]
      - paragraph: Bring in Meta and TikTok results for an effectiveness score, next steps, and local-language keywords to try.
      - text: Meta TikTok Effectiveness score
      - strong: "82"
      - paragraph: Local-language keyword sets
      - list:
        - listitem: beach resort
        - listitem: 해변 리조트
        - listitem: ビーチリゾート
      - text: Illustrative
      - group: How performance guidance works
  - region "Useful market intelligence shouldn’t need a full analytics team.":
    - paragraph: Built for Cebu tourism businesses
    - heading "Useful market intelligence shouldn’t need a full analytics team." [level=2]:
      - text: Useful market intelligence shouldn’t need a full
      - emphasis: analytics team
      - text: .
    - paragraph: CeView is for tourism MSME owners, managers and marketing staff who depend on visitors but don’t have analysts or a revenue-management team.
    - heading "Matches your business to what travelers are searching for." [level=3]
    - paragraph: CeView doesn’t forecast by business type. It matches you to the tourism themes travelers search for. A dive shop and a beachfront resort can share the same Coastal & Island forecast.
    - paragraph: Explore business opportunities by tourism theme
    - heading "Find insights for your kind of business." [level=3]
    - paragraph: Explore demand, seasonal trends, and traveler interests across Cebu’s key tourism themes.
    - list "Kinds of tourism business":
      - listitem:
        - img "A resort hotel with palm trees and a large blue swimming pool."
        - heading "Resorts, hotels & homestays" [level=3]
        - paragraph: Plan destination promotions around the weeks interest from a target market starts to rise.
        - list "Usual tourism themes":
          - listitem: Accommodation & Staycation
          - listitem: Coastal & Island
      - listitem:
        - img "A scuba diver swimming over a coral reef in the Philippines."
        - heading "Dive shops & marine tours" [level=3]
        - paragraph: Spot growing interest in coastal and island travel and reach divers before they finalize plans.
        - list "Usual tourism themes":
          - listitem: Coastal & Island
      - listitem:
        - img "A waterfall pouring into a turquoise pool in Badian, Cebu."
        - heading "Tour & adventure operators" [level=3]
        - paragraph: Time outdoor and eco-tour campaigns for when travelers start looking.
        - list "Usual tourism themes":
          - listitem: Adventure & Nature
      - listitem:
        - img "Visitors at a historic stone pavilion with a tiled roof."
        - heading "Heritage, culture & events" [level=3]
        - paragraph: See which market is warming to heritage travel and shape tours and events for it.
        - list "Usual tourism themes":
          - listitem: Cultural & Heritage
      - listitem:
        - img "Flower beds in front of colourful windmill-style buildings at a hillside garden attraction."
        - heading "Attractions & recreation" [level=3]
        - paragraph: Shift your promotional focus when family and entertainment travel starts to pick up.
        - list "Usual tourism themes":
          - listitem: Theme Parks & Entertainment
      - listitem:
        - img "Hands reaching for rice, grilled fish and vegetables served on banana leaves."
        - heading "Restaurants & food businesses" [level=3]
        - paragraph: Line up seasonal highlights for visitors who travel for food.
        - list "Usual tourism themes":
          - listitem: Culinary & Gastronomy
      - listitem:
        - img "A brightly painted jeepney driving through a city street."
        - heading "Travel agencies & tourist transport" [level=3]
        - paragraph: Package and promote the routes and trips that each market is searching for.
        - list "Usual tourism themes":
          - listitem: Urban & City
          - listitem: Coastal & Island
      - listitem:
        - img "A craftsman finishing an acoustic guitar by hand in a workshop."
        - heading "Souvenir & local-product shops" [level=3]
        - paragraph: Put Cebu-made products in front of visitors when their interest peaks.
        - list "Usual tourism themes":
          - listitem: Cultural & Heritage
          - listitem: Culinary & Gastronomy
    - 'button "Show card 1 of 8: Resorts, hotels & homestays"'
    - 'button "Show card 2 of 8: Dive shops & marine tours"'
    - 'button "Show card 3 of 8: Tour & adventure operators"'
    - 'button "Show card 4 of 8: Heritage, culture & events"'
    - 'button "Show card 5 of 8: Attractions & recreation"'
    - 'button "Show card 6 of 8: Restaurants & food businesses"'
    - 'button "Show card 7 of 8: Travel agencies & tourist transport"'
    - 'button "Show card 8 of 8: Souvenir & local-product shops"'
    - paragraph: For LGU tourism offices & tourism associations
    - heading "Help many small operators at once." [level=3]
    - paragraph: The proposed Partner Plan gives every member business the Growth plan at about 35% below the regular price, with group onboarding and training and one consolidated invoice.
    - link "See the Partner Plan":
      - /url: "#pricing"
    - img "Sinulog festival dancers in red and gold costumes, one holding an image of the Santo Niño aloft."
    - paragraph: Illustrative photos of Cebu and Philippine tourism. These are not CeView customers.
  - region "Your market research shouldn’t end where your marketing starts.":
    - paragraph: From fragmented to connected
    - heading "Your market research shouldn’t end where your marketing starts." [level=2]:
      - text: Your market research shouldn’t end where your marketing
      - emphasis: starts
      - text: .
    - list:
      - listitem:
        - heading "Social media tools" [level=3]
        - paragraph: "Usually: Scheduling, captions and basic analytics"
        - paragraph: "CeView adds: Demand-based market targeting before you create content, and a side-by-side view of how each platform performs"
      - listitem:
        - heading "Marketing agencies" [level=3]
        - paragraph: "Usually: Campaign planning and execution, at agency prices"
        - paragraph: "CeView adds: An affordable self-service option for MSMEs, or a faster workflow for your own marketing staff"
      - listitem:
        - heading "Tourism intelligence platforms" [level=3]
        - paragraph: "Usually: Broad destination or visitor insights"
        - paragraph: "CeView adds: Signals turned into actions specific to your business"
      - listitem:
        - heading "Google Trends and free tools" [level=3]
        - paragraph: "Usually: Past search interest; you choose, translate and interpret the terms"
        - paragraph: "CeView adds: Keyword sets in each market’s language, 12-week forecasts and markets ranked for you"
      - listitem:
        - heading "Deciding from experience" [level=3]
        - paragraph: "Usually: The owner’s judgment, based on last season"
        - paragraph: "CeView adds: Data, AI guidance and campaign feedback in one workflow, with your judgment still in charge"
    - paragraph:
      - text: CeView’s advantage isn’t another forecast or another AI writer.
      - mark: It connects market intelligence with the marketing decisions that follow.
    - list "The connected workflow":
      - listitem: Spot the signal
      - listitem: Pick the market
      - listitem: Draft the content
      - listitem: Check it
      - listitem: Learn from results
  - region "Useful guidance, with your business still in control.":
    - paragraph: Built for informed decisions
    - heading "Useful guidance, with your business still in control." [level=2]
    - paragraph: We’re clear about what CeView knows, what it estimates and what stays your call.
    - list:
      - listitem:
        - heading "You approve everything" [level=3]
        - paragraph: CeView supports your decisions; it doesn’t make them. Every draft waits for your approval, and nothing is posted to your accounts on your behalf.
      - listitem:
        - heading "Public data, explained" [level=3]
        - paragraph: "Search interest comes from Google Trends, and economic indicators come from public sources. CeView’s value is in what it does with them: forecasting, ranking and connecting them to your marketing."
    - list:
      - listitem:
        - heading "Search interest, not bookings" [level=3]
        - paragraph: Forecasts show how strongly travelers are searching for experiences like yours. They don’t guarantee bookings, arrivals or revenue. Results still depend on your offer, pricing and execution.
      - listitem:
        - heading "Every forecast shows its status" [level=3]
        - paragraph: Each forecast lists its data source and whether the model behind it is provisional or validated, so you know how much weight to give it.
        - paragraph: Provisional Validated
      - listitem:
        - heading "Your account stays yours" [level=3]
        - paragraph: Your business profile, content and results stay in your own account. Other businesses using CeView can’t see them.
      - listitem:
        - heading "Reasons, not just scores" [level=3]
        - paragraph: Recommendations come with a plain-language reason you can check, not an unexplained number.
    - paragraph: What we’re measuring in the Cebu pilot
    - text: Targets, not results yet
    - term: Target forecast error (MAPE) on a held-out test period, measured against simple baselines
    - definition: ≤ 15%
    - term: Target usability score (SUS, out of 100) with at least 15 Cebu operators
    - definition: 70+
    - term: Target reduction in marketing prep time vs. your current manual workflow
    - definition: 40%
    - term: Cebu tourism MSMEs we plan to onboard during the pilot
    - definition: "50"
    - paragraph: Forecasting results stay provisional until the reserved test-period evaluation is complete.
  - region "Start free. Upgrade when the forecasts start paying off.":
    - paragraph: Plans
    - heading "Start free. Upgrade when the forecasts start paying off." [level=2]:
      - text: Start free. Upgrade when the forecasts start
      - emphasis: paying off
      - text: .
    - paragraph: Proposed plans for launch. Prices will be tested with pilot businesses in Cebu before they’re final.
    - group "Billing period":
      - text: Billing period
      - radio "Monthly" [checked]
      - text: Monthly
      - radio "Annually · 2 months free"
      - text: Annually · 2 months free
    - list "Plans":
      - listitem:
        - heading "Starter" [level=3]
        - paragraph: ₱0 /month
        - paragraph
        - paragraph: "Best for: Businesses exploring CeView"
        - list:
          - listitem: One business profile
          - listitem: Monthly market snapshot
          - listitem: Preview of which markets are gaining interest
          - listitem: 5 AI content drafts a month
          - listitem: Self-service access
        - 'link "Start with Starter: Starter plan"':
          - /url: "#demo?plan=starter"
          - text: Start with Starter
      - listitem:
        - heading "Insights" [level=3]
        - paragraph: ₱499 /month
        - paragraph
        - paragraph: "Best for: Businesses planning their own promotions"
        - list:
          - listitem: Everything in Starter
          - listitem: "Weekly 12-week forecasts for all supported markets: local, domestic and international"
          - listitem: Markets ranked for your business
          - listitem: Opportunity alerts
        - 'link "Choose Insights: Insights plan"':
          - /url: "#demo?plan=insights"
          - text: Choose Insights
      - listitem:
        - text: Recommended
        - heading "Growth" [level=3]
        - paragraph: ₱999 /month
        - paragraph
        - paragraph: "Best for: Businesses doing active marketing"
        - list:
          - listitem: Everything in Insights
          - listitem: 40 AI content drafts a month, with review
          - listitem: Meta and TikTok campaign tracking
          - listitem: Weekly AI reports with next steps
          - listitem: Email support
        - 'link "Choose Growth: Growth plan"':
          - /url: "#demo?plan=growth"
          - text: Choose Growth
      - listitem:
        - heading "Scale" [level=3]
        - paragraph: From ₱2,499 /month
        - paragraph
        - paragraph: "Best for: Businesses with multiple branches"
        - list:
          - listitem: Growth features for up to 3 branches
          - listitem: Branch-level reporting
          - listitem: Up to 5 team members
          - listitem: 120 shared AI content drafts a month
          - listitem: Priority support
        - 'link "Talk to us: Scale plan"':
          - /url: "#demo?plan=scale"
          - text: Talk to us
    - button "Show the Starter plan"
    - button "Show the Insights plan"
    - button "Show the Growth plan"
    - button "Show the Scale plan"
    - text: Add-ons
    - list:
      - listitem:
        - text: "+20 AI content drafts:"
        - strong: ₱149
      - listitem:
        - text: "Additional branch:"
        - strong: ₱699
        - text: /month
      - listitem:
        - text: "Assisted onboarding:"
        - strong: ₱1,500
        - text: one-time
    - paragraph: Partner Plan
    - heading "For LGU tourism offices, tourism associations and MSME support programs" [level=3]
    - paragraph: Give every member business the Growth plan at about 35% below the regular price, with group onboarding and training and one consolidated invoice.
    - paragraph: ₱649 per business / month
    - paragraph: Minimum 20 businesses · billed annually
    - link "Ask about the Partner Plan":
      - /url: "#demo?plan=partner"
    - paragraph: All prices in PHP and proposed. They will be tested with pilot customers before launch and may change.
  - region "Want to see how CeView could fit your tourism business?":
    - paragraph: See CeView for your business
    - heading "Want to see how CeView could fit your tourism business?" [level=2]
    - paragraph: Book a walkthrough and see how CeView moves from your business profile to a ranked market, a reviewed draft and a campaign report.
    - heading "What you’ll see" [level=3]
    - list:
      - listitem: How your business maps to tourism themes
      - listitem: How markets are forecast and ranked for you
      - listitem: How insights become reviewed content
      - listitem: How campaign results shape the next plan
    - paragraph: Cebu pilot
    - paragraph: We’re onboarding up to 50 Cebu tourism MSMEs for a guided pilot, with help setting up your profile, reading the recommendations and preparing your first promotion.
    - form "Request your demo":
      - heading "Request your demo" [level=3]
      - paragraph: Takes about a minute. Every field is required unless marked optional.
      - paragraph
      - text: Full name
      - textbox "Full name"
      - text: Work email
      - textbox "Work email"
      - text: Business name
      - textbox "Business name"
      - text: Type of tourism business
      - combobox "Type of tourism business":
        - option "Choose the closest match…" [selected]
        - option "Resort, hotel or homestay"
        - option "Dive shop or marine tour"
        - option "Tour or adventure operator"
        - option "Heritage, cultural or events"
        - option "Attraction or recreation"
        - option "Restaurant or food business"
        - option "Travel agency or tourist transport"
        - option "Souvenir or local-product shop"
        - option "LGU tourism office or tourism association"
        - option "Other"
      - text: What would you most like help with? (optional)
      - combobox "What would you most like help with? (optional)":
        - option "No preference" [selected]
        - option "Finding the right market"
        - option "Timing promotions for the off-peak season"
        - option "Creating content for a market"
        - option "Reviewing content before posting"
        - option "Tracking campaign results"
        - option "The Partner Plan"
      - button "Request My Demo"
      - paragraph: No commitment. We’ll only use your details to respond to your CeView request.
    - img "Palm trees casting long shadows across a white-sand beach with calm turquoise water."
  - region "Questions before you explore CeView?":
    - paragraph: FAQ
    - heading "Questions before you explore CeView?" [level=2]:
      - text: Questions before you explore
      - emphasis: CeView
      - text: "?"
    - paragraph: Something else on your mind? Request a demo and ask us directly.
    - link "Request a demo":
      - /url: "#demo"
    - figure "Built in Cebu, for Cebu tourism businesses first.":
      - img "Metro Cebu and the sea beyond, seen from the hills above Cebu City."
      - text: Built in Cebu, for Cebu tourism businesses first.
    - heading "What exactly does CeView do?" [level=3]:
      - button "What exactly does CeView do?" [expanded]
    - region "What exactly does CeView do?":
      - paragraph: CeView forecasts how strongly travelers are searching online for the kinds of tourism you offer, up to 12 weeks ahead. It ranks which market to focus on, helps you draft and review marketing content for that market, and turns your campaign results into next steps, all in one workflow.
    - heading "Who is CeView for?" [level=3]:
      - button "Who is CeView for?"
    - region "Who is CeView for?":
      - paragraph: "Cebu tourism MSME owners, managers and marketing staff: resorts and homestays, dive shops, tour and activity operators, attractions, food businesses, travel agencies, tourist transport, souvenir shops, and cultural, heritage and event operators. It suits businesses that want to reach new visitor markets without their own analytics team."
    - heading "Which markets does CeView cover?" [level=3]:
      - button "Which markets does CeView cover?"
    - region "Which markets does CeView cover?":
      - paragraph: "Local travelers (Cebu and nearby provinces), domestic travelers (other Philippine regions), and three international markets: South Korea, Japan and the United States. Those three bring about 60% of Central Visayas’ foreign arrivals. More international markets will be added as the platform grows."
    - heading "Does CeView predict actual bookings?" [level=3]:
      - button "Does CeView predict actual bookings?"
    - region "Does CeView predict actual bookings?":
      - paragraph: No. It forecasts online search interest, an early sign of traveler attention, not bookings, arrivals or revenue. It helps you prepare earlier; actual results still depend on your offer, pricing and execution.
    - heading "Where does the demand information come from?" [level=3]:
      - button "Where does the demand information come from?"
    - region "Where does the demand information come from?":
      - paragraph: Weekly search interest from Google Trends, using keyword sets CeView prepares in each market’s language, plus public data on seasonality, exchange rates, economic conditions and flight access. Each forecast shows its data source.
    - heading "How accurate are the forecasts?" [level=3]:
      - button "How accurate are the forecasts?"
    - region "How accurate are the forecasts?":
      - paragraph: The forecasting model is being evaluated on a reserved test period it never saw during development, against simple baselines like last week’s value, a moving average and the same week last year. The target is an average error of 15% or less. Until that evaluation is complete, forecasts are marked as provisional.
    - heading "Does CeView create marketing content for me?" [level=3]:
      - button "Does CeView create marketing content for me?"
    - region "Does CeView create marketing content for me?":
      - paragraph: It drafts social media captions and visual direction for the market you choose, using your business profile and that market’s cultural context. A second AI reviews each draft against a quality checklist and explains what to improve. You edit and approve the final version.
    - heading "Does CeView publish content automatically?" [level=3]:
      - button "Does CeView publish content automatically?"
    - region "Does CeView publish content automatically?":
      - paragraph: No. Nothing is posted to your accounts on your behalf. You decide what to use and where.
    - heading "Which ad platforms can I connect?" [level=3]:
      - button "Which ad platforms can I connect?"
    - region "Which ad platforms can I connect?":
      - paragraph: Meta and TikTok. You can also type in results manually. CeView turns them into return on ad spend, conversion rate, cost per customer, click-through rate and cost per click, plus one overall effectiveness score.
    - heading "How much will CeView cost?" [level=3]:
      - button "How much will CeView cost?"
    - region "How much will CeView cost?":
      - paragraph:
        - text: There’s a free Starter plan. Proposed paid plans start at ₱499 a month, and there’s a Partner Plan for LGU tourism offices and tourism associations. Prices will be tested with pilot businesses before launch. See
        - link "Plans":
          - /url: "#pricing"
        - text: .
    - heading "Is my business data private?" [level=3]:
      - button "Is my business data private?"
    - region "Is my business data private?":
      - paragraph: Yes. Your business profile, content and results stay in your own account, and other businesses using CeView can’t see them.
    - heading "How do I try CeView?" [level=3]:
      - button "How do I try CeView?"
    - region "How do I try CeView?":
      - paragraph:
        - link "Request a demo":
          - /url: "#demo"
        - text: . We’re onboarding Cebu tourism businesses into a guided pilot, and we’ll walk you through setup, recommendations and your first promotion.
  - region "Your next tourism opportunity may start before the bookings do.":
    - paragraph: Be part of a stronger Cebu tourism industry
    - heading "Your next tourism opportunity may start before the bookings do." [level=2]:
      - text: Your next tourism opportunity may start before the bookings
      - emphasis: do.
    - paragraph: Spot rising traveler interest, focus on the right market and prepare your marketing earlier.
    - link "Request a Demo":
      - /url: "#demo"
    - link "Take the Product Tour":
      - /url: "#product"
    - list:
      - listitem: Spot demand earlier
      - listitem: Reach the right travelers
      - listitem: Grow a stronger Cebu together
- contentinfo:
  - img "CeView"
  - paragraph: Tourism demand intelligence and AI-assisted marketing guidance for Cebu tourism businesses.
  - navigation "Product":
    - paragraph: Product
    - link "Why CeView":
      - /url: "#why"
    - link "How It Works":
      - /url: "#how-it-works"
    - link "Features":
      - /url: "#features"
    - link "Plans":
      - /url: "#pricing"
  - navigation "Company":
    - paragraph: Company
    - link "FAQ":
      - /url: "#faq"
    - link "Request a Demo":
      - /url: "#demo"
    - link "Sign In":
      - /url: /login
    - link "Contact":
      - /url: mailto:hello@ceview.local
  - paragraph: Supports
  - list:
    - listitem: UN SDG 8 · Decent work & economic growth
    - listitem: SDG 9 · Industry & innovation
    - listitem: SDG 11 · Sustainable communities
  - paragraph: © 2026 CeView. All rights reserved.
  - navigation "Legal":
    - link "Terms of Use":
      - /url: /terms
    - link "· Privacy Notice":
      - /url: /privacy
    - button "· Photo credits"
```

# Test source

```ts
  130 | 
  131 |   test('switching to annual billing changes the prices and the periods', async ({ page }) => {
  132 |     await page.goto('/');
  133 |     await page.getByRole('radio', { name: /Annually/ }).check();
  134 |     await expect(plan(page, 'Insights')).toContainText('₱4,990');
  135 |     await expect(plan(page, 'Insights')).toContainText('/year');
  136 |     await expect(plan(page, 'Growth')).toContainText('₱9,990');
  137 |     await page.getByRole('radio', { name: 'Monthly' }).check();
  138 |     await expect(plan(page, 'Insights')).toContainText('₱499');
  139 |     await expect(plan(page, 'Insights')).toContainText('/month');
  140 |   });
  141 | 
  142 |   test('a plan button pre-selects that plan in the demo form', async ({ page }) => {
  143 |     await page.goto('/');
  144 |     await page.getByRole('link', { name: 'Choose Insights: Insights plan' }).click();
  145 |     await expect(page).toHaveURL(/#demo\?plan=insights$/);
  146 |     await expect(page.locator('.cv-form-plan')).toContainText('Insights');
  147 |   });
  148 | 
  149 |   test('the partner plan button pre-fills the help field', async ({ page }) => {
  150 |     await page.goto('/');
  151 |     await page.getByRole('link', { name: /Ask about the Partner Plan/ }).click();
  152 |     await expect(page).toHaveURL(/#demo\?plan=partner$/);
  153 |     await expect(page.getByLabel(/What would you most like help with/)).toHaveValue('The Partner Plan');
  154 |   });
  155 | });
  156 | 
  157 | test.describe('Landing page — product tour', () => {
  158 |   const tabs = ['Demand Intelligence', 'Content Studio', 'Content Review', 'Performance'];
  159 | 
  160 |   test('shows four tabs with the first selected, and switching changes the panel', async ({ page }) => {
  161 |     await page.goto('/');
  162 |     for (const name of tabs) await expect(page.getByRole('tab', { name })).toBeVisible();
  163 |     await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'true');
  164 |     await page.getByRole('tab', { name: 'Content Review' }).click();
  165 |     await expect(page.getByRole('tab', { name: 'Content Review' })).toHaveAttribute('aria-selected', 'true');
  166 |     await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'false');
  167 |     await expect(page.getByText('Review score 84 · passes the mark of 70')).toBeVisible();
  168 |   });
  169 | 
  170 |   test('arrow keys, Home and End move between tabs, wrapping around', async ({ page }) => {
  171 |     await page.goto('/');
  172 |     const first = page.getByRole('tab', { name: tabs[0] });
  173 |     await first.focus();
  174 |     await page.keyboard.press('ArrowRight');
  175 |     await expect(page.getByRole('tab', { name: tabs[1] })).toHaveAttribute('aria-selected', 'true');
  176 |     await page.keyboard.press('End');
  177 |     await expect(page.getByRole('tab', { name: tabs[3] })).toHaveAttribute('aria-selected', 'true');
  178 |     await page.keyboard.press('ArrowRight');
  179 |     await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'true');
  180 |     await page.keyboard.press('ArrowLeft');
  181 |     await expect(page.getByRole('tab', { name: tabs[3] })).toHaveAttribute('aria-selected', 'true');
  182 |     await page.keyboard.press('Home');
  183 |     await expect(page.getByRole('tab', { name: tabs[0] })).toHaveAttribute('aria-selected', 'true');
  184 |   });
  185 | });
  186 | 
  187 | test.describe('Landing page — footer', () => {
  188 |   test('links to the legal pages and back to sign in', async ({ page }) => {
  189 |     await page.goto('/');
  190 |     const footer = page.locator('footer');
  191 |     await footer.getByRole('link', { name: 'Terms of Use' }).click();
  192 |     await expect(page).toHaveURL(/\/terms$/);
  193 |     await page.goBack();
  194 |     await footer.getByRole('link', { name: 'Privacy Notice' }).click();
  195 |     await expect(page).toHaveURL(/\/privacy$/);
  196 |   });
  197 | 
  198 |   test('the photo credits dialog opens and closes', async ({ page }) => {
  199 |     await page.goto('/');
  200 |     await page.getByRole('button', { name: 'Photo credits' }).click();
  201 |     const dialog = page.getByRole('dialog', { name: 'Photo credits' });
  202 |     await expect(dialog).toBeVisible();
  203 |     await expect(dialog).toContainText('Every photo on this page is a real photograph');
  204 |     await page.getByRole('button', { name: 'Close photo credits' }).click();
  205 |     await expect(dialog).toBeHidden();
  206 |   });
  207 | 
  208 |   test('the copyright line is shown', async ({ page }) => {
  209 |     await page.goto('/');
  210 |     await expect(page.getByText('© 2026 CeView. All rights reserved.')).toBeVisible();
  211 |   });
  212 | });
  213 | 
  214 | test.describe('Landing page — phone', () => {
  215 |   const open = (page: Page) => page.getByRole('button', { name: 'Open menu' });
  216 |   const sheet = (page: Page) => page.getByRole('dialog', { name: 'Menu' });
  217 | 
  218 |   test('@mobile the header shows a menu button instead of the links', async ({ page }) => {
  219 |     await page.goto('/');
  220 |     await expect(open(page)).toBeVisible();
  221 |     await expect(open(page)).toHaveAttribute('aria-expanded', 'false');
  222 |     await expect(headerNav(page)).toBeHidden();
  223 |   });
  224 | 
  225 |   test('@mobile the menu sheet opens, locks scrolling and lists the sections', async ({ page }) => {
  226 |     await page.goto('/');
  227 |     await open(page).click();
  228 |     await expect(sheet(page)).toBeVisible();
  229 |     for (const s of SECTIONS) await expect(sheet(page).getByRole('link', { name: s.link })).toBeVisible();
> 230 |     await expect(sheet(page).getByRole('link', { name: 'Request a Demo' })).toBeVisible();
      |                                                                             ^ Error: expect(locator).toBeVisible() failed
  231 |     expect(await page.evaluate(() => document.body.style.overflow)).toBe('hidden');
  232 |   });
  233 | 
  234 |   test('@mobile Escape closes the sheet, returns focus to the button and restores scrolling', async ({ page }) => {
  235 |     await page.goto('/');
  236 |     await open(page).click();
  237 |     await page.keyboard.press('Escape');
  238 |     await expect(sheet(page)).toBeHidden();
  239 |     await expect(open(page)).toBeFocused();
  240 |     expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  241 |   });
  242 | 
  243 |   test('@mobile the close button closes the sheet', async ({ page }) => {
  244 |     await page.goto('/');
  245 |     await open(page).click();
  246 |     await sheet(page).getByRole('button', { name: 'Close menu' }).click();
  247 |     await expect(sheet(page)).toBeHidden();
  248 |   });
  249 | 
  250 |   test('@mobile choosing a section closes the sheet and scrolls there', async ({ page }) => {
  251 |     await page.goto('/');
  252 |     await open(page).click();
  253 |     await sheet(page).getByRole('link', { name: 'Pricing' }).click();
  254 |     await expect(sheet(page)).toBeHidden();
  255 |     await expect(page).toHaveURL(/#pricing$/);
  256 |     await expect(page.locator('#pricing')).toBeInViewport();
  257 |   });
  258 | 
  259 |   test('@mobile Tab stays inside the open sheet', async ({ page }) => {
  260 |     await page.goto('/');
  261 |     await open(page).click();
  262 |     for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
  263 |     expect(await page.evaluate(() => !!document.activeElement?.closest('#cv-menu'))).toBe(true);
  264 |   });
  265 | 
  266 |   test('@mobile the page does not scroll sideways', async ({ page }) => {
  267 |     await page.goto('/');
  268 |     await expectNoHorizontalOverflow(page);
  269 |   });
  270 | });
  271 | 
```