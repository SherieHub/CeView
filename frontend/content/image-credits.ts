/**
 * Every photo on the landing page: where it came from, under which licence,
 * and what it may truthfully be called.
 *
 * RULES
 *   - Files live in /public/images/landing/ (served at /images/landing/…).
 *     Downloaded and stored locally — never hotlinked.
 *   - Real photography only: Unsplash or Pexels (free licences) for general
 *     scenes; Wikimedia Commons (CC0 / CC BY / CC BY-SA, with attribution) for
 *     specific Cebu landmarks. No placeholder services, AI-generated images,
 *     identifiable third-party branding or celebrities.
 *   - `verifiedLocation` is the place the source page records, or null. A
 *     caption may only name a specific place when this is set.
 *   - WebP, ≤ 2400px wide for full-bleed, ≤ 1600px for cards, ideally < 350KB.
 *
 * The photos below are illustrative Philippine tourism scenes, not CeView
 * customers. All seven were checked as non-premium (not Unsplash+) when
 * downloaded on 2026-09-23.
 */

export type ImageLicense =
  | 'Unsplash License'
  | 'Pexels License'
  | 'CC0'
  | 'CC BY 2.0'
  | 'CC BY 4.0'
  | 'CC BY-SA 3.0'
  | 'CC BY-SA 4.0';

export interface ImageCredit {
  /** Where the image is used. Unique. */
  slot: string;
  /** File name inside /public/images/landing/. */
  file: string;
  /** Optional AVIF sibling in the same folder. */
  avif?: string;
  /**
   * Responsive set: files named `${base}-${w}.webp` (and `.avif`) for each
   * width. `file` should be the largest of them, used as the fallback src.
   */
  responsive?: { base: string; widths: readonly number[]; avif: boolean };
  width: number;
  height: number;
  alt: string;
  caption: string;
  photographer: string;
  sourceUrl: string;
  license: ImageLicense;
  /** Location recorded by the source, or null when it records none. */
  verifiedLocation: string | null;
  /**
   * Visible credit line, required wherever the licence asks for attribution
   * (CC BY / CC BY-SA). Rendered in the landing footer. Unsplash and Pexels
   * photos don't need one.
   */
  attribution?: string;
  /** Licence deed URL, linked from the visible credit. */
  licenseUrl?: string;
}

export const IMAGE_BASE = '/images/landing/';

