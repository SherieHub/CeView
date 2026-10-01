---
name: tourism-app-branding
description: Comprehensive brand and design system for the AI-driven tourism web app, covering color palette, typography, font sizes, buttons, cards, spacing, and component styling. Use this skill whenever building, styling, or reviewing ANY UI for the tourism app — pages, components, landing sections, forms, buttons, cards, navigation, headers, or CSS/Tailwind/styled-components code. Trigger this even if the user doesn't explicitly say "branding" or "design system" — any request to build or style a screen, component, or page for this app should consult this skill first. Also use when the user asks about colors, fonts, button styles, or "make it match our brand."
---

# Tourism App — Brand & Design System

This skill defines the complete visual identity for the AI-driven tourism web app, inspired by a navy + mint tech-forward design, adapted with warm travel accents. Apply these rules by default to every UI element you build or edit for this app. Don't ask the user to re-specify colors/fonts — use this system automatically.

## Precedence

This skill's color palette, typography, and component rules are the
single source of truth for the tourism app and OVERRIDE any generic
frontend-design guidance — including its font recommendations and
"avoid common choices" rule. Do not swap fonts, colors, or button
styles for variety; consistency across the app is the goal, not novelty.

Where frontend-design's guidance doesn't conflict (motion/animation
principles, spacing rhythm, layout composition, avoiding generic
templated layouts), it's fine to apply on top of this brand system.

## Quick Start

When building any component, always:
1. Use CSS variables from Section 1 (never hardcode hex values inline — reference the variable name).
2. Match typography rules in Section 3 exactly (font family, size, weight, color per element type).
3. Use the correct button variant from Section 4 based on the action's importance (primary/warm CTA vs. secondary vs. outline).
4. Follow spacing/radius conventions in Section 5 so components feel consistent across the app.

If a request conflicts with this system (e.g., "make the button red"), apply the request but flag that it deviates from brand.

---

## 1. Color Palette (CSS Variables)

Include this block once in the project's global stylesheet (`globals.css`, `:root`, or Tailwind config) and reference variables everywhere else.

```css
:root {
  /* ---- Anchor / Structural ---- */
  --color-navy-primary: #1B3A5C;   /* Nav bar, footer, headings on light bg */
  --color-navy-dark: #16304D;      /* Hero background, dark overlays */

  /* ---- Primary Accent (cool) ---- */
  --color-mint-primary: #5FD6A6;   /* Default buttons, links, icon bg, highlights */
  --color-mint-light: #7FE0B8;     /* Hover states */
  --color-mint-pale: #E4F6EF;      /* Section backgrounds (alternating) */
  --color-mint-pale-alt: #EFFAF5;  /* Secondary light section bg */

  /* ---- Luminous accent (cool) ---- */
  --color-cyan-accent: #2ED9DA;    /* Gradients, indicators, hover text — never a fill behind text */

  /* ---- Travel Accent (warm) — use for primary conversion actions ---- */
  --color-teal-accent: #3CBDB1;    /* Water/coastline accent, secondary highlights */
  --color-coral-cta: #FF8C69;      /* "Book Now" / "Explore" / high-intent buttons */
  --color-coral-cta-hover: #FF7550;
  --color-sand: #FFB88C;           /* Secondary warm tone, badges, tags */

  /* ---- Neutrals ---- */
  --color-white: #FFFFFF;
  --color-off-white: #F7F9FA;
  --color-gray-text: #6B7B8C;      /* Secondary/meta text */
  --color-gray-light: #C9D6DE;     /* Borders, dividers, disabled states */

  /* ---- Text ---- */
  --color-text-heading: #1B3A5C;   /* Headings on light background */
  --color-text-body: #5A6B7A;      /* Paragraph copy */
  --color-text-inverse: #FFFFFF;   /* Text on navy/dark backgrounds */
  --color-text-accent: #5FD6A6;    /* Mint subheadings on dark backgrounds */
  --color-text-muted: #8A97A3;     /* Placeholder, timestamps, captions */
}
```

