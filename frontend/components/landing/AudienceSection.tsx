/**
 * Who it's for — six image-led cards, one per kind of tourism business.
 *
 * The photos are illustrative stock (Unsplash, see assets/photos/CREDITS.md)
 * chosen for variety: an establishment, an activity, a landscape, heritage,
 * an event and food, most with people in frame. A note under the grid says
 * they aren't CeView customers. Each card takes one accent from the palette
 * for its badge and hover edge; the photos get a light teal grade so they
 * sit inside the CeView surface rather than on top of it.
 */
import { BedDouble, FerrisWheel, Fish, Landmark, Mountain, UtensilsCrossed } from 'lucide-react';
import resortPhoto from './assets/photos/resort.webp';
import divePhoto from './assets/photos/dive.webp';
import naturePhoto from './assets/photos/nature.webp';
import culturePhoto from './assets/photos/culture.webp';
import attractionsPhoto from './assets/photos/attractions.webp';
import foodPhoto from './assets/photos/food.webp';
import { AUDIENCE } from './landingContent';
import { SectionHead } from './landingParts';

const MEDIA = {
  stay: { photo: resortPhoto, icon: BedDouble },
  dive: { photo: divePhoto, icon: Fish },
  nature: { photo: naturePhoto, icon: Mountain },
  culture: { photo: culturePhoto, icon: Landmark },
  fun: { photo: attractionsPhoto, icon: FerrisWheel },
  food: { photo: foodPhoto, icon: UtensilsCrossed },
};

export default function AudienceSection() {
  return (
    <section className="lp-section lp-section--white" id="who-its-for" aria-labelledby="lp-audience-title">
      <div className="lp-wrap">
        <div className="lp-audience-head">
          <SectionHead id="lp-audience-title" eyebrow={AUDIENCE.eyebrow} title={AUDIENCE.title} />
          <p className="lp-lede">{AUDIENCE.lede}</p>
        </div>

        <ul className="lp-audience-grid">
          {AUDIENCE.items.map((a) => {
            const { photo, icon: Icon } = MEDIA[a.key];
            return (
              <li key={a.key} className="lp-audience-card lp-reveal" data-accent={a.accent}>
                <div className="lp-audience-photo">
                  <img src={photo} alt={a.alt} width={800} height={480} loading="lazy" decoding="async" />
                </div>
                <div className="lp-audience-body">
                  <span className="lp-audience-badge" aria-hidden="true">
                    <Icon size={22} strokeWidth={1.8} />
                  </span>
                  <h3 className="lp-h3">{a.title}</h3>
                  <p className="lp-body">{a.body}</p>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="lp-photo-note">{AUDIENCE.photoNote}</p>
      </div>
    </section>
  );
}
