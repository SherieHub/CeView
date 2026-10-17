import React, { useState, useEffect } from 'react';
import { useAttributionLinks } from '../../../services/useAttributionLinks';
import { useLinkPerformance } from '../../../services/useLinkPerformance';
import CreativePerformanceTable from './CreativePerformanceTable';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';

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

  if (linksError) {
    return (
      <div className="card">
        <ApiErrorPanel error={linksError} onRetry={refreshLinks} label="Link-attributed evidence — campaign links" />
      </div>
    );
  }

  if (!links) {
    return (
      <div className="card">
        <p className="body-sm">Loading links...</p>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="card">
        <h3 className="heading-sm">Link-attributed evidence</h3>
        <div className="empty">
          <p className="mx-auto">No tracked campaign links yet.</p>
        </div>
      </div>
    );
  }

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
  };

  return (
    <div className="space-y-4">
      <div className="card">
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

      {perfError ? (
        <div className="card">
          <ApiErrorPanel error={perfError} onRetry={refreshPerf} label="Link-attributed evidence — creative performance" />
        </div>
      ) : perfLoading || !performance ? (
        <div className="card">
          <p className="body-sm">Loading performance...</p>
        </div>
      ) : (
        <CreativePerformanceTable performance={performance} />
      )}
    </div>
  );
}