### Color usage rules
| Element | Color |
|---|---|
| Navbar / footer background | `--color-navy-primary` |
| Hero background (with image overlay) | `--color-navy-dark` at 70–80% opacity over image |
| Alternating content sections | `--color-white` ↔ `--color-mint-pale` |
| Cards on white/mint background | `--color-white` with soft shadow |
| Cards on navy background | `--color-white` or 10% white overlay (glassmorphism-lite) |
| Primary action buttons (Explore, Search, Learn More) | `--color-mint-primary` |
| High-intent conversion buttons (Book Now, Reserve, Buy Tickets) | `--color-coral-cta` |
| Secondary/tag badges (e.g. "Beach", "Adventure", "Family") | `--color-sand` or `--color-teal-accent` |
| Links | `--color-mint-primary`, hover → `--color-mint-light` |
| Borders / dividers | `--color-gray-light` |
| Disabled states | `--color-gray-light` bg, `--color-gray-text` text |

**Rule of thumb:** mint = general brand/navigation actions. Coral = money/booking actions. Never use both as competing CTAs in the same view — coral always wins visual priority when a booking action is present.

---

## 2. Font Families

```css
:root {
  --font-heading: 'Poppins', 'Montserrat', sans-serif; /* rounded, friendly geometric sans */
  --font-body: 'Inter', 'Open Sans', sans-serif;        /* clean, highly readable */
}
```

- **Headings** (`h1`–`h4`, nav labels, hero titles): `--font-heading`, weight 600–700.
- **Body copy, paragraphs, form labels, buttons**: `--font-body`, weight 400–600.
- Never mix in a third font family. If a Google Font is unavailable, fall back to system `sans-serif`.

---

## 3. Typography Scale

Apply these exact sizes/weights/colors by element type. Use `rem` units (base 16px).

| Element | Font | Size | Weight | Color | Line Height |
|---|---|---|---|---|---|
| Hero H1 (on dark bg) | heading | 2.75rem (44px) | 700 | `--color-text-inverse` | 1.15 |
| H1 (on light bg) | heading | 2.5rem (40px) | 700 | `--color-text-heading` | 1.2 |
| H2 (section title) | heading | 2rem (32px) | 700 | `--color-text-heading` | 1.25 |
| H3 (card/subsection title) | heading | 1.5rem (24px) | 600 | `--color-text-heading` | 1.3 |
| H4 (minor heading) | heading | 1.125rem (18px) | 600 | `--color-text-heading` | 1.4 |
| Subhead / accent tagline | heading | 1.125rem (18px) | 500 | `--color-text-accent` | 1.4 |
| Body paragraph | body | 1rem (16px) | 400 | `--color-text-body` | 1.6 |
| Small/meta text (dates, captions) | body | 0.875rem (14px) | 400 | `--color-text-muted` | 1.5 |
| Button label | body | 1rem (16px) | 600 | context-dependent (see §4) | 1 |
| Nav link | body | 0.9375rem (15px) | 500 | `--color-navy-primary` (or inverse on dark navbar) | 1 |
| Form label | body | 0.875rem (14px) | 600 | `--color-text-heading` | 1.4 |
| Form input text | body | 1rem (16px) | 400 | `--color-text-heading` | 1.4 |
| Placeholder text | body | 1rem (16px) | 400 | `--color-text-muted` | 1.4 |

```css
h1, h2, h3, h4 {
  font-family: var(--font-heading);
  color: var(--color-text-heading);
}

p, label, input, button, li {
  font-family: var(--font-body);
}

p {
  color: var(--color-text-body);
  font-size: 1rem;
  line-height: 1.6;
}

.subhead-accent {
  font-family: var(--font-heading);
  color: var(--color-text-accent);
  font-weight: 500;
  font-size: 1.125rem;
}

.text-meta {
  font-size: 0.875rem;
  color: var(--color-text-muted);
}
```

---

## 4. Buttons

Three variants, used contextually — do not invent new button styles.

### Primary (brand actions — Explore, Search, Learn More, Sign Up)
```css
.btn-primary {
  background-color: var(--color-mint-primary);
  color: var(--color-navy-dark);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: 1rem;
  border: none;
  border-radius: 24px; /* pill shape */
  padding: 12px 32px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.btn-primary:hover { background-color: var(--color-mint-light); }
.btn-primary:disabled { background-color: var(--color-gray-light); color: var(--color-gray-text); cursor: not-allowed; }
```

### CTA / Booking (Book Now, Reserve, Buy Tickets, Checkout)
```css
.btn-cta {
  background-color: var(--color-coral-cta);
  color: var(--color-white);
  font-family: var(--font-body);
  font-weight: 700;
  font-size: 1rem;
  border: none;
  border-radius: 24px;
  padding: 14px 36px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}
.btn-cta:hover { background-color: var(--color-coral-cta-hover); }
```

