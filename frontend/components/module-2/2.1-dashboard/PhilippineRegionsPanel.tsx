/**
 * Top Philippines Region Market — the domestic counterpart of the international
 * markets panel, with the same rows (rank, region map, name, bar, score),
 * each opening the same radar drawer the international markets use
 * (RegionRadarDrawer).
 *
 * Design-preview data only: the API does not yet return regional rankings.
 * The ⓘ beside the heading says so (tooltip and screen-reader text), and the
 * drawer repeats it, so the figures are never presented as a live forecast.
 *
 * The open drawer can be controlled from outside (`activeRegionName` +
 * `onActiveRegionChange`) so the dashboard's summary tile can open it too;
 * left uncontrolled, the panel manages it itself.
 */
import { useEffect, useState } from 'react';
import { Info, MousePointerClick } from 'lucide-react';
import RegionMapIcon from './RegionMapIcon';
import RegionRadarDrawer from './RegionRadarDrawer';
import { SAMPLE_REGIONS } from './regionSamples';
import type { DemandAlert } from '@/types';

export { SAMPLE_REGIONS };

const PREVIEW_NOTE = 'Preview rankings — live regional forecasts are not available yet.';

interface PhilippineRegionsPanelProps {
  selectedAlert: DemandAlert | null;
  /** Category shown when no alert is selected (e.g. the top market's). */
  fallbackCategory?: string | null;
  activeRegionName?: string | null;
  onActiveRegionChange?: (name: string | null) => void;
}

export default function PhilippineRegionsPanel({
  selectedAlert,
  fallbackCategory = null,
  activeRegionName,
  onActiveRegionChange,
}: PhilippineRegionsPanelProps) {
  const controlled = onActiveRegionChange !== undefined;
  const [ownActive, setOwnActive] = useState<string | null>(null);
  const activeName = controlled ? (activeRegionName ?? null) : ownActive;
  const setActive = controlled ? onActiveRegionChange : setOwnActive;

  useEffect(() => {
    if (!controlled) setOwnActive(null);
  }, [selectedAlert?.id, controlled]);

  const category = selectedAlert?.category ?? fallbackCategory ?? 'Uncategorized';

  return (
    <section className="dash-regions" aria-labelledby="dash-regions-title">
      <div className="feed-head">
        <h2 id="dash-regions-title" className="heading-md">
          Top Philippines Region Market
          <span className="region-info" title={PREVIEW_NOTE}>
            <Info size={16} strokeWidth={1.75} aria-hidden="true" />
            <span className="sr-only">{PREVIEW_NOTE}</span>
          </span>
        </h2>
        {selectedAlert && <span className="markets-note">{category}</span>}
      </div>

      {selectedAlert ? (
        <ol className="region-list rank-list">
          {SAMPLE_REGIONS.map((region, index) => {
            const isLead = index === 0;
            return (
              <li key={region.name}>
                <button
                  type="button"
                  className="rank-card"
                  data-lead={isLead}
                  onClick={() => setActive(region.name)}
                  aria-label={`View ${region.name} region details`}
                >
                  <span className="rank-no" data-lead={isLead}>
                    {index + 1}
                  </span>
                  <RegionMapIcon name={region.name} />
                  <span className="rank-name">
                    <h3 className="heading-sm">{region.name}</h3>
                  </span>
                  <span className={`bar ${isLead ? 'bar--lead' : ''}`} aria-hidden="true">
                    <i style={{ width: `${region.score}%` }} />
                  </span>
                  <b className="rank-pts num">
                    {region.score}
                    <span className="sr-only"> out of 100</span>
                  </b>
                </button>
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="card">
          <div className="empty">
            <div className="empty-glyph">
              <MousePointerClick aria-hidden="true" />
            </div>
            <h3 className="heading-sm">Select a surge alert</h3>
            <p className="body-sm">Select an alert to view the Philippine-region preview for your dashboard.</p>
          </div>
        </div>
      )}

      {/* Mounted only while a region is open, like the drawer it replaced, so a
          closed one never sits in the page beside the international drawer. */}
      {activeName && <RegionRadarDrawer activeName={activeName} onChange={setActive} />}
    </section>
  );
}
