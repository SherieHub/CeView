import React, { useState, useEffect, useRef } from 'react';
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
 * Track 5's optional click-match step for the promo-code LogBookingAction.
 * The parent is not implemented in this checkout. Mount with the selected
 * campaign's link/window and submit a non-null value as the redemption clickId.
 * Selecting “None of these” leaves the existing manual booking path unchanged.
 */
export function ClickMatchStep({ linkId, from, to, value, onChange }: ClickMatchStepProps) {
  const [candidates, setCandidates] = useState<UnconvertedClick[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown | null>(null);
  
  const reqIdRef = useRef(0);

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
        if (value !== null && !filtered.find(c => c.clickId === value)) {
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

  return (
    <fieldset className="bg-white rounded-lg border border-gray-200 p-6 flex flex-col space-y-4">
      <legend className="text-lg font-semibold px-2">Was this from an ad click? (optional)</legend>
      
      {error ? (
        <div className="flex flex-col space-y-2">
          <ApiErrorPanel error={error} onRetry={() => fetchCandidates(from, to, linkId)} />
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="clickMatch"
              value=""
              checked={value === null}
              onChange={() => onChange(null)}
              className="form-radio text-blue-600"
            />
            <span>None of these</span>
          </label>
        </div>
      ) : (
        <div className="flex flex-col space-y-3">
          <label className="flex items-center space-x-2">
            <input
              type="radio"
              name="clickMatch"
              value=""
              checked={value === null}
              onChange={() => onChange(null)}
              disabled={loading}
              className="form-radio text-blue-600"
            />
            <span>None of these</span>
          </label>
          
          {loading ? (
            <div className="text-gray-500 py-4">Loading candidates...</div>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-gray-500">No unconverted clicks found for this time period.</p>
          ) : (
            candidates.map(click => (
              <label key={click.clickId} className="flex items-center space-x-2">
                <input
                  type="radio"
                  name="clickMatch"
                  value={click.clickId}
                  checked={value === click.clickId}
                  onChange={() => onChange(click.clickId)}
                  disabled={loading}
                  className="form-radio text-blue-600"
                />
                <div className="flex flex-col">
                  <span>{click.untagged ? 'Organic / untagged' : click.adLabel || `Ad ${click.externalAdId}`}</span>
                  <span className="text-xs text-gray-400">
                    {click.platform} • {new Date(click.clickedAt).toLocaleString('en-US', { timeZone: 'Asia/Manila' })}
                  </span>
                </div>
              </label>
            ))
          )}
        </div>
      )}
    </fieldset>
  );
}