### Outline (secondary actions, on dark or light backgrounds)
```css
.btn-outline {
  background-color: transparent;
  border: 1.5px solid currentColor;
  color: var(--color-navy-primary); /* on light bg */
  font-family: var(--font-body);
  font-weight: 600;
  border-radius: 24px;
  padding: 11px 30px;
}
.btn-outline--inverse { color: var(--color-white); } /* use on navy/dark hero bg */
```

**Rules:**
- All buttons are pill-shaped (`border-radius: 24px`), no sharp corners, no square buttons.
- Only one `.btn-cta` per view/section max — it should stand out.
- Never place `.btn-cta` and `.btn-primary` side by side with equal visual weight; if both appear, `.btn-cta` is visually dominant (larger padding, bolder weight).
- `.btn-cta` also covers the **forward action in a multi-step flow** ("Continue", "Next",
  "Finish") — see §5 "Two rule changes this reference supersedes". It carries
  `--gradient-cta` there; `.btn-primary` and `.btn-outline` are always flat.

---

## 5. Spacing, Radius & Elevation

```css
:root {
  --radius-sm: 8px;    /* inputs, small tags */
  --radius-md: 16px;   /* cards */
  --radius-pill: 24px; /* buttons */

  --space-xs: 8px;
  --space-sm: 16px;
  --space-md: 24px;
  --space-lg: 48px;
  --space-xl: 80px;    /* section vertical padding */

  --shadow-card: 0 4px 20px rgba(27, 58, 92, 0.08);
  --shadow-card-hover: 0 8px 28px rgba(27, 58, 92, 0.14);
}

.card {
  background: var(--color-white);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  padding: var(--space-md);
  transition: box-shadow 0.2s ease;
}
.card:hover { box-shadow: var(--shadow-card-hover); }

section { padding: var(--space-xl) var(--space-md); }
```

- Sections alternate background (`white` → `mint-pale` → `white`) with `--space-xl` vertical padding between them.
- Cards always use `--radius-md` (16px) — never sharp corners, never fully rounded.
- Icons inside colored badge backgrounds (e.g. feature icons) use `--radius-md` as well, with `--color-mint-primary` or `--color-teal-accent` fill and white/navy iconography.

### Page width & full-bleed layout

**Application screens are full-bleed. Do not wrap them in a centered fixed-width container.**

Anything behind a login — dashboards, wizards, settings, content tools — must fill the
viewport. Structural chrome (sidebars, step rails, top bars, footers) sits flush against
the viewport edge, and the content column consumes all remaining width. A
`max-width: 1180px; margin: 0 auto` on an app shell is a bug: it strands large empty
gutters on wide screens and makes the product feel like a document instead of a tool.

```css
/* ✅ App shell — full-bleed, chrome flush to the edge */
.app-wrap {
  display: grid;
  grid-template-columns: 290px minmax(0, 1fr); /* rail + content */
  width: 100%;
  min-height: 100dvh;
}

/* ❌ Never do this on an authenticated app screen */
.app-wrap { max-width: 1180px; margin: 0 auto; }
```

**Full-bleed applies to chrome, not to text.** The distinction matters:

- **Chrome is full-bleed.** Sidebars, rails, nav and headers reach the viewport edge with
  no outer container and no inset — the gradient must touch the edge of the screen.
- **Content inside the column is capped and centred.** Give the content stack a
  `max-width` around `880px` with `margin-inline: auto`. A form or article running the
  full width of a 1900px display is unusable, and the padding alone won't save it. The
  column padding is the *floor* on small screens; the cap takes over on large ones.

```css
.app-main { padding: var(--space-lg) var(--space-xl); }   /* floor, small screens */
.app-main > * { max-width: 880px; margin-inline: auto; }  /* cap, large screens */
```

Rules:
- Grid track for the content column is `minmax(0, 1fr)`, never bare `1fr` — bare `1fr`
  has `min-width: auto` and lets wide children (tables, textareas, long labels) push the
  page into horizontal scroll.
- Cap the whole content stack at one shared width so the progress bar, panel and footer
  all align on the same left and right edges. Capping only some of them looks like a bug.
- Sidebars and rails are fixed-width tracks (`248px` app sidebar, `320px` wizard rail)
  that reach the top and bottom edges of the viewport. Never inset them.
