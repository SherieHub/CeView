import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import DropOffBadge from './DropOffBadge';
import { COLORS } from '../../../../constants';

interface CustomerJourneyFunnelProps {
  mockFunnelData: any[];
}

const CustomerJourneyFunnel: React.FC<CustomerJourneyFunnelProps> = ({ mockFunnelData }) => (
  <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 mt-12">
    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 mb-6">
      <h3 className="text-lg font-semibold" style={{ color: COLORS.NAVY }}>Customer Journey (Drop-off Analysis)</h3>
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wider bg-slate-100 px-3 py-1 rounded-full">Impressions → Bookings</span>
    </div>
    <div className="h-[300px] md:h-[350px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart layout="vertical" data={mockFunnelData} margin={{ top: 20, right: 80, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} stroke="#E2E8F0" />
          <XAxis type="number" hide />
          <YAxis dataKey="stage" type="category" axisLine={false} tickLine={false} tick={{ fill: COLORS.TEXT_MUTED, fontWeight: 600, fontSize: 14 }} width={100} />
          <Tooltip cursor={{fill: 'transparent'}} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} formatter={(value: any) => typeof value === 'number' ? value.toLocaleString() : value} />
          <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={40}>
            {mockFunnelData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={index === 0 ? COLORS.NAVY : index === 1 ? COLORS.GOLD : index === 2 ? COLORS.RED_ORANGE : COLORS.TEXT_LIGHT} />
            ))}
            <LabelList dataKey="value" position="right" formatter={(label: any) => label == null ? '' : typeof label === 'number' ? label.toLocaleString() : String(label)} style={{ fill: COLORS.TEXT_MAIN, fontWeight: 'bold', fontSize: 14 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="flex justify-between items-center mt-4 px-[100px]">
      {mockFunnelData.map((stage, idx) => {
        if (idx === 0) return <div key={idx} className="w-10"></div>;
        return <DropOffBadge key={idx} dropoff={stage.dropoff} />;
      })}
    </div>
  </div>
);

export default CustomerJourneyFunnel;
