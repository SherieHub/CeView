import React, { useState, useEffect } from 'react';
import { useAttributionLinks } from '../../../services/useAttributionLinks';
import { useLinkPerformance } from '../../../services/useLinkPerformance';
import CreativePerformanceTable from './CreativePerformanceTable';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import { AttributionLink } from '../../../types';
import { Link2 } from 'lucide-react';

export default function LinkAttributionPanel() {
  const { links, error: linksError, refresh: refreshLinks } = useAttributionLinks();
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);

  useEffect(() => {
    if (links && links.length > 0) {
      if (!selectedLinkId || !links.find(l => l.linkId === selectedLinkId)) {
        setSelectedLinkId(links[0].linkId);
      }
    } else if (links && links.length === 0) {
      setSelectedLinkId(null);
    }
  }, [links, selectedLinkId]);

  const { data: performance, loading: perfLoading, error: perfError, refresh: refreshPerf } = useLinkPerformance(selectedLinkId);

  const selectedLink = links?.find(l => l.linkId === selectedLinkId);
  void selectedLink;

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  };

  // One card: the title, the link picker beside it, and whatever state the
  // evidence is in below.
  return (
    <section className="card perf-ev perf-ev--links" aria-labelledby="perf-ev-links-title">
      <div className="perf-ev-head">
        <span className="perf-ev-icon" aria-hidden="true"><Link2 size={18} /></span>
        <div className="perf-ev-titles">
          <h3 id="perf-ev-links-title" className="perf-ev-title">Link-attributed evidence</h3>
          <p className="perf-ev-sub">Machine-observed clicks; conversions include enquiries and operator-matched bookings.</p>
        </div>
        {links && links.length > 0 && (
          <div className="perf-ev-pick">
            <label htmlFor="link-attribution-select" className="field-label">Campaign link</label>
            <select
              id="link-attribution-select"
              className="input"
              value={selectedLinkId || ''}
              onChange={e => setSelectedLinkId(e.target.value)}
            >
              {links.map(link => (
                <option key={link.linkId} value={link.linkId}>
                  {link.category} • {link.targetMarket} • {formatDate(link.windowStart)} - {formatDate(link.windowEnd)} ({link.slug})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {linksError ? (
        <ApiErrorPanel error={linksError} onRetry={refreshLinks} label="Link-attributed evidence — campaign links" />
      ) : !links ? (
        <p className="body-sm">Loading links...</p>
      ) : links.length === 0 ? (
        <div className="empty">
          <p className="mx-auto">No tracked campaign links yet.</p>
        </div>
      ) : perfError ? (
        <ApiErrorPanel error={perfError} onRetry={refreshPerf} label="Link-attributed evidence — creative performance" />
      ) : perfLoading || !performance ? (
        <p className="body-sm">Loading performance...</p>
      ) : (
        <CreativePerformanceTable performance={performance} embedded />
      )}
    </section>
  );
}
