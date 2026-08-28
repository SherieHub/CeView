/**
 * CARD — Market Radar Drawer: Economic & Seasonal Insights Tabs
 * Prototype reference: renderRadar() — ui-ux-prototype.html:2532-2793
 *
 * Two lenses on the same market. The shell owns the active tab so that
 * switching it cannot disturb the sibling chart's timeframe, which is the
 * milestone for this card.
 *
 * Both panels stay mounted and are hidden with `hidden` rather than being
 * unmounted — remounting would reset each panel's own scroll position and
 * throw away the charts' render every time you toggle.
 */
import PurchasingPowerTab from './PurchasingPowerTab';
import SeasonalPatternsTab from './SeasonalPatternsTab';
import type { DrawerInsightsSlotProps, InsightsTab } from './radarTypes';

const TABS: { id: InsightsTab; label: string }[] = [
  { id: 'economy', label: 'Purchasing Power' },
  { id: 'season', label: 'Seasonal Patterns' },
];

export default function InsightsTabs({ market, activeTab, onTabChange }: DrawerInsightsSlotProps) {
  return (
    <section className="radar-section" aria-label="Market insights">
      <div className="seg mb-4" role="tablist" aria-label="Market insights">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`radar-tab-${t.id}`}
            aria-selected={activeTab === t.id}
            aria-controls={`radar-panel-${t.id}`}
            aria-pressed={activeTab === t.id}
            onClick={() => onTabChange(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id="radar-panel-economy"
        aria-labelledby="radar-tab-economy"
        hidden={activeTab !== 'economy'}
      >
        <PurchasingPowerTab market={market} />
      </div>

      <div
        role="tabpanel"
        id="radar-panel-season"
        aria-labelledby="radar-tab-season"
        hidden={activeTab !== 'season'}
      >
        <SeasonalPatternsTab market={market} />
      </div>
    </section>
  );
}