export const IMAGE_CREDITS = [
  {
    // Resized and recompressed from the original; as an adaptation it is
    // shared under the same CC BY-SA 3.0 licence.
    slot: 'hero-cebu-coast',
    file: 'hero-cebu-coast-2400.webp',
    responsive: { base: 'hero-cebu-coast', widths: [1280, 1920, 2400], avif: true },
    width: 2400,
    height: 938,
    alt: 'Clear turquoise water and a white-sand beach at White Beach, Moalboal, with an outrigger bangka offshore.',
    caption: 'White Beach, Moalboal, Cebu',
    photographer: 'Lindstrm',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:High_tide_at_White_Beach_in_Moalboal.JPG',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
    verifiedLocation: 'White Beach, Moalboal, Cebu, Philippines',
    attribution: 'Photo: White Beach, Moalboal, by Lindstrm, CC BY-SA 3.0, via Wikimedia Commons',
  },
  {
    // Decorative texture behind "How CeView works", shown at 14% opacity and
    // never captioned, so it makes no claim about place. It is NOT the
    // Philippines: no licensable Philippine reef aerial of this size was found
    // on Commons. Swap for a Cebu reef photo when one is available.
    // Resized and recompressed, so shared under the same CC BY-SA 4.0 licence.
    slot: 'howitworks-ocean-texture',
    file: 'howitworks-ocean-texture-2400.webp',
    responsive: { base: 'howitworks-ocean-texture', widths: [1600, 2400], avif: true },
    width: 2400,
    height: 1600,
    alt: 'Aerial view of coral heads in clear turquoise shallow water.',
    caption: 'Shallow-water reef from above',
    photographer: 'Paul Harrison',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Coral_Reef_from_Above_1.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedLocation: 'Caribbean (exact site not given by the source)',
    attribution: 'Texture photo: Coral Reef from Above, by Paul Harrison, CC BY-SA 4.0, via Wikimedia Commons',
  },
  {
    // Product split: a 4:3 crop of the original, keeping the palm-lined shore on the right.
    slot: 'product-malapascua-beach',
    file: 'product-malapascua-beach-1600.webp',
    responsive: { base: 'product-malapascua-beach', widths: [960, 1600], avif: true },
    width: 1600,
    height: 1200,
    alt: 'Clear turquoise water lapping a white-sand beach lined with palm trees on Malapascua Island.',
    caption: 'Malapascua Island',
    photographer: 'Vyacheslav Argenberg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Malapascua_(island),_Tropical_beach,_Philippines.jpg',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    verifiedLocation: 'Malapascua Island, Central Visayas, Philippines',
    attribution: 'Photo: Malapascua Island, by Vyacheslav Argenberg, CC BY 4.0, via Wikimedia Commons',
  },
  {
    // 4:3 crop of the original; the source title names Moalboal.
    slot: 'product-sea-turtle',
    file: 'product-sea-turtle-800.webp',
    responsive: { base: 'product-sea-turtle', widths: [480, 800], avif: true },
    width: 800,
    height: 600,
    alt: 'A sea turtle swimming over a coral reef in clear blue water off Moalboal, Cebu.',
    caption: 'Moalboal, Cebu',
    photographer: 'Lakshmi Sawitri',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:2014_11_Moalboal_37_turtle_with_2_hitchikers_(15862666838).jpg',
    license: 'CC BY 2.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    verifiedLocation: 'Moalboal, Cebu, Philippines',
    attribution: 'Photo: sea turtle, Moalboal, by Lakshmi Sawitri, CC BY 2.0, via Wikimedia Commons',
  },
  {
    // Demo section, beside the form. The brief's first choice (a Filipino
    // tourism business owner at work) had no freely licensed match, so this
    // is its stated fallback: a calm Cebu beach. 16:10 crop.
    slot: 'demo-side',
    file: 'demo-side-1600.webp',
    responsive: { base: 'demo-side', widths: [960, 1600], avif: true },
    width: 1600,
    height: 1000,
    alt: 'Palm trees casting long shadows across a white-sand beach with calm turquoise water.',
    caption: 'Bounty Beach, Malapascua Island',
    photographer: 'Vyacheslav Argenberg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Malapascua_(island),_Bounty_Beach_with_palms,_Philippines.jpg',
    license: 'CC BY 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
    verifiedLocation: 'Bounty Beach, Malapascua Island, Cebu, Philippines',
    attribution: 'Photo: Bounty Beach, Malapascua, by Vyacheslav Argenberg, CC BY 4.0, via Wikimedia Commons',
  },
  {
    // "How CeView works": decorative, faded in from the section's top right.
    slot: 'how-lagoon',
    file: 'how-lagoon-1600.webp',
    responsive: { base: 'how-lagoon', widths: [1000, 1600], avif: true },
    width: 1600,
    height: 1067,
    alt: 'Limestone cliffs around a turquoise lagoon, with outrigger boats moored along a boardwalk.',
    caption: 'Kayangan Lake viewpoint, Coron',
    photographer: 'Mmlibranda',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:The_viewpoint_on_the_hike_to_Kayangan_Lake.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedLocation: 'Coron, Palawan, Philippines',
    attribution: 'Photo: Kayangan Lake viewpoint, Coron, by Mmlibranda, CC BY-SA 4.0, via Wikimedia Commons',
  },
  {
    // "Who it's for" banner: decorative, shown on the right under the section's teal fade.
    slot: 'who-sumilon-sandbar',
    file: 'who-sumilon-sandbar-1600.webp',
    responsive: { base: 'who-sumilon-sandbar', widths: [1000, 1600], avif: true },
    width: 1600,
    height: 900,
    alt: 'The white sandbar of Sumilon Island reaching into turquoise water, with an outrigger boat and the Cebu mainland behind.',
    caption: 'Sumilon Island sandbar, Oslob',
    photographer: 'Warrendering',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sumilon_Island_sandbar.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedLocation: 'Sumilon Island, Oslob, Cebu, Philippines (GPS 9.4329, 123.3861)',
    attribution: 'Photo: Sumilon Island sandbar, by Warrendering, CC BY-SA 4.0, via Wikimedia Commons',
  },
  {
    // Final CTA band: a 3:2 crop shown full-bleed under a dark teal overlay.
    slot: 'cta-aerial-ocean',
    file: 'cta-aerial-ocean-2400.webp',
    responsive: { base: 'cta-aerial-ocean', widths: [1200, 2400], avif: true },
    width: 2400,
    height: 1600,
    alt: 'Aerial view of a forested island ringed by reef and turquoise shallows, with two outrigger boats moored offshore.',
    caption: 'Linapacan, Palawan',
    photographer: 'Bernd Dittrich (@hdbernd)',
    sourceUrl: 'https://unsplash.com/photos/2sx3mgMCNho',
    license: 'Unsplash License',
    verifiedLocation: 'New Culaylayan, Linapacan, Palawan, Philippines',
  },
  {
    // FAQ help card: a 4:3 crop of the city and sea.
    slot: 'faq-card',
    file: 'faq-card-1000.webp',
    responsive: { base: 'faq-card', widths: [600, 1000], avif: true },
    width: 1000,
    height: 750,
    alt: 'Metro Cebu and the sea beyond, seen from the hills above Cebu City.',
    caption: 'Metro Cebu from Tops Lookout',
    photographer: 'Patrickroque01',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Metro_Cebu_view_from_Tops_Lookout_(Cebu_City;_09-06-2022).jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    verifiedLocation: 'Tops Lookout, Cebu City, Philippines',
    attribution: 'Photo: Metro Cebu from Tops Lookout, by Patrickroque01, CC BY-SA 4.0, via Wikimedia Commons',
  },
  // "Who it's for" cards: 4:3 centre crops of the full-resolution originals.
  {
    slot: 'who-resort',
    file: 'who-resort-1200.webp',
    responsive: { base: 'who-resort', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'A resort hotel with palm trees and a large blue swimming pool.',
    caption: 'Resort pool, Philippines',
    photographer: 'SJ (@uxsj_ph)',
    sourceUrl: 'https://unsplash.com/photos/fcwxfhNHIvY',
    license: 'Unsplash License',
    verifiedLocation: null,
  },
  {
    slot: 'who-dive',
    file: 'who-dive-1200.webp',
    responsive: { base: 'who-dive', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'A scuba diver swimming over a coral reef in the Philippines.',
    caption: 'Kimud Shoal, Tabango, Leyte',
    photographer: 'Oliver Schwaneberg (@schwanebergo)',
    sourceUrl: 'https://unsplash.com/photos/6MBFQXv--MY',
    license: 'Unsplash License',
    verifiedLocation: 'Kimud Shoal, Tabango, Leyte, Philippines',
  },
  {
    slot: 'who-adventure',
    file: 'who-adventure-1200.webp',
    responsive: { base: 'who-adventure', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'A waterfall pouring into a turquoise pool in Badian, Cebu.',
    caption: 'Badian, Cebu',
    photographer: 'Toa Heftiba (@heftiba)',
    sourceUrl: 'https://unsplash.com/photos/OmFuGKuXik8',
    license: 'Unsplash License',
    verifiedLocation: 'Badian, Philippines',
  },
  {
    slot: 'who-heritage',
    file: 'who-heritage-1200.webp',
    responsive: { base: 'who-heritage', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'Visitors at a historic stone pavilion with a tiled roof.',
    caption: 'Heritage site, Philippines',
    photographer: 'Angelyn Sanjorjo (@kiisstherain)',
    sourceUrl: 'https://unsplash.com/photos/44q8e4QN6RE',
    license: 'Unsplash License',
    verifiedLocation: null,
  },
  {
    slot: 'who-attraction',
    file: 'who-attraction-1200.webp',
    responsive: { base: 'who-attraction', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'Flower beds in front of colourful windmill-style buildings at a hillside garden attraction.',
    caption: 'Sirao Garden, Cebu City',
    photographer: 'Maria Glenda Perico',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Sirao_Garden.jpg',
    license: 'CC BY-SA 4.0',
    verifiedLocation: 'Sirao, Cebu City, Philippines',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'Photo: Sirao Garden, by Maria Glenda Perico, CC BY-SA 4.0, via Wikimedia Commons',
  },
  {
    slot: 'who-food',
    file: 'who-food-1200.webp',
    responsive: { base: 'who-food', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'Hands reaching for rice, grilled fish and vegetables served on banana leaves.',
    caption: 'Shared meal, Mabalacat, Pampanga',
    photographer: 'Avel Chuklanov (@chuklanov)',
    sourceUrl: 'https://unsplash.com/photos/sedJnjrUMM8',
    license: 'Unsplash License',
    verifiedLocation: 'Mabalacat, Philippines',
  },
  {
    slot: 'who-transport',
    file: 'who-transport-1200.webp',
    responsive: { base: 'who-transport', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'A brightly painted jeepney driving through a city street.',
    caption: 'Jeepney, Cebu City',
    photographer: 'Akiyoshi Matsuoka (松岡明芳)',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:2016-09-27Jeepney_in_Cebu_City_DSCF5388.jpg',
    license: 'CC BY-SA 4.0',
    verifiedLocation: 'Cebu City, Philippines',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
    attribution: 'Photo: jeepney in Cebu City, by Akiyoshi Matsuoka, CC BY-SA 4.0, via Wikimedia Commons',
  },
  {
    slot: 'who-souvenir',
    file: 'who-souvenir-1200.webp',
    responsive: { base: 'who-souvenir', widths: [800, 1200], avif: true },
    width: 1200,
    height: 900,
    alt: 'A craftsman finishing an acoustic guitar by hand in a workshop.',
    caption: 'Guitar workshop, Cebu',
    photographer: 'shankar s.',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Giving_the_finishing_touches_(9237746362).jpg',
    license: 'CC BY 2.0',
    verifiedLocation: 'Cebu, Philippines',
    licenseUrl: 'https://creativecommons.org/licenses/by/2.0/',
    attribution: 'Photo: guitar workshop, Cebu, by shankar s., CC BY 2.0, via Wikimedia Commons',
  },
  {
    slot: 'who-partner-community',
    file: 'who-partner-community-1600.webp',
    responsive: { base: 'who-partner-community', widths: [960, 1600], avif: true },
    width: 1600,
    height: 1000,
    alt: 'Sinulog festival dancers in red and gold costumes, one holding an image of the Santo Niño aloft.',
    caption: 'Sinulog Festival, Cebu',
    photographer: 'Ralphllanos',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Unity_in_Dance,_The_Heart_of_Sinulog_Festival.jpg',
    license: 'CC0',
    verifiedLocation: 'Cebu City, Philippines',
  },
  {
    // 4:5 crop of the full-resolution original, centred on the boats.
    slot: 'challenge-aerial-boats',
    file: 'challenge-aerial-boats-1200.webp',
    responsive: { base: 'challenge-aerial-boats', widths: [800, 1200], avif: true },
    width: 1200,
    height: 1500,
    alt: 'Aerial view of outrigger bangka boats moored beside a forested island in clear turquoise water off Moalboal, Cebu.',
    caption: 'Moalboal, Cebu',
    photographer: 'Ken Suarez (@kensuarez)',
    sourceUrl: 'https://unsplash.com/photos/oO7d1Q9mJZQ',
    license: 'Unsplash License',
    verifiedLocation: 'Moalboal, Philippines',
  },
] as const satisfies readonly ImageCredit[];

export type ImageSlot = (typeof IMAGE_CREDITS)[number]['slot'];

export interface ResolvedImage extends ImageCredit {
  src: string;
  /** `srcset` for the WebP files, when the image has a responsive set. */
  srcSet?: string;
  /** AVIF `srcset` (responsive set) or single AVIF URL. */
  avifSrcSet?: string;
}

/** The credit for a slot. Typed, so an unknown slot is a compile error. */
export function imageFor(slot: ImageSlot): ResolvedImage {
  const credit: ImageCredit = IMAGE_CREDITS.find((c) => c.slot === slot)!;
  const r = credit.responsive;
  const set = (ext: string) => r!.widths.map((w) => `${IMAGE_BASE}${r!.base}-${w}.${ext} ${w}w`).join(', ');
  return {
    ...credit,
    src: IMAGE_BASE + credit.file,
    srcSet: r ? set('webp') : undefined,
    avifSrcSet: r ? (r.avif ? set('avif') : undefined) : credit.avif ? IMAGE_BASE + credit.avif : undefined,
  };
}
