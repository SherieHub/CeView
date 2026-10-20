import { useEffect, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import type { AttributionVoucher } from '../../../types';

export default function CvLaunchVoucherCard() {
  const [voucher, setVoucher] = useState<AttributionVoucher | null>(null);
  const [grossRevenue, setGrossRevenue] = useState('');
  const [message, setMessage] = useState('');
  useEffect(() => { apiClient.vouchers.list().then(rows => setVoucher(rows.find(row => row.code === 'CVLAUNCH') ?? null)).catch(() => setMessage('Voucher data is unavailable.')); }, []);
  if (!voucher) return <div className="card body-sm">{message || 'No CVLAUNCH voucher is active.'}</div>;
  const exhausted = voucher.voucherStatus !== 'ACTIVE' || voucher.redemptionsRemaining === 0;
  async function redeem() {
    if (!voucher) return;
    const activeVoucher = voucher;
    const result = await apiClient.vouchers.redeem(activeVoucher.attributionCodeId, Number(grossRevenue));
    setVoucher({ ...activeVoucher, redemptionsUsed: activeVoucher.redemptionsUsed + 1, redemptionsRemaining: result.redemptionsRemaining, voucherStatus: result.redemptionsRemaining === 0 ? 'EXHAUSTED' : 'ACTIVE' });
    setMessage(`Recorded: PHP ${result.grossRevenue.toFixed(2)} gross, PHP ${result.netRevenue.toFixed(2)} net.`); setGrossRevenue('');
  }
  return <div className="card body-sm space-y-3"><p><strong>CVLAUNCH</strong> — PHP 50 off every booking.</p><p>{voucher.redemptionsUsed} / {voucher.redemptionLimit} redeemed · {voucher.redemptionsRemaining} remaining</p>
    <label>Gross booking amount<input aria-label="Gross booking amount" type="number" min="0" value={grossRevenue} onChange={e => setGrossRevenue(e.target.value)} disabled={exhausted} /></label>
    <button type="button" onClick={redeem} disabled={exhausted || !grossRevenue}> {exhausted ? 'Voucher fully redeemed' : 'Redeem CVLAUNCH'} </button>{message && <p>{message}</p>}</div>;
}
