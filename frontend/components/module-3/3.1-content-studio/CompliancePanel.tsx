import { CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { useEffect } from 'react';
// OMCS_RUBRIC_LABELS is a static display map (rubric key -> human label), not
// data the backend serves — kept as a direct fixture import deliberately.
import { OMCS_RUBRIC_LABELS } from '../../../services/fixtures/omcs';
import { apiClient } from '../../../services/apiClient';
import { ApiErrorPanel } from '../../shared/ApiErrorPanel';
import type { ComplianceSlotProps } from './contentStudioTypes';

const STEPS = ['Read caption and platform constraints', 'Analyse publication media', 'Match business profile signals', 'Score visual direction consistency', 'Evaluate audience and cultural fit', 'Create compliance recommendation'];

export default function CompliancePanel({ draft, audit, onAuditChange }: ComplianceSlotProps) {
  const ready = Boolean(draft.agreementChecked && draft.caption.trim() && draft.mediaDataUrl && draft.platforms.length);
  useEffect(() => {
    if (!ready || audit.status !== 'idle') return;
    onAuditChange({ status: 'running', step: 0, result: null });
  }, [ready, audit.status, onAuditChange]);
  useEffect(() => {
    if (audit.status !== 'running') return;
    if (audit.step >= STEPS.length) {
      apiClient.compliance
        .omcsAnalyze({ caption: draft.caption, imageUrl: draft.mediaDataUrl ?? '' })
        .then((result) => onAuditChange({ status: 'complete', step: STEPS.length, result }))
        .catch((e) => onAuditChange({ status: 'error', step: 0, result: null, error: e }));
      return;
    }
    const timer = window.setTimeout(() => onAuditChange({ ...audit, step: audit.step + 1 }), 420);
    return () => window.clearTimeout(timer);
  }, [audit, onAuditChange, draft.caption, draft.mediaDataUrl]);
  const result = audit.result;
  return <section className="card" aria-labelledby="compliance-title">
    <div className="flex items-start gap-3"><span className="conn-ico" aria-hidden="true"><ShieldCheck /></span><div><h2 id="compliance-title" className="heading-lg">Compliance audit</h2><p className="body-sm">Checks the caption and selected media before publishing.</p></div></div>
    {audit.status === 'idle' && <p className="mt-5 rounded-lg bg-mint-pale p-4 text-sm leading-6 text-navy-dark">Add a caption, media, and a publish destination, then confirm authorisation to begin the six-step audit.</p>}
    {audit.status === 'running' && <div className="mt-5 space-y-3" aria-live="polite">{STEPS.map((step, index) => <div key={step} className="flex items-center gap-3 text-sm"><span className="grid h-6 w-6 place-items-center rounded-full bg-mint-pale text-teal-accent">{index < audit.step ? <CheckCircle2 size={15} /> : index === audit.step ? <LoaderCircle size={15} className="animate-spin" /> : index + 1}</span><span className={index <= audit.step ? 'text-navy-dark' : 'text-[var(--color-text-muted)]'}>{step}</span></div>)}</div>}
    {audit.status === 'error' && (
      <div className="mt-5">
        <ApiErrorPanel error={audit.error} label="Compliance audit" />
        <button type="button" className="btn btn--secondary mt-4" onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}><RefreshCw size={16} />Re-run audit</button>
      </div>
    )}
    {result && <div className="mt-5"><div className="flex items-center gap-4"><div className="grid h-20 w-20 place-items-center rounded-full border-8 border-success text-xl font-bold text-navy-dark">{Math.round(result.omcsScore)}</div><div><p className="inline-flex items-center gap-1 rounded-full bg-mint-pale px-3 py-1 text-sm font-semibold text-success"><CheckCircle2 size={15} />{result.status}</p><p className="mt-2 text-sm text-[var(--color-text-muted)]">OMCS score (pass threshold: 70)</p></div></div><p className="mt-4 rounded-lg bg-mint-pale p-3 text-sm leading-6 text-navy-dark">{result.feedback}</p><div className="mt-4 space-y-2">{Object.entries(result.rubricEvaluationData.scores).map(([key, value]) => <div key={key}><div className="flex justify-between gap-4 text-xs text-[var(--color-text-muted)]"><span>{OMCS_RUBRIC_LABELS[key]}</span><span>{value}/100</span></div><div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-light"><div className="h-full bg-teal-accent" style={{ width: `${value}%` }} /></div></div>)}</div><p className="mt-4 text-sm leading-6 text-[var(--color-text-muted)]">{result.consistencyExplanation}</p><button type="button" className="btn btn--secondary mt-4" onClick={() => onAuditChange({ status: 'idle', step: 0, result: null })}><RefreshCw size={16} />Re-run audit</button></div>}
  </section>;
}
