import { useEffect, useRef, useState } from 'react';
import { apiClient } from '../../../services/apiClient';
import type { AttributionVoucher } from '../../../types';

export default function CvLaunchVoucherCard() {
  const [voucher, setVoucher] = useState<AttributionVoucher | null>(null);
  const [grossRevenue, setGrossRevenue] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const redeeming = useRef(false);
  useEffect(() => { apiClient.vouchers.list().then(rows => setVoucher(rows.find(row => row.code === 'CVLAUNCH') ?? null)).catch(() => setMessage('Voucher data is unavailable.')); }, []);
  if (!voucher) return <div className="card body-sm">{message || 'No CVLAUNCH voucher is active.'}</div>;
  const exhausted = voucher.voucherStatus !== 'ACTIVE' || voucher.redemptionsRemaining === 0;
  async function redeem() {
    if (!voucher || redeeming.current || !grossRevenue.trim() || !Number.isFinite(Number(grossRevenue)) || Number(grossRevenue) < 0) return;
    redeeming.current = true;
    setPending(true);
    const activeVoucher = voucher;
    try {
    const result = await apiClient.vouchers.redeem(activeVoucher.attributionCodeId, Number(grossRevenue));
    setVoucher({ ...activeVoucher, redemptionsUsed: activeVoucher.redemptionsUsed + 1, redemptionsRemaining: result.redemptionsRemaining, voucherStatus: result.redemptionsRemaining === 0 ? 'EXHAUSTED' : 'ACTIVE' });
    setMessage(`Recorded: PHP ${result.grossRevenue.toFixed(2)} gross, PHP ${result.netRevenue.toFixed(2)} net.`); setGrossRevenue('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Voucher redemption failed. Please try again.');
    } finally {
      redeeming.current = false;
      setPending(false);
    }
  }
  return <div className="card body-sm space-y-3"><p><strong>CVLAUNCH</strong> — PHP 50 off every booking.</p><p>{voucher.redemptionsUsed} / {voucher.redemptionLimit} redeemed · {voucher.redemptionsRemaining} remaining</p>
    <label>Gross booking amount<input aria-label="Gross booking amount" type="number" min="0" value={grossRevenue} onChange={e => setGrossRevenue(e.target.value)} disabled={exhausted} /></label>
    <button type="button" onClick={redeem} disabled={pending || exhausted || !grossRevenue || Number(grossRevenue) < 0}> {pending ? 'Recording…' : exhausted ? 'Voucher unavailable' : 'Redeem CVLAUNCH'} </button>{message && <p role="status">{message}</p>}</div>;
}