- **Rails are pinned.** A rail stays in place while its content column scrolls:
  `position: sticky; top: 0; align-self: start; height: 100dvh; overflow-y: auto`. Use
  `sticky`, not `fixed` — sticky keeps the grid track, so the layout needs no compensating
  offset. `align-self: start` is required, otherwise the grid stretches the item and
  sticky silently does nothing.
- Below 1024px, multi-column shells collapse to a single column, the rail unpins and
  stacks, and padding drops to `--space-md`.

**Prose gets a tighter measure still.** Running paragraphs cap at `max-width: 56ch` on the
`<p>` itself — narrower than the 880px content cap, because comfortable reading measure is
shorter than comfortable form measure. Fields, tables, cards and charts fill the capped
content width.

Marketing pages (`<section>`-based landing content, per §7) are the other exception:
those may center at a comfortable reading width, since they *are* documents.

### Surface & gradient system

App screens are built from **two paired surfaces**: dark gradient chrome against a pale
mint canvas. This is the house look — use it for any full-screen app view (onboarding,
dashboards, settings shells).

```css
:root {
  /* Deep stops — navy anchor bridged to the teal accent */
  --color-deep-navy: #15304C;
  --color-deep-teal: #124A52;

  --gradient-chrome: linear-gradient(165deg, var(--color-deep-navy) 0%, var(--color-deep-teal) 100%);
  --gradient-canvas: linear-gradient(135deg, var(--color-mint-pale) 0%, var(--color-white) 55%, var(--color-mint-pale-alt) 100%);
  --gradient-accent: linear-gradient(90deg, var(--color-cyan-accent) 0%, var(--color-mint-primary) 100%);
  --gradient-cta:    linear-gradient(135deg, var(--color-coral-cta) 0%, var(--color-coral-cta-hover) 100%);

  /* Tints for content sitting ON dark chrome */
  --chrome-raised: rgba(255, 255, 255, 0.08);
  --chrome-line:   rgba(255, 255, 255, 0.14);
}
```

| Surface | Treatment |
|---|---|
| Sidebars, step rails, nav chrome, hero panels | `--gradient-chrome`, `--color-text-inverse` |
| Main content canvas | `--gradient-canvas` |
| Raised block on dark chrome (notes, active rows) | `--chrome-raised` — **never** a white card |
| Dividers on dark chrome | `--chrome-line` |
| Progress bars, active indicators, icon-badge fills | `--gradient-accent` |
| High-intent buttons | `--gradient-cta` |

Rules:
- **Gradients are for surfaces and indicators, never for controls** — the only gradient
  button is `.btn-cta`. `.btn-primary` and `.btn-outline` stay flat.
- **Never place two dark gradients side by side.** Chrome always meets canvas.
- On dark chrome, layer with white tints (`--chrome-raised`), not with light cards. A
  white card on the rail breaks the surface.
- Active/selected rows on chrome take `--chrome-raised` plus a **3px
  `--color-mint-primary` left border**.
- Form fields on the canvas are **elevated white cards** — `--radius-md`, `--shadow-card`,
  transparent border that becomes `--color-mint-primary` on hover. Do not use a flat
  grey-bordered input on a gradient canvas; it looks unfinished.
- Icon chips pair `--color-mint-pale` fill with a `--color-teal-accent` glyph.

### Form rhythm

Spacing inside a form must be **stepped, not flat**. Separating every element by the same
gap makes a form read as an undifferentiated list — grouping should be visible before any
text is read.

| Between | Gap |
|---|---|
| Label → its control | `10px` |
| Sibling controls in one group (stacked rows) | `12px` |
| One field group → the next | `40px` |
| Heading block → first field group | `40px` |
| Eyebrow → heading | `10px` |
| Heading → supporting paragraph | `12px` |

Padding for a full-screen app view: `--space-lg` vertical and `--space-xl` horizontal from
1024px up, dropping to `--space-md` on both axes below that. Content must never sit flush
against a rail or a viewport edge — full-bleed governs *surfaces*, not text.

**Focus on form surfaces uses a ring, not an outline.** The global
`:focus-visible { outline }` draws a second rectangle *inside* an already-bordered field,
which reads as a doubled border. Fields override it with a `box-shadow` ring that follows
their own `border-radius`:

```css
:root { --ring-focus: 0 0 0 3px rgba(95, 214, 166, 0.32); }

.input:focus, .input:focus-visible {
  outline: none;
  border-color: var(--color-mint-primary);
  box-shadow: var(--ring-focus), var(--shadow-card);
}
```

