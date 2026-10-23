import React, { useState, useEffect, useId, useRef } from 'react';
import { apiClient } from '../../../services/apiClient';
import type { UnconvertedClick } from '../../../types';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';

export interface ClickMatchStepProps {
  linkId: string;
  from: string;
  to: string;
  value: string | null;
  onChange(clickId: string | null): void;
}

/**
 * Track 5's optional click-match step, mounted by LogBookingAction with the
 * selected code's link and a lookback window ending at the booking time; a
 * non-null value is submitted as the redemption's clickId.
 * Selecting “None of these” leaves the existing manual booking path unchanged.
 */
export function ClickMatchStep({ linkId, from, to, value, onChange }: ClickMatchStepProps) {
  const [candidates, setCandidates] = useState<UnconvertedClick[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  
  const reqIdRef = useRef(0);
  const groupName = useId();
  // Read at completion time: the effect's closure would otherwise see the value from when the request started.
  const valueRef = useRef(value);
  valueRef.current = value;

  const fetchCandidates = async (currentFrom: string, currentTo: string, currentLinkId: string) => {
    reqIdRef.current += 1;
    const reqId = reqIdRef.current;
    
    setLoading(true);
    setError(null);
    
    try {
      const allClicks = await apiClient.attributionLinks.unconvertedClicks(currentFrom, currentTo);
      if (reqIdRef.current === reqId) {
        const filtered = allClicks.filter(c => c.linkId === currentLinkId);
        setCandidates(filtered);
        setLoading(false);
        
        // Clear selection if it no longer appears in the list
        if (valueRef.current !== null && !filtered.find(c => c.clickId === valueRef.current)) {
          onChange(null);
        }
      }
    } catch (err) {
      if (reqIdRef.current === reqId) {
        setError(err);
        setLoading(false);
      }
    }
  };

  const isFirstRender = useRef(true);

  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    } else {
      // Clear the selection synchronously when window changes
      onChange(null);
    }
    fetchCandidates(from, to, linkId);
    
    return () => {
      reqIdRef.current += 1;
    };
    // We intentionally exclude value/onChange to prevent loops or unnecessary fetches
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, linkId]);

  const clickTime = (iso: string) =>
    new Date(iso).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'Asia/Manila',
    });

  // One row per option: radio, what it is, then platform and time pushed right.
  const row = 'flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-[var(--color-mint-pale-alt)]';
  const radio = 'shrink-0 accent-[var(--color-mint-primary)]';
  const noneOption = (disabled: boolean) => (
    <label className={row}>
      <input
        type="radio"
        name={groupName}
        value=""
        checked={value === null}
        onChange={() => onChange(null)}
        disabled={disabled}
        className={radio}
      />
      <span>None of these</span>
    </label>
  );

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="field-label">Was this from an ad click? (optional)</legend>

      {error ? (
        <div className="flex flex-col gap-2">
          <ApiErrorPanel error={error} onRetry={() => fetchCandidates(from, to, linkId)} />
          <div className="overflow-hidden rounded-[var(--radius-sm)] border border-gray-light bg-white">
            {noneOption(false)}
          </div>
        </div>
      ) : (
        <div className="max-h-56 divide-y divide-[var(--color-gray-light)] overflow-y-auto rounded-[var(--radius-sm)] border border-gray-light bg-white">
          {noneOption(loading)}
          {loading ? (
            <p className="body-xs px-3 py-2 text-[var(--color-text-muted)]">Loading candidates...</p>
          ) : candidates.length === 0 ? (
            <p className="body-xs px-3 py-2 text-[var(--color-text-muted)]">No unconverted clicks found for this time period.</p>
          ) : (
            candidates.map(click => (
              <label key={click.clickId} className={row}>
                <input
                  type="radio"
                  name={groupName}
                  value={click.clickId}
                  checked={value === click.clickId}
                  onChange={() => onChange(click.clickId)}
                  disabled={loading}
                  className={radio}
                />
                {/* Side by side when there is room; on a phone the meta drops
                    under the name rather than truncating it to "Ad a…". */}
                <span className="flex min-w-0 flex-1 flex-col sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                  <span className="min-w-0 sm:truncate">
                    {click.untagged ? 'Organic / untagged' : click.adLabel || `Ad ${click.externalAdId}`}
                  </span>
                  <span className="body-xs whitespace-nowrap text-[var(--color-text-muted)] sm:shrink-0">
                    {click.platform} • {clickTime(click.clickedAt)}
                  </span>
                </span>
              </label>
            ))
          )}
        </div>
      )}
    </fieldset>
  );
}
