import React, { useState } from 'react';
import { Activity, PlusCircle } from 'lucide-react';
import DataInputField from '../../composites/module-4/DataInputField';
import { COLORS } from '../../../constants';

interface DataIngestionFormProps {
  onSimulateSubmit: () => void;
}

const DataIngestionForm: React.FC<DataIngestionFormProps> = ({ onSimulateSubmit }) => {
  const [formData, setFormData] = useState({ impressions: '', clicks: '', adSpend: '', revenue: '', conversions: '', bookings: '', newCustomers: '' });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSimulateSubmit();
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6 pb-12">
      <div className="text-center space-y-2 mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-sm" style={{ backgroundColor: COLORS.NAVY, color: COLORS.LIGHT_GOLD}}>
          <Activity size={32} />
        </div>
        <h2 className="text-3xl font-bold" style={{ color: COLORS.NAVY }}>No Campaign Data Found</h2>
        <p style={{ color: COLORS.TEXT_MUTED }}>Please enter simulated parameters to generate funnel metrics for this period.</p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-300 space-y-6">
        <h3 className="text-lg font-bold border-b border-slate-200 pb-4" style={{ color: COLORS.TEXT_MAIN }}>Manual Data Ingestion</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DataInputField label="Impressions" name="impressions" type="number" placeholder="e.g., 150000" onChange={handleInputChange} />
          <DataInputField label="Clicks" name="clicks" type="number" placeholder="e.g., 7200" onChange={handleInputChange} />
          <DataInputField label="Ad Spend (₱)" name="adSpend" type="number" placeholder="e.g., 5000" onChange={handleInputChange} />
          <DataInputField label="Revenue (₱)" name="revenue" type="number" placeholder="e.g., 1000" onChange={handleInputChange} />
          <DataInputField label="Conversions (Leads)" name="conversions" type="number" placeholder="e.g., 350" onChange={handleInputChange} />
          <DataInputField label="Bookings (Sales)" name="bookings" type="number" placeholder="e.g., 500" onChange={handleInputChange} />
          <div className="md:col-span-2">
            <DataInputField label="New Customers" name="newCustomers" type="number" placeholder="e.g., 80" onChange={handleInputChange} />
          </div>
        </div>
        <button type="submit" className="w-full mt-6 py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 shadow-sm transition-all" style={{ backgroundColor: COLORS.NAVY }}>
          <PlusCircle size={20} /> Generate Campaign Analytics
        </button>
      </form>
    </div>
  );
};

export default DataIngestionForm;