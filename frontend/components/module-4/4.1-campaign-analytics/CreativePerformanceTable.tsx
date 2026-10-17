import React from 'react';
import type { LinkPerformance } from '../../../types';

interface Props {
  performance: LinkPerformance;
  /** Inside LinkAttributionPanel's card, which already carries the title. */
  embedded?: boolean;
}

/** The card and its title — left out when the panel around it supplies them. */
function Frame({ embedded, children }: { embedded: boolean; children: React.ReactNode }) {
  if (embedded) return <div className="perf-ev-table">{children}</div>;
  return (
    <div className="card">
      <h3 className="heading-sm">Link-attributed evidence</h3>
      <p className="body-sm mt-2">Machine-observed clicks; conversions include enquiries and operator-matched bookings.</p>
      {children}
    </div>
  );
}

export default function CreativePerformanceTable({ performance, embedded = false }: Props) {
  const rows = [...performance.creatives].sort((a, b) => {
    const diff = b.conversions - a.conversions;
    if (diff !== 0) return diff;
    if (a.externalAdId === b.externalAdId) return 0;
    if (a.externalAdId === null) return 1;
    if (b.externalAdId === null) return -1;
    return a.externalAdId.localeCompare(b.externalAdId);
  });

  const hasObservedClicks = rows.some(row => row.clicks > 0);
  const onlyUntagged = hasObservedClicks && rows.filter(row => row.clicks > 0).every(row => row.untagged);
  
  const pesos = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' });

  if (!hasObservedClicks) {
    return (
      <Frame embedded={embedded}>
        <div className="empty">
          <p className="mx-auto">No tracked clicks yet. Share this campaign's ad URL to begin collecting link-attributed evidence.</p>
        </div>
        <div className="body-xs mt-4 text-[var(--color-text-muted)]">
          Click and conversion counts are a floor, not a census. In-app browsers and tracking prevention can remove tracking parameters.
        </div>
      </Frame>
    );
  }

  return (
    <Frame embedded={embedded}>

      {onlyUntagged && (
        <div role="status" className="mt-4 rounded-[var(--radius-sm)] border border-sand bg-mint-pale-alt px-4 py-3 text-sm text-navy-dark">
          All tracked clicks arrived without a creative ID. If you ran paid ads, the bare link may have been pasted instead of the platform-specific ad URL. Copy the Meta or TikTok ad URL from Content Studio. Organic traffic can also appear here.
        </div>
      )}

      <div className="mt-4 overflow-x-auto">
        <table className="num w-full border-collapse text-left text-sm">
          <caption className="sr">Clicks, conversions and revenue per ad creative, most conversions first</caption>
          <thead>
            <tr className="border-b border-gray-light">
              <th className="py-3 pr-3 font-semibold text-navy-dark">Creative</th>
              <th className="py-3 px-3 whitespace-nowrap font-semibold text-navy-dark text-right">Clicks</th>
              <th className="py-3 px-3 whitespace-nowrap font-semibold text-navy-dark text-right">Conversions</th>
              <th className="py-3 pl-3 whitespace-nowrap font-semibold text-navy-dark text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.externalAdId ?? `untagged-${i}`} className="border-b border-gray-light last:border-0 text-[var(--color-text-body)]">
                <td className="min-w-[8rem] break-words py-3 pr-3 text-navy-dark">{row.untagged ? 'Organic / untagged' : (row.adLabel || `Ad ${row.externalAdId}`)}</td>
                <td className="py-3 px-3 whitespace-nowrap text-right">{row.clicks}</td>
                <td className="py-3 px-3 whitespace-nowrap text-right">{row.conversions}</td>
                <td className="py-3 pl-3 whitespace-nowrap text-right">{pesos.format(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-light font-semibold text-navy-dark">
            <tr>
              <td className="py-3 pr-3">Total</td>
              <td className="py-3 px-3 whitespace-nowrap text-right">{performance.totalClicks}</td>
              <td className="py-3 px-3 whitespace-nowrap text-right">{performance.totalConversions}</td>
              <td className="py-3 pl-3 whitespace-nowrap text-right">{pesos.format(performance.totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="body-xs mt-4 space-y-1 text-[var(--color-text-muted)]">
        <p>An enquiry counts as one conversion; revenue stays ₱0.00 until an amount is recorded.</p>
        <p>Click and conversion counts are a floor, not a census. In-app browsers and tracking prevention can remove tracking parameters.</p>
      </div>
    </Frame>
  );
}
