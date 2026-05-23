import React, { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import DataIngestionForm from '../../modules/module-4/DataIngestionForm';
import EngagementMetricsBoard from '../../modules/module-4/EngagementMetricsBoard';
import CustomerJourneyFunnel from '../../modules/module-4/CustomerJourneyFunnel';
import PESComputationBoard from '../../modules/module-4/PESComputationBoard';
import AIActionPlanReport from '../../modules/module-4/AIActionPlanReport';

const CampaignAnalyticsView: React.FC = () => {
  const [hasData, setHasData] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '2026-05-01', end: '2026-05-14' });

  // Module 4 Mock Data
  const mockMetrics = {
    ctr: { value: 4.8, unit: '%', trend: 1.2, isPositive: true },
    cpc: { value: 60.25, unit: '₱', trend: -0.05, isPositive: true }, 
    roas: { value: 3.2, unit: 'x', trend: 0.4, isPositive: true },
    convRate: { value: 2.5, unit: '%', trend: -0.5, isPositive: false },
    cac: { value: 2520.00, unit: '₱', trend: 5.00, isPositive: false } 
  };

  const mockFunnelData = [
    { stage: 'Impressions', value: 150000, dropoff: null },
    { stage: 'Clicks', value: 7200, dropoff: '-95.2%' },
    { stage: 'Conversions', value: 850, dropoff: '-88.1%' },
    { stage: 'Bookings', value: 180, dropoff: '-78.8%' }
  ];

  if (!hasData) {
    return <DataIngestionForm onSimulateSubmit={() => setHasData(true)} />;
  }

  return (
    <div className="animate-fade-in pb-12 max-w-6xl mx-auto">
      <button 
        onClick={() => setHasData(false)}
        className="flex items-center text-slate-500 hover:text-slate-800 mb-6 font-medium transition-colors"
      >
        <ArrowLeft size={18} className="mr-2" /> Back to Home
      </button>

      <EngagementMetricsBoard 
        mockMetrics={mockMetrics} 
        dateRange={dateRange} 
        setDateRange={setDateRange} 
        isRefreshing={isRefreshing} 
        setIsRefreshing={setIsRefreshing} 
      />
      
      <CustomerJourneyFunnel mockFunnelData={mockFunnelData} />
      <PESComputationBoard />
      <AIActionPlanReport />
    </div>
  );
};

export default CampaignAnalyticsView;