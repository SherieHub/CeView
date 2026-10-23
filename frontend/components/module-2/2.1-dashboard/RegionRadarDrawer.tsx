/**
 * The Philippine regions' drawer: the same RadarDrawerView the international
 * markets use, fed with regionPreview.ts's preview data, with region maps in
 * the switcher. A notice under the header says the figures are a preview,
 * and "Target this market" stays disabled until Content Studio can target a
 * region (it sends the market id to the backend, which only knows the
 * international markets).
 */
import { FlaskConical } from 'lucide-react';
import RadarDrawerView from '../2.2-market-radar/RadarDrawerView';
import RegionMapIcon from './RegionMapIcon';
import { REGION_MARKETS, regionMarketByName } from './regionPreview';

interface RegionRadarDrawerProps {
  /** Open region by name, or null for closed. */
  activeName: string | null;
  onChange: (name: string | null) => void;
}

export default function RegionRadarDrawer({ activeName, onChange }: RegionRadarDrawerProps) {
  return (
    <RadarDrawerView
      markets={REGION_MARKETS}
      market={regionMarketByName(activeName)}
      onSelect={(id) => onChange(REGION_MARKETS.find((m) => m.id === id)?.name ?? null)}
      onClose={() => onChange(null)}
      renderIcon={(m) => <RegionMapIcon name={m.name} />}
      dialogLabel={(m) => `${m.name} region details`}
      switcher="dropdown"
      switcherLabel="Switch region"
      targetUnavailable="Regional targeting isn't available yet — Content Studio can target the international markets for now."
      notice={
        <section className="radar-section radar-notice" aria-label="Preview data">
          <div className="info-card" data-tone="attention" role="status">
            <span className="info-tab">Preview data</span>
            <div className="info-body">
              <span className="info-glyph">
                <FlaskConical size={16} strokeWidth={2} aria-hidden="true" />
              </span>
              <p className="body-sm">
                Live regional forecasts are not available yet. The rankings, figures and insights below are an
                illustrative preview of how this view will work.
              </p>
            </div>
          </div>
        </section>
      }
    />
  );
}
