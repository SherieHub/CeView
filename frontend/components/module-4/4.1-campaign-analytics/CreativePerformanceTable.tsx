import React from 'react';
import type { LinkPerformance } from '../../../types';

interface Props {
  performance: LinkPerformance;
}

export default function CreativePerformanceTable({ performance }: Props) {
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
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h3 className="text-lg font-semibold mb-1">Link-attributed evidence</h3>
        <p className="text-sm text-gray-500 mb-6">Machine-observed clicks; conversions include enquiries and operator-matched bookings.</p>
        <div className="py-8 text-center text-gray-500">
          <p>No tracked clicks yet. Share this campaign's ad URL to begin collecting link-attributed evidence.</p>
        </div>
        <div className="mt-6 text-xs text-gray-400">
          Click and conversion counts are a floor, not a census. In-app browsers and tracking prevention can remove tracking parameters.
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h3 className="text-lg font-semibold mb-1">Link-attributed evidence</h3>
      <p className="text-sm text-gray-500 mb-4">Machine-observed clicks; conversions include enquiries and operator-matched bookings.</p>

      {onlyUntagged && (
        <div className="mb-4 p-3 bg-amber-50 text-amber-800 text-sm rounded border border-amber-200">
          All tracked clicks arrived without a creative ID. If you ran paid ads, the bare link may have been pasted instead of the platform-specific ad URL. Copy the Meta or TikTok ad URL from Content Studio. Organic traffic can also appear here.
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              <th className="py-3 pr-4 font-medium text-gray-600">Creative</th>
              <th className="py-3 px-4 font-medium text-gray-600 text-right">Clicks</th>
              <th className="py-3 px-4 font-medium text-gray-600 text-right">Conversions</th>
              <th className="py-3 pl-4 font-medium text-gray-600 text-right">Revenue</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={row.externalAdId ?? `untagged-${i}`} className="border-b border-gray-100 last:border-0">
                <td className="py-3 pr-4">{row.untagged ? 'Organic / untagged' : (row.adLabel || `Ad ${row.externalAdId}`)}</td>
                <td className="py-3 px-4 text-right">{row.clicks}</td>
                <td className="py-3 px-4 text-right">{row.conversions}</td>
                <td className="py-3 pl-4 text-right">{pesos.format(row.revenue)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-gray-200 font-semibold">
            <tr>
              <td className="py-3 pr-4">Total</td>
              <td className="py-3 px-4 text-right">{performance.totalClicks}</td>
              <td className="py-3 px-4 text-right">{performance.totalConversions}</td>
              <td className="py-3 pl-4 text-right">{pesos.format(performance.totalRevenue)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 text-xs text-gray-400 space-y-1">
        <p>An enquiry counts as one conversion; revenue stays ₱0.00 until an amount is recorded.</p>
        <p>Click and conversion counts are a floor, not a census. In-app browsers and tracking prevention can remove tracking parameters.</p>
      </div>
    </div>
  );
}
