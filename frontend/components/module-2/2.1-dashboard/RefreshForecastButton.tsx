/**
 * CARD — Dashboard: AI Status Banner & Refresh Forecast
 * Prototype reference: ui-ux-prototype.html:2484-2486, 2521-2528
 *
 * Re-runs the forecast pipeline.
 *
 * The completion toast branches on degraded mode. The prototype's banner said
 * refreshing "will not produce new predictions until the service recovers" and
 * then toasted "Forecast refreshed — 3 markets re-ranked" regardless, so the
 * page contradicted itself in the one state where the operator most needs to
 * trust it.
 *
 * The 2100ms delay lives in apiClient.forecast.analyze()'s fixture branch, not
 * here — this component owns no timer.
 */
import { RefreshCw } from 'lucide-react';
import { useToast } from '../../shared/Toast';
import type { RefreshForecastSlotProps } from './dashboardTypes';

export default function RefreshForecastButton({
  isRefreshing,
  degraded,
  onRefresh,
}: RefreshForecastSlotProps) {
  const { showToast } = useToast();

  async function handleClick() {
    const result = await onRefresh();
    // A null result means the run failed — useDashboardState already routed
    // the error into ApiErrorPanel, so toasting a fake success here would
    // contradict the error panel sitting right above it.
    if (result == null) return;

    if (degraded) {
      showToast('Forecast service still unavailable — showing cached rankings');
      return;
    }
    const count = result.markets.length;
    showToast(`Forecast refreshed — ${count} market${count === 1 ? '' : 's'} re-ranked`);
  }

  return (
    <button type="button" className="btn-outline btn-outline--sm" onClick={handleClick} disabled={isRefreshing}>
      {isRefreshing ? (
        <>
          <span className="spinner" aria-hidden="true" /> Running pipeline…
        </>
      ) : (
        <>
          <RefreshCw size={14} aria-hidden="true" /> Refresh forecast
        </>
      )}
    </button>
  );
}
