import React, { useState, useEffect } from 'react';
import { useAttributionLinks } from '../../../services/useAttributionLinks';
import { useLinkPerformance } from '../../../services/useLinkPerformance';
import CreativePerformanceTable from './CreativePerformanceTable';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import { AttributionLink } from '../../../types';

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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <ApiErrorPanel error={linksError} onRetry={refreshLinks} />
      </div>
    );
  }

  if (!links) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <p className="text-gray-500">Loading links...</p>
      </div>
    );
  }

  if (links.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-1">Link-attributed evidence</h3>
        <div className="py-8 text-center text-gray-500">
          <p>No tracked campaign links yet.</p>
        </div>
      </div>
    );
  }

  const selectedLink = links.find(l => l.linkId === selectedLinkId);

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Campaign link</label>
        <select
          className="w-full border-gray-300 rounded-md shadow-sm text-sm p-2 border focus:ring-blue-500 focus:border-blue-500"
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <ApiErrorPanel error={perfError} onRetry={refreshPerf} />
        </div>
      ) : perfLoading || !performance ? (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <p className="text-gray-500">Loading performance...</p>
        </div>
      ) : (
        <CreativePerformanceTable performance={performance} />
      )}
    </div>
  );
}
