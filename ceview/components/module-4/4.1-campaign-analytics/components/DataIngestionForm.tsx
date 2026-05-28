import React, { useState } from 'react';
import { Activity, PlusCircle, Loader2 } from 'lucide-react';
import DataInputField from './DataInputField';
import { COLORS } from '../../../../constants';
import { api, ApiError } from '../../../../services/apiClient';
import type { ManualIngestResponse } from '../../../../types';

interface DataIngestionFormProps {
  onDataReady: (data: ManualIngestResponse) => void;
}

interface FormState {
  impressions: string;
  clicks: string;
  adSpend: string;
  revenue: string;
  conversions: string;
  bookings: string;
  newCustomers: string;
}

const EMPTY: FormState = {
  impressions: '', clicks: '', adSpend: '', revenue: '',
  conversions: '', bookings: '', newCustomers: '',
};

const DataIngestionForm: React.FC<DataIngestionFormProps> = ({ onDataReady }) => {
  const [formData, setFormData]   = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError]   = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const impressions  = Number(formData.impressions);
    const clicks       = Number(formData.clicks);
    const adSpend      = Number(formData.adSpend);
    const revenue      = Number(formData.revenue);
    const conversions  = Number(formData.conversions);
    const bookings     = Number(formData.bookings);
    const newCustomers = Number(formData.newCustomers);

    if ([impressions, clicks, adSpend, revenue, conversions, bookings, newCustomers].some(v => isNaN(v) || v < 0)) {
      setFormError('All fields must be non-negative numbers.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await api.analyticsManual({
        impressions, clicks, adSpend, revenue, conversions, bookings, newCustomers,
      });
      onDataReady(result);
    } catch (err) {
      console.warn('[Module 4] analyticsManual failed', err);
      const msg = err instanceof ApiError
        ? `Analytics service unavailable [${err.code}]. Please check the backend is running.`
        : 'Analytics service unavailable. Please check the backend is running.';
      setFormError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in space-y-6 pb-12">
      <div className="text-center space-y-2 mb-8">
        <div
          className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 shadow-sm"
          style={{ backgroundColor: COLORS.NAVY, color: COLORS.LIGHT_GOLD }}
        >
          <Activity size={32} />
        </div>
        <h2 className="text-3xl font-bold" style={{ color: COLORS.NAVY }}>No Campaign Data Found</h2>
        <p style={{ color: COLORS.TEXT_MUTED }}>
          Enter your campaign parameters to generate funnel metrics and analytics.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-8 rounded-2xl shadow-sm border border-slate-300 space-y-6">
        <h3 className="text-lg font-bold border-b border-slate-200 pb-4" style={{ color: COLORS.TEXT_MAIN }}>
          Manual Data Ingestion
        </h3>

        {formError && (
          <div className="px-4 py-3 rounded-xl border text-sm font-medium" style={{ backgroundColor: '#FEF2F2', borderColor: '#FECACA', color: '#991B1B' }}>
            {formError}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <DataInputField label="Impressions"    name="impressions"  type="number" placeholder="e.g., 150000" onChange={handleInputChange} />
          <DataInputField label="Clicks"         name="clicks"       type="number" placeholder="e.g., 7200"   onChange={handleInputChange} />
          <DataInputField label="Ad Spend (₱)"  name="adSpend"      type="number" placeholder="e.g., 5000"   onChange={handleInputChange} />
          <DataInputField label="Revenue (₱)"   name="revenue"      type="number" placeholder="e.g., 16000"  onChange={handleInputChange} />
          <DataInputField label="Conversions (Leads)" name="conversions" type="number" placeholder="e.g., 350" onChange={handleInputChange} />
          <DataInputField label="Bookings (Sales)"    name="bookings"    type="number" placeholder="e.g., 180" onChange={handleInputChange} />
          <div className="md:col-span-2">
            <DataInputField label="New Customers" name="newCustomers" type="number" placeholder="e.g., 80" onChange={handleInputChange} />
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full mt-6 py-4 rounded-xl text-white font-bold flex items-center justify-center gap-2 hover:opacity-90 shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          style={{ backgroundColor: COLORS.NAVY }}
        >
          {submitting ? (
            <><Loader2 size={20} className="animate-spin" /> Computing Analytics…</>
          ) : (
            <><PlusCircle size={20} /> Generate Campaign Analytics</>
          )}
        </button>
      </form>
    </div>
  );
};

export default DataIngestionForm;