Where a control is wrapped in a surface (an icon chip plus an input in one card), the
**wrapper** owns focus via `:focus-within` and the inner control is stripped bare —
`outline: none; border: none; box-shadow: none`. One ring around the whole row, never a
ring nested inside a bordered row.

Never delete focus indication to remove a doubled outline — move it, so keyboard users
keep a visible target.

Fixed-width chrome must be sized against the §3 type scale, not the compact scale it may
have been designed at. A 290px rail that fitted 11px labels will wrap at `0.9375rem`;
widen the track (320px) rather than shrinking the type back down.
- **`--color-cyan-accent` is gradient-and-indicator only.** It gives the accent gradient
  its luminosity — progress bars, active step dots, brand marks. Never use it as a flat
  fill behind text or as a button colour: at `#2ED9DA` it fails contrast against both
  white and navy. If a cool element needs a solid fill, use `--color-teal-accent`.

### Two rule changes this reference supersedes

**1. Coral is now the forward action in a multi-step flow.** §4 previously reserved
`.btn-cta` for booking/money actions only. It now *also* covers the primary forward action
in a wizard or checkout flow — "Continue", "Next", "Finish" — because that action is the
conversion in an onboarding context. The step eyebrow above it takes the same coral, so a
step's identity and its forward action share one accent. `.btn-primary` (mint) remains the
default for ordinary brand actions everywhere else, and the "only one `.btn-cta` per view"
rule still holds — a flow's Continue *is* that one.

**2. Platform chips are unified, not brand-coloured.** Where several third-party platform
icons appear together (Instagram, TikTok, Facebook, Naver), give them all the standard
mint chip rather than each platform's own brand colour. Four saturated brand hues stacked
in a column overwhelm the mint/coral system; recognition comes from the glyph and its
adjacent label. Single, isolated platform marks may still use their own colour.

---

## 6. Iconography & Imagery

- Icon style: line icons or duotone, rounded stroke caps — matches the rounded/friendly heading font.
- Icon badges: square-ish rounded container (`--radius-md`), mint or teal background, white or navy icon.
- Photography: warm, natural travel photography (coastlines, landmarks, local culture) — avoid cold corporate stock photos. When used behind text (hero, CTA banners), always apply a navy overlay (`--color-navy-dark` at 70–80% opacity) for text legibility.

---

## 7. Example Component Patterns

### Hero section
```html
<section style="background: var(--color-navy-dark); padding: var(--space-xl) var(--space-md);">
  <h1 style="color: var(--color-text-inverse); font-family: var(--font-heading);">
    Discover your next adventure
  </h1>
  <p class="subhead-accent">Curated trips, powered by AI.</p>
  <button class="btn-cta">Book Now</button>
</section>
```

### Destination card
```html
<div class="card">
  <img src="..." style="border-radius: var(--radius-md);" />
  <h3>Bali, Indonesia</h3>
  <p class="text-meta">7 days · From $899</p>
  <button class="btn-primary">Explore</button>
</div>
```

---

## 8. Quick Reference Table

| Role | Hex | Variable |
|---|---|---|
| Navy anchor | `#1B3A5C` | `--color-navy-primary` |
| Navy dark (hero) | `#16304D` | `--color-navy-dark` |
| Mint primary | `#5FD6A6` | `--color-mint-primary` |
| Mint pale bg | `#E4F6EF` | `--color-mint-pale` |
| Cyan accent (gradients/indicators only) | `#2ED9DA` | `--color-cyan-accent` |
| Teal accent | `#3CBDB1` | `--color-teal-accent` |
| Coral CTA | `#FF8C69` | `--color-coral-cta` |
| Sand | `#FFB88C` | `--color-sand` |
| Body text | `#5A6B7A` | `--color-text-body` |
| Border/divider | `#C9D6DE` | `--color-gray-light` |
| Deep navy (chrome gradient start) | `#15304C` | `--color-deep-navy` |
| Deep teal (chrome gradient end) | `#124A52` | `--color-deep-teal` |

Surfaces: dark `--gradient-chrome` rails/nav against a `--gradient-canvas` content area;
elevated white fields on the canvas; `--chrome-raised` tints for blocks on the chrome.

Fonts: **Poppins/Montserrat** (headings) + **Inter/Open Sans** (body). Buttons: pill-shaped, 24px radius. Cards: 16px radius, soft navy-tinted shadow.