import { BedDouble, Landmark, MapPin, Mountain, Utensils } from 'lucide-react';

/** UI stubs requested for the dashboard preview, not live search-interest scores. */
const STUB_TRENDS = [
  { name: 'Beach', category: 'Coastal & Island', score: 100, tone: 'coastal', icon: MapPin },
  { name: 'Bay', category: 'Coastal & Island', score: 92, tone: 'coastal', icon: MapPin },
  { name: 'Sand', category: 'Coastal & Island', score: 88, tone: 'coastal', icon: MapPin },
  { name: 'Diving', category: 'Adventure & Nature', score: 84, tone: 'purple', icon: Mountain },
  { name: 'Fiesta', category: 'Cultural & Heritage', score: 81, tone: 'coral', icon: Landmark },
  { name: 'Spa', category: 'Accommodation & Staycation', score: 76, tone: 'blue', icon: BedDouble },
  { name: 'Dining', category: 'Culinary & Gastronomy', score: 72, tone: 'gold', icon: Utensils },
  { name: 'Cliff', category: 'Adventure & Nature', score: 68, tone: 'blue', icon: Mountain },
] as const;
const LINES = [
  'M2 23 Q6 17 11 20 M16 16 Q21 9 27 12 T39 7 M43 6 L47 3',
  'M2 22 Q7 17 12 20 M17 15 Q22 10 28 12 T40 6 M44 6 L48 3',
  'M2 21 Q7 17 12 20 M17 15 Q22 11 28 12 T40 8 M44 7 L48 4',
];
export default function TrendingBusinessTypes() {
  return (
    <section className="dash-business-trends" aria-labelledby="business-trends-title">
      <h2 id="business-trends-title" className="heading-md">Trending Search Interests</h2>
      <p className="body-sm">Preview data · Illustrative search interests across tourism themes.</p>
      <div className="business-trends-scroll" role="region" aria-label="Trending search interests preview" tabIndex={0}>
        <ol>
          {STUB_TRENDS.map((trend, index) => {
            const Icon = trend.icon;
            return (
              <li key={trend.name}>
                <span className="business-trend-rank">{index + 1}</span>
                <div className="business-trend-copy">
                  <h3>{trend.name}</h3>
                  <span className="business-trend-category" data-tone={trend.tone}><Icon size={12} aria-hidden="true" />{trend.category}</span>
                </div>
                <svg className="business-trend-spark" viewBox="0 0 50 28" fill="none" aria-hidden="true">
                  <path d={LINES[index % LINES.length]} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                <b className="business-trend-score" data-muted={index === 7 || undefined}>{trend.score}</b>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
