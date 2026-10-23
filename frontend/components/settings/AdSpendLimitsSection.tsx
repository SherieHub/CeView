/**
 * Settings -> Platforms: the business's own ceilings on what CeView-created Meta ads may spend.
 *
 * Paid ads are blocked in the Publish window until both are saved, so the form makes them hard to
 * get wrong: positive amounts in the ad account's currency (kept to that currency's decimals),
 * the total at least the daily amount. The server enforces the same rules and counts the ads that
 * are already running against the total.
 */
import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { useToast } from '../shared/Toast';
import { apiClient } from '../../services/apiClient';
import { formatMinor, minorFactor } from '../module-3/3.1-content-studio/adRules';
import type { AdConnection, AdSpendLimits } from '../../types';

/** Whole minor units from what was typed, or null when it is not a positive amount in this currency. */
function toMinor(text: string, factor: number): number | null {
  const digits = Math.round(Math.log10(factor));
  if (!/^\d+(\.\d+)?$/.test(text.trim())) return null;
  const decimals = text.includes('.') ? text.trim().split('.')[1].length : 0;
  if (decimals > digits) return null;
  const minor = Math.round(Number(text) * factor);
  return minor >= 1 ? minor : null;
}

export default function AdSpendLimitsSection({ meta }: { meta: AdConnection | null }) {
  const { showToast } = useToast();
  const active = meta?.status === 'ACTIVE' && Boolean(meta.currency);
  const [limits, setLimits] = useState<AdSpendLimits | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [dailyText, setDailyText] = useState('');
  const [totalText, setTotalText] = useState('');
  const [saving, setSaving] = useState(false);

  const currency = limits?.currency ?? meta?.currency ?? 'PHP';
  const factor = minorFactor(currency);
  const fill = (value: AdSpendLimits) => {
    setLimits(value);
    setDailyText(value.maxDailyMinor == null ? '' : String(value.maxDailyMinor / minorFactor(value.currency)));
    setTotalText(value.maxTotalMinor == null ? '' : String(value.maxTotalMinor / minorFactor(value.currency)));
  };

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setLoadFailed(false);
    apiClient.adConnections.limits.get()
      .then((value) => { if (!cancelled) fill(value); })
      .catch(() => { if (!cancelled) setLoadFailed(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, meta?.currency]);

  const daily = toMinor(dailyText, factor);
  const total = toMinor(totalText, factor);
  const totalBelowDaily = daily != null && total != null && total < daily;
  const valid = daily != null && total != null && !totalBelowDaily;
  const unchanged = limits?.configured === true && limits.maxDailyMinor === daily && limits.maxTotalMinor === total;

  async function save() {
    if (!valid || daily == null || total == null) return;
    setSaving(true);
    try {
      fill(await apiClient.adConnections.limits.save(daily, total));
      showToast('Limits saved');
    } catch {
      showToast('Could not save the limits. Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="pf-card pf-panel" id="pf-ad-limits" aria-labelledby="pf-ad-limits-title">
      <div className="pf-panel-head pf-panel-head--light">
        <span className="pf-panel-icon" aria-hidden="true"><ShieldCheck size={22} /></span>
        <div>
          <h2 id="pf-ad-limits-title" className="pf-panel-title">Ad spending limits</h2>
          <p className="pf-panel-sub">
            The most CeView may let a paid Meta ad spend, whatever is typed in the Publish window. Ads are
            always created paused, and nothing spends until you launch it in Ads Manager.
          </p>
        </div>
      </div>

      <div className="pf-panel-body">
        {!active ? (
          <p className="pf-note">Connect a Meta ad account above to set spending limits for paid ads.</p>
        ) : loadFailed ? (
          <p className="pf-note pf-note--error">Could not load your spending limits. Check that the backend is running.</p>
        ) : limits === null ? (
          <div className="skel" style={{ height: 72 }} aria-hidden="true" />
        ) : (
          <>
            {!limits.configured && (
              <p className="pf-note">Paid ads stay blocked until you save both limits.</p>
            )}
            <div className="pf-limits">
              <label className="pf-limit-field">
                <span>Daily limit ({currency})</span>
                <input inputMode="decimal" value={dailyText} onChange={(e) => setDailyText(e.target.value)} placeholder="e.g. 500" />
                <small>The most one ad may spend in a day.</small>
              </label>
              <label className="pf-limit-field">
                <span>Total limit ({currency})</span>
                <input inputMode="decimal" value={totalText} onChange={(e) => setTotalText(e.target.value)} placeholder="e.g. 10000" />
                <small>The most all your active ads may spend over their whole run.</small>
              </label>
            </div>
            {totalBelowDaily && (
              <p className="pf-note pf-note--error" role="alert">The total limit must be at least the daily limit.</p>
            )}
            {limits.configured && (
              <p className="pf-row-sub">
                Already committed by active ads: {formatMinor(limits.committedMinor, currency)}.
              </p>
            )}
            <div className="pf-limit-actions">
              <button type="button" className="pf-connect" onClick={save} disabled={!valid || unchanged || saving}>
                {saving && <Loader2 className="animate-spin" size={16} aria-hidden="true" />}
                Save limits
              </button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
