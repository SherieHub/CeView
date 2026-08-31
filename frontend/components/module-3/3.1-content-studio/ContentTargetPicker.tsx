/**
 * Gates Content Studio behind an explicit two-step pick: a surge alert, then a
 * target market for that alert's category. Ports the design agreed in
 * docs/superpowers/specs/2026-08-13-content-studio-alert-market-picker-design.md
 * (written against the frozen ui-ux-prototype.html) to the real frontend and
 * real backend data — no entry point may skip this by inferring a market on
 * the operator's behalf.
 *
 * Reuses the dashboard's alert-card / rank-card visual language (see AlertCard
 * and RankCard) rather than the components themselves: those own dashboard
 * concerns (read/selected state, opening the radar drawer) that don't apply
 * here — picking a card advances the step, it doesn't toggle or drill in.
 */
import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, MapPin, Plane, Tag, TrendingUp, Zap } from 'lucide-react';
import { isSurge } from '../../../types';
import type { DemandAlert, Market } from '../../../types';
import { apiClient } from '../../../services/apiClient';
import { useProfile } from '../../../services/profileContext';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';

interface Props {
  onPicked: (alert: DemandAlert, market: Market) => void;
}

export default function ContentTargetPicker({ onPicked }: Props) {
  const { profile } = useProfile();

  const [alerts, setAlerts] = useState<DemandAlert[] | null>(null);
  const [alertsError, setAlertsError] = useState<unknown | null>(null);

  const [pickedAlert, setPickedAlert] = useState<DemandAlert | null>(null);
  const [markets, setMarkets] = useState<Market[] | null>(null);
  const [marketsError, setMarketsError] = useState<unknown | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient.notifications
      .list()
      .then((list) => {
        if (cancelled) return;
        // Same scoping as the dashboard's myAlerts — a surge that doesn't
        // touch one of the operator's own categories isn't theirs to target.
        setAlerts((list as DemandAlert[]).filter((a) => profile.categories.includes(a.category)));
      })
      .catch((e) => { if (!cancelled) setAlertsError(e); });
    return () => { cancelled = true; };
  }, [profile.categories]);

  function pickAlert(alert: DemandAlert) {
    setPickedAlert(alert);
    setMarketsError(null);
    apiClient.markets
      .forCategory(alert.category)
      .then((list) => setMarkets(list as Market[]))
      .catch((e) => setMarketsError(e));
  }

  function backToAlerts() {
    setPickedAlert(null);
    setMarkets(null);
    setMarketsError(null);
  }

  if (alertsError != null) {
    return (
      <div>
        <p className="ob-step-eyebrow">Step 1 of 2</p>
        <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>Pick a surge alert</h2>
        <ApiErrorPanel error={alertsError} label="Surge alerts" />
      </div>
    );
  }

  // Step 2 — pick a target market for the chosen alert's category.
  if (pickedAlert) {
    return (
      <div>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="ob-step-eyebrow">Step 2 of 2</p>
            <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>
              Pick a target market for {pickedAlert.category}
            </h2>
          </div>
          <button type="button" className="btn-ghost" onClick={backToAlerts}>
            <ArrowLeft size={16} aria-hidden="true" /> Back to alerts
          </button>
        </div>

        {marketsError != null && <ApiErrorPanel error={marketsError} label="Target markets" />}

        {markets == null && marketsError == null && (
          <div className="mt-4 flex flex-col gap-3" aria-hidden="true">
            <div className="skel" style={{ height: 120 }} />
            <div className="skel" style={{ height: 120 }} />
          </div>
        )}

        {markets != null && (
          <div className="mt-4 grid gap-4">
            {markets.map((market) => {
              const isLead = market.rank === 1;
              const hasSpike = market.chartData.some((point) => point.spike === 1);
              return (
                <button
                  key={market.id}
                  type="button"
                  className="rank-card"
                  onClick={() => onPicked(pickedAlert, market)}
                >
                  <div className="rank-head">
                    <span className="rank-no" data-lead={isLead}>{market.rank}</span>
                    <div className="min-w-0 flex-1">
                      <h3 className="heading-sm">{market.name}</h3>
                      <p className="text-meta">
                        {market.city} · {market.distanceKm.toLocaleString()} km to Cebu
                      </p>
                    </div>
                    <div className="rank-score">
                      <b className="num">{market.matchScore}</b>
                      <span className="text-meta">Potential</span>
                    </div>
                  </div>
                  <div className="rank-facts mt-3">
                    <span className="rank-fact" data-direct={market.directFlight}>
                      <Plane size={14} aria-hidden="true" />
                      <b>{market.directFlight ? 'Direct' : 'Via Manila'}</b> · {market.flightHours}
                    </span>
                    <span className="rank-fact">
                      <CalendarClock size={14} aria-hidden="true" />
                      {market.flightFrequency}x / week
                    </span>
                    {hasSpike && (
                      <span className="chip chip--critical ml-auto">
                        <Zap aria-hidden="true" /> Surge active
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Step 1 — pick a surge alert.
  return (
    <div>
      <p className="ob-step-eyebrow">Step 1 of 2</p>
      <h2 className="heading-lg" style={{ margin: '6px 0 8px' }}>Pick a surge alert</h2>
      <p className="body-sm" style={{ marginBottom: 24, maxWidth: '56ch' }}>
        Content Studio generates market-localized captions for one surge at a time. Choose which
        one you're creating content for, then pick a target market for its category.
      </p>

      {alerts == null && (
        <div className="flex flex-col gap-3" aria-hidden="true">
          <div className="skel" style={{ height: 150 }} />
          <div className="skel" style={{ height: 150 }} />
        </div>
      )}

      {alerts != null && alerts.length === 0 && (
        <div className="card">
          <div className="empty">
            <div className="empty-glyph"><Tag aria-hidden="true" /></div>
            <h3 className="heading-sm">No surge alerts for your categories yet</h3>
            <p className="body-sm">
              Nothing is currently trending for {profile.categories.join(', ') || 'your business categories'}.
              There's nothing to create content for until a surge is detected.
            </p>
          </div>
        </div>
      )}

      {alerts != null && alerts.length > 0 && (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <button key={alert.id} type="button" className="alert-card" onClick={() => pickAlert(alert)}>
              <div className="alert-top">
                <span className="text-meta">{alert.date}</span>
                {isSurge(alert) && (
                  <span className="chip chip--critical">
                    <Zap aria-hidden="true" /> Surge
                  </span>
                )}
              </div>
              <h3 className="heading-sm">{alert.title}</h3>
              <p className="body-sm">{alert.alertMessage}</p>
              <div className="chip-row mt-3">
                <span className="chip"><MapPin aria-hidden="true" /> {alert.market}</span>
                <span className="chip"><Tag aria-hidden="true" /> {alert.category}</span>
                <span className="chip"><TrendingUp aria-hidden="true" /> {alert.trend}</span>
              </div>
              <span className="alert-cta">
                Pick this alert <ArrowRight size={15} aria-hidden="true" />
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
